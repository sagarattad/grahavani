// One card per dosha. Manglik and Kemadruma use Grahavani's own rules
// (lib/astro); Sade Sati and Dhaiya use locally computed Saturn transits
// (lib/astro/transits.ts); Kaal Sarp comes from Kundlit. Missing data
// (e.g. a Kaal Sarp call that failed, or a chart saved before transit data was
// kept) becomes "unavailable" instead of breaking the page.
import { DOSHAS, rashi } from "./glossary";
import { dateOnly } from "./format";
import { activationWindows, type Window } from "./dasha";
import { computeManglik, INTENSITY_LABEL } from "./astro/manglik";
import { kemadruma, ord } from "./astro/rules";
import { dhaiyaRanges, sadeSatiRanges, type PhaseRange } from "./astro/transits";
import type { Chart, KaalSarp, Manglik } from "./kundlit-schemas";
import { rateDhaiya, rateKaalSarp, rateKemadruma, rateManglik, rateSadeSati, type DoshaLevel, type Rating } from "./strength";

export type DateRange = PhaseRange;

/** "Rising: 3 Jun 2027 – 17 Apr 2030 (Saturn leaves the sign meanwhile: back into Meena …; ahead into Vrishabha …)", marking cuts by the computed span. */
export function rangeText(r: DateRange): string {
  const from = r.startsBefore ? `before ${dateOnly(r.start)}` : dateOnly(r.start);
  const to = r.continuesBeyond ? `continues beyond ${dateOnly(r.end)}` : dateOnly(r.end);
  const dips = r.dips?.map((d) => `${d.direction === "back" ? "back into" : "ahead into"} ${rashi(d.sign)} ${dateOnly(d.start)} – ${dateOnly(d.end)}`);
  return `${r.label}: ${from} – ${to}${dips?.length ? ` (Saturn leaves the sign meanwhile: ${dips.join("; ")})` : ""}`;
}

export type DoshaCard = {
  key: keyof typeof DOSHAS;
  name: string;
  meaning?: string;
  status: "present" | "absent" | "cancelled" | "running" | "upcoming" | "none" | "unavailable";
  statusLabel: string;
  details: string[];
  windows: Window[]; // Dasha-based ("when it is felt")
  ranges: DateRange[]; // transit-based dates (Sade Sati, Dhaiya)
  asOf?: string;
  /** Grahavani's classical intensity (lib/strength.ts); level null when not present. */
  rating: Rating<DoshaLevel>;
};

const NOT_RATED: Rating<DoshaLevel> = { level: null, label: "Not rated", reasons: [] };

const card = (
  key: keyof typeof DOSHAS,
  rest: Omit<DoshaCard, "key" | "name" | "meaning" | "rating"> & { rating?: Rating<DoshaLevel> },
): DoshaCard => ({
  key,
  name: DOSHAS[key].en,
  meaning: DOSHAS[key].meaning,
  rating: NOT_RATED,
  ...rest,
});

const unavailable = (key: keyof typeof DOSHAS) =>
  card(key, { status: "unavailable", statusLabel: "Not available", details: [], windows: [], ranges: [] });

const t = (s: string) => new Date(s).getTime();

/**
 * Grahavani's own Manglik (lib/astro/manglik.ts), computed from the chart:
 * Mars from Lagna, Moon and Venus, which house set applies, each cancellation
 * (applies or not, tradition-dependent) and the intensity reasoning.
 */
export function manglikCard(chart: Chart, asOf: string): DoshaCard {
  const m = computeManglik(chart);
  const g = m.grahavani;
  const status = g.intensity === "none" ? "absent" : g.intensity === "cancelled" ? "cancelled" : "present";
  return card("manglik", {
    status,
    statusLabel: status === "absent" ? "Not present" : status === "cancelled" ? "Formed but cancelled" : `Present — ${INTENSITY_LABEL[g.intensity]}`,
    details: [
      ...g.refs.map(
        (r) => `From ${r.from}: Mars in the ${ord(r.house)} — ${r.north ? "yes (North Indian set 1, 4, 7, 8, 12)" : r.southOnly ? "South Indian rule only (adds the 2nd)" : "no"}`,
      ),
      ...(status === "absent"
        ? []
        : [
            ...g.cancellations.filter((c) => c.applies).map((c) => `Cancellation: ${c.text} (tradition-dependent)`),
            ...g.cancellations.filter((c) => !c.applies && c.weight > 0).map((c) => `Does not apply: ${c.text}`),
            ...g.cancellations.filter((c) => c.note).map((c) => `Note: ${c.text}: ${c.note}`),
            `Intensity: ${g.steps.join("; ")}`,
          ]),
    ],
    // A cancelled dosha has no "felt in" periods.
    windows: status === "present" ? activationWindows(["Mars"], chart.vimshottari.timeline, asOf, 3) : [],
    ranges: [],
    rating: rateManglik(m),
  });
}

