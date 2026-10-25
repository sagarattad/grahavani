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

  it("Sade Sati and Dhaiya come from Saturn's computed transits, over a full Saturn cycle", () => {
    const mumbai = sadeSatiCard(chartOf("mumbai"), asOf);
    expect(mumbai.status).toBe("upcoming");
    // A retrograde return shows as its own range; the phases still run Rising → Peak → Setting.
    expect([...new Set(mumbai.ranges.map((r) => r.label))].slice(0, 3)).toEqual(["Rising", "Peak", "Setting"]);
    // Kundlit's 10-year window listed nothing for Raipur; a 31-year span always finds the next one.
    const ss = sadeSatiCard(raipur, asOf);
    expect(ss.status).toBe("upcoming");
    expect(ss.statusLabel).toMatch(/^Not running now — next from \d{1,2} \w{3} \d{4}$/);
    expect(ss.statusLabel).not.toMatch(/none listed/);
  });

  it("Dhaiya: a range that contains as_of is running", () => {
    expect(dhaiyaCard(raipur, asOf).status).toBe("running"); // Ardhashtama from 29 Mar 2025
  });

  it("missing data becomes 'unavailable', never an error", () => {
    const cards = buildDoshas({ chart: { ...raipur, transit: undefined }, manglik: null, kaalSarp: undefined, asOf });
    // Manglik, Sade Sati and Dhaiya are computed locally, so only Kaal Sarp can be unavailable.
    expect(cards.find((c) => c.key === "kaalSarp")!.status).toBe("unavailable");
    for (const k of ["manglik", "sadeSati", "dhaiya"]) expect(cards.find((c) => c.key === k)!.status, k).not.toBe("unavailable");
  });

  it("Manglik card: Grahavani's houses, cancellations, reasoning and Mangal periods", () => {
    const c = manglikCard(raipur, asOf);
    expect(c.statusLabel).toBe("Present — Medium");
    expect(c.details[0]).toBe("From Lagna: Mars in the 7th — yes (North Indian set 1, 4, 7, 8, 12)");
    expect(c.details.join()).toMatch(/Cancellation: Mars in its own or exaltation sign \(tradition-dependent\)/);
    expect(c.details.join()).toMatch(/Intensity: .*Total \+1 − 0?\.?\d* ?.*= 1 → Medium|Intensity: .*= 1 → Medium/);
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
