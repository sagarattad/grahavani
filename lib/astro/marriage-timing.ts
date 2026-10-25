// Traditional marriage-timing windows: a significator's Antardasha that
// coincides with a double transit of Jupiter and Saturn on the 7th house or
// on the 7th lord's sign. These are classical indicators, not predictions.
import type { Chart } from "../kundlit-schemas";
import { rashi } from "../glossary";
import { antardashas, contains, type SubPeriod } from "../dasha";
import { SIGN_LORD, type Planet } from "./relations";
import { houseLords } from "./functional";
import { byName, houseFrom } from "./rules";
import { darakaraka, upapada } from "./marriage";
import { slowTransits, type TransitStay } from "./transits";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
const ms = (s: string) => new Date(s).getTime();
const iso = (t: number) => new Date(t).toISOString();
/** Shorter overlaps (a retrograde sliver of days or weeks) are dropped. */
export const MIN_WINDOW_DAYS = 30;

/** Signs a transiting planet influences from where it is: its own sign and its aspects (Jupiter 5 / 7 / 9, Saturn 3 / 7 / 10). */
const ASPECTS: Record<"Jupiter" | "Saturn", number[]> = { Jupiter: [1, 5, 7, 9], Saturn: [1, 3, 7, 10] };
const influences = (s: TransitStay, target: number) => ASPECTS[s.planet].includes(houseFrom(s.sign, target));

export type Significators = {
  /** Venus, the D1 7th lord, the Darakaraka, the D9 7th lord, and a node whose dispositor is one of them. */
  primary: Map<string, string[]>;
  /** Flags only (never qualify a period): the Upapada lord and the 2nd lord. */
  secondary: Map<string, string[]>;
};

export function marriageSignificators(chart: Chart): Significators {
  const lords = houseLords(chart.lagna.sign_num);
  const primary = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, p: string, why: string) => m.set(p, [...(m.get(p) ?? []), why]);
  add(primary, "Venus", "Venus, the natural significator");
  add(primary, lords[7], "D1 7th lord");
  add(primary, darakaraka(chart).planet, "Darakaraka");
  add(primary, SIGN_LORD[wrap(chart.navamsha_lagna.sign_num + 6)], "D9 7th lord");
  for (const node of ["Rahu", "Ketu"]) {
    const disp = SIGN_LORD[byName(chart, node).sign_num];
    if (primary.has(disp) && !primary.has(node)) add(primary, node, `node in a sign of ${disp} (${primary.get(disp)![0]})`);
  }
  const secondary = new Map<string, string[]>();
  add(secondary, upapada(chart).lord, "Upapada lord");
  add(secondary, lords[2], "2nd lord (family)");
  return { primary, secondary };
}

export type Target = { sign: number; what: string };

/** The 7th house sign and the sign the 7th lord occupies, counted from the Lagna or the Moon. */
export function seventhTargets(chart: Chart, from: "Lagna" | "Moon"): Target[] {
  const base = from === "Lagna" ? chart.lagna.sign_num : byName(chart, "Moon").sign_num;
  const seventh = wrap(base + 6);
  const lord = SIGN_LORD[seventh] as Planet;
  const lordSign = byName(chart, lord).sign_num;
  return [
    { sign: seventh, what: `the 7th house from the ${from}` },
    ...(lordSign !== seventh ? [{ sign: lordSign, what: `the sign holding ${lord}, 7th lord from the ${from}` }] : []),
  ];
}

export type MarriageWindow = {
  start: string;
  end: string;
  period: string; // "Rahu–Venus"
  /** "MD and AD": both lords are significators (ranks above "AD only"). */
  rank: "MD and AD" | "AD only";
  why: string[];
  /** The same double transit also falls on a Moon-based target. */
  moonAlso: boolean;
  /** Secondary significators among the period lords (Upapada lord, 2nd lord). */
  secondary: string[];
};

/**
 * Windows over the Antardashas (current and next Mahadasha, from `asOf`)
 * whose lord is a primary significator, where Jupiter and Saturn both
 * influence the same Lagna-based target (7th house, or the 7th lord's sign)
 * at the same time. A Mahadasha lord alone never qualifies its Antardashas.
 */
