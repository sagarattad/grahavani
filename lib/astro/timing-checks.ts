// Birth-time sensitivity, D10 career factors and transit overlaps.
import type { Chart } from "../kundlit-schemas";
import { SIGN_LORD, dignityOf, dignityText, type Planet } from "./relations";
import { houseLords } from "./functional";
import { byName } from "./rules";
import { dasamsaSign, navamsaSign, stepBack } from "./varga";
import { antardashas, contains, type SubPeriod } from "../dasha";
import { sadeSatiCard, dhaiyaCard } from "../doshas";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
const ms = (s: string) => new Date(s).getTime();

// ---------- Birth-time sensitivity ----------

export type BirthTimeCheck = {
  /** Degrees per minute the Lagna moves, from Kundlit's minutes-to-next-sign (assumed steady within the sign). */
  rate: number;
  d1: { earlier: number; later: number; earlierSign: number; laterSign: number };
  d9: { earlier: number; later: number; earlierSign: number; laterSign: number };
  warn: boolean;
  /** "D9 Lagna would be Simha if birth was about 5 minutes earlier." style lines. */
  notes: string[];
};

export const SENSITIVE_MINUTES = 10;

/** Minutes until the D1 and D9 Lagna change sign, earlier and later. Null without Kundlit's lagna_confidence_minutes. */
export function birthTimeCheck(chart: Chart, signName: (n: number) => string): BirthTimeCheck | null {
  const { sign_num: sign, deg_in_sign: deg, lagna_confidence_minutes: toNext } = chart.lagna;
  if (!toNext || toNext <= 0) return null;
  const rate = (30 - deg) / toNext;
  const nav = 10 / 3;
  const pos = deg % nav;
  const d1 = { earlier: deg / rate, later: toNext, earlierSign: wrap(sign - 1), laterSign: wrap(sign + 1) };
  const back = stepBack(sign, deg, pos + 1e-6);
  const fwd = deg + (nav - pos) + 1e-6;
  const d9 = {
    earlier: pos / rate,
    later: (nav - pos) / rate,
    earlierSign: navamsaSign(back.sign, back.deg),
    laterSign: fwd >= 30 ? navamsaSign(wrap(sign + 1), fwd - 30) : navamsaSign(sign, fwd),
  };
  const notes: string[] = [];
  const line = (what: string, mins: number, dir: string, s: number) =>
    notes.push(`${what} would be ${signName(s)} if birth was about ${mins < 1 ? "less than 1" : Math.round(mins)} minute${Math.round(mins) === 1 ? "" : "s"} ${dir}.`);
  if (d1.earlier < SENSITIVE_MINUTES) line("The D1 Lagna", d1.earlier, "earlier", d1.earlierSign);
  if (d1.later < SENSITIVE_MINUTES) line("The D1 Lagna", d1.later, "later", d1.laterSign);
  if (d9.earlier < SENSITIVE_MINUTES) line("The D9 Lagna", d9.earlier, "earlier", d9.earlierSign);
  if (d9.later < SENSITIVE_MINUTES) line("The D9 Lagna", d9.later, "later", d9.laterSign);
  return { rate, d1, d9, warn: notes.length > 0, notes };
}

// ---------- D10 (career) ----------

export type CareerD10 = {
  lagnaSign: number;
  tenthSign: number;
  tenthLord: Planet;
  /** Key planets in the D10 with their D10 dignity. */
  planets: { name: string; sign: number; dignity: string }[];
};

/** D10 Lagna (computed), its 10th and lord, and the D1 10th lord, Sun, Saturn, Mercury, Jupiter in the D10. */
export function careerD10(chart: Chart): CareerD10 | null {
  if (chart.grahas.some((g) => !g.dashamsha)) return null;
  const lagnaSign = dasamsaSign(chart.lagna.sign_num, chart.lagna.deg_in_sign);
  const tenthSign = wrap(lagnaSign + 9);
  const d10Signs = Object.fromEntries(chart.grahas.map((g) => [g.name, g.dashamsha!.sign_num]));
  const d1TenthLord = houseLords(chart.lagna.sign_num)[10];
  const names = [...new Set([d1TenthLord, SIGN_LORD[tenthSign], "Sun", "Saturn", "Mercury", "Jupiter"])];
  return {
    lagnaSign,
    tenthSign,
    tenthLord: SIGN_LORD[tenthSign],
    planets: names.map((n) => {
      const g = byName(chart, n);
      return { name: n, sign: g.dashamsha!.sign_num, dignity: dignityText(dignityOf(n as Planet, g.dashamsha!.sign_num, d10Signs)) };
    }),
  };
}

// ---------- Transits ----------

export type TransitOverlap = { transit: string; from: string; to: string; period: string; periodFrom: string; periodTo: string };

/**
 * Sade Sati / Dhaiya phases (Kundlit's dated Saturn transits) that overlap the
 * Antardashas of the current and next Mahadasha. Jupiter: current sign only
 * (Kundlit gives no dated Jupiter transits).
 */
export function transitOverlaps(chart: Chart, asOf: string): { overlaps: TransitOverlap[]; jupiterNow: { sign: number; fromMoon: number } | null } {
  const { timeline } = chart.vimshottari;
  const now = ms(asOf);
  const i = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const ads: SubPeriod[] = timeline.slice(i, i + 2).flatMap((md) => antardashas(md, timeline)).filter((ad) => ms(ad.end) > now);
  const ranges = [sadeSatiCard(chart), dhaiyaCard(chart)].flatMap((c) => c.ranges.map((r) => ({ transit: `${c.name} (${r.label})`, from: r.start, to: r.end })));
  const overlaps: TransitOverlap[] = [];
  for (const r of ranges) {
    for (const ad of ads) {
      if (ms(r.from) < ms(ad.end) && ms(ad.start) < ms(r.to)) {
        overlaps.push({ transit: r.transit, from: r.from, to: r.to, period: `${ad.parent}–${ad.lord}`, periodFrom: ad.start, periodTo: ad.end });
      }
    }
  }
  const jc = chart.transit?.jupiter_cycle;
  return { overlaps, jupiterNow: jc ? { sign: jc.sign_num, fromMoon: jc.house_from_moon } : null };
}
