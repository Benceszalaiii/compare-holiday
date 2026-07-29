import { newId } from "./id";
import { normalizeTrip } from "./storage";
import type { Destination, Profile, TripState } from "./types";
import { DEFAULT_PROFILE_NAME } from "./types";

/**
 * Marks a string as one of ours and pins the format version, so a mistyped or
 * truncated paste fails with an explanation instead of a stack trace.
 */
const PREFIX = "NYARALAS1:";

/**
 * One destination on its own. A separate prefix from the profile code above,
 * because the two are pasted into different boxes and telling someone "this is
 * the other kind of code" beats letting a profile land in the form.
 */
const DESTINATION_PREFIX = "NYARALASCEL1:";

export type TransferProfile = { name: string; trip: TripState };

type TransferPayload = {
  kind: "compare-holiday-transfer";
  version: 1;
  exportedAt: number;
  profiles: TransferProfile[];
};

/* ------------------------------------------------------------- base64url */

/**
 * `btoa` only accepts Latin-1, and these payloads are full of Hungarian
 * accents and hotel names, so the string is encoded to UTF-8 bytes first.
 */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------------------------------------------------------------- export */

/**
 * Produces one unbroken line of text. Chat apps, email clients and terminals
 * all reflow or re-wrap pasted JSON; a single token with no spaces, quotes or
 * newlines survives that trip intact.
 */
export function encodeTransfer(profiles: TransferProfile[]): string {
  const payload: TransferPayload = {
    kind: "compare-holiday-transfer",
    version: 1,
    exportedAt: Date.now(),
    profiles: profiles.map(({ name, trip }) => ({ name, trip })),
  };
  return PREFIX + toBase64Url(JSON.stringify(payload));
}

/* ---------------------------------------------------------------- import */

export type DecodeResult =
  | { ok: true; profiles: TransferProfile[] }
  | { ok: false; reason: string };

/** Sent when the code is ours but belongs in the other paste box. */
const WRONG_BOX = {
  profile:
    "Ez egy profil kódja. A Profilok panel Betöltés gombjával tudod betölteni.",
  destination:
    "Ez egy úti cél kódja. Nyisd meg az űrlapot, és ott illeszd be a Beillesztés gombbal.",
} as const;

type Envelope =
  | { ok: true; root: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * Unwraps a pasted code down to its parsed object.
 *
 * Accepts the compact prefixed form and also raw exported JSON, because people
 * paste whatever they have to hand. All whitespace is stripped first: a code
 * that has been wrapped across lines by an email client is still a valid code.
 */
function readEnvelope(input: string, prefix: string): Envelope {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Illeszd be a kapott kódot." };

  let json: string;
  if (trimmed.startsWith("{")) {
    json = trimmed;
  } else {
    const compact = trimmed.replace(/\s+/g, "");
    if (!compact.startsWith(prefix)) {
      // Being handed the other kind of code is the likeliest mistake, and the
      // only one where the fix is a different button rather than a re-copy.
      if (prefix !== PREFIX && compact.startsWith(PREFIX)) {
        return { ok: false, reason: WRONG_BOX.profile };
      }
      if (
        prefix !== DESTINATION_PREFIX &&
        compact.startsWith(DESTINATION_PREFIX)
      ) {
        return { ok: false, reason: WRONG_BOX.destination };
      }
      return {
        ok: false,
        reason:
          "Ez nem egy nyaraláshasonlító kód. Ellenőrizd, hogy a teljes szöveget bemásoltad-e.",
      };
    }
    try {
      json = fromBase64Url(compact.slice(prefix.length));
    } catch {
      return {
        ok: false,
        reason:
          "A kód sérült vagy hiányos. Másold ki és illeszd be újra, elejétől a végéig.",
      };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "A kód tartalma olvashatatlan." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "A kód tartalma olvashatatlan." };
  }
  return { ok: true, root: parsed as Record<string, unknown> };
}

/** Reads a pasted profile code. */
export function decodeTransfer(input: string): DecodeResult {
  const envelope = readEnvelope(input, PREFIX);
  if (!envelope.ok) return envelope;

  const root = envelope.root;
  if (root.kind !== "compare-holiday-transfer") {
    return {
      ok: false,
      reason:
        root.kind === "compare-holiday-destination"
          ? WRONG_BOX.destination
          : "Ez a kód nem ehhez az alkalmazáshoz készült.",
    };
  }

  const rawProfiles = Array.isArray(root.profiles) ? root.profiles : [];
  const profiles: TransferProfile[] = rawProfiles.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const p = entry as Record<string, unknown>;
    // Every incoming trip goes through the same normaliser as stored data, so
    // a hand-edited or older export can't put an invalid shape into state.
    const trip = normalizeTrip(p.trip);
    if (!trip) return [];
    return [
      {
        name:
          typeof p.name === "string" && p.name ? p.name : DEFAULT_PROFILE_NAME,
        trip,
      },
    ];
  });

  if (profiles.length === 0) {
    return { ok: false, reason: "A kód nem tartalmaz egyetlen profilt sem." };
  }
  return { ok: true, profiles };
}

