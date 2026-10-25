// Grahavani's composite planet strength. Baladi avastha is only a small input;
// the main factors are dignity (with the compound relationship), house, D9
// dignity and Vargottama, combustion, retrogression and, for the Moon, paksha
// (Sun–Moon elongation). Partial Shadbala components (Uccha, Dig, Moon's
// Paksha) are computed for display and for the AI; this is NOT full Shadbala.
import type { Chart, Graha } from "../kundlit-schemas";
import { EXALTATION_POINT, SIGN_LORD, dignityOf, dignityText, isPlanet, type Dignity, type Planet } from "./relations";
import { neechaBhanga } from "./rules";

export type StrengthLevel = "strong" | "moderate" | "weak";
export type Factor = { label: string; points: number };
export type PlanetStrength = {
  name: string;
  score: number;
  level: StrengthLevel;
  dignity: Dignity | null; // null for Rahu / Ketu
  d9Dignity: Dignity | null;
  vargottama: boolean;
  factors: Factor[];
  /** Partial Shadbala components in virupas (0–60 each). */
  shadbala: { uccha: number | null; dig: number | null; paksha: number | null };
};

export const STRENGTH_THRESHOLDS = { strong: 3, moderate: 0.5 };
export const levelOf = (score: number): StrengthLevel =>
  score >= STRENGTH_THRESHOLDS.strong ? "strong" : score >= STRENGTH_THRESHOLDS.moderate ? "moderate" : "weak";

const DIGNITY_POINTS: Record<string, number> = {
  exalted: 3,
  moolatrikona: 2.5,
  own: 2,
  "great friend": 1.5,
  friend: 1,
  neutral: 0,
  enemy: -1,
  "great enemy": -1.5,
  debilitated: -3,
};
const D9_POINTS: Record<string, number> = { exalted: 1.5, moolatrikona: 1, own: 1, "great friend": 0.75, friend: 0.5, neutral: 0, enemy: -0.5, "great enemy": -0.75, debilitated: -1.5 };
// Baladi avastha: a minor factor classically.
const AVASTHA_POINTS: Record<string, number> = { Yuva: 0.5, Kumara: 0.25, Bala: 0.1, Vriddha: 0, Mrita: -0.25 };
const NATURAL_MALEFICS = new Set(["Sun", "Mars", "Saturn", "Rahu", "Ketu"]);

/** Kendra / trikona +1.5 (Lagna once), 2 / 11 +0.5, 3 0, 6 −1, 8 / 12 −1.5; malefics do better in 3 and 6 (upachaya). */
export function housePoints(name: string, house: number): Factor {
  const malefic = NATURAL_MALEFICS.has(name);
  if ([1, 4, 7, 10].includes(house)) return { label: `Bhava ${house} (kendra)`, points: 1.5 };
  if ([5, 9].includes(house)) return { label: `Bhava ${house} (trikona)`, points: 1.5 };
  if ([2, 11].includes(house)) return { label: `Bhava ${house}`, points: 0.5 };
  if (house === 3) return { label: "Bhava 3 (upachaya)", points: malefic ? 0.5 : 0 };
  if (house === 6) return { label: "Bhava 6 (dusthana, upachaya)", points: malefic ? 0 : -1 };
  return { label: `Bhava ${house} (dusthana)`, points: -1.5 };
}

const angle = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Sun–Moon elongation 0–360° (waxing below 180). */
export function moonElongation(chart: Chart): number | null {
  const sun = chart.grahas.find((g) => g.name === "Sun");
  const moon = chart.grahas.find((g) => g.name === "Moon");
  return sun && moon ? (((moon.longitude - sun.longitude) % 360) + 360) % 360 : null;
}

/** Strongest direction for Dig bala, as a longitude derived from the Lagna (equal houses). */
function digPoint(p: Planet, lagnaLong: number): number {
  if (p === "Jupiter" || p === "Mercury") return lagnaLong; // 1st
  if (p === "Sun" || p === "Mars") return lagnaLong - 90; // 10th
  if (p === "Saturn") return lagnaLong + 180; // 7th
  return lagnaLong + 90; // Moon, Venus: 4th
}

