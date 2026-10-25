// Grahavani's classical rating for present Yogas and Doshas.
// Yoga ratings come from the composite strength of every participating planet
// (lib/astro/planet-strength.ts: dignity with compound relationship, house, D9,
// combustion, retrogression, paksha; Baladi avastha only a minor input). It is
// not full Shadbala; partial Shadbala components are shown separately.
import { graha } from "./glossary";
import type { Chart, KaalSarp, Koot, Manglik } from "./kundlit-schemas";
import type { ManglikResult } from "./astro/manglik";
import { chartStrengths, strengthReason, type PlanetStrength, type StrengthLevel } from "./astro/planet-strength";

export type YogaLevel = "Strong" | "Moderate" | "Weak";
export type DoshaLevel = "High" | "Medium" | "Low";
export type Rating<L extends string> = {
  level: L | null;
  label: string;
  reasons: string[];
  /** Yogas: the planets of the combination the rating is based on. */
  basis?: string[];
};

export const PARTIAL_POINTS_NOTE =
  "When Nadi or Bhakoot Dosha is cancelled, our calculation (Kundlit) gives partial points (e.g. 4 / 8). Some websites score a cancelled dosha differently, for example as full points or as 0.";

export const RATING_NOTE =
  "Grahavani's classical rating: each planet's composite strength (dignity with compound relationship, house, D9 dignity and Vargottama, combustion, retrogression, the Moon's paksha bala; Baladi avastha as a minor factor), and a Yoga is only as strong as the planets that form it. Not full Shadbala; schools weigh these differently.";

const NODES = new Set(["Rahu", "Ketu"]);
const YOGA_LEVELS: YogaLevel[] = ["Weak", "Moderate", "Strong"];
const LEVEL_INDEX: Record<StrengthLevel, number> = { weak: 0, moderate: 1, strong: 2 };
const MAHAPURUSHA = new Set(["yoga.ruchaka", "yoga.bhadra", "yoga.hamsa", "yoga.malavya", "yoga.sasa"]);

type RatableYoga = {
  key: string;
  nabhasa: boolean;
  status: "present" | "cancelled";
  combinations: { participants: string[] }[];
};

const yogaRating = (level: YogaLevel | null, reasons: string[], basis?: string[]): Rating<YogaLevel> => ({
  level,
  label: level ? `Rated ${level}` : "Not rated",
  reasons: reasons.slice(0, 5),
  ...(basis ? { basis } : {}),
});

/**
 * A combination's level is the average strength of its planets (Rahu / Ketu
 * left out when another planet takes part), with two consistency rules:
 * - it can be Strong only if none of its planets is weak;
 * - it can be at most one level above its weakest planet.
 * The yoga takes its best combination; a Bhanga lowers it one level.
 */
export function rateYoga(y: RatableYoga, chart: Chart, strengths: Map<string, PlanetStrength> = chartStrengths(chart)): Rating<YogaLevel> {
  if (y.nabhasa) return yogaRating(null, ["Describes the overall pattern of the chart"]);

  let best: { idx: number; score: number; ps: PlanetStrength[]; capped: string | null } | null = null;
  for (const c of y.combinations) {
    const others = c.participants.filter((p) => !NODES.has(p));
    const names = others.length ? others : c.participants;
    const ps = names.map((n) => strengths.get(n));
    if (ps.length === 0 || ps.some((p) => !p)) return yogaRating(null, ["Data unavailable for this chart"]);
    const list = ps as PlanetStrength[];
    const score = list.reduce((s, p) => s + p.score, 0) / list.length;
    const fromAvg = score >= 3 ? 2 : score >= 0.5 ? 1 : 0;
    const weakest = Math.min(...list.map((p) => LEVEL_INDEX[p.level]));
    const idx = Math.min(fromAvg, weakest + 1);
    const weak = list.filter((p) => p.level === "weak").map((p) => graha(p.name));
    const capped = idx < fromAvg ? `limited by ${weak.join(" and ") || "a weaker planet"} (a yoga is only as strong as its planets)` : null;
    if (!best || idx > best.idx || (idx === best.idx && score > best.score)) best = { idx, score, ps: list, capped };
  }
  if (!best) return yogaRating(null, ["Data unavailable for this chart"]);

  let idx = best.idx;
  const reasons = best.ps.map((p) => strengthReason(p, graha(p.name)));
  if (MAHAPURUSHA.has(y.key)) reasons.unshift("Pancha Mahapurusha conditions met (own or exalted sign in a kendra)");
  if (best.capped) reasons.push(best.capped);
  if (y.status === "cancelled") {
    idx = Math.max(0, idx - 1);
    reasons.push("Cancelled by Bhanga (one level lower)");
  }
  return yogaRating(YOGA_LEVELS[idx], reasons, best.ps.map((p) => p.name));
}

/**
 * Consistency check before any text is generated: no Strong yoga may contain a
 * weak planet. Returns problems (empty = consistent); rateYoga prevents them by
 * construction, so a non-empty result means a bug.
 */
export function ratingContradictions(
  yogas: { name: string; rating: Rating<YogaLevel>; combinations: { participants: string[] }[] }[],
  strengths: Map<string, PlanetStrength>,
): string[] {
  return yogas.flatMap((y) => {
    if (y.rating.level !== "Strong") return [];
    const basis = y.rating.basis ?? [...new Set(y.combinations.flatMap((c) => c.participants))];
    const weak = basis.filter((n) => !NODES.has(n) && strengths.get(n)?.level === "weak");
    return weak.length ? [`${y.name} is rated Strong but ${weak.join(", ")} is weak`] : [];
  });
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
const MANGLIK_LEVEL: Record<string, DoshaLevel> = { high: "High", medium: "Medium", low: "Low" };

/** Grahavani's Manglik (lib/astro/manglik.ts) gives its own intensity; Kundlit's severity is the fallback. */
export function rateManglik(m: Manglik | ManglikResult): Rating<DoshaLevel> {
  if ("grahavani" in m) {
    const g = m.grahavani;
    if (!m.manglik) return doshaRating(null, g.intensity === "cancelled" ? [g.steps[g.steps.length - 1]] : []);
    return doshaRating(MANGLIK_LEVEL[g.intensity] ?? "Medium", [
      g.steps[g.steps.length - 1],
      ...g.cancellations.filter((c) => c.applies).map((c) => `${c.text} (tradition-dependent)`),
    ]);
  }
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

export function rateKemadruma(present: boolean, cancellations: string[]): Rating<DoshaLevel> {
  if (!present) return doshaRating(null, []);
  return cancellations.length
    ? doshaRating("Low", cancellations.map((c) => `Cancelled: ${c}`))
    : doshaRating("Medium", ["Formed, and none of the classical cancellations apply"]);
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
