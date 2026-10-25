import { describe, expect, it } from "vitest";
import {
  DIGNITY,
  GRAHAS,
  KOOTS,
  KOOT_CANCELLATIONS,
  MANGLIK_SEVERITY,
  MILAN_VERDICTS,
  NAKSHATRAS,
  RASHIS,
} from "./glossary";
import { loadKundliFixtures, loadManglikFixtures, loadMilanFixtures, rawFixture } from "../tests/fixtures";

// Every string Kundlit sends us must have a glossary entry, spelled the same
// way, so the UI and AI never show two spellings of one term.

describe("glossary covers every Kundlit string", () => {
  it("Kundli fixtures: grahas, Rashis, Nakshatras, dignities", () => {
    for (const { chart } of loadKundliFixtures()) {
      const positions = [chart.lagna, ...chart.grahas];
      for (const p of positions) {
        expect(RASHIS[p.sign_num].en).toBe(p.sign);
        expect(NAKSHATRAS[p.nakshatra_num].en).toBe(p.nakshatra);
      }
      for (const g of chart.grahas) {
        expect(GRAHAS[g.name], g.name).toBeDefined();
        expect(DIGNITY[g.dignity], g.dignity).toBeDefined();
        expect(RASHIS[g.navamsha.sign_num].en).toBe(g.navamsha.sign);
      }
    }
  });

  it("Milan fixtures: koots in standard order, verdicts, cancellations", () => {
    for (const { koots, verdict } of loadMilanFixtures()) {
      expect(koots.map((k) => k.koot)).toEqual(KOOTS.map((k) => k.api));
      koots.forEach((k, i) => expect(k.max_points).toBe(KOOTS[i].max));
      expect(MILAN_VERDICTS[verdict], verdict).toBeDefined();
      for (const k of koots) {
        if (k.cancelled_by) {
          const tail = k.cancelled_by.split(".").pop()!;
          expect(KOOT_CANCELLATIONS[tail], tail).toBeDefined();
        }
      }
    }
  });

  it("Manglik fixtures: severities", () => {
    for (const m of loadManglikFixtures()) expect(MANGLIK_SEVERITY[m.severity], m.severity).toBeDefined();
  });

  it("has 12 Rashis and 27 Nakshatras", () => {
    expect(Object.keys(RASHIS)).toHaveLength(12);
    expect(Object.keys(NAKSHATRAS)).toHaveLength(27);
  });
});

describe("stripping", () => {
  it("stored chart JSON is under 15 KB (raw response is ~150–220 KB)", () => {
    for (const { file, chart } of loadKundliFixtures()) {
      if (file.includes("synthetic")) continue; // synthetic fixtures are saved pre-stripped
      const raw = JSON.stringify(rawFixture(file)).length;
      const stored = JSON.stringify(chart).length;
      expect(stored).toBeLessThan(15_000);
      expect(stored).toBeLessThan(raw / 6); // aspects and D10 are kept for lib/astro
      expect(JSON.stringify(chart)).not.toContain("citations");
    }
  });
});
