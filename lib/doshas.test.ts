import { describe, expect, it } from "vitest";
import { buildDoshas, dhaiyaCard, kaalSarpCard, kemadrumaCard, manglikCard, sadeSatiCard } from "./doshas";
import { manglikSchema } from "./kundlit-schemas";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, rawFixture } from "../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
const raipur = chartOf("raipur");
const asOf = raipur.vimshottari.current.as_of;

describe("doshas", () => {
  it("Kemadruma is present for the Mumbai chart and absent for Raipur", () => {
    expect(kemadrumaCard(chartOf("mumbai"), asOf).status).toBe("present");
    expect(kemadrumaCard(raipur, asOf).status).toBe("absent");
  });

  it("Kaal Sarp: Present fixture and Not-present fixture", () => {
    const ks = loadKaalSarpFixtures();
    const present = kaalSarpCard(ks.find((k) => k.file.includes("present"))!, raipur, asOf);
    const absent = kaalSarpCard(ks.find((k) => k.file.includes("absent"))!, raipur, asOf);
    expect(present.status).toBe("present");
    expect(present.statusLabel).toMatch(/Shankhachuda/);
    for (const w of present.windows) expect(["Rahu", "Ketu"]).toContain(w.ad ?? w.md);
    expect(absent.status).toBe("absent");
  });

  it("Sade Sati dates come from the chart's transit data", () => {
    const mumbai = sadeSatiCard(chartOf("mumbai"));
    expect(mumbai.status).toBe("upcoming");
    expect(mumbai.ranges.map((r) => r.label)).toEqual(["Rising", "Peak", "Setting"]);
    expect(sadeSatiCard(raipur).status).toBe("none");
  });

  it("'none' only claims what Kundlit covers (periods ending within its 10-year window)", () => {
    const ss = sadeSatiCard(raipur); // as_of 22 Oct 2026, nothing listed
    expect(ss.statusLabel).toBe("Not running — none listed that ends before 22 Oct 2036");
    expect(ss.statusLabel).not.toMatch(/next 10 years/);
    expect(ss.coveredUntil).toBeDefined();
    const dh = dhaiyaCard({ ...raipur, transit: { ...raipur.transit!, dhaiya_lifecycle: { kantaka_occurrences: [], ardha_ashtama_occurrences: [] } } });
    expect(dh.statusLabel).toMatch(/none listed that ends before 22 Oct 2036/);
  });

  it("Dhaiya: a range that contains as_of is running", () => {
    expect(dhaiyaCard(raipur).status).toBe("running"); // Ardhashtama 2025-03-30 → 2028-02-23
  });

  it("missing data becomes 'unavailable', never an error", () => {
    const cards = buildDoshas({ chart: { ...raipur, transit: undefined }, manglik: null, kaalSarp: undefined, asOf });
    for (const k of ["manglik", "kaalSarp", "sadeSati", "dhaiya"]) {
      expect(cards.find((c) => c.key === k)!.status, k).toBe("unavailable");
    }
  });

  it("Manglik card shows severity, triggers and Mangal periods", () => {
    const [m] = loadManglikFixtures();
    const c = manglikCard(m, raipur, asOf);
    expect(c.statusLabel).toBe("Present — Mild");
    expect(c.details[0]).toMatch(/From Lagna/);
    for (const w of c.windows) expect(w.ad ?? w.md).toBe("Mars");
  });
});

describe("remedies are stripped when Manglik data is parsed", () => {
  it("drops Kundlit's remedies[]", () => {
    const raw = rawFixture("manglik-1990-01-15-raipur.json");
    expect(raw.remedies.length).toBeGreaterThan(0);
    expect("remedies" in manglikSchema.parse(raw)).toBe(false);
  });
});
