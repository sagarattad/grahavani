// Local sidereal positions of the slow planets (Saturn, Jupiter) for transit
// timing beyond Kundlit's 10-year window. Positions come from astronomy-engine
// (MIT, VSOP87-based, apparent geocentric, about 1′ accuracy); the sidereal
// zodiac uses the Lahiri ayanamsa as defined by Swiss Ephemeris
// (SE_SIDM_LAHIRI: 23.245524743° at JD 2435553.5, carried forward by IAU 2006
// general precession, without nutation), which matches Kundlit's
// `ayanamsha_deg`. lib/astro/ephemeris.test.ts checks both against Kundlit.
import { Body, Ecliptic, GeoVector } from "astronomy-engine";

export type SlowPlanet = "Saturn" | "Jupiter";

const DAY = 86400_000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const LAHIRI_T0 = 2435553.5; // JD
const LAHIRI_AT_T0 = 23.245524743;

const jd = (ms: number) => ms / DAY + 2440587.5;
/** IAU 2006 general precession in longitude (arcseconds), T in Julian centuries from J2000. */
const precession = (T: number) => 5028.796195 * T + 1.1054348 * T ** 2 + 0.00007964 * T ** 3 - 0.000023857 * T ** 4;

/** Lahiri ayanamsa (degrees) at an instant. */
export function lahiriAyanamsa(ms: number): number {
  const T = (ms - J2000) / (36525 * DAY);
  const T0 = (LAHIRI_T0 - 2451545) / 36525;
  return LAHIRI_AT_T0 + (precession(T) - precession(T0)) / 3600;
}

/** Sidereal (Lahiri) geocentric apparent longitude, 0–360°. */
export function siderealLongitude(body: SlowPlanet, ms: number): number {
  const tropical = Ecliptic(GeoVector(body === "Saturn" ? Body.Saturn : Body.Jupiter, new Date(ms), true)).elon;
  return (((tropical - lahiriAyanamsa(ms)) % 360) + 360) % 360;
}

export const signOf = (longitude: number) => Math.floor(longitude / 30) + 1;
const signAt = (body: SlowPlanet, ms: number) => signOf(siderealLongitude(body, ms));

export type SignStay = { sign: number; start: number; end: number };

const cache = new Map<string, SignStay[]>();

/**
 * Every stay of `body` in a sign between two instants, including retrograde
 * returns to the previous sign. Daily steps (both planets move under 0.25° a
 * day, and a retrograde loop lasts months), then bisection to under a minute
 * at each change. The first stay starts at `from` and the last ends at `to`.
 */
export function signStays(body: SlowPlanet, from: number, to: number): SignStay[] {
  const key = `${body}:${Math.floor(from / DAY)}:${Math.ceil(to / DAY)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const stays: SignStay[] = [];
  let t = from;
  let sign = signAt(body, t);
  let start = from;
  while (t < to) {
    const next = Math.min(t + DAY, to);
    const s = signAt(body, next);
    if (s !== sign) {
      let lo = t;
      let hi = next;
      while (hi - lo > 30_000) {
        const mid = (lo + hi) / 2;
        if (signAt(body, mid) === sign) lo = mid;
        else hi = mid;
      }
      stays.push({ sign, start, end: hi });
      sign = s;
      start = hi;
    }
    t = next;
  }
  stays.push({ sign, start, end: to });
  if (cache.size > 200) cache.clear();
  cache.set(key, stays);
  return stays;
}
