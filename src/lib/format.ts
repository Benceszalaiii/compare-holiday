/**
 * The app is Hungarian-only, so the locale is fixed rather than taken from the
 * browser: figures read back exactly the way they look on the Hungarian sites
 * the user copies them from, wherever the app happens to run.
 */
const LOCALE = "hu-HU";

const huf = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

const plainNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** "312 400 Ft". Renders an em dash for values that can't be computed yet. */
export function formatHuf(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return huf.format(Math.round(value));
}

/** Signed difference: "+42 000 Ft" / "−8 500 Ft" / "ugyanannyi". */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const rounded = Math.round(value);
  if (rounded === 0) return "ugyanannyi";
  // A real minus sign, not a hyphen, so the two signs are the same width.
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${plainNumber.format(Math.abs(rounded))} Ft`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return plainNumber.format(Math.round(value));
}

const monthDay = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * `weekday: "short"` in Hungarian collapses to a single letter ("P"), which is
 * ambiguous between péntek and… nothing else, but still reads as noise. These
 * are the forms a Hungarian calendar actually prints.
 */
const WEEKDAYS = ["V", "H", "K", "Sze", "Cs", "P", "Szo"] as const;

function utcDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "aug. 14." */
export function formatDate(iso: string): string {
  const d = utcDate(iso);
  return d ? monthDay.format(d) : "—";
}

/** "P, 2026. aug. 14." */
export function formatDateLong(iso: string): string {
  const d = utcDate(iso);
  if (!d) return "—";
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCFullYear()}. ${monthDay.format(d)}`;
}

/**
 * "aug. 14. – 20." within one month, "aug. 28. – szept. 3." across two, and
 * year-prefixed in Hungarian order when the trip isn't in the current year.
 */
export function formatDateRange(arrival: string, departure: string): string {
  const a = utcDate(arrival);
  const b = utcDate(departure);
  if (!a || !b) return "—";
  const sameMonth =
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth();
  const yearPrefix =
    a.getUTCFullYear() === new Date().getUTCFullYear()
      ? ""
      : `${a.getUTCFullYear()}. `;
  const right = sameMonth ? `${b.getUTCDate()}.` : monthDay.format(b);
  return `${yearPrefix}${monthDay.format(a)} – ${right}`;
}

/** "06:15" from a datetime-local value. */
export function formatTime(value: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[1]}:${m[2]}` : "—";
}

/** "1 ó 05 p" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes))
    return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} p`;
  return `${h} ó ${String(m).padStart(2, "0")} p`;
}

/** "booking.com" from a full URL, for labelling a listing's source. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
