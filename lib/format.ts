/** 18.1113 → 18°06′ */
export function dms(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const IST = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

/**
 * Period dates are shown in IST everywhere, whatever offset Kundlit sent
 * (dates are compared and computed as UTC instants).
 * "2037-09-19T08:55:36.358+05:30" → "19 Sep 2037". A plain "YYYY-MM-DD"
 * (a civil date such as a birth date) is shown as written.
 */
export function dateOnly(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    const [y, mo, d] = isoOrDate.split("-").map(Number);
    return `${d} ${MONTHS[mo - 1]} ${y}`;
  }
  return IST.format(new Date(isoOrDate)).replace("Sept", "Sep");
}

/** "1990-01-15" + "14:30" → "15 Jan 1990, 2:30 PM" (local birth time, as entered) */
export function birthDateTime(date: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${dateOnly(date)}, ${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export const ymd = ([y, m, d]: number[]) => `${y}y ${m}m ${d}d`;

const IST_PARTS = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** Calendar date (IST) of an instant: [year, month, day]. */
export function istDate(iso: string): [number, number, number] {
  const [y, m, d] = IST_PARTS.format(new Date(iso)).split("-").map(Number);
  return [y, m, d];
}

/**
 * Calendar years, months and days from one instant to another (IST dates).
 * Used for the Dasha balance at birth, so it agrees with the first
 * Mahadasha's end date in the timeline (Kundlit's own balance_ymd uses a
 * different year length and can differ by a few days).
 */
export function calendarSpan(fromIso: string, toIso: string): [number, number, number] {
  const [y1, m1, d1] = istDate(fromIso);
  let [y, m, d] = istDate(toIso);
  if (d < d1) {
    m -= 1;
    d += new Date(Date.UTC(y, m, 0)).getUTCDate(); // days in the month before `toIso`'s month
  }
  if (m < m1) {
    y -= 1;
    m += 12;
  }
  return [y - y1, m - m1, d - d1];
}

/** "Sun Mahadasha, 1y 9m 24d (until 9 Jul 1997)" from the timeline's first Mahadasha. */
export function dashaBalanceText(birthIso: string, firstMd: { end: string }): string {
  return `${ymd(calendarSpan(birthIso, firstMd.end))} (until ${dateOnly(firstMd.end)})`;
}

export const points = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
