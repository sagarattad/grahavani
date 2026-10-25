import { describe, expect, it } from "vitest";
import { lahiriAyanamsa, siderealLongitude, signStays } from "./ephemeris";
import { MIN_WINDOW_DAYS, marriageSignificators, marriageWindows } from "./marriage-timing";
import { dhaiyaRanges, sadeSatiRanges, transitSpan } from "./transits";
import { loadKundliFixtures, rawFixture } from "../../tests/fixtures";

const fx = loadKundliFixtures();
const ms = (s: string) => new Date(s).getTime();
const DAY = 86400_000;
const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe.each(fx)("local ephemeris against Kundlit: $file", ({ file, chart }) => {
  const birth = ms(chart.vimshottari.timeline[0].start);
  const raw = rawFixture(file).chart;

  it("Lahiri ayanamsa matches Kundlit's ayanamsha_deg", () => {
    expect(Math.abs(lahiriAyanamsa(birth) - raw.ayanamsha_deg)).toBeLessThan(0.001);
  });

  it("natal Saturn and Jupiter within 0.03°", () => {
    for (const p of ["Saturn", "Jupiter"] as const) {
      expect(angle(siderealLongitude(p, birth), chart.grahas.find((g) => g.name === p)!.longitude), p).toBeLessThan(0.03);
    }
  });

  it.skipIf(!raw.transit?.grahas)("transiting Saturn and Jupiter at Kundlit's as_of within 0.03°", () => {
    const at = ms(raw.transit.as_of);
    for (const p of ["Saturn", "Jupiter"] as const) {
      expect(angle(siderealLongitude(p, at), raw.transit.grahas.find((g: { name: string }) => g.name === p).longitude), p).toBeLessThan(0.03);
    }
  });

  it.skipIf(!chart.transit)("every Kundlit Sade Sati date is a computed Saturn sign change within one day", () => {
    const asOf = chart.transit!.as_of;
    const edges = sadeSatiRanges(chart, asOf).flatMap((r) => [ms(r.start), ms(r.end)]);
    const kundlit = chart.transit!.sade_sati_lifecycle.occurrences.flatMap((o) => Object.values(o).filter((v): v is string => typeof v === "string"));
    for (const d of kundlit) {
      if (ms(d) < ms(asOf)) continue; // ranges are listed from as_of on
      expect(Math.min(...edges.map((e) => Math.abs(e - ms(d)))) / DAY, d).toBeLessThan(1);
    }
  });
});

describe.each(fx)("Saturn phases shown once per cycle: $file", ({ chart }) => {
  const asOf = chart.vimshottari.current.as_of;
  const span = transitSpan(chart, asOf);

  it("no phase repeats within a cycle; dips are inside their phase; cuts are marked", () => {
    for (const ranges of [sadeSatiRanges(chart, asOf), dhaiyaRanges(chart, asOf)]) {
      for (const label of new Set(ranges.map((r) => r.label))) {
        const same = ranges.filter((r) => r.label === label);
        for (let i = 1; i < same.length; i++) expect(ms(same[i].start) - ms(same[i - 1].end), label).toBeGreaterThan(20 * 365 * DAY);
      }
      for (const r of ranges) {
        for (const d of r.dips ?? []) expect(ms(d.start) >= ms(r.start) && ms(d.end) <= ms(r.end)).toBe(true);
        expect(Boolean(r.continuesBeyond)).toBe(ms(r.end) >= span.to);
      }
    }
  });
});

describe("retrograde returns near sign boundaries", () => {
  it("Saturn 2027–28: Mesha, back to Meena, Mesha again", () => {
    const s = signStays("Saturn", Date.UTC(2027, 3, 1), Date.UTC(2028, 5, 1)).map((x) => [x.sign, new Date(x.start).toISOString().slice(0, 10)]);
    expect(s.map(([sign]) => sign)).toEqual([12, 1, 12, 1]);
    expect(s[1][1]).toBe("2027-06-02"); // 3 Jun 2027 IST
    expect(s[3][1]).toBe("2028-02-23");
  });

  it("Jupiter 2026–27: Karka and Simha back and forth", () => {
    const signs = signStays("Jupiter", Date.UTC(2026, 8, 1), Date.UTC(2027, 8, 1)).map((x) => x.sign);
    expect(signs).toEqual([4, 5, 4, 5]);
  });

  it("each stay ends where the next begins, and the sign really changes there", () => {
    const s = signStays("Saturn", Date.UTC(2040, 0, 1), Date.UTC(2046, 0, 1));
    for (let i = 1; i < s.length; i++) {
      expect(s[i].start).toBe(s[i - 1].end);
      expect(Math.floor(siderealLongitude("Saturn", s[i].start + 60_000) / 30) + 1).toBe(s[i].sign);
      expect(Math.floor(siderealLongitude("Saturn", s[i].start - 60_000) / 30) + 1).toBe(s[i - 1].sign);
    }
  });
});

describe.each(fx)("marriage windows: $file", ({ chart }) => {
  const asOf = chart.vimshottari.current.as_of;

  it("every window is a primary significator's Antardasha, ranked MD+AD above AD-only, under half the span", () => {
    const sig = marriageSignificators(chart);
    const w = marriageWindows(chart, asOf, 100);
    for (const x of w) {
      const [md, ad] = x.period.split("–");
      expect(sig.primary.has(ad), x.period).toBe(true); // an MD lord alone never qualifies
      expect(x.rank).toBe(sig.primary.has(md) ? "MD and AD" : "AD only");
      expect(x.why.join()).toMatch(/from the Lagna/);
      expect(ms(x.end) - ms(x.start), x.period).toBeGreaterThanOrEqual(MIN_WINDOW_DAYS * DAY);
    }
    const i = Math.max(chart.vimshottari.timeline.findIndex((p) => ms(p.start) <= ms(asOf) && ms(asOf) < ms(p.end)), 0);
    const end = ms((chart.vimshottari.timeline[i + 1] ?? chart.vimshottari.timeline[i]).end);
    const covered = w.reduce((t, x) => t + ms(x.end) - ms(x.start), 0);
    expect(covered / (end - ms(asOf))).toBeLessThan(0.5);
  });
});
