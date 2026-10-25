// Birth-time sensitivity, D10 career factors and transit overlaps.
import type { Chart } from "../kundlit-schemas";
import { SIGN_LORD, dignityFact, dignityOf, dignityText, isPlanet, type Planet } from "./relations";
import { houseLords } from "./functional";
import { byName } from "./rules";
import { dasamsaSign, navamsaSign, stepBack, tempSigns } from "./varga";
import { antardashas, contains, type SubPeriod } from "../dasha";
import { sadeSatiCard, dhaiyaCard } from "../doshas";
import { JUPITER_GOOD_FROM_MOON, slowTransits, transitAt } from "./transits";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
const ms = (s: string) => new Date(s).getTime();

// ---------- Birth-time sensitivity ----------

export type LagnaShift = { earlier: number; later: number; earlierSign: number; laterSign: number };

export type BirthTimeCheck = {
  /** Degrees per minute the Lagna moves, from Kundlit's minutes-to-next-sign (assumed steady within the sign). */
  rate: number;
  d1: LagnaShift;
  d9: LagnaShift;
  d10: LagnaShift;
  warn: boolean;
  /** Which charts change within SENSITIVE_MINUTES. */
  sensitive: { d1: boolean; d9: boolean; d10: boolean };
  /** "The D9 Lagna would be Simha if birth was about 5 minutes earlier." style lines (all charts). */
  notes: string[];
  /** The same lines per chart, for showing the D9 one by marriage and the D10 one by career. */
  notesBy: { d1: string[]; d9: string[]; d10: string[] };
};

export const SENSITIVE_MINUTES = 10;

/** Minutes are rounded down everywhere ("about 7 minutes" when it is 7.5). */
export const wholeMinutes = (m: number) => (m < 1 ? "less than 1 minute" : `${Math.floor(m)} minute${Math.floor(m) === 1 ? "" : "s"}`);

/** When the Lagna of a divisional chart with `size`-degree parts changes, earlier and later. */
function vargaShift(sign: number, deg: number, rate: number, size: number, vargaOf: (sign: number, deg: number) => number): LagnaShift {
  const pos = deg % size;
  const back = stepBack(sign, deg, pos + 1e-6);
  const fwd = deg + (size - pos) + 1e-6;
  return {
    earlier: pos / rate,
    later: (size - pos) / rate,
    earlierSign: vargaOf(back.sign, back.deg),
    laterSign: fwd >= 30 ? vargaOf(wrap(sign + 1), fwd - 30) : vargaOf(sign, fwd),
  };
}

/** Minutes until the D1, D9 and D10 Lagna change sign, earlier and later. Null without Kundlit's lagna_confidence_minutes. */
export function birthTimeCheck(chart: Chart, signName: (n: number) => string): BirthTimeCheck | null {
  const { sign_num: sign, deg_in_sign: deg, lagna_confidence_minutes: toNext } = chart.lagna;
  if (!toNext || toNext <= 0) return null;
  const rate = (30 - deg) / toNext;
  const d1 = { earlier: deg / rate, later: toNext, earlierSign: wrap(sign - 1), laterSign: wrap(sign + 1) };
  const d9 = vargaShift(sign, deg, rate, 10 / 3, navamsaSign);
  const d10 = vargaShift(sign, deg, rate, 3, dasamsaSign);
  const notesBy = { d1: [] as string[], d9: [] as string[], d10: [] as string[] };
  const add = (key: "d1" | "d9" | "d10", s: LagnaShift) => {
    const what = `The ${key.toUpperCase()} Lagna`;
    if (s.earlier < SENSITIVE_MINUTES) notesBy[key].push(`${what} would be ${signName(s.earlierSign)} if birth was about ${wholeMinutes(s.earlier)} earlier.`);
    if (s.later < SENSITIVE_MINUTES) notesBy[key].push(`${what} would be ${signName(s.laterSign)} if birth was about ${wholeMinutes(s.later)} later.`);
  };
  add("d1", d1);
  add("d9", d9);
  add("d10", d10);
  const sensitive = { d1: notesBy.d1.length > 0, d9: notesBy.d9.length > 0, d10: notesBy.d10.length > 0 };
  const notes = [...notesBy.d1, ...notesBy.d9, ...notesBy.d10];
  return { rate, d1, d9, d10, warn: notes.length > 0, sensitive, notes, notesBy };
}

// ---------- D10 (career) ----------

