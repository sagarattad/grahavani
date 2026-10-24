// One card per dosha, built from Kundlit data only. Missing data (e.g. a
// Kaal Sarp call that failed, or a chart saved before transit data was kept)
// becomes "unavailable" instead of breaking the page.
import { DOSHAS, SADE_SATI_PHASES, severity } from "./glossary";
import { dateOnly } from "./format";
import { activationWindows, type Window } from "./dasha";
import { cleanClaim, keyOf } from "./yogas";
import { MANGLIK_CHECKS } from "./summaries";
import type { Chart, KaalSarp, Manglik } from "./kundlit-schemas";
import { rateDhaiya, rateKaalSarp, rateKemadruma, rateManglik, rateSadeSati, type DoshaLevel, type Rating } from "./strength";

export type DateRange = { label: string; start: string; end: string; current: boolean };

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
  /** Transit cards: Kundlit only lists periods that end before this instant. */
  coveredUntil?: string;
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
const YEAR_MS = 365.25 * 86400_000;
/** End of Kundlit's transit window (default 10 years after as_of). */
const coveredUntil = (asOf: string, years: number | null | undefined) => new Date(t(asOf) + (years ?? 10) * YEAR_MS).toISOString();
const inRange = (start: string, end: string, now: number) => t(start) <= now && now < t(end);

export function manglikCard(m: Manglik | null | undefined, chart: Chart, asOf: string): DoshaCard {
  if (!m) return unavailable("manglik");
  const triggered = MANGLIK_CHECKS.filter((c) => m[c.key]).map((c) => c.label);
  return card("manglik", {
    status: m.manglik ? "present" : "absent",
    statusLabel: m.manglik ? `Present — ${severity(m.severity)}` : "Not present",
    details: [
      ...(m.manglik ? [`Triggered: ${triggered.join(", ") || "—"}`] : []),
      ...m.cancellations.map((c) => `Cancellation: ${c}`),
    ],
    windows: m.manglik ? activationWindows(["Mars"], chart.vimshottari.timeline, asOf, 3) : [],
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

export function kemadrumaCard(chart: Chart, asOf: string): DoshaCard {
  const found = chart.yogas.filter((y) => keyOf(y) === "yoga.kemadruma");
  const bhanga = chart.yogas.filter((y) => keyOf(y) === "yoga.bhanga.kemadruma");
  const status = !found.length ? "absent" : bhanga.length ? "cancelled" : "present";
  return card("kemadruma", {
    status,
    statusLabel: status === "absent" ? "Not present" : status === "cancelled" ? "Present — cancelled" : "Present",
    details: [...found.map((y) => cleanClaim(y.claim)), ...bhanga.map((y) => `Cancellation: ${cleanClaim(y.claim)}`)],
    windows: found.length ? activationWindows(["Moon"], chart.vimshottari.timeline, asOf, 3) : [],
    ranges: [],
    rating: rateKemadruma(found.length > 0, bhanga.length > 0),
  });
}

export function sadeSatiCard(chart: Chart): DoshaCard {
  const tr = chart.transit;
  if (!tr) return unavailable("sadeSati");
  const now = t(tr.as_of);
  const until = coveredUntil(tr.as_of, tr.sade_sati_lifecycle.horizon_years);
  const ranges: DateRange[] = tr.sade_sati_lifecycle.occurrences.flatMap((o) =>
    (
      [
        ["Rising", o.rising_start, o.rising_end],
        ["Peak", o.peak_start, o.peak_end],
        ["Setting", o.setting_start, o.setting_end],
      ] as const
    )
      .filter(([, s, e]) => s && e && t(e!) > now)
      .map(([label, s, e]) => ({ label, start: s!, end: e!, current: inRange(s!, e!, now) })),
  );
  const status = tr.sade_sati.active ? "running" : ranges.length ? "upcoming" : "none";
  return card("sadeSati", {
    status,
    statusLabel:
      status === "running"
        ? `Running now — ${SADE_SATI_PHASES[tr.sade_sati.phase] ?? tr.sade_sati.phase}`
        : status === "upcoming"
          ? "Not running now — upcoming"
          : `Not running — none listed that ends before ${dateOnly(until)}`,
    details: [],
    windows: [],
    ranges,
    asOf: tr.as_of,
    coveredUntil: until,
    rating: rateSadeSati(status === "running" ? (ranges.find((r) => r.current)?.label ?? "Rising") : null),
  });
}

export function dhaiyaCard(chart: Chart): DoshaCard {
  const tr = chart.transit;
  if (!tr) return unavailable("dhaiya");
  const now = t(tr.as_of);
  const until = coveredUntil(tr.as_of, tr.dhaiya_lifecycle.horizon_years);
  const ranges: DateRange[] = [
    ...tr.dhaiya_lifecycle.kantaka_occurrences.map((r) => ({ label: "Kantaka (4th from Chandra)", ...r })),
    ...tr.dhaiya_lifecycle.ardha_ashtama_occurrences.map((r) => ({ label: "Ardhashtama (8th from Chandra)", ...r })),
  ]
    .filter((r) => t(r.end_dt) > now)
    .map((r) => ({ label: r.label, start: r.start_dt, end: r.end_dt, current: inRange(r.start_dt, r.end_dt, now) }))
    .sort((a, b) => t(a.start) - t(b.start));
  const status = ranges.some((r) => r.current) ? "running" : ranges.length ? "upcoming" : "none";
  return card("dhaiya", {
    status,
    statusLabel:
      status === "running"
        ? "Running now"
        : status === "upcoming"
          ? "Not running now — upcoming"
          : `Not running — none listed that ends before ${dateOnly(until)}`,
    details: [],
    windows: [],
    ranges,
    asOf: tr.as_of,
    coveredUntil: until,
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
    manglikCard(opts.manglik, chart, asOf),
    kaalSarpCard(opts.kaalSarp, chart, asOf),
    kemadrumaCard(chart, asOf),
    sadeSatiCard(chart),
    dhaiyaCard(chart),
  ];
}
