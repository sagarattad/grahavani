import { describe, expect, it } from "vitest";
import { significators, timingCandidates } from "./timing";
import { antardashaTable } from "./dasha";
import { dateOnly } from "./format";
import { graha } from "./glossary";
import { loadKundliFixtures } from "../tests/fixtures";

const raipur = loadKundliFixtures().find((f) => f.file.includes("raipur"))!.chart;
const asOf = raipur.vimshottari.current.as_of;

describe("timing candidates", () => {
  it("marriage significators: Bhava 7 lord, Shukra, Guru, Rahu and grahas in Bhava 7", () => {
    const sig = significators(raipur, "marriage");
    expect(sig.get("Mars")).toEqual(expect.arrayContaining(["lord of Bhava 7", "placed in Bhava 7"]));
    expect([...sig.keys()].sort()).toEqual(["Jupiter", "Mars", "Rahu", "Venus"]);
  });

  it("every marriage candidate is an upcoming Antardasha of a significator, with exact table dates", () => {
    const cands = timingCandidates(raipur, asOf).marriage;
    const sigNames = [...significators(raipur, "marriage").keys()].map(graha);
    const table = antardashaTable(raipur.vimshottari.timeline).map((p) => `${dateOnly(p.start)}|${dateOnly(p.end)}`);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.length).toBeLessThanOrEqual(6);
    for (const c of cands) {
      expect(sigNames).toContain(c.antardasha);
      expect(table).toContain(`${c.from}|${c.to}`);
      expect(c.reason).toMatch(/Antardasha lord/);
    }
  });

  it("covers all five topics", () => {
    expect(Object.keys(timingCandidates(raipur, asOf)).sort()).toEqual(["career", "education", "marriage", "property", "travel"]);
  });
});
