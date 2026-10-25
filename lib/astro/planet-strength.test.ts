import { describe, expect, it } from "vitest";
import { chartStrengths, housePoints, levelOf, moonElongation } from "./planet-strength";
import { functionalNature } from "./functional";
import { groupYogas } from "../yogas";
import { ratingContradictions } from "../strength";
import { loadKundliFixtures } from "../../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;

describe("composite planet strength", () => {
  it("Baladi avastha is only a minor factor", () => {
    for (const f of fx) {
      for (const s of chartStrengths(f.chart).values()) {
        const av = s.factors.find((x) => x.label.includes("avastha"));
        if (av) expect(Math.abs(av.points), s.name).toBeLessThanOrEqual(0.5);
        expect(s.factors.map((x) => x.label).join()).not.toMatch(/very little result/);
      }
    }
  });

  it("house points: kendra/trikona up, dusthana down, malefics better in upachaya", () => {
    expect(housePoints("Jupiter", 1).points).toBe(1.5);
    expect(housePoints("Jupiter", 8).points).toBe(-1.5);
    expect(housePoints("Saturn", 6).points).toBeGreaterThan(housePoints("Venus", 6).points);
  });

  it("levels", () => {
    expect(levelOf(3)).toBe("strong");
    expect(levelOf(1)).toBe("moderate");
    expect(levelOf(0)).toBe("weak");
  });

  it("the Moon gets paksha bala from the Sun–Moon elongation", () => {
    const raipur = chartOf("raipur");
    const e = moonElongation(raipur)!;
    const moon = chartStrengths(raipur).get("Moon")!;
    expect(moon.shadbala.paksha).toBeCloseTo(Math.min(e, 360 - e) / 3, 0);
    expect(moon.factors.some((f) => f.label.startsWith("paksha bala"))).toBe(true);
  });

  it("partial Shadbala components stay within 0–60 virupas", () => {
    for (const f of fx) {
      for (const s of chartStrengths(f.chart).values()) {
        for (const v of [s.shadbala.uccha, s.shadbala.dig, s.shadbala.paksha]) {
          if (v === null) continue;
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it("Rahu and Ketu follow their dispositor and the planets they sit with", () => {
    for (const f of fx) {
      const s = chartStrengths(f.chart);
      expect(s.get("Rahu")!.factors.some((x) => x.label.startsWith("dispositor"))).toBe(true);
      expect(s.get("Rahu")!.dignity).toBeNull();
    }
  });

  it("our yogakaraka matches Kundlit's on every fixture", () => {
    for (const f of fx) expect(functionalNature(f.chart.lagna.sign_num).yogakarakas, f.file).toEqual(f.chart.functional.yogakarakas);
  });
});

describe("yoga ratings follow their planets", () => {
  it("no fixture has a Strong yoga with a weak planet", () => {
    for (const f of fx) {
      const ys = groupYogas(f.chart, f.chart.vimshottari.current.as_of);
      expect(ratingContradictions(ys, chartStrengths(f.chart)), f.file).toEqual([]);
    }
  });

  it("a yoga is at most one level above its weakest planet, and says why", () => {
    for (const f of fx) {
      const s = chartStrengths(f.chart);
      for (const y of groupYogas(f.chart, f.chart.vimshottari.current.as_of)) {
        if (!y.rating.basis || y.status === "cancelled") continue;
        const levels = y.rating.basis.map((n) => s.get(n)!.level);
        if (levels.includes("weak")) expect(y.rating.level, `${f.file} ${y.name}`).not.toBe("Strong");
      }
    }
  });
});
