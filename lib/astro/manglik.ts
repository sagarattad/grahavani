// Grahavani's Manglik Dosha: computed from the chart (Kundlit's severity is not
// passed through). Mars's house is counted from the Lagna, the Moon and Venus.
// North Indian set (1, 4, 7, 8, 12) decides the status; the South Indian rule
// adds the 2nd and is shown separately. Cancellations are tradition-dependent
// and each one is listed as applying or not. Intensity is worked out in steps.
import type { Chart, Manglik } from "../kundlit-schemas";
import { EXALTATION_SIGN, ownSigns } from "./relations";
import { functionalNature } from "./functional";
import { aspects, byName, conjunct, houseFrom, ord } from "./rules";

export const NORTH_SET = [1, 4, 7, 8, 12];
export const SOUTH_EXTRA = 2;

export type ManglikRef = { from: "Lagna" | "Moon" | "Venus"; house: number; north: boolean; southOnly: boolean };
export type ManglikCancellation = { text: string; applies: boolean; weight: number; note?: string };
export type ManglikIntensity = "high" | "medium" | "low" | "cancelled" | "none";

export type ManglikDetails = {
  refs: ManglikRef[];
  houseSet: string;
  cancellations: ManglikCancellation[];
  /** Step-by-step reasoning for the intensity. */
  steps: string[];
  score: number;
  intensity: ManglikIntensity;
};

/** Kundlit's Manglik shape (so existing pages keep working) plus Grahavani's details. */
export type ManglikResult = Manglik & { grahavani: ManglikDetails };

export const INTENSITY_LABEL: Record<ManglikIntensity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  cancelled: "Formed but cancelled",
  none: "Not present",
};

export function computeManglik(chart: Chart): ManglikResult {
  const mars = byName(chart, "Mars");
  const moon = byName(chart, "Moon");
  const venus = byName(chart, "Venus");
  const jupiter = byName(chart, "Jupiter");
  const rahu = byName(chart, "Rahu");

  const ref = (from: ManglikRef["from"], sign: number): ManglikRef => {
    const house = houseFrom(sign, mars.sign_num);
    return { from, house, north: NORTH_SET.includes(house), southOnly: house === SOUTH_EXTRA };
  };
  const refs = [ref("Lagna", chart.lagna.sign_num), ref("Moon", moon.sign_num), ref("Venus", venus.sign_num)];

  const yk = functionalNature(chart.lagna.sign_num).yogakarakas.includes("Mars");
  const ownOrExalted = ownSigns("Mars").includes(mars.sign_num) || EXALTATION_SIGN.Mars === mars.sign_num;
  const d9Strong = ownSigns("Mars").includes(mars.navamsha.sign_num) || EXALTATION_SIGN.Mars === mars.navamsha.sign_num;
  const jupConj = conjunct(jupiter, mars);
  const jupAsp = aspects(jupiter, mars);
  const cancellations: ManglikCancellation[] = [
    { text: `Mars is yogakaraka for ${chart.lagna.sign} Lagna (Karka / Simha exemption)`, applies: yk, weight: 1 },
    { text: "Mars in its own or exaltation sign", applies: ownOrExalted, weight: 1 },
    { text: jupConj ? "Jupiter conjunct Mars" : "Jupiter conjunct or aspecting Mars", applies: jupConj || jupAsp, weight: 1 },
    { text: "Mars conjunct the Moon", applies: conjunct(mars, moon), weight: 0.5 },
    { text: "Mars exalted or in its own sign in the D9 (mitigating)", applies: d9Strong, weight: 0.25 },
    {
      text: "Rahu with Mars",
      applies: false,
      weight: 0,
      note: conjunct(rahu, mars) ? "present here, but disputed as a cancellation, so not applied" : "disputed as a cancellation; not applied",
    },
  ];

  const steps: string[] = [];
  let score = 0;
  for (const r of refs) {
    if (r.north) {
      score += 1;
      steps.push(`From ${r.from}: Mars in the ${ord(r.house)} → +1`);
    } else if (r.southOnly) {
      score += 0.5;
      steps.push(`From ${r.from}: Mars in the 2nd (South Indian rule only) → +0.5`);
    } else steps.push(`From ${r.from}: Mars in the ${ord(r.house)} → no`);
  }
  const formed = refs.some((r) => r.north || r.southOnly);
  if (formed) {
    for (const c of cancellations.filter((x) => x.applies)) {
      score -= c.weight;
      steps.push(`${c.text} → −${c.weight}`);
    }
  }
  score = Math.round(score * 100) / 100;
  const intensity: ManglikIntensity = !formed ? "none" : score <= 0 ? "cancelled" : score < 1 ? "low" : score < 2 ? "medium" : "high";
  if (formed) {
    // Signed sum of every term, e.g. "+1 + 0.5 − 1 − 0.25 = 0.25".
    const terms = [
      ...refs.filter((r) => r.north || r.southOnly).map((r) => (r.north ? 1 : 0.5)),
      ...cancellations.filter((c) => c.applies && c.weight).map((c) => -c.weight),
    ];
    const sum = terms.map((v, i) => (i === 0 ? `${v < 0 ? "−" : "+"}${Math.abs(v)}` : `${v < 0 ? "−" : "+"} ${Math.abs(v)}`)).join(" ");
    steps.push(`Total ${sum} = ${score} → ${INTENSITY_LABEL[intensity]} (≤ 0 cancelled, < 1 low, < 2 medium, else high)`);
  }

  const north = refs.some((r) => r.north);
  return {
    manglik: formed && intensity !== "cancelled",
    severity: intensity,
    ascendant_check: refs[0].north || refs[0].southOnly,
    moon_check: refs[1].north || refs[1].southOnly,
    venus_check: refs[2].north || refs[2].southOnly,
    cancellations: formed ? cancellations.filter((c) => c.applies).map((c) => `${c.text} (tradition-dependent)`) : [],
    grahavani: {
      refs,
      houseSet: north || !formed ? "North Indian (1, 4, 7, 8, 12)" : "South Indian (adds the 2nd)",
      cancellations,
      steps,
      score,
      intensity,
    },
  };
}