export type CareerD10 = {
  lagnaSign: number;
  tenthSign: number;
  tenthLord: Planet;
  /** Key planets in the D10 with their D10 dignity. */
  /** `dignity` for display ("enemy (compound neutral)"); `fact` is the one compound dignity for the AI. */
  planets: { name: string; sign: number; dignity: string; fact: string }[];
};

/** A planet's one D10 dignity (compound relation or own / exalted / …), or undefined without D10 data. */
export function d10Fact(chart: Chart, name: string): string | undefined {
  const g = chart.grahas.find((x) => x.name === name);
  if (!g?.dashamsha || !isPlanet(name)) return undefined;
  return dignityFact(dignityOf(name, g.dashamsha.sign_num, tempSigns(chart, "d10")));
}

/** D10 Lagna (computed), its 10th and lord, and the D1 10th lord, Sun, Saturn, Mercury, Jupiter in the D10. */
export function careerD10(chart: Chart): CareerD10 | null {
  if (chart.grahas.some((g) => !g.dashamsha)) return null;
  const lagnaSign = dasamsaSign(chart.lagna.sign_num, chart.lagna.deg_in_sign);
  const tenthSign = wrap(lagnaSign + 9);
  const d10Temp = tempSigns(chart, "d10");
  const d1TenthLord = houseLords(chart.lagna.sign_num)[10];
  const names = [...new Set([d1TenthLord, SIGN_LORD[tenthSign], "Sun", "Saturn", "Mercury", "Jupiter"])];
  return {
    lagnaSign,
    tenthSign,
    tenthLord: SIGN_LORD[tenthSign],
    planets: names.map((n) => {
      const g = byName(chart, n);
      const d = dignityOf(n as Planet, g.dashamsha!.sign_num, d10Temp);
      return { name: n, sign: g.dashamsha!.sign_num, dignity: dignityText(d), fact: dignityFact(d) };
    }),
  };
}

// ---------- Transits ----------

export type TransitOverlap = { transit: string; from: string; to: string; period: string; periodFrom: string; periodTo: string };

/** One Jupiter sign stay and the Antardashas it overlaps. */
export type JupiterTransit = {
  sign: number;
  from: string;
  to: string;
  fromMoon: number;
  fromLagna: number;
  /** Classically favourable from the natal Moon (2, 5, 7, 9, 11). */
  favourable: boolean;
  periods: string[];
};

/**
 * Transits (computed locally, lib/astro/transits.ts) against the Antardashas
 * of the current and next Mahadasha: Sade Sati / Dhaiya phases that overlap
 * each Antardasha, and Jupiter's sign stays with the Antardashas they overlap.
 */
export function transitOverlaps(
  chart: Chart,
  asOf: string,
): { overlaps: TransitOverlap[]; jupiter: JupiterTransit[]; jupiterNow: { sign: number; fromMoon: number; fromLagna: number } } {
  const { timeline } = chart.vimshottari;
  const now = ms(asOf);
  const i = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const ads: SubPeriod[] = timeline.slice(i, i + 2).flatMap((md) => antardashas(md, timeline)).filter((ad) => ms(ad.end) > now);
  const lastEnd = ads.length ? ms(ads[ads.length - 1].end) : now;
  const overlapsAd = (from: string, to: string, ad: SubPeriod) => ms(from) < ms(ad.end) && ms(ad.start) < ms(to);
  const ranges = [sadeSatiCard(chart, asOf), dhaiyaCard(chart, asOf)].flatMap((c) => c.ranges.map((r) => ({ transit: `${c.name} (${r.label})`, from: r.start, to: r.end })));
  const overlaps: TransitOverlap[] = [];
  for (const r of ranges) {
    for (const ad of ads) {
      if (overlapsAd(r.from, r.to, ad)) overlaps.push({ transit: r.transit, from: r.from, to: r.to, period: `${ad.parent}–${ad.lord}`, periodFrom: ad.start, periodTo: ad.end });
    }
  }
  const jupiter = slowTransits(chart, asOf, "Jupiter")
    .filter((j) => ms(j.end) > now && ms(j.start) < lastEnd)
    .map((j) => ({
      sign: j.sign,
      from: j.start,
      to: j.end,
      fromMoon: j.fromMoon,
      fromLagna: j.fromLagna,
      favourable: JUPITER_GOOD_FROM_MOON.includes(j.fromMoon),
      periods: ads.filter((ad) => overlapsAd(j.start, j.end, ad)).map((ad) => `${ad.parent}–${ad.lord}`),
    }));
  const jn = transitAt(chart, asOf, "Jupiter");
  return { overlaps, jupiter, jupiterNow: { sign: jn.sign, fromMoon: jn.fromMoon, fromLagna: jn.fromLagna } };
}
