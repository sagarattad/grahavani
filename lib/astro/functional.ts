// Functional nature of the planets for a Lagna (Parashari). Computed here
// because Kundlit's functional benefic / malefic lists contradict each other
// (the same planet can appear in both).
import { SEVEN, SIGN_LORD, type Planet } from "./relations";

const KENDRA = [4, 7, 10];
const TRIKONA = [5, 9];

/** House number (1–12) → its lord, for a Lagna sign. */
export function houseLords(lagnaSign: number): Record<number, Planet> {
  return Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, SIGN_LORD[((lagnaSign - 1 + i) % 12) + 1]]));
}

/** Houses a planet rules from the Lagna. */
export function housesRuled(p: Planet, lagnaSign: number): number[] {
  return Object.entries(houseLords(lagnaSign))
    .filter(([, l]) => l === p)
    .map(([h]) => Number(h));
}

export type FunctionalNature = {
  yogakarakas: Planet[];
  benefics: Planet[];
  malefics: Planet[];
  neutrals: Planet[];
  marakas: Planet[];
  badhaka: Planet;
  /** Per planet: houses ruled and the reason for its classification. */
  roles: Record<Planet, { houses: number[]; nature: "yogakaraka" | "benefic" | "malefic" | "neutral"; reason: string }>;
};

/**
 * - Yogakaraka: rules both a kendra (4, 7, 10) and a trikona (5, 9).
 * - Trikona lords (1, 5, 9) are benefic even when they also rule a dusthana
 *   (e.g. Jupiter, 6th and 9th lord, for Karka Lagna). Otherwise lords of 3, 6,
 *   11 and the 8th are malefic; kendra, 2nd and 12th lordship is neutral.
 * - Marakas: lords of the 2nd and 7th. Badhaka: lord of the 11th (movable
 *   Lagna), 9th (fixed) or 7th (dual).
 */
export function functionalNature(lagnaSign: number): FunctionalNature {
  const lords = houseLords(lagnaSign);
  const roles = {} as FunctionalNature["roles"];
  for (const p of SEVEN) {
    const houses = housesRuled(p, lagnaSign);
    const yk = houses.some((h) => KENDRA.includes(h)) && houses.some((h) => TRIKONA.includes(h));
    let score = 0;
    const why: string[] = [];
    for (const h of houses) {
      const [points, label] =
        h === 1 || TRIKONA.includes(h)
          ? [1, `${h} (trikona) +`]
          : [3, 6, 11].includes(h)
            ? [-1, `${h} (trishadaya) −`]
            : h === 8 && !houses.includes(1)
              ? [-1, "8 −"]
              : [0, `${h} (neutral)`];
      score += points;
      why.push(label);
    }
    const trikonaLord = houses.some((h) => h === 1 || TRIKONA.includes(h));
    const nature = yk ? "yogakaraka" : trikonaLord || score > 0 ? "benefic" : score < 0 ? "malefic" : "neutral";
    roles[p] = { houses, nature, reason: yk ? `rules kendra and trikona (${houses.join(", ")})` : `rules ${why.join(", ")}` };
  }
  const by = (n: string) => SEVEN.filter((p) => roles[p].nature === n);
  return {
    yogakarakas: by("yogakaraka"),
    benefics: [...by("yogakaraka"), ...by("benefic")],
    malefics: by("malefic"),
    neutrals: by("neutral"),
    marakas: [...new Set([lords[2], lords[7]])],
    badhaka: lords[[1, 4, 7, 10].includes(lagnaSign) ? 11 : [2, 5, 8, 11].includes(lagnaSign) ? 9 : 7],
    roles,
  };
}
