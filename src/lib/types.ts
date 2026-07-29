/**
 * Everything here is in HUF and stored as a plain number of forints.
 * There are no sub-units in practice, so integer forints are the unit of
 * account throughout; no cent/fillér handling is needed.
 */

/** Metadata scraped from a hotel listing URL. Null fields mean "not found". */
export type HotelMeta = {
  title: string | null;
  image: string | null;
  location: string | null;
  siteName: string | null;
};

export type HotelFetchState = "idle" | "loading" | "ok" | "failed";

export type Hotel = {
  id: string;
  url: string;
  /** Total price for the whole stay, for the whole group, in HUF. */
  totalPrice: number;
  /**
   * Card data. Filled from the listing page when that works, from the URL
   * when it doesn't, and directly editable either way — there is no separate
   * "manual" copy to keep in sync.
   */
  meta: HotelMeta;
  fetchState: HotelFetchState;
  /** Why the lookup failed, shown inline next to the editable fields. */
  fetchNote: string;
};

export type Flight = {
  /** IATA codes, uppercased on entry. */
  originCode: string;
  destinationCode: string;
  /** `datetime-local` strings, e.g. "2026-08-14T06:15". Local airport time. */
  outboundDepart: string;
  outboundArrive: string;
  returnDepart: string;
  returnArrive: string;
  carrier: string;
  /**
   * Per person, both directions, in HUF — the figure airlines and search
   * engines actually quote, so it is the one that gets typed. The group total
   * is derived from it and the global head count.
   */
  pricePerPerson: number;
  bookingUrl: string;
};

export type Destination = {
  id: string;
  place: string;
  /** ISO date, "2026-08-14". */
  arrival: string;
  departure: string;
  flight: Flight;
  hotels: Hotel[];
  /** Which hotel feeds the trip total. Null when no hotel is saved yet. */
  chosenHotelId: string | null;
  notes: string;
  createdAt: number;
};

export type TripState = {
  version: 1;
  /** Global across every destination; drives all per-person figures. */
  people: number;
  destinations: Destination[];
};

export const SORT_KEYS = [
  "total",
  "perPerson",
  "perNight",
  "perPersonPerDay",
  "departure",
  "added",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  total: "Teljes költség",
  perPerson: "Fejenként",
  perNight: "Éjszakánként",
  perPersonPerDay: "Fő / nap",
  departure: "Indulás dátuma",
  added: "Legutóbb felvett",
};

export function emptyFlight(): Flight {
  return {
    originCode: "BUD",
    destinationCode: "",
    outboundDepart: "",
    outboundArrive: "",
    returnDepart: "",
    returnArrive: "",
    carrier: "",
    pricePerPerson: 0,
    bookingUrl: "",
  };
}

export function emptyMeta(): HotelMeta {
  return { title: null, image: null, location: null, siteName: null };
}

export function initialTripState(): TripState {
  return { version: 1, people: 2, destinations: [] };
}

/**
 * A named, self-contained set of research. Profiles exist so one browser can
 * hold several unrelated plans — a summer trip, a winter one, someone else's —
 * without their destinations or head counts bleeding into each other.
 */
export type Profile = {
  id: string;
  name: string;
  trip: TripState;
  createdAt: number;
  updatedAt: number;
};

/** The whole localStorage payload. */
export type ProfileStore = {
  version: 2;
  activeProfileId: string;
  profiles: Profile[];
};

export const DEFAULT_PROFILE_NAME = "Alapértelmezett";
