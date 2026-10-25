// Regression test for "case B", a real chart kept only on the owner's computer
// (tests/fixtures/kundlit/*case-b* are git-ignored). Skipped when absent.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chartStrengths } from "./planet-strength";
import { neechaBhanga } from "./rules";
import { groupYogas, sharedLinks } from "../yogas";
import { dhaiyaRanges, saturnOverNatal } from "./transits";
import { birthTimeCheck } from "./timing-checks";
import { loadKundliFixtures } from "../../tests/fixtures";

const DIR = path.join(__dirname, "../../tests/fixtures/kundlit");
const present = existsSync(path.join(DIR, "janam-kundali-case-b.json")) && existsSync(path.join(DIR, "case-b.expected.json"));

describe.skipIf(!present)("regression: case B (local-only fixture)", () => {
  const chart = present ? loadKundliFixtures().find((f) => f.file === "janam-kundali-case-b.json")!.chart : null!;
  const ex = present ? JSON.parse(readFileSync(path.join(DIR, "case-b.expected.json"), "utf8")) : null;
  const asOf = present ? chart.vimshottari.current.as_of : "";
  const ys = present ? groupYogas(chart, asOf) : [];
  const by = (k: string) => ys.find((y) => y.key.split(".").pop() === k);

  it("the Moon gets no combustion penalty (paksha bala scores it)", () => {
    const m = chartStrengths(chart).get("Moon")!;
    expect(m.factors.some((f) => f.label === "combust")).toBe(ex.moon.combustFactor);
    expect(m.level).toBe(ex.moon.level);
  });

  it("Neecha Bhanga: the planet exalted in the debilitation sign in a kendra; Raja Yoga partial when debilitated again in the D9", () => {
    const nb = neechaBhanga(chart).find((n) => n.planet === ex.neechaBhanga.planet)!;
    expect(nb.state).toBe(ex.neechaBhanga.state);
    expect(nb.rules).toEqual(ex.neechaBhanga.rules);
    expect(nb.raja.state).toBe(ex.neechaBhanga.raja);
    expect(nb.raja.why).toMatch(/debilitated again in the D9/);
  });

  it("yoga ratings, Budhaditya, and Raj Yoga preferring a combination without the 8th lord", () => {
    expect(Object.fromEntries(Object.keys(ex.yogas).map((k) => [k, by(k)?.rating.level]))).toEqual(ex.yogas);
    expect(by("raja")!.rating.basis!.sort()).toEqual(ex.rajaBasis);
  });

  it("Nabhasa: the seven-house akriti yogas need seven occupied consecutive houses", () => {
    for (const k of ex.absentYogas) expect(ys.some((y) => y.key === k), k).toBe(false);
    for (const k of ex.presentNabhasa) expect(ys.some((y) => y.key === k), k).toBe(true);
  });

  it("shared links: a planet pair, and one placement", () => {
    const s = sharedLinks(ys, chart);
    for (const e of ex.shared) expect(s.find((l) => l.yogas.join() === e.yogas.join())).toMatchObject(e);
  });

  it("when-active lists are complete (no silent cap)", () => {
    const periods = by("raja")!.windows.map((w) => `${w.md}–${w.ad}`);
    for (const p of ex.rajaWindowsInclude) expect(periods).toContain(p);
  });

  it("Saturn: a standalone Dhaiya phase from its first entry; transit over natal Saturn / Moon", () => {
    expect(dhaiyaRanges(chart, asOf).find((r) => r.label.startsWith("Ashtama"))!.start.slice(0, 10)).toBe(ex.ashtamaStart);
    expect(saturnOverNatal(chart, asOf)[0]).toMatchObject({ over: ex.saturnOverNatal.over });
    expect(saturnOverNatal(chart, asOf)[0].start.slice(0, 10)).toBe(ex.saturnOverNatal.start);
  });

  it("birth-time box: D1 change under 30 minutes shown; a chart under 2 minutes not interpreted", () => {
    const bt = birthTimeCheck(chart, (n) => String(n))!;
    expect(Math.floor(bt.d1.earlier)).toBe(ex.birthTime.d1EarlierMinutes);
    expect(bt.notesBy.d1.length).toBeGreaterThan(0);
    expect(bt.uninterpretable.d10).toBe(ex.birthTime.d10Uninterpretable);
    expect(bt.notes.join(" ")).toContain(ex.birthTime.noteHasNoAbout);
    expect(bt.notes.join(" ")).not.toContain("about less than");
  });
});
