// Divisional signs (vargas) from a sign and degree. Checked against Kundlit's
// navamsha / dashamsha on every fixture.
import type { Chart, Graha } from "../kundlit-schemas";
import { TATKALIKA_BASIS } from "@/config/astro";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;

/** D9: movable signs start from themselves, fixed from the 9th, dual from the 5th; 3°20′ each. */
export function navamsaSign(sign: number, deg: number): number {
  const start = [1, 4, 7, 10].includes(sign) ? sign : [2, 5, 8, 11].includes(sign) ? sign + 8 : sign + 4;
  return wrap(start + Math.floor(Math.min(deg, 29.999999) / (10 / 3)));
}

/** D10: odd signs start from themselves, even signs from the 9th; 3° each. */
export function dasamsaSign(sign: number, deg: number): number {
  const start = sign % 2 === 1 ? sign : sign + 8;
  return wrap(start + Math.floor(Math.min(deg, 29.999999) / 3));
}

/** Sign and degree a small step earlier along the zodiac (crossing into the previous sign if needed). */
export function stepBack(sign: number, deg: number, by: number): { sign: number; deg: number } {
  return deg - by >= 0 ? { sign, deg: deg - by } : { sign: wrap(sign - 1), deg: 30 + deg - by };
}

/**
 * Sign of every graha used for the temporary (tatkalika) friendship when
 * judging dignity in `varga`: the D1 signs under the default Parashari
 * convention, or the varga's own signs (config/astro.ts TATKALIKA_BASIS).
 */
export function tempSigns(chart: Chart, varga: "d1" | "d9" | "d10"): Record<string, number> {
  const pick = (g: Graha) =>
    varga === "d1" || TATKALIKA_BASIS === "d1" ? g.sign_num : varga === "d9" ? g.navamsha.sign_num : (g.dashamsha?.sign_num ?? g.sign_num);
  return Object.fromEntries(chart.grahas.map((g) => [g.name, pick(g)]));
}
