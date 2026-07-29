import type { NextRequest } from "next/server";
import {
  extractHotelMeta,
  isFetchableUrl,
  looksLikeErrorPage,
  metaFromUrl,
  safeHost,
} from "@/lib/og";
import type { HotelMeta } from "@/lib/types";

export type OgSuccess = { ok: true; meta: HotelMeta; finalUrl: string };
/**
 * A failure still carries `fallback`: whatever could be worked out from the
 * URL itself. The client fills the card with it so a blocked lookup leaves the
 * user correcting a name rather than typing one from nothing.
 */
export type OgFailure = { ok: false; reason: string; fallback: HotelMeta };
export type OgResponse = OgSuccess | OgFailure;

/** Listing pages are heavy; stop reading once the head is certainly behind us. */
const MAX_BYTES = 600_000;
/**
 * Comfortably inside Vercel's default serverless limit, so a slow listing site
 * produces this route's own readable error rather than a platform gateway
 * timeout the client can't explain to the user.
 */
const TIMEOUT_MS = 8_000;

/** Deployed ceiling for the whole handler, above the fetch timeout above. */
export const maxDuration = 15;

/**
 * Presenting as a real browser is enough for ordinary hotel sites, which serve
 * their OpenGraph tags to anyone.
 *
 * It is NOT enough for Booking, Airbnb or Expedia: those gate OpenGraph behind
 * an allowlist of named crawlers, and answer everything else with a challenge
 * page (Booking returns a 4 KB body under a 202). The only thing that gets
 * through is impersonating a specific company's crawler, which this app does
 * not do — `metaFromUrl` covers those sites from the URL instead.
 */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9,hu;q=0.8",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function fail(reason: string, target: string, status = 200): Response {
  return Response.json(
    { ok: false, reason, fallback: metaFromUrl(target) } satisfies OgFailure,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Reads a hotel listing URL and returns its OpenGraph card data.
 *
 * Always responds 200 with an `ok` discriminant for reachable-but-unreadable
 * pages: a blocked scrape is an expected outcome the UI handles inline, not an
 * exception, and modelling it as an HTTP error would make the client treat a
 * bot-check the same as a network fault.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return fail("Nem adtál meg linket.", "", 400);

  const check = isFetchableUrl(target.trim());
  if (!check.ok) return fail(check.reason, target, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(check.url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });

    const host = safeHost(check.url.toString()) || "az oldal";

    if (!response.ok) {
      return fail(
        response.status === 403 || response.status === 429
          ? `A(z) ${host} nem engedi az automatikus beolvasást.`
          : `A(z) ${host} ${response.status} hibakóddal válaszolt.`,
        target,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return fail("Ez a link nem weboldalra mutat.", target);
    }

    const html = await readCapped(response);
    if (!html) return fail("Az oldal üresen jött vissza.", target);

    const finalUrl = response.url || check.url.toString();
    const meta = extractHotelMeta(html, finalUrl);

    // A bot wall answers 200 (Booking uses 202) with a few kilobytes and no
    // OpenGraph at all. Treating that as "the page has no metadata" would be
    // technically true and practically useless, so it is called what it is.
    if (!meta.title && !meta.image) {
      return fail(
        html.length < 20_000
          ? `A(z) ${host} nem engedi az automatikus beolvasást.`
          : `Nem találtam adatokat itt: ${host}.`,
        target,
      );
    }

    // An error page still has a <title>, and saving it would give the user a
    // hotel called "404 Page Not Found".
    if (!meta.image && looksLikeErrorPage(meta.title)) {
      return fail(`A(z) ${host} hibaoldalt adott vissza.`, target);
    }

    return Response.json({ ok: true, meta, finalUrl } satisfies OgSuccess, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return fail("Az oldal túl sokáig válaszolt.", target);
    }
    return fail("Nem sikerült elérni a linket.", target);
  } finally {
    clearTimeout(timeout);
  }
}

/** Streams the response body up to MAX_BYTES, then drops the connection. */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;

  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      // The head is all we parse, so stop as soon as it closes.
      if (chunks.length % 4 === 0 && chunks.join("").search(/<\/head>/i) !== -1)
        break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return chunks.join("");
}
