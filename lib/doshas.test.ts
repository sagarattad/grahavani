import { describe, expect, it } from "vitest";
import { buildDoshas, dhaiyaCard, kaalSarpCard, kemadrumaCard, manglikCard, sadeSatiCard } from "./doshas";
import { manglikSchema } from "./kundlit-schemas";
import { loadKaalSarpFixtures, loadKundliFixtures, rawFixture } from "../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
const raipur = chartOf("raipur");
const asOf = raipur.vimshottari.current.as_of;

describe("doshas", () => {
  it("Kemadruma has three states: formed, formed but cancelled (with reasons), not formed", () => {
    const mumbai = kemadrumaCard(chartOf("mumbai"), asOf);
    expect(mumbai.status).toBe("cancelled");
    expect(mumbai.statusLabel).toBe("Formed but cancelled");
    expect(mumbai.details.join()).toMatch(/Cancellation: Mars is in a kendra \(10th\) from the Moon/);
    expect(kemadrumaCard(chartOf("1999-04-12"), asOf)).toMatchObject({ status: "absent", statusLabel: "Not formed" });
    // A genuine uncancelled Kemadruma: no planet 2nd/12th from the Moon and no cancellation.
    const lonely = {
      ...raipur,
      lagna: { ...raipur.lagna, sign_num: 2 },
      grahas: raipur.grahas.map((g) => ({ ...g, sign_num: g.name === "Moon" ? 1 : g.name === "Sun" || g.name === "Rahu" || g.name === "Ketu" ? g.sign_num : 6, house: g.name === "Moon" ? 12 : 5 })),
    };
    expect(kemadrumaCard(lonely, asOf)).toMatchObject({ status: "present", statusLabel: "Formed" });
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
    // Manglik is computed from the chart itself, so it is never unavailable.
    for (const k of ["kaalSarp", "sadeSati", "dhaiya"]) {
      expect(cards.find((c) => c.key === k)!.status, k).toBe("unavailable");
    }
  });

  it("Manglik card: Grahavani's houses, cancellations, reasoning and Mangal periods", () => {
    const c = manglikCard(raipur, asOf);
    expect(c.statusLabel).toBe("Present — Medium");
    expect(c.details[0]).toBe("From Lagna: Mars in the 7th — yes (North Indian set 1, 4, 7, 8, 12)");
    expect(c.details.join()).toMatch(/Cancellation: Mars in its own or exaltation sign \(tradition-dependent\)/);
    expect(c.details.join()).toMatch(/Intensity: .*Total 1 → Medium/);
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
