// Vimshottari sub-periods. Kundlit gives the Mahadasha timeline but only the
// Antardasha / Pratyantar running today, so the sub-periods are split here
// with the standard proportions (sub-period = parent length × lord years / 120).
// This is plain arithmetic on Kundlit's own dates; lib/dasha.test.ts checks
// it against Kundlit's current Antardasha and Pratyantar. All maths is in UTC ms.

export const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"] as const;
export const DASHA_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

export type Period = { lord: string; start: string; end: string };
/** `fullStart`: where a sub-period clipped at birth would have begun (Kundlit reports this as its start). */
export type SubPeriod = Period & { parent: string; fullStart?: string };

const ms = (iso: string) => new Date(iso).getTime();
const iso = (t: number) => new Date(t).toISOString();

/** Kundlit's year length, read from a complete Mahadasha in its own timeline. */
export function msPerYear(timeline: Period[]): number {
  const full = timeline[1] ?? timeline[0];
  return (ms(full.end) - ms(full.start)) / DASHA_YEARS[full.lord];
}

function sequenceFrom(lord: string): string[] {
  const i = DASHA_ORDER.indexOf(lord as (typeof DASHA_ORDER)[number]);
  return [...DASHA_ORDER.slice(i), ...DASHA_ORDER.slice(0, i)];
}

/**
 * Splits a period into its 9 sub-periods. `fullStart` is where the period
 * would have begun if it were complete (only differs for the Mahadasha
 * running at birth); sub-periods before `clipFrom` are dropped or trimmed.
 */
function split(parent: Period, fullStart: number, clipFrom: number): SubPeriod[] {
  const end = ms(parent.end);
  const total = end - fullStart;
  let t = fullStart;
  const out: SubPeriod[] = [];
  for (const lord of sequenceFrom(parent.lord)) {
    const next = t + (total * DASHA_YEARS[lord]) / 120;
    if (next > clipFrom) out.push({ parent: parent.lord, lord, start: iso(Math.max(t, clipFrom)), end: iso(next), ...(t < clipFrom ? { fullStart: iso(t) } : {}) });
    t = next;
  }
  out[out.length - 1].end = parent.end; // remove floating-point drift
  return out;
}

/** The 9 Antardashas of a Mahadasha (the first Mahadasha is clipped at birth). */
export function antardashas(md: Period, timeline: Period[]): SubPeriod[] {
  const isBirthMd = timeline[0]?.start === md.start;
  const fullStart = isBirthMd ? ms(md.end) - DASHA_YEARS[md.lord] * msPerYear(timeline) : ms(md.start);
  return split(md, fullStart, ms(md.start));
}

/**
 * The Pratyantar Dashas of an Antardasha. An Antardasha clipped at birth keeps
 * its unclipped start in `fullStart`, so the proportions stay correct.
 */
export function pratyantardashas(ad: SubPeriod, fullStart = ms(ad.fullStart ?? ad.start)): SubPeriod[] {
  return split(ad, fullStart, ms(ad.start));
}

export function antardashaTable(timeline: Period[]): SubPeriod[] {
  return timeline.flatMap((md) => antardashas(md, timeline));
}

export const contains = (p: Period, t: number) => ms(p.start) <= t && t < ms(p.end);

export type Window = { md: string; ad?: string; start: string; end: string; current: boolean };

/**
 * Current and upcoming periods ruled by any of `lords`: whole Mahadashas, and
 * Antardashas inside the current and next Mahadasha. Sorted by start.
 */
export function activationWindows(lords: Iterable<string>, timeline: Period[], asOf: string, limit = 6): Window[] {
  const want = new Set(lords);
  const now = ms(asOf);
  const idx = timeline.findIndex((p) => contains(p, now));
  const out: Window[] = [];
  for (const md of timeline) {
    if (want.has(md.lord) && ms(md.end) > now) out.push({ md: md.lord, start: md.start, end: md.end, current: contains(md, now) });
  }
  for (const md of timeline.slice(Math.max(idx, 0), Math.max(idx, 0) + 2)) {
    for (const ad of antardashas(md, timeline)) {
      if (want.has(ad.lord) && ms(ad.end) > now && !want.has(md.lord)) {
        out.push({ md: md.lord, ad: ad.lord, start: ad.start, end: ad.end, current: contains(ad, now) });
      }
    }
  }
  return out.sort((a, b) => ms(a.start) - ms(b.start)).slice(0, limit);
}
