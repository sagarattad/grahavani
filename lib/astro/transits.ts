// Saturn and Jupiter transits computed locally (lib/astro/ephemeris.ts) over
// the current and next Mahadasha, so timing is not limited to Kundlit's
// 10-year window: Sade Sati and Dhaiya phases, Jupiter's signs, and each
// planet's house from the natal Moon and Lagna.
import type { Chart } from "../kundlit-schemas";
import { contains } from "../dasha";
import { houseFrom } from "./rules";
import { signStays, type SlowPlanet } from "./ephemeris";

export type TransitStay = { planet: SlowPlanet; sign: number; start: string; end: string; fromMoon: number; fromLagna: number };
export type PhaseRange = { label: string; start: string; end: string; current: boolean };

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

const SADE_SATI: Record<number, string> = { 12: "Rising", 1: "Peak", 2: "Setting" };
const DHAIYA: Record<number, string> = { 4: "Kantaka (4th from Chandra)", 8: "Ardhashtama (8th from Chandra)" };

/** Saturn's stays in the given houses from the Moon that end after `asOf` (a retrograde return shows as its own range). */
function saturnPhases(chart: Chart, asOf: string, labels: Record<number, string>): PhaseRange[] {
  const now = ms(asOf);
  return slowTransits(chart, asOf, "Saturn")
    .filter((s) => labels[s.fromMoon] && ms(s.end) > now)
    .map((s) => ({ label: labels[s.fromMoon], start: s.start, end: s.end, current: ms(s.start) <= now && now < ms(s.end) }));
}

/** Sade Sati: Saturn in the 12th (Rising), 1st (Peak) and 2nd (Setting) from the natal Moon. */
export const sadeSatiRanges = (chart: Chart, asOf: string) => saturnPhases(chart, asOf, SADE_SATI);

/** Shani Dhaiya: Saturn in the 4th (Kantaka) or 8th (Ardhashtama) from the natal Moon. */
export const dhaiyaRanges = (chart: Chart, asOf: string) => saturnPhases(chart, asOf, DHAIYA);

/** Classically favourable Jupiter transits from the natal Moon (gochara). */
export const JUPITER_GOOD_FROM_MOON = [2, 5, 7, 9, 11];

/** Where Saturn or Jupiter is at `asOf`. */
export function transitAt(chart: Chart, asOf: string, planet: SlowPlanet): TransitStay {
  const now = ms(asOf);
  return slowTransits(chart, asOf, planet).find((s) => ms(s.start) <= now && now < ms(s.end))!;
}
