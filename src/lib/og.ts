import type { HotelMeta } from "./types";

/** Named entities that actually show up in listing titles. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  ccedil: "ç",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    );
}

/**
 * Pulls every `<meta>` tag into a lookup keyed by both `property` and `name`,
 * plus the document `<title>`. Deliberately regex-based rather than a DOM
 * parser: listing pages are large and malformed, we only need a handful of
 * head tags, and this avoids pulling a parser dependency into the bundle.
 */
export function parseMetaTags(html: string): Map<string, string> {
  const out = new Map<string, string>();
  // Only the head matters, and stopping there avoids scanning megabytes of
  // review markup on a Booking page.
  const headEnd = html.search(/<\/head>/i);
  const scope =
    headEnd === -1 ? html.slice(0, 250_000) : html.slice(0, headEnd);

  const metaTag = /<meta\b[^>]*>/gi;
  for (const [tag] of scope.matchAll(metaTag)) {
    const key =
      /\bproperty\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bname\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bitemprop\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (!key || content === undefined) continue;
    const normalized = key.toLowerCase();
    // First tag wins: pages often repeat og:image with lower-res variants.
    if (!out.has(normalized))
      out.set(normalized, decodeEntities(content).trim());
  }

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(scope)?.[1];
  if (title && !out.has("__title")) {
    out.set("__title", decodeEntities(title).replace(/\s+/g, " ").trim());
  }
  return out;
}

function pick(tags: Map<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = tags.get(key);
    if (value) return value;
  }
  return null;
}

/** Resolves a possibly-protocol-relative or root-relative image URL. */
function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * Booking wraps the hotel name in boilerplate that changes by locale and by
 * A/B bucket, so several shapes are stripped rather than one.
 */
function cleanBookingTitle(raw: string): string {
  return raw
    .replace(/^Booking\.com\s*[::]\s*/i, "")
    .replace(/\s*[-–—]\s*Updated\s+\d{4}\s+Prices?\s*$/i, "")
    .replace(/\s*[-–—]\s*Frissítve\s+\d{4}\s*.*$/i, "")
    .replace(
      /\s*[-–—]\s*\d[\d\s.,]*\s*(Guest reviews?|vendégértékelés).*$/i,
      "",
    )
    .replace(/\s*[-–—]\s*(Book your hotel now|Foglalj most)!?\s*$/i, "")
    .replace(/,?\s*Updated\s+\d{4}\s+Prices?\s*$/i, "")
    .trim();
}

/**
 * Splits "Hotel Sacher Wien, Vienna, Austria" into name and location. The
 * first comma-separated chunk is the property; the rest is where it is.
 * Returns a null location when there's nothing after the name to use, which
 * the UI turns into an editable field rather than inventing a place.
 */
function splitNameAndLocation(title: string): {
  title: string;
  location: string | null;
} {
  const parts = title
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { title, location: null };
  return { title: parts[0], location: parts.slice(1).join(", ") };
}

/** Airbnb titles read "Condo in Split, Croatia · ★4.92 · 2 bedrooms · …". */
function cleanAirbnbTitle(raw: string): {
  title: string;
  location: string | null;
} {
  const [head] = raw.split("·").map((p) => p.trim());
  const inMatch = /^(.*?)\s+in\s+(.+)$/i.exec(head ?? raw);
  if (inMatch) {
    return { title: inMatch[1].trim(), location: inMatch[2].trim() };
  }
  return { title: (head ?? raw).trim(), location: null };
}

/**
 * Turns scraped head tags into the four fields the hotel card renders.
 * Host-specific handling exists only where the generic OG values are known to
 * be noisy; everything else falls through to plain OpenGraph.
 */
