import { describe, expect, it } from "vitest";
import { activationWindows, antardashas, contains, pratyantardashas } from "./dasha";
import { loadKundliFixtures } from "../tests/fixtures";

const ms = (s: string) => new Date(s).getTime();
const TWO_MIN = 2 * 60_000;

describe.each(loadKundliFixtures())("Vimshottari split: $file", ({ chart }) => {
  const { timeline, current } = chart.vimshottari;
  const now = ms(current.as_of);
  const md = timeline.find((p) => contains(p, now))!;

  it("finds the same current Mahadasha as Kundlit", () => {
    expect(md.lord).toBe(current.mahadasha.lord);
  });

  it("computed current Antardasha matches Kundlit (lord and dates)", () => {
    const ad = antardashas(md, timeline).find((p) => contains(p, now))!;
    expect(ad.lord).toBe(current.antardasha.lord);
    expect(Math.abs(ms(ad.start) - ms(current.antardasha.start))).toBeLessThan(TWO_MIN);
    expect(Math.abs(ms(ad.end) - ms(current.antardasha.end))).toBeLessThan(TWO_MIN);
  });

  it("computed current Pratyantar Dasha matches Kundlit", () => {
    const ad = antardashas(md, timeline).find((p) => contains(p, now))!;
    const pd = pratyantardashas(ad).find((p) => contains(p, now))!;
    expect(pd.lord).toBe(current.pratyantardasha.lord);
    expect(Math.abs(ms(pd.start) - ms(current.pratyantardasha.start))).toBeLessThan(TWO_MIN);
    expect(Math.abs(ms(pd.end) - ms(current.pratyantardasha.end))).toBeLessThan(TWO_MIN);
  });

  it("Antardashas are contiguous and fill every Mahadasha exactly", () => {
    for (const m of timeline) {
      const ads = antardashas(m, timeline);
      expect(ads[0].start).toBe(new Date(m.start).toISOString());
      expect(ads[ads.length - 1].end).toBe(m.end);
      for (let i = 1; i < ads.length; i++) expect(Math.abs(ms(ads[i].start) - ms(ads[i - 1].end))).toBeLessThan(1);
    }
  });

  it("the Mahadasha running at birth is clipped, later ones have all 9", () => {
    expect(antardashas(timeline[0], timeline).length).toBeLessThanOrEqual(9);
    expect(antardashas(timeline[1], timeline)).toHaveLength(9);
  });
});

describe("activationWindows", () => {
  const { chart } = loadKundliFixtures().find((f) => f.file.includes("raipur"))!;
  const { timeline, current } = chart.vimshottari;

  it("returns only periods of the requested lords, starting from now", () => {
    const w = activationWindows(["Venus"], timeline, current.as_of);
    expect(w.length).toBeGreaterThan(0);
    for (const x of w) {
      expect(x.ad ?? x.md).toBe("Venus");
      expect(ms(x.end)).toBeGreaterThan(ms(current.as_of));
    }
  });

  it("flags the running period as current", () => {
    const w = activationWindows(["Rahu"], timeline, current.as_of);
    expect(w[0]).toMatchObject({ md: "Rahu", current: true });
  });
});
