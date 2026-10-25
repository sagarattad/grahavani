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
  /** Whose Lagna changes within SENSITIVE_MINUTES: claims that depend on that Lagna are tentative. */
  sensitive: { d1: boolean; d9: boolean; d10: boolean };
  /** Lagna changes within UNREADABLE_MINUTES: the chart is shown but not interpreted. */
  uninterpretable: { d9: boolean; d10: boolean };
  /** Planets that could change their own sign in that chart within SENSITIVE_MINUTES (realistically only the Moon). */
  planetsSensitive: { d1: string[]; d9: string[]; d10: string[] };
  /** "The D9 Lagna would be Simha if birth was about 5 minutes earlier." style lines (all charts). */
  notes: string[];
  /** The same lines per chart, for showing the D9 one by marriage and the D10 one by career. */
  notesBy: { d1: string[]; d9: string[]; d10: string[] };
};

/** A Lagna change within this many minutes makes claims depending on that Lagna tentative. */
export const SENSITIVE_MINUTES = 10;
/** The D1 Lagna change is shown (not treated as sensitive) up to this many minutes. */
export const D1_NOTE_MINUTES = 30;
/** A divisional chart whose Lagna changes within this many minutes is shown but not interpreted. */
export const UNREADABLE_MINUTES = 2;

/** Minutes are rounded down everywhere ("about 7 minutes" when it is 7.5; "less than 1 minute" below that). */
export const wholeMinutes = (m: number) => (m < 1 ? "less than 1 minute" : `about ${Math.floor(m)} minute${Math.floor(m) === 1 ? "" : "s"}`);

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

/** Fastest daily motion (degrees) each graha reaches, so a planet's sign change within minutes is never missed. */
const MAX_SPEED: Record<string, number> = { Moon: 15.4, Mercury: 2.2, Venus: 1.26, Sun: 1.02, Mars: 0.8, Jupiter: 0.25, Saturn: 0.13, Rahu: 0.2, Ketu: 0.2 };

/** Planets whose own sign in a chart with `size`-degree parts could change within `minutes` of the birth time. */
function planetsNearBoundary(chart: Chart, size: number, minutes: number): string[] {
  return chart.grahas
    .filter((g) => {
      const pos = g.deg_in_sign % size;
      const toEdge = Math.min(pos, size - pos);
      return toEdge < ((MAX_SPEED[g.name] ?? 1) * minutes) / 1440;
    })
    .map((g) => g.name);
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
  const add = (key: "d1" | "d9" | "d10", s: LagnaShift, within: number) => {
    const what = `The ${key.toUpperCase()} Lagna`;
    if (s.earlier < within) notesBy[key].push(`${what} would be ${signName(s.earlierSign)} if birth was ${wholeMinutes(s.earlier)} earlier.`);
    if (s.later < within) notesBy[key].push(`${what} would be ${signName(s.laterSign)} if birth was ${wholeMinutes(s.later)} later.`);
  };
  add("d1", d1, D1_NOTE_MINUTES);
  add("d9", d9, SENSITIVE_MINUTES);
  add("d10", d10, SENSITIVE_MINUTES);
  const near = (s: LagnaShift, m: number) => s.earlier < m || s.later < m;
  const sensitive = { d1: near(d1, SENSITIVE_MINUTES), d9: near(d9, SENSITIVE_MINUTES), d10: near(d10, SENSITIVE_MINUTES) };
  const uninterpretable = { d9: near(d9, UNREADABLE_MINUTES), d10: near(d10, UNREADABLE_MINUTES) };
  const planetsSensitive = {
    d1: planetsNearBoundary(chart, 30, SENSITIVE_MINUTES),
    d9: planetsNearBoundary(chart, 10 / 3, SENSITIVE_MINUTES),
    d10: planetsNearBoundary(chart, 3, SENSITIVE_MINUTES),
  };
  const notes = [...notesBy.d1, ...notesBy.d9, ...notesBy.d10];
  return { rate, d1, d9, d10, warn: notes.length > 0, sensitive, uninterpretable, planetsSensitive, notes, notesBy };
}

/**
 * A Lagna-dependent house lord (the D9 7th lord, the D10 10th lord) recomputed
 * under each neighbouring Lagna the birth-time window reaches. `firm` when the
 * same planet rules that house under all of them (the house sign itself still
 * changes, so it stays tentative).
 */
export type LordCheck = { lord: Planet; neighbours: { lagna: number; lord: Planet }[]; firm: boolean };

export function lagnaLordCheck(bt: BirthTimeCheck, chart: "d9" | "d10", lagnaSign: number, house: 7 | 10): LordCheck | null {
  if (!bt.sensitive[chart] || bt.uninterpretable[chart]) return null;
  const s = bt[chart];
  const lordOf = (lagna: number) => SIGN_LORD[wrap(lagna + house - 1)];
  const neighbours = [
    ...(s.earlier < SENSITIVE_MINUTES ? [s.earlierSign] : []),
    ...(s.later < SENSITIVE_MINUTES ? [s.laterSign] : []),
  ].map((l) => ({ lagna: l, lord: lordOf(l) }));
  const lord = lordOf(lagnaSign);
  return { lord, neighbours, firm: neighbours.every((n) => n.lord === lord) };
}

/** The birth-time caveat shown beside the marriage (D9) or career (D10) block. */
export function vargaCaveat(bt: BirthTimeCheck, chart: "d9" | "d10", lagnaSign: number, lordName: (p: string) => string): string {
  const C = chart.toUpperCase();
  if (bt.uninterpretable[chart]) return `The ${C} is shown but not interpreted: its Lagna changes within 2 minutes of the birth time.`;
  const house = chart === "d9" ? 7 : 10;
  const check = lagnaLordCheck(bt, chart, lagnaSign, house);
  const tail = `planets' own ${C} signs are firm.`;
  return check?.firm
    ? `Claims that depend on the ${C} Lagna (its houses, the ${house}th house) are tentative; the ${house}th lord ${lordName(check.lord)} is the same under the neighbouring Lagna, so it is firm, and ${tail}`
    : `Claims that depend on the ${C} Lagna (its houses, the ${house}th and its lord) are tentative; ${tail}`;
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