export function extractHotelMeta(html: string, finalUrl: string): HotelMeta {
  const tags = parseMetaTags(html);
  const host = safeHost(finalUrl);

  const image = absoluteUrl(
    pick(
      tags,
      "og:image:secure_url",
      "og:image:url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ),
    finalUrl,
  );
  const siteName = pick(tags, "og:site_name") ?? host;
  const rawTitle = pick(tags, "og:title", "twitter:title", "__title") ?? null;
  const description = pick(
    tags,
    "og:description",
    "twitter:description",
    "description",
  );

  // Facebook place tags, when a listing bothers to emit them, beat any
  // heuristic pulled out of the title string.
  const placeLocation = [
    pick(tags, "og:locality", "place:location:locality"),
    pick(tags, "og:region", "place:location:region"),
    pick(tags, "og:country_name", "place:location:country_name"),
  ]
    .filter(Boolean)
    .join(", ");

  let title = rawTitle;
  let location: string | null = placeLocation || null;

  if (host.includes("booking.")) {
    if (rawTitle) {
      const split = splitNameAndLocation(cleanBookingTitle(rawTitle));
      title = split.title;
      location ??= split.location;
    }
    // Booking URLs carry the country as an ISO code: /hotel/at/sacher.html
    location ??= countryFromBookingUrl(finalUrl);
  } else if (host.includes("airbnb.")) {
    if (rawTitle) {
      const split = cleanAirbnbTitle(rawTitle);
      title = split.title;
      location ??= split.location;
    }
  } else if (rawTitle && !location) {
    const split = splitNameAndLocation(rawTitle);
    // Only trust the comma split when the tail looks like a place rather than
    // a marketing clause.
    if (
      split.location &&
      split.location.length <= 60 &&
      !/\d/.test(split.location)
    ) {
      title = split.title;
      location = split.location;
    }
  }

  location ??= locationFromDescription(description);

  return {
    title: title?.slice(0, 160) || null,
    image,
    location: location?.slice(0, 120) || null,
    siteName: siteName || null,
  };
}

const BOOKING_COUNTRIES: Record<string, string> = {
  at: "Ausztria",
  hr: "Horvátország",
  cz: "Csehország",
  fr: "Franciaország",
  de: "Németország",
  gr: "Görögország",
  hu: "Magyarország",
  it: "Olaszország",
  nl: "Hollandia",
  pl: "Lengyelország",
  pt: "Portugália",
  ro: "Románia",
  sk: "Szlovákia",
  si: "Szlovénia",
  es: "Spanyolország",
  ch: "Svájc",
  gb: "Egyesült Királyság",
  tr: "Törökország",
  rs: "Szerbia",
  me: "Montenegró",
  al: "Albánia",
  ba: "Bosznia-Hercegovina",
  bg: "Bulgária",
  dk: "Dánia",
  se: "Svédország",
  no: "Norvégia",
  fi: "Finnország",
  ie: "Írország",
  be: "Belgium",
  ee: "Észtország",
  lv: "Lettország",
  lt: "Litvánia",
  mt: "Málta",
  cy: "Ciprus",
  is: "Izland",
  ua: "Ukrajna",
  ma: "Marokkó",
  eg: "Egyiptom",
  ae: "Egyesült Arab Emírségek",
  us: "Egyesült Államok",
};

function countryFromBookingUrl(url: string): string | null {
  const code = /\/hotel\/([a-z]{2})\//i.exec(url)?.[1]?.toLowerCase();
  return code ? (BOOKING_COUNTRIES[code] ?? null) : null;
}

/** "austria-trend-europa-wien" -> "Austria Trend Europa Wien" */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) =>
      // Short joining words stay lowercase unless they lead.
      /^(am|an|and|de|del|der|des|di|du|el|es|im|in|la|le|les|of|the|und|van|von|zum|zur)$/i.test(
        word,
      )
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * What can be worked out from the URL alone, with no network at all.
 *
 * This is the load-bearing path, not a nicety: Booking, Airbnb and Expedia all
 * refuse to serve OpenGraph data to anything outside their crawler allowlist,
 * so for the two sites this app is actually pointed at, the pasted URL is the
 * only source of truth available. Booking's path carries the property slug and
 * an ISO country code, which between them give a real name and a real country
 * without asking the user to retype either.
 */
export function metaFromUrl(raw: string): HotelMeta {
  const host = safeHost(raw);
  const empty: HotelMeta = {
    title: null,
    image: null,
    location: null,
    siteName: host || null,
  };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return empty;
  }

  if (host.includes("booking.")) {
    // /hotel/at/austria-trend-europa-wien.hu.html
    const slug = /\/hotel\/[a-z]{2}\/([^/.]+)/i.exec(url.pathname)?.[1];
    return {
      ...empty,
      title: slug ? titleCaseSlug(slug) : null,
      location: countryFromBookingUrl(raw),
    };
  }

  if (host.includes("airbnb.")) {
    const id = /\/rooms\/(?:plus\/)?(\d+)/.exec(url.pathname)?.[1];
    return { ...empty, title: id ? `Airbnb szállás #${id}` : null };
  }

  // Any other site: the last meaningful path segment is usually the name.
  const segment = url.pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/\.(html?|php|aspx?)$/i, "");
  return {
    ...empty,
    title:
      segment && segment.length > 2 ? titleCaseSlug(segment) : host || null,
  };
}

/**
 * Titles that mean "you didn't get the page you asked for". Without this a
 * bot wall or a dead listing saves as a hotel literally named "404 Page Not
 * Found", which looks like data and isn't.
 */
export function looksLikeErrorPage(title: string | null): boolean {
  if (!title) return false;
  return /\b(404|403|429|not found|page not found|access denied|forbidden|error|are you a robot|just a moment|attention required|hozzáférés megtagadva|az oldal nem található|nem található)\b/i.test(
    title,
  );
}

/**
 * Last-ditch: descriptions usually open with the place. Booking serves the
 * Hungarian copy on the .hu domain and English elsewhere, so both phrasings
 * are worth a try before giving up and asking the user.
 */
function locationFromDescription(description: string | null): string | null {
  if (!description) return null;
  const english =
    /\b(?:located|set|situated)\s+in\s+([A-Z][\w'’\-.]*(?:\s+[A-Z][\w'’\-.]*){0,3})/.exec(
      description,
    );
  if (english?.[1]) return english[1].trim();
  // "…Bécs városában található" / "…Bécsben található"
  const hungarian =
    /\b([A-ZÁÉÍÓÖŐÚÜŰ][\wáéíóöőúüű'’\-.]+)(?:\s+városában)?\s+található/.exec(
      description,
    );
  return hungarian?.[1]?.trim() ?? null;
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Blocks loopback, link-local, and RFC1918 targets so a pasted URL can't be
 * used to make the server probe the machine it runs on. This is a literal
 * check on the hostname, not a resolved-IP check, which is the right level of
 * paranoia for a locally-run personal tool.
 */
export function isFetchableUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Ez nem tűnik érvényes linknek." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      reason: "Csak http és https linkeket tudok beolvasni.",
    };
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    return { ok: false, reason: "Helyi címeket nem tudok beolvasni." };
  }
  return { ok: true, url };
}