/* --------------------------------------------------- a single destination */

type DestinationPayload = {
  kind: "compare-holiday-destination";
  version: 1;
  exportedAt: number;
  /**
   * The head count the figures were entered under. Nothing is recalculated
   * from it — flight prices travel per person — but it lets the normaliser
   * migrate a code produced from an older, group-total shape.
   */
  people: number;
  destination: Destination;
};

/**
 * Packs one destination — dates, flight, every saved hotel, notes — into a
 * code, so a place that has already been researched can be handed to another
 * profile or another person instead of typed in again.
 */
export function encodeDestination(
  destination: Destination,
  people: number,
): string {
  const payload: DestinationPayload = {
    kind: "compare-holiday-destination",
    version: 1,
    exportedAt: Date.now(),
    people,
    destination,
  };
  return DESTINATION_PREFIX + toBase64Url(JSON.stringify(payload));
}

export type DecodeDestinationResult =
  | { ok: true; destination: Destination }
  | { ok: false; reason: string };

/**
 * Reads a pasted destination code. The result carries fresh ids, so filling
 * the form from it can never reach back into the destination it came from —
 * including when both live in the same browser.
 */
export function decodeDestination(input: string): DecodeDestinationResult {
  const envelope = readEnvelope(input, DESTINATION_PREFIX);
  if (!envelope.ok) return envelope;

  const root = envelope.root;
  if (root.kind !== "compare-holiday-destination") {
    return {
      ok: false,
      reason:
        root.kind === "compare-holiday-transfer"
          ? WRONG_BOX.profile
          : "Ez a kód nem ehhez az alkalmazáshoz készült.",
    };
  }

  // Routed through the same normaliser as stored data by wrapping it in a
  // one-destination trip, so a hand-edited or older code can't put an invalid
  // shape into the form.
  const trip = normalizeTrip({
    version: 1,
    people: typeof root.people === "number" ? root.people : 1,
    destinations: [root.destination],
  });
  const destination = trip?.destinations[0];
  if (!destination) {
    return { ok: false, reason: "A kód nem tartalmaz úti célt." };
  }
  return { ok: true, destination: withFreshDestinationIds(destination) };
}

/**
 * Re-keys a destination and its hotels. Used wherever a copy enters the store
 * — a duplicated profile, an imported one, a pasted destination — so no two
 * rows can ever share an id.
 */
export function withFreshDestinationIds(destination: Destination): Destination {
  const hotelIds = new Map(destination.hotels.map((h) => [h.id, newId()]));
  return {
    ...destination,
    id: newId(),
    hotels: destination.hotels.map((h) => ({
      ...h,
      id: hotelIds.get(h.id) ?? newId(),
    })),
    chosenHotelId: destination.chosenHotelId
      ? (hotelIds.get(destination.chosenHotelId) ?? null)
      : null,
  };
}

/* ----------------------------------------------------------------- names */

/**
 * Keeps imported profiles from colliding with existing ones. Importing is
 * always additive, so two profiles called "Nyár" become "Nyár" and
 * "Nyár (2)" rather than one silently replacing the other.
 */
export function uniqueProfileName(name: string, taken: string[]): string {
  const trimmed = name.trim() || DEFAULT_PROFILE_NAME;
  if (!taken.includes(trimmed)) return trimmed;

  // Re-importing an already-numbered name counts from its own number rather
  // than stacking suffixes, so a code exported from "Nyár (2)" comes back as
  // "Nyár (3)" and not "Nyár (2) (2)".
  const base = trimmed.replace(/\s*\(\d+\)$/, "");
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base} (${Date.now()})`;
}

/** A filename-ish summary used in the export panel's description. */
export function describeTransfer(profiles: Profile[]): string {
  const destinations = profiles.reduce(
    (sum, p) => sum + p.trip.destinations.length,
    0,
  );
  const profileWord = profiles.length === 1 ? "profil" : "profil";
  return `${profiles.length} ${profileWord}, ${destinations} úti cél`;
}
