// Regression test for "case C", a real chart kept only on the owner's computer
// (tests/fixtures/kundlit/*case-c* are git-ignored). Skipped when absent.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { computeManglik } from "./manglik";
import { exchanges, neechaBhanga } from "./rules";
import { groupYogas, sharedLinks, sharedLinkText } from "../yogas";
import { marriageFactors } from "./marriage";
import { marriageSignificators } from "./marriage-timing";
import { kundliFacts } from "../ai/facts";
import { loadKundliFixtures } from "../../tests/fixtures";

const DIR = path.join(__dirname, "../../tests/fixtures/kundlit");
const present = existsSync(path.join(DIR, "janam-kundali-case-c.json")) && existsSync(path.join(DIR, "case-c.expected.json"));

describe.skipIf(!present)("regression: case C (local-only fixture)", () => {
  const chart = present ? loadKundliFixtures().find((f) => f.file === "janam-kundali-case-c.json")!.chart : null!;
  const ex = present ? JSON.parse(readFileSync(path.join(DIR, "case-c.expected.json"), "utf8")) : null;
  const asOf = present ? chart.vimshottari.current.as_of : "";
  const ys = present ? groupYogas(chart, asOf) : [];
  const by = (k: string) => ys.find((y) => y.key.split(".").pop() === k);

  it("Manglik: weighted references; no Lagna hit keeps it at most Medium", () => {
    const m = computeManglik(chart);
    expect(m.grahavani.steps.at(-1)).toContain(ex.manglik.total);
    expect(m.severity).toBe(ex.manglik.severity);
  });

  it("sign exchange: Raj Yoga by exchange, a Parivartana yoga, and the tradition-dependent Neecha Bhanga rule", () => {
    expect(exchanges(chart).map((x) => [x.a, x.b, x.kind])).toEqual(ex.exchanges);
    expect(by("raja")!.combinations.some((c) => c.claim.includes("exchange signs — a Raj yoga"))).toBe(true);
    expect(by(ex.parivartana)).toBeDefined();
    expect(neechaBhanga(chart)[0].rules.some((r) => r.includes("exchanges signs with its dispositor") && r.includes("(tradition-dependent)"))).toBe(true);
  });

  it("Neechabhanga Raj Yoga: partial when the D9 dignity is below neutral; rated on the planet, not the cancellers", () => {
    const nb = neechaBhanga(chart)[0];
    expect(nb.raja.state).toBe("partial");
    expect(nb.raja.why).toContain(ex.nbry.why);
    expect(by("neechabhanga")!.rating.level).toBe(ex.nbry.level);
    expect(by("yogakaraka_kendra")!.rating.level).toBe(ex.nbry.level); // consistent: both rest on the same weak planet
  });

  it("a suppressed D9 has no 7th-lord row, bullet, significator or fact", () => {
    const mf = marriageFactors(chart);
    expect(mf.d9.suppressed).toBe(true);
    expect(mf.comparison.join()).not.toContain("D9 7th lord");
    expect([...marriageSignificators(chart).primary.values()].flat()).not.toContain("D9 7th lord");
    expect(marriageSignificators(chart).primary.get("Venus")).toEqual(["Venus, the natural significator"]);
    const { facts } = kundliFacts(chart, chart.vimshottari.current, { manglik: null, kaalSarp: null });
    expect(facts.marriage).not.toHaveProperty("d9_7th_lord");
  });

  it("shared links are per link", () => {
    const texts = sharedLinks(ys, chart).map(sharedLinkText);
    for (const t of ex.sharedContains) expect(texts.join(" | ")).toContain(t);
  });
});
