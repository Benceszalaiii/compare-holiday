import { newId } from "./id";
import type {
  Destination,
  Hotel,
  HotelFetchState,
  Profile,
  ProfileStore,
  TripState,
} from "./types";
import { DEFAULT_PROFILE_NAME, initialTripState } from "./types";

/** Pre-profiles payload: a single bare TripState. */
const LEGACY_KEY = "compare-holiday:v1";
const STORAGE_KEY = "compare-holiday:v2";

function readRaw(key: string): unknown {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Private browsing or a storage-blocked context.
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function emptyProfile(name = DEFAULT_PROFILE_NAME): Profile {
  const now = Date.now();
  return {
    id: newId(),
    name,
    trip: initialTripState(),
    createdAt: now,
    updatedAt: now,
  };
}

export function initialProfileStore(): ProfileStore {
  const profile = emptyProfile();
  return { version: 2, activeProfileId: profile.id, profiles: [profile] };
}

/**
 * Reads saved research, migrating the pre-profiles payload when it finds one.
 *
 * A corrupt blob surfaces as "no data" rather than throwing, because the
 * alternative is a blank white screen over a JSON typo.
 */
export function loadStore(): ProfileStore | null {
  const current = readRaw(STORAGE_KEY);
  if (current !== null) return normalizeStore(current);

  // Nothing under v2 — adopt a single-trip payload as the first profile. The
  // v1 key is deliberately left in place as a free rollback copy.
  const legacy = readRaw(LEGACY_KEY);
  if (legacy === null) return null;
  const trip = normalizeTrip(legacy);
  if (!trip) return null;

  const profile: Profile = { ...emptyProfile(), trip };
  return { version: 2, activeProfileId: profile.id, profiles: [profile] };
}

export function saveStore(store: ProfileStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage blocked. The in-memory state stays valid for
    // this session; there is nothing useful to tell the user mid-keystroke.
  }
}

export function clearStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

/** Coerces an arbitrary blob into a usable ProfileStore. */
function normalizeStore(input: unknown): ProfileStore | null {
  if (typeof input !== "object" || input === null) return null;
  const root = input as Record<string, unknown>;
  const rawProfiles = Array.isArray(root.profiles) ? root.profiles : [];

  const profiles: Profile[] = rawProfiles.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const p = entry as Record<string, unknown>;
    const trip = normalizeTrip(p.trip);
    if (!trip) return [];
    const now = Date.now();
    return [
      {
        id: str(p.id) || newId(),
        name: str(p.name) || DEFAULT_PROFILE_NAME,
        trip,
        createdAt: num(p.createdAt, now),
        updatedAt: num(p.updatedAt, now),
      },
    ];
  });

  // A store with no readable profiles is indistinguishable from no store.
  if (profiles.length === 0) return null;

  const activeId = str(root.activeProfileId);
  return {
    version: 2,
    // A dangling active id would render an empty app over intact data.
    activeProfileId: profiles.some((p) => p.id === activeId)
      ? activeId
      : profiles[0].id,
    profiles,
  };
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * A fetch that was mid-flight when the tab closed resumes as idle, never as a
 * permanently spinning skeleton.
 */
function fetchState(value: unknown): HotelFetchState {
  return value === "ok" || value === "failed" ? value : "idle";
}

/**
 * Flight prices used to be stored as a group total. Anything saved under the
 * old shape is divided by the head count so the trip total it produced stays
 * the same figure the user was comparing against.
 */
function flightPricePerPerson(
  flightRaw: Record<string, unknown>,
  people: number,
): number {
  if (typeof flightRaw.pricePerPerson === "number") {
    return num(flightRaw.pricePerPerson);
  }
  const legacyTotal = num(flightRaw.totalPrice);
  return legacyTotal > 0 ? Math.round(legacyTotal / Math.max(1, people)) : 0;
}

/**
 * Coerces an arbitrary parsed blob into a valid TripState. Every field is
 * defaulted rather than trusted, so a payload hand-edited in devtools, pasted
 * in from another machine, or left behind by an older shape still loads
 * instead of throwing at render time.
 */
export function normalizeTrip(input: unknown): TripState | null {
  if (typeof input !== "object" || input === null) return null;
  const root = input as Record<string, unknown>;
  const rawDestinations = Array.isArray(root.destinations)
    ? root.destinations
    : [];

  // Resolved before the loop because the legacy flight-price migration needs
  // the head count to convert a stored group total into a per-person figure.
  const people = Math.max(
    1,
    Math.round(num(root.people, initialTripState().people)),
  );

  const destinations: Destination[] = rawDestinations.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const d = entry as Record<string, unknown>;
    const flightRaw =
      typeof d.flight === "object" && d.flight !== null
        ? (d.flight as Record<string, unknown>)
        : {};
    const hotelsRaw = Array.isArray(d.hotels) ? d.hotels : [];

    const hotels: Hotel[] = hotelsRaw.flatMap((h) => {
      if (typeof h !== "object" || h === null) return [];
      const hotel = h as Record<string, unknown>;
      const metaRaw =
        typeof hotel.meta === "object" && hotel.meta !== null
          ? (hotel.meta as Record<string, unknown>)
          : {};
      return [
        {
          id: str(hotel.id) || newId(),
          url: str(hotel.url),
          totalPrice: num(hotel.totalPrice),
          meta: {
            title: nullableStr(metaRaw.title),
            image: nullableStr(metaRaw.image),
            location: nullableStr(metaRaw.location),
            siteName: nullableStr(metaRaw.siteName),
          },
          fetchState: fetchState(hotel.fetchState),
          fetchNote: str(hotel.fetchNote),
        },
      ];
    });

    const chosenId = str(d.chosenHotelId) || null;

    return [
      {
        id: str(d.id) || newId(),
        place: str(d.place),
        arrival: str(d.arrival),
        departure: str(d.departure),
        flight: {
          originCode: str(flightRaw.originCode, "BUD"),
          destinationCode: str(flightRaw.destinationCode),
          outboundDepart: str(flightRaw.outboundDepart),
          outboundArrive: str(flightRaw.outboundArrive),
          returnDepart: str(flightRaw.returnDepart),
          returnArrive: str(flightRaw.returnArrive),
          carrier: str(flightRaw.carrier),
          pricePerPerson: flightPricePerPerson(flightRaw, people),
          bookingUrl: str(flightRaw.bookingUrl),
        },
        hotels,
        // Drop a dangling reference to a hotel that no longer exists.
        chosenHotelId: hotels.some((h) => h.id === chosenId) ? chosenId : null,
        notes: str(d.notes),
        createdAt: num(d.createdAt, Date.now()),
      },
    ];
  });

  return { version: 1, people, destinations };
}

export { LEGACY_KEY, STORAGE_KEY };
