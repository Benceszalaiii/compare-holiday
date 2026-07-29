import type { Destination, Flight, Hotel, SortKey } from "./types";

const MS_PER_DAY = 86_400_000;

/**
 * Parses "2026-08-14" at UTC midnight. Using UTC keeps the night count
 * immune to DST transitions, which otherwise make a late-March trip come out
 * an hour short and floor to one night fewer.
 */
function parseDate(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/**
 * Parses "2026-08-14T06:15" as a wall-clock instant, pinned to UTC so that
 * subtracting two of them yields the difference the user typed rather than a
 * DST-shifted one. Seconds, if the browser supplies them, are discarded.
 */
function parseDateTime(value: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`);
  return Number.isNaN(t) ? null : t;
}

/** Hotel nights between arrival and departure. Null until both dates parse. */
export function nightsBetween(
  arrival: string,
  departure: string,
): number | null {
  const a = parseDate(arrival);
  const d = parseDate(departure);
  if (a === null || d === null) return null;
  const nights = Math.round((d - a) / MS_PER_DAY);
  return nights >= 0 ? nights : null;
}

/** Safe divide: returns null rather than Infinity or NaN. */
function per(total: number, divisor: number | null): number | null {
  if (divisor === null || divisor <= 0) return null;
  if (!Number.isFinite(total)) return null;
  return total / divisor;
}

export function chosenHotel(destination: Destination): Hotel | null {
  const { hotels, chosenHotelId } = destination;
  if (hotels.length === 0) return null;
  return hotels.find((h) => h.id === chosenHotelId) ?? hotels[0];
}

/**
 * Minutes in the air for one leg. Returns null unless both endpoints parse.
 * Note this is wall-clock difference between local airport times, so a
 * BUD->VIE hop reads as 1h05m even though the clocks share a zone; for a
 * cross-zone route the figure is the local-time difference, which is what a
 * booking site shows too.
 */
export function legMinutes(depart: string, arrive: string): number | null {
  const d = parseDateTime(depart);
  const a = parseDateTime(arrive);
  if (d === null || a === null) return null;
  const mins = Math.round((a - d) / 60_000);
  return mins >= 0 ? mins : null;
}

export type Derived = {
  nights: number | null;
  /** Calendar days on the ground, i.e. nights + 1. */
  days: number | null;
  flightTotal: number;
  flightPerPerson: number | null;
  hotelTotal: number;
  hotelPerNight: number | null;
  hotelPerPersonPerNight: number | null;
  tripTotal: number;
  perPerson: number | null;
  perNight: number | null;
  perPersonPerDay: number | null;
  outboundMinutes: number | null;
  returnMinutes: number | null;
  hasFlightPrice: boolean;
  hasHotelPrice: boolean;
  /** Enough is filled in to render figures at all. */
  priced: boolean;
  /**
   * Both halves of the cost are present, so this total means the same thing
   * as the other totals. A destination priced for flights but not hotels has
   * a real number that is simply not the same quantity, and letting it race
   * the fully-priced ones is how a comparison tool lies to its user.
   */
  comparable: boolean;
  /** Which half is absent, for the tag on the row. */
  missing: "none" | "hotel" | "flight" | "both";
};

export function derive(destination: Destination, people: number): Derived {
  const nights = nightsBetween(destination.arrival, destination.departure);
  const days = nights === null ? null : nights + 1;
  const hotel = chosenHotel(destination);

  // The flight is quoted per head and multiplied up; the hotel is quoted for
  // the whole stay and divided down. Each direction matches how the price is
  // actually advertised on the site the user copied it from.
  const flightPerPerson = destination.flight.pricePerPerson || 0;
  const flightTotal = flightPerPerson * Math.max(1, people);
  const hotelTotal = hotel?.totalPrice ?? 0;
  const tripTotal = flightTotal + hotelTotal;

  const hasFlightPrice = flightTotal > 0;
  // Covers both "no hotel saved" and "hotel saved but no price typed yet" —
  // from the total's point of view those are the same gap.
  const hasHotelPrice = hotelTotal > 0;
  const hasNights = nights !== null && nights > 0;

  return {
    nights,
    days,
    flightTotal,
    flightPerPerson: flightPerPerson || null,
    hotelTotal,
    hotelPerNight: per(hotelTotal, nights),
    hotelPerPersonPerNight:
      nights === null || nights <= 0 ? null : per(hotelTotal, nights * people),
    tripTotal,
    perPerson: per(tripTotal, people),
    perNight: per(tripTotal, nights),
    perPersonPerDay: days === null ? null : per(tripTotal, days * people),
    outboundMinutes: legMinutes(
      destination.flight.outboundDepart,
      destination.flight.outboundArrive,
    ),
    returnMinutes: legMinutes(
      destination.flight.returnDepart,
      destination.flight.returnArrive,
    ),
    hasFlightPrice,
    hasHotelPrice,
    priced: hasNights && tripTotal > 0,
    comparable: hasNights && hasFlightPrice && hasHotelPrice,
    missing:
      hasFlightPrice && hasHotelPrice
        ? "none"
        : hasFlightPrice
          ? "hotel"
          : hasHotelPrice
            ? "flight"
            : "both",
  };
}

/** Price delta of a candidate hotel against the one driving the total. */
export function hotelDelta(hotel: Hotel, chosen: Hotel | null): number | null {
  if (!chosen || chosen.id === hotel.id) return null;
  return hotel.totalPrice - chosen.totalPrice;
}

export type RankedDestination = {
  destination: Destination;
  derived: Derived;
  /** Difference from the cheapest complete destination. 0 for the cheapest. */
  deltaFromCheapest: number | null;
  isCheapest: boolean;
};

function sortValue(key: SortKey, entry: RankedDestination): number {
  const { derived, destination } = entry;
  switch (key) {
    case "total":
      return derived.tripTotal;
    case "perPerson":
      return derived.perPerson ?? Number.POSITIVE_INFINITY;
    case "perNight":
      return derived.perNight ?? Number.POSITIVE_INFINITY;
    case "perPersonPerDay":
      return derived.perPersonPerDay ?? Number.POSITIVE_INFINITY;
    case "departure":
      return parseDate(destination.arrival) ?? Number.POSITIVE_INFINITY;
    case "added":
      // Negated so the shared ascending comparator puts newest first.
      return -destination.createdAt;
  }
}

/**
 * Display tier. Destinations only ever sort against their own tier, so a
 * flight-only total can never outrank a real one on a cheaper-looking number.
 */
function tier(entry: RankedDestination): number {
  if (entry.derived.comparable) return 0;
  if (entry.derived.priced) return 1;
  return 2;
}

/**
 * Ranks destinations for display: computes every derived figure, awards
 * "cheapest", and sorts.
 *
 * Only fully-priced destinations take part in the price comparison. One that
 * is missing its hotel still shows the flight total it does have, but it sits
 * in a lower tier, wins nothing, and gets no delta — because 86 000 Ft of
 * flights is not a smaller version of 254 000 Ft of flights-and-hotel, it is a
 * different measurement, and ranking them together would quietly recommend
 * whichever destination the user had researched least.
 */
export function rank(
  destinations: Destination[],
  people: number,
  sortKey: SortKey,
): RankedDestination[] {
  const entries: RankedDestination[] = destinations.map((destination) => ({
    destination,
    derived: derive(destination, people),
    deltaFromCheapest: null,
    isCheapest: false,
  }));

  const comparable = entries.filter((e) => e.derived.comparable);
  const cheapest = comparable.reduce<RankedDestination | null>(
    (best, e) =>
      best === null || e.derived.tripTotal < best.derived.tripTotal ? e : best,
    null,
  );

  if (cheapest) {
    for (const entry of comparable) {
      entry.deltaFromCheapest =
        entry.derived.tripTotal - cheapest.derived.tripTotal;
    }
    cheapest.isCheapest = true;
  }

  return entries.sort((a, b) => {
    const tierDiff = tier(a) - tier(b);
    if (tierDiff !== 0) return tierDiff;
    const diff = sortValue(sortKey, a) - sortValue(sortKey, b);
    return diff !== 0
      ? diff
      : a.destination.place.localeCompare(b.destination.place);
  });
}

/** The subset that can honestly be compared on price. */
export function comparableEntries(
  entries: RankedDestination[],
): RankedDestination[] {
  return entries.filter((e) => e.derived.comparable);
}

/** True when the route has enough entered to render a timeline. */
export function hasFlightTimes(flight: Flight): boolean {
  return Boolean(flight.outboundDepart && flight.outboundArrive);
}
