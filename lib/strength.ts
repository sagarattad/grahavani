// Grahavani's classical rating for present Yogas and Doshas.
// An interpretive layer on Kundlit's chart data (dignity, house, combustion,
// Baladi avastha, cancellations), like the Antardasha split. It is NOT
// Shadbala: Kundlit's strength_score was checked against AstroSage Shadbala
// and didn't track it (Spearman −0.18), so it is not used. See PLAN.md.
import { graha } from "./glossary";
import type { Chart, Graha, KaalSarp, Koot, Manglik } from "./kundlit-schemas";

export type YogaLevel = "Strong" | "Moderate" | "Weak";
export type DoshaLevel = "High" | "Medium" | "Low";
export type Rating<L extends string> = { level: L | null; label: string; reasons: string[] };

export const PARTIAL_POINTS_NOTE =
  "When Nadi or Bhakoot Dosha is cancelled, our calculation (Kundlit) gives partial points (e.g. 4 / 8). Some websites score a cancelled dosha differently, for example as full points or as 0.";

export const RATING_NOTE =
  "Grahavani's classical rating from Kundlit's chart data (dignity, house, combustion, Baladi avastha, cancellations). It is not Shadbala; schools weigh these differently.";

const DIGNITY: Record<string, [number, string]> = {
  exalted: [2, "exalted"],
  moolatrikona: [2, "moolatrikona"],
  own: [1.5, "own sign"],
  friend: [0.5, "friendly sign"],
  neutral: [0, "neutral sign"],
  enemy: [-0.5, "enemy sign"],
  debilitated: [-2, "debilitated"],
};
const AVASTHA: Record<string, [number, string]> = {
  Yuva: [1, "Yuva (full results)"],
  Kumara: [0.5, "Kumara (half results)"],
  Bala: [0.25, "Bala (quarter results)"],
  Vriddha: [0, "Vriddha (little result)"],
  Mrita: [-0.5, "Mrita (very little result)"],
};
const NODES = new Set(["Rahu", "Ketu"]);
const KENDRA_TRIKONA = new Set([1, 4, 5, 7, 9, 10]);
const DUSTHANA = new Set([6, 8, 12]);

/** Kendra/trikona +1 (house 1 counted once), dusthana −1, others 0. */
function housePoints(h: number): [number, string] {
  if (KENDRA_TRIKONA.has(h)) return [1, `Bhava ${h} (+)`];
  if (DUSTHANA.has(h)) return [-1, `Bhava ${h} (−)`];
  return [0, `Bhava ${h}`];
}

type Mode = "full" | "mahapurusha" | "node";

/** Points and a short reason for one graha. `null` when avastha is missing. */
export function grahaPoints(g: Graha, mode: Mode = "full"): { points: number; reason: string } | null {
  const parts: string[] = [];
  let points = 0;
  if (mode !== "node" && !g.avastha) return null;
  if (mode === "full") {
    const [d, dl] = DIGNITY[g.dignity] ?? [0, g.dignity];
    points += d;
    if (g.dignity !== "neutral") parts.push(dl);
  }
  if (mode === "full" || mode === "node") {
    const [h, hl] = housePoints(g.house);
    points += h;
    parts.push(hl);
  }
  if (mode !== "node") {
    if (g.combust && g.name !== "Sun") {
      points -= 1;
      parts.push("combust");
    }
    const [a, al] = AVASTHA[g.avastha!] ?? [0, g.avastha!];
    points += a;
    parts.push(al);
  }
  return { points, reason: `${graha(g.name)}: ${parts.join(", ")}` };
}

const YOGA_LEVELS: YogaLevel[] = ["Weak", "Moderate", "Strong"];
const MAHAPURUSHA = new Set(["yoga.ruchaka", "yoga.bhadra", "yoga.hamsa", "yoga.malavya", "yoga.sasa"]);
export const YOGA_THRESHOLDS = { strong: 1.5, moderate: 0.25 };

type RatableYoga = {
  key: string;
  nabhasa: boolean;
  status: "present" | "cancelled";
  combinations: { participants: string[] }[];
};

const yogaRating = (level: YogaLevel | null, reasons: string[]): Rating<YogaLevel> => ({
  level,
  label: level ? `Rated ${level}` : "Not rated",
  reasons: reasons.slice(0, 4),
});

