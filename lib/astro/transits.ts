// Saturn and Jupiter transits computed locally (lib/astro/ephemeris.ts) over
// the current and next Mahadasha, so timing is not limited to Kundlit's
// 10-year window: Sade Sati and Dhaiya phases, Jupiter's signs, and each
// planet's house from the natal Moon and Lagna.
import type { Chart } from "../kundlit-schemas";
import { contains } from "../dasha";
import { houseFrom } from "./rules";
import { signStays, type SlowPlanet } from "./ephemeris";

export type TransitStay = { planet: SlowPlanet; sign: number; start: string; end: string; fromMoon: number; fromLagna: number };
/**
 * One Saturn phase, ending at Saturn's final exit from the sign. It starts at
 * the first entry when it opens a sequence (Sade Sati's Rising) or stands
 * alone (each Dhaiya), and at the final entry when it follows another phase
 * (Peak, Setting), so consecutive phases never overlap. `earlyEntries`: brief
 * earlier entries before that final entry. `dips`: spells outside the sign
 * inside the phase. `startsBefore` / `continuesBeyond`: cut by the span.
 */
export type PhaseRange = {
  label: string;
  start: string;
  end: string;
  current: boolean;
  earlyEntries?: { start: string; end: string }[];
  /** "back" = retrograde into the previous sign, "ahead" = into the next sign before returning. */
  dips?: { sign: number; start: string; end: string; direction: "back" | "ahead" }[];
  startsBefore?: boolean;
  continuesBeyond?: boolean;
};

const ms = (s: string) => new Date(s).getTime();
const iso = (t: number) => new Date(t).toISOString();
const YEAR = 365.25 * 86400_000;

/**
 * The span transits are computed over: from the start of the current
 * Mahadasha to the end of the next one, and at least 31 years after `asOf`
 * (one full Saturn cycle, so a next Sade Sati is always found).
 */
export function transitSpan(chart: Chart, asOf: string): { from: number; to: number } {
  const { timeline } = chart.vimshottari;
  const now = ms(asOf);
  const i = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const nextEnd = ms((timeline[i + 1] ?? timeline[i]).end);
  return { from: Math.min(ms(timeline[i].start), now), to: Math.max(nextEnd, now + 31 * YEAR) };
}

/** Every sign stay of Saturn or Jupiter over the transit span, with houses from the natal Moon and Lagna. */
export function slowTransits(chart: Chart, asOf: string, planet: SlowPlanet): TransitStay[] {
  const { from, to } = transitSpan(chart, asOf);
  const moon = chart.grahas.find((g) => g.name === "Moon")!.sign_num;
  return signStays(planet, from, to).map((s) => ({
    planet,
    sign: s.sign,
    start: iso(s.start),
    end: iso(s.end),
    fromMoon: houseFrom(moon, s.sign),
    fromLagna: houseFrom(chart.lagna.sign_num, s.sign),
  }));
}

/** House from the Moon → label, and whether the phase starts at the first entry (opens a sequence or stands alone). */
type PhaseDef = Record<number, { label: string; fromFirstEntry: boolean }>;
const SADE_SATI: PhaseDef = { 12: { label: "Rising", fromFirstEntry: true }, 1: { label: "Peak", fromFirstEntry: false }, 2: { label: "Setting", fromFirstEntry: false } };
const DHAIYA: PhaseDef = {
  4: { label: "Ardhashtama / Kantaka (4th from Chandra)", fromFirstEntry: true },
  8: { label: "Ashtama Shani (8th from Chandra)", fromFirstEntry: true },
};
// Stays of the same phase closer than this are one phase with retrograde dips between them.
const SAME_PHASE_GAP = 2 * YEAR;