export function kaalSarpCard(k: KaalSarp | null | undefined, chart: Chart, asOf: string): DoshaCard {
  if (!k) return unavailable("kaalSarp");
  return card("kaalSarp", {
    status: k.present ? "present" : "absent",
    statusLabel: k.present ? `Present — ${k.type ?? "type not given"} (${k.full_or_partial})` : "Not present",
    details: [k.explanation, ...(k.present && k.affected_houses.length ? [`Bhavas involved: ${k.affected_houses.join(", ")}`] : [])],
    windows: k.present ? activationWindows(["Rahu", "Ketu"], chart.vimshottari.timeline, asOf, 3) : [],
    ranges: [],
    rating: rateKaalSarp(k),
  });
}

/** Grahavani's Kemadruma (lib/astro/rules.ts): formed, formed but cancelled (with reasons), or not formed. */
export function kemadrumaCard(chart: Chart, asOf: string): DoshaCard {
  const k = kemadruma(chart);
  const status = k.state === "not formed" ? "absent" : k.state === "cancelled" ? "cancelled" : "present";
  return card("kemadruma", {
    status,
    statusLabel: status === "absent" ? "Not formed" : status === "cancelled" ? "Formed but cancelled" : "Formed",
    details: status === "absent" ? [`Not formed: ${k.why}`] : [`Formed: ${k.why}`, ...k.cancellations.map((c) => `Cancellation: ${c}`)],
    windows: status === "present" ? activationWindows(["Moon"], chart.vimshottari.timeline, asOf, 3) : [],
    ranges: [],
    rating: rateKemadruma(status !== "absent", k.cancellations),
  });
}

/** Sade Sati from Saturn's locally computed transits (lib/astro/transits.ts), over the current and next Mahadasha. */
export function sadeSatiCard(chart: Chart, asOf: string): DoshaCard {
  const ranges = sadeSatiRanges(chart, asOf);
  const running = ranges.find((r) => r.current);
  const status = running ? "running" : ranges.length ? "upcoming" : "none";
  return card("sadeSati", {
    status,
    statusLabel: running ? `Running now — ${running.label}` : status === "upcoming" ? `Not running now — next from ${dateOnly(ranges[0].start)}` : "Not running",
    details: [],
    windows: [],
    ranges,
    asOf,
    rating: rateSadeSati(running?.label ?? null),
  });
}

/** Shani Dhaiya (Kantaka and Ardhashtama) from Saturn's locally computed transits. */
export function dhaiyaCard(chart: Chart, asOf: string): DoshaCard {
  const ranges = dhaiyaRanges(chart, asOf);
  const status = ranges.some((r) => r.current) ? "running" : ranges.length ? "upcoming" : "none";
  return card("dhaiya", {
    status,
    statusLabel: status === "running" ? "Running now" : status === "upcoming" ? `Not running now — next from ${dateOnly(ranges[0].start)}` : "Not running",
    details: [],
    windows: [],
    ranges,
    asOf,
    rating: rateDhaiya(status === "running"),
  });
}

export function buildDoshas(opts: {
  chart: Chart;
  manglik?: Manglik | null;
  kaalSarp?: KaalSarp | null;
  asOf: string;
}): DoshaCard[] {
  const { chart, asOf } = opts;
  return [
    manglikCard(chart, asOf),
    kaalSarpCard(opts.kaalSarp, chart, asOf),
    kemadrumaCard(chart, asOf),
    sadeSatiCard(chart, asOf),
    dhaiyaCard(chart, asOf),
  ];
}