export function rateYoga(y: RatableYoga, chart: Chart): Rating<YogaLevel> {
  if (y.nabhasa) return yogaRating(null, ["Describes the overall pattern of the chart"]);
  const byName = new Map(chart.grahas.map((g) => [g.name, g]));
  const maha = MAHAPURUSHA.has(y.key);

  let best: { score: number; reasons: string[] } | null = null;
  for (const c of y.combinations) {
    const others = c.participants.filter((p) => !NODES.has(p));
    const nodeOnly = others.length === 0;
    const names = nodeOnly ? c.participants : others;
    const pts = names.map((n) => byName.get(n)).map((g) => (g ? grahaPoints(g, maha ? "mahapurusha" : nodeOnly ? "node" : "full") : null));
    if (pts.length === 0 || pts.some((p) => p === null)) return yogaRating(null, ["Data unavailable for this chart"]);
    const score = pts.reduce((s, p) => s + p!.points, 0) / pts.length;
    if (!best || score > best.score) best = { score, reasons: pts.map((p) => p!.reason) };
  }
  if (!best) return yogaRating(null, ["Data unavailable for this chart"]);

  let idx: number;
  const reasons = [...best.reasons];
  if (maha) {
    reasons.unshift("Pancha Mahapurusha conditions met (own or exalted sign in a kendra)");
    idx = best.score >= 0.5 ? 2 : best.score >= 0 ? 1 : 0;
  } else {
    idx = best.score >= YOGA_THRESHOLDS.strong ? 2 : best.score >= YOGA_THRESHOLDS.moderate ? 1 : 0;
  }
  if (y.status === "cancelled") {
    idx = Math.max(0, idx - 1);
    reasons.push("Cancelled by Bhanga (one level lower)");
  }
  return yogaRating(YOGA_LEVELS[idx], reasons);
}

// ---------- Doshas ----------

const doshaRating = (level: DoshaLevel | null, reasons: string[]): Rating<DoshaLevel> => ({
  level,
  label: level ? `Intensity: ${level}` : "Not rated",
  reasons: reasons.slice(0, 4),
});

const SEVERITY: Record<string, DoshaLevel> = {
  mild: "Low",
  medium: "Medium",
  moderate: "Medium",
  partial: "Medium",
  high: "High",
  severe: "High",
};

/** Kundlit's severity already accounts for its listed cancellations (checked on fixtures). */
export function rateManglik(m: Manglik): Rating<DoshaLevel> {
  if (!m.manglik) return doshaRating(null, []);
  const level = SEVERITY[m.severity] ?? "Medium";
  return doshaRating(level, [
    `Kundlit severity: ${m.severity}`,
    ...(m.cancellations.length ? [`${m.cancellations.length} cancellation(s) listed, already reflected in the severity`] : []),
  ]);
}

export function rateKaalSarp(k: KaalSarp): Rating<DoshaLevel> {
  if (!k.present) return doshaRating(null, []);
  return k.full_or_partial === "full"
    ? doshaRating("High", ["Full: all seven grahas on one side of Rahu–Ketu"])
    : doshaRating("Medium", [`${k.full_or_partial === "partial" ? "Partial" : k.full_or_partial}: not every graha on one side`]);
}

export function rateKemadruma(present: boolean, cancelled: boolean): Rating<DoshaLevel> {
  if (!present) return doshaRating(null, []);
  return cancelled ? doshaRating("Low", ["Cancellation listed by Kundlit"]) : doshaRating("Medium", ["Present, no cancellation listed"]);
}

export function rateSadeSati(runningPhase: string | null): Rating<DoshaLevel> {
  if (!runningPhase) return doshaRating(null, []);
  return runningPhase === "Peak"
    ? doshaRating("High", ["Peak phase: Shani over Chandra's own Rashi"])
    : doshaRating("Medium", [`${runningPhase} phase`]);
}

export function rateDhaiya(running: boolean): Rating<DoshaLevel> {
  return running ? doshaRating("Medium", ["Running now"]) : doshaRating(null, []);
}

/** Nadi / Bhakoot: present and not cancelled → High; cancelled → Low. */
export function rateKootDosha(k: Koot, cancellation: string | null): Rating<DoshaLevel> {
  if (!k.dosha) return doshaRating(null, []);
  return cancellation
    ? doshaRating("Low", [`Cancelled: ${cancellation}`, `Kundlit gives partial points when cancelled (${k.earned} / ${k.max_points})`])
    : doshaRating("High", [`No cancellation listed (${k.earned} / ${k.max_points} points)`]);
}

/**
 * The only form in which AI texts may state a rating ("rated Strong",
 * "intensity: Low"); lib/ai/validate.ts checks these phrases against FACTS.
 * English only: localise the phrases and the validator patterns together.
 */
export function ratingPhrase(r: Rating<string>, kind: "yoga" | "dosha"): string {
  if (!r.level) return "not rated";
  return kind === "yoga" ? `rated ${r.level}` : `intensity: ${r.level}`;
}

export type { Rating as StrengthRating };