/** Saturn's phases in the given houses from the Moon that end after `asOf`, each shown once (see PhaseRange). */
function saturnPhases(chart: Chart, asOf: string, defs: PhaseDef): PhaseRange[] {
  const now = ms(asOf);
  const span = transitSpan(chart, asOf);
  const stays = slowTransits(chart, asOf, "Saturn");
  const prev = (sign: number) => ((sign + 10) % 12) + 1;
  const out: PhaseRange[] = [];
  for (const house of Object.keys(defs).map(Number)) {
    let group: number[] = []; // indexes into `stays`
    const flush = () => {
      if (!group.length) return;
      const sign = stays[group[0]].sign;
      // The final entry from the previous sign, unless the phase starts at its first entry.
      const entries = group.filter((k) => k === 0 || stays[k - 1].sign === prev(sign));
      const first = defs[house].fromFirstEntry || !entries.length ? group[0] : entries[entries.length - 1];
      const last = group[group.length - 1];
      const startMs = ms(stays[first].start);
      const endMs = ms(stays[last].end);
      const earlyEntries = group.filter((k) => k < first).map((k) => ({ start: stays[k].start, end: stays[k].end }));
      const dips = stays
        .filter((x) => ms(x.start) >= startMs && ms(x.end) <= endMs && x.sign !== sign)
        .map((x) => ({ sign: x.sign, start: x.start, end: x.end, direction: x.sign === prev(sign) ? ("back" as const) : ("ahead" as const) }));
      out.push({
        label: defs[house].label,
        start: stays[first].start,
        end: stays[last].end,
        current: startMs <= now && now < endMs,
        ...(earlyEntries.length ? { earlyEntries } : {}),
        ...(dips.length ? { dips } : {}),
        ...(startMs <= span.from ? { startsBefore: true } : {}),
        ...(endMs >= span.to ? { continuesBeyond: true } : {}),
      });
      group = [];
    };
    stays.forEach((st, k) => {
      if (st.fromMoon !== house) return;
      if (group.length && ms(st.start) - ms(stays[group[group.length - 1]].end) > SAME_PHASE_GAP) flush();
      group.push(k);
    });
    flush();
  }
  return out.filter((r) => ms(r.end) > now).sort((a, b) => ms(a.start) - ms(b.start));
}

/** Sade Sati: Saturn in the 12th (Rising), 1st (Peak) and 2nd (Setting) from the natal Moon. */
export const sadeSatiRanges = (chart: Chart, asOf: string) => saturnPhases(chart, asOf, SADE_SATI);

/** Shani Dhaiya: Saturn in the 4th (Ardhashtama / Kantaka) or 8th (Ashtama Shani) from the natal Moon. */
export const dhaiyaRanges = (chart: Chart, asOf: string) => saturnPhases(chart, asOf, DHAIYA);

/**
 * Transiting Saturn in the sign of natal Saturn (Saturn return) or of the
 * natal Moon, ending after `asOf`: first entry to final exit, retrograde
 * returns included.
 */
export function saturnOverNatal(chart: Chart, asOf: string): { over: ("Saturn" | "Moon")[]; sign: number; start: string; end: string }[] {
  const now = ms(asOf);
  const natal = (n: string) => chart.grahas.find((g) => g.name === n)!.sign_num;
  const stays = slowTransits(chart, asOf, "Saturn");
  const out: { over: ("Saturn" | "Moon")[]; sign: number; start: string; end: string }[] = [];
  for (const sign of [...new Set([natal("Saturn"), natal("Moon")])]) {
    const over = (["Saturn", "Moon"] as const).filter((n) => natal(n) === sign);
    let run: TransitStay[] = [];
    const flush = () => {
      if (run.length && ms(run[run.length - 1].end) > now) out.push({ over: [...over], sign, start: run[0].start, end: run[run.length - 1].end });
      run = [];
    };
    for (const st of stays.filter((x) => x.sign === sign)) {
      if (run.length && ms(st.start) - ms(run[run.length - 1].end) > SAME_PHASE_GAP) flush();
      run.push(st);
    }
    flush();
  }
  return out.sort((a, b) => ms(a.start) - ms(b.start));
}

/** Classically favourable Jupiter transits from the natal Moon (gochara). */
export const JUPITER_GOOD_FROM_MOON = [2, 5, 7, 9, 11];

/** Where Saturn or Jupiter is at `asOf`. */
export function transitAt(chart: Chart, asOf: string, planet: SlowPlanet): TransitStay {
  const now = ms(asOf);
  return slowTransits(chart, asOf, planet).find((s) => ms(s.start) <= now && now < ms(s.end))!;
}