export function marriageWindows(chart: Chart, asOf: string, limit = 6): MarriageWindow[] {
  return marriageTiming(chart, asOf, limit).windows;
}

/**
 * One plain sentence on the Dasha side of the windows, when it is the same for
 * all of them: "Neither window has both Dasha lords as significators." Null when
 * some windows have both and some do not (each window says so itself).
 */
export function windowsLordsNote(windows: MarriageWindow[]): string | null {
  const n = windows.length;
  if (!n) return null;
  const both = windows.filter((w) => w.rank === "MD and AD").length;
  if (both === 0) return n === 1 ? "The window does not have both Dasha lords as significators." : n === 2 ? "Neither window has both Dasha lords as significators." : "None of the windows has both Dasha lords as significators.";
  if (both === n) return n === 1 ? "The window has both Dasha lords as significators." : n === 2 ? "Both windows have both Dasha lords as significators." : "Every window has both Dasha lords as significators.";
  return null;
}

/** The first `limit` windows, how many there are in all, and the overlaps left out for being shorter than MIN_WINDOW_DAYS. */
export function marriageTiming(chart: Chart, asOf: string, limit = 6): { windows: MarriageWindow[]; total: number; brief: MarriageWindow[] } {
  const { timeline } = chart.vimshottari;
  const now = ms(asOf);
  const i = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const sig = marriageSignificators(chart);
  const ads = timeline
    .slice(i, i + 2)
    .flatMap((md) => antardashas(md, timeline))
    .filter((ad) => ms(ad.end) > now && sig.primary.has(ad.lord));
  const sat = slowTransits(chart, asOf, "Saturn");
  const jup = slowTransits(chart, asOf, "Jupiter");
  const lagna = seventhTargets(chart, "Lagna");
  const moon = seventhTargets(chart, "Moon");
  const out: MarriageWindow[] = [];

  for (const ad of ads as SubPeriod[]) {
    const from = Math.max(ms(ad.start), now);
    const to = ms(ad.end);
    for (const s of sat) {
      for (const j of jup) {
        const a = Math.max(from, ms(s.start), ms(j.start));
        const b = Math.min(to, ms(s.end), ms(j.end));
        if (a >= b) continue;
        const hits = lagna.filter((t) => influences(s, t.sign) && influences(j, t.sign));
        if (!hits.length) continue;
        const how = (x: TransitStay, t: Target) => `${x.planet} ${x.sign === t.sign ? "in" : "aspecting from"} ${rashi(x.sign)}`;
        const why = hits.map((t) => `${how(j, t)} and ${how(s, t)}: both on ${rashi(t.sign)}, ${t.what}`);
        const prev = out[out.length - 1];
        // Consecutive stays with the same double transit in the same period merge into one window.
        if (prev && prev.period === `${ad.parent}–${ad.lord}` && Math.abs(ms(prev.end) - a) < 60_000) {
          prev.end = iso(b);
          prev.why = [...new Set([...prev.why, ...why])];
          prev.moonAlso ||= moon.some((t) => influences(s, t.sign) && influences(j, t.sign));
          continue;
        }
        out.push({
          start: iso(a),
          end: iso(b),
          period: `${ad.parent}–${ad.lord}`,
          rank: sig.primary.has(ad.parent) ? "MD and AD" : "AD only",
          why,
          moonAlso: moon.some((t) => influences(s, t.sign) && influences(j, t.sign)),
          secondary: [...new Set([ad.parent, ad.lord])].flatMap((p) => (sig.secondary.get(p) ?? []).map((w) => `${p} (${w})`)),
        });
      }
    }
  }
  // A few days or weeks between retrograde ingresses is not a usable window.
  const long = (w: MarriageWindow) => ms(w.end) - ms(w.start) >= MIN_WINDOW_DAYS * 86400_000;
  const sorted = out.sort((x, y) => ms(x.start) - ms(y.start));
  const all = sorted.filter(long);
  return { windows: all.slice(0, limit), total: all.length, brief: sorted.filter((w) => !long(w)) };
}