/** Strength of one planet. Rahu / Ketu: house, plus half their dispositor's and conjunct planets' strength. */
export function planetStrength(g: Graha, chart: Chart, cache = new Map<string, PlanetStrength>()): PlanetStrength {
  const hit = cache.get(g.name);
  if (hit) return hit;
  const signs = Object.fromEntries(chart.grahas.map((x) => [x.name, x.sign_num]));
  const d9Signs = Object.fromEntries(chart.grahas.map((x) => [x.name, x.navamsha.sign_num]));
  const factors: Factor[] = [];
  let result: PlanetStrength;

  if (!isPlanet(g.name)) {
    factors.push(housePoints(g.name, g.house));
    const lord = SIGN_LORD[g.sign_num];
    const disp = chart.grahas.find((x) => x.name === lord)!;
    const ds = planetStrength(disp, chart, cache);
    factors.push({ label: `dispositor ${lord} (${ds.level})`, points: round1(ds.score / 2) });
    // A node also gives the results of the planets it sits with.
    const conj = chart.grahas.filter((x) => x.sign_num === g.sign_num && isPlanet(x.name));
    if (conj.length) {
      const avg = conj.reduce((s, x) => s + planetStrength(x, chart, cache).score, 0) / conj.length;
      factors.push({ label: `with ${conj.map((x) => x.name).join(", ")}`, points: round1(avg / 2) });
    }
    const score = round1(factors.reduce((s, f) => s + f.points, 0));
    result = { name: g.name, score, level: levelOf(score), dignity: null, d9Dignity: null, vargottama: g.vargottama, factors, shadbala: { uccha: null, dig: null, paksha: null } };
  } else {
    const p = g.name;
    const dignity = dignityOf(p, g.sign_num, signs, g.dignity);
    factors.push({ label: dignityText(dignity), points: DIGNITY_POINTS[dignity.label] ?? 0 });
    if (dignity.label === "debilitated") {
      const nb = neechaBhanga(chart).find((n) => n.planet === p);
      if (nb?.state === "formed") factors.push({ label: `Neecha Bhanga (${nb.rules.length} cancelling condition${nb.rules.length > 1 ? "s" : ""})`, points: 1.5 });
    }
    factors.push(housePoints(p, g.house));
    if (g.combust && p !== "Sun") factors.push({ label: "combust", points: -1.5 });
    const d9Dignity = dignityOf(p, g.navamsha.sign_num, d9Signs);
    if (g.vargottama) factors.push({ label: "Vargottama", points: 1 });
    const d9p = D9_POINTS[d9Dignity.label] ?? 0;
    if (d9p !== 0) factors.push({ label: `D9 ${g.navamsha.sign}: ${dignityText(d9Dignity)}`, points: d9p });
    if (g.retrograde && p !== "Sun" && p !== "Moon") factors.push({ label: "retrograde (cheshta)", points: 0.5 });

    const elong = p === "Moon" ? moonElongation(chart) : null;
    const light = elong === null ? null : Math.min(elong, 360 - elong); // 0 = new Moon, 180 = full
    if (light !== null) {
      factors.push({ label: `paksha bala ${Math.round(light / 3)}/60 (${elong! < 180 ? "waxing" : "waning"}, ${Math.round(light)}° of light)`, points: round1((light / 180 - 0.5) * 3) });
    }
    const dig = round1((180 - angle(g.longitude, digPoint(p, chart.lagna.longitude))) / 3);
    if (dig >= 45) factors.push({ label: `dig bala ${Math.round(dig)}/60`, points: 0.5 });
    else if (dig <= 15) factors.push({ label: `dig bala ${Math.round(dig)}/60`, points: -0.5 });
    if (g.avastha) factors.push({ label: `${g.avastha} avastha (minor factor)`, points: AVASTHA_POINTS[g.avastha] ?? 0 });

    const score = round1(factors.reduce((s, f) => s + f.points, 0));
    result = {
      name: p,
      score,
      level: levelOf(score),
      dignity,
      d9Dignity,
      vargottama: g.vargottama,
      factors,
      shadbala: { uccha: round1((180 - angle(g.longitude, EXALTATION_POINT[p])) / 3), dig, paksha: light === null ? null : round1(light / 3) },
    };
  }
  cache.set(g.name, result);
  return result;
}

/** Strength of every graha in the chart, by name. */
export function chartStrengths(chart: Chart): Map<string, PlanetStrength> {
  const cache = new Map<string, PlanetStrength>();
  for (const g of chart.grahas) planetStrength(g, chart, cache);
  return cache;
}

/** Short reason: "Chandra: strong — moolatrikona, Bhava 11, paksha bala 37/60". */
export function strengthReason(s: PlanetStrength, grahaLabel: string, max = 3): string {
  const top = [...s.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, max);
  return `${grahaLabel}: ${s.level} — ${top.map((f) => f.label).join(", ")}`;
}
