// Regression test for "case A", a real chart kept only on the owner's computer
// (tests/fixtures/kundlit/janam-kundali-case-a.json and case-a.expected.json are
// git-ignored, so no birth details are published). Skipped when absent.
// Phases B–D add Viparita / Neecha Bhanga / Kemadruma / Manglik / D9 checks.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chartStrengths } from "./planet-strength";
import { functionalNature } from "./functional";
import { groupYogas } from "../yogas";
import { ratingContradictions } from "../strength";
import { kemadruma, neechaBhanga, viparita } from "./rules";
import { computeManglik } from "./manglik";
import { marriageFactors } from "./marriage";
import { birthTimeCheck } from "./timing-checks";
import { readDashaLord } from "./dasha-lords";
import { loadKundliFixtures } from "../../tests/fixtures";
import { careerD10 } from "./timing-checks";
import { sharedLinks } from "../yogas";
import { marriageWindows } from "./marriage-timing";
import { dashaBalanceText } from "../format";
import { kemadrumaCard } from "../doshas";

const DIR = path.join(__dirname, "../../tests/fixtures/kundlit");
const present = existsSync(path.join(DIR, "janam-kundali-case-a.json")) && existsSync(path.join(DIR, "case-a.expected.json"));

describe.skipIf(!present)("regression: case A (local-only fixture)", () => {
  const chart = present ? loadKundliFixtures().find((f) => f.file === "janam-kundali-case-a.json")!.chart : null!;
  const expected = present ? JSON.parse(readFileSync(path.join(DIR, "case-a.expected.json"), "utf8")) : null;
  const s = present ? chartStrengths(chart) : null!;
  const dm = (d: number) => `${Math.floor(d)}°${String(Math.floor((d % 1) * 60 + 1e-9)).padStart(2, "0")}′`;

  it("raw data is unchanged: degrees, padas, D9, avasthas, Dasha dates", () => {
    expect({ sign: chart.lagna.sign, deg: dm(chart.lagna.deg_in_sign) }).toEqual(expected.lagna);
    expect(chart.navamsha_lagna.sign).toBe(expected.d9_lagna);
    for (const g of chart.grahas) {
      const e = expected.grahas[g.name];
      expect({ sign: g.sign, deg: dm(g.deg_in_sign), nakshatra: g.nakshatra, pada: g.pada, d9: g.navamsha.sign, avastha: g.avastha }, g.name).toEqual({
        sign: e.sign,
        deg: e.deg,
        nakshatra: e.nakshatra,
        pada: e.pada,
        d9: e.d9,
        avastha: e.avastha,
      });
    }
    expect(chart.vimshottari.timeline.map((p) => [p.lord, p.start.slice(0, 10), p.end.slice(0, 10)])).toEqual(expected.mahadashas);
  });

  it("Mars is yogakaraka (lord of 5 and 10), in a kendra, exalted in D9", () => {
    expect(functionalNature(chart.lagna.sign_num).roles.Mars).toMatchObject({ houses: [5, 10], nature: "yogakaraka" });
    const mars = chart.grahas.find((g) => g.name === "Mars")!;
    expect([1, 4, 7, 10]).toContain(mars.house);
    expect(s.get("Mars")!.d9Dignity!.label).toBe("exalted");
  });

  it("Jupiter: friend's sign, compound great friend, Vargottama", () => {
    const j = s.get("Jupiter")!;
    expect(j.dignity).toMatchObject({ natural: "friend", compound: "great friend" });
    expect(j.vargottama).toBe(true);
  });

  it("the Moon is waning but not weak in paksha bala (~248° from the Sun)", () => {
    const m = s.get("Moon")!;
    expect(m.shadbala.paksha).toBeGreaterThan(30);
    expect(m.factors.find((f) => f.label.startsWith("paksha"))!.label).toMatch(/waning/);
    expect(m.level).not.toBe("weak");
  });

  it("Sarala Yoga: Saturn, 8th lord, in the 8th (own sign)", () => {
    expect(viparita(chart).find((v) => v.key === "yoga.sarala")).toMatchObject({ lord: "Saturn", house: 8, formed: true });
  });

  it("Venus Neecha Bhanga: Jupiter in a kendra from the Moon, Mercury (dispositor, exaltation-sign planet) conjunct; Raja Yoga partial", () => {
    const v = neechaBhanga(chart).find((n) => n.planet === "Venus")!;
    expect(v.state).toBe("formed");
    expect(v.rules).toEqual([
      "Jupiter, lord of Venus's exaltation sign, is in a kendra from the Moon",
      "Venus is conjunct its dispositor Mercury",
      "Venus is conjunct Mercury, whose exaltation sign this is",
    ]);
    expect(v.countText).toBe(expected.round2.neecha_bhanga_count);
    expect(v.raja).toMatchObject({ state: "partial", why: "Venus is in Bhava 3, not a kendra or trikona; Venus is combust" });
    const nbry = groupYogas(chart, chart.vimshottari.current.as_of).find((y) => y.key === "yoga.neechabhanga")!;
    expect(nbry.rating.level).toBe("Weak");
  });

  it("Kemadruma: formed, then cancelled (Jupiter in a kendra from the Moon)", () => {
    const k = kemadruma(chart);
    expect(k.state).toBe("cancelled");
    expect(k.cancellations).toContain("Jupiter is in a kendra (7th) from the Moon");
  });

  it("Manglik: Lagna 4th yes, Moon 6th no, Venus 2nd South Indian only; yogakaraka exemption lowers it", () => {
    const m = computeManglik(chart);
    expect(m.grahavani.refs.map((r) => [r.from, r.house, r.north, r.southOnly])).toEqual([
      ["Lagna", 4, true, false],
      ["Moon", 6, false, false],
      ["Venus", 2, false, true],
    ]);
    expect(m.grahavani.cancellations.find((c) => c.text.startsWith("Mars is yogakaraka"))!.applies).toBe(true);
    expect(m.severity).toBe("low");
    expect(m.grahavani.steps.join(" | ")).toMatch(/Mars is yogakaraka for Karka Lagna .* → −1/);
  });

  it("marriage: D9 7th Meena, lord Jupiter (Vargottama); Venus in D9 Kumbha; Darakaraka Venus; Upapada Kanya", () => {
    const m = marriageFactors(chart);
    expect(m.d9).toMatchObject({ lagnaSign: 6, seventhSign: 12, seventhLord: "Jupiter", lordVargottama: true, venusD9Sign: 11 });
    expect(m.darakaraka).toMatchObject({ planet: "Venus", eightKaraka: "Venus" });
    expect(m.atmakaraka).toBe("Sun");
    expect(m.upapada.sign).toBe(6);
  });

  it("birth time: the D9 Lagna becomes Simha about 4–5 minutes earlier; D1 has about half an hour", () => {
    const bt = birthTimeCheck(chart, (n) => String(n))!;
    expect(bt.warn).toBe(true);
    expect(bt.d9.earlierSign).toBe(5);
    expect(bt.d9.earlier).toBeGreaterThan(4);
    expect(bt.d9.earlier).toBeLessThan(5);
    expect(bt.d1.earlier).toBeGreaterThan(30);
  });

  it("Rahu Mahadasha reads through dispositor Venus and the yogakaraka Mars in a kendra", () => {
    const r = readDashaLord(chart, "Rahu", groupYogas(chart, chart.vimshottari.current.as_of));
    expect(r.node).toMatchObject({ dispositor: "Venus", conjunct: ["Mars"], withYogakarakaInKendra: true });
  });

  it("functional roles: Jupiter benefic, Venus badhaka, marakas Sun and Saturn", () => {
    const f = functionalNature(chart.lagna.sign_num);
    expect(f.benefics).toEqual(expect.arrayContaining(["Mars", "Moon", "Jupiter"]));
    expect(f.badhaka).toBe("Venus");
    expect(f.marakas.sort()).toEqual(["Saturn", "Sun"]);
  });

  it("Gajakesari and Raj Yoga ratings are consistent with the Moon's strength", () => {
    const ys = groupYogas(chart, chart.vimshottari.current.as_of);
    expect(ratingContradictions(ys, s)).toEqual([]);
    for (const k of ["yoga.gajakesari", "yoga.raja"]) {
      const y = ys.find((x) => x.key === k)!;
      expect(y.rating.reasons.join(" | "), k).toMatch(/Chandra: strong/);
      expect(y.rating.reasons.join(" | "), k).toMatch(/Borderline: depends on Chandra/);
    }
  });

  describe("round 2 (Oct 2026)", () => {
    const r2 = present ? expected.round2 : null!;
    const ys = present ? groupYogas(chart, chart.vimshottari.current.as_of) : [];
    const by = (k: string) => ys.find((y) => y.key.split(".").pop() === k);

    it("planet levels, scores and borderline flags", () => {
      expect(Object.fromEntries(Object.keys(r2.levels).map((n) => [n, s.get(n)!.level]))).toEqual(r2.levels);
      for (const [n, v] of Object.entries(r2.scores)) expect(s.get(n)!.score, n).toBeCloseTo(v as number, 6);
      expect([...s.values()].filter((x) => x.borderline).map((x) => x.name)).toEqual(r2.borderline);
    });

    it("D1 dignity with BPHS zones and D9 / D10 dignity with D1 tatkalika", () => {
      for (const [n, v] of Object.entries(r2.d1_dignity)) expect(s.get(n)!.dignity!.label, n).toBe(v);
      for (const [n, v] of Object.entries(r2.d9_dignity)) expect(s.get(n)!.d9Dignity!.label, n).toBe(v);
      const d10 = careerD10(chart)!;
      expect(d10.lagnaSign).toBe(r2.d10_lagna);
      for (const [n, v] of Object.entries(r2.d10_dignity)) {
        const text = d10.planets.find((p) => p.name === n)!.dignity;
        expect(text === v || text.endsWith(`compound: ${v})`), `${n}: ${text}`).toBe(true);
      }
    });

    it("yoga ratings, the level-average arithmetic, Dhana and shared links", () => {
      expect(Object.fromEntries(Object.keys(r2.yogas).map((k) => [k, by(k)?.rating.level]))).toEqual(r2.yogas);
      expect(by("vesi")!.rating.reasons.join()).toMatch(/average \d(\.\d+)?, rounded down/);
      expect(Boolean(by("dhana"))).toBe(r2.dhana_formed);
      expect(sharedLinks(ys)).toEqual([r2.shared_link]);
    });

    it("Venus D1 → D9 change", () => {
      const verdict = { improved: "improved in the D9", weakened: "weakened in the D9", confirmed: "the D9 confirms" }[r2.venus_d9 as "improved"];
      expect(marriageFactors(chart).comparison[0]).toContain(verdict);
    });

    it("birth-time minutes, rounded down: D1, D9 and D10", () => {
      const bt = birthTimeCheck(chart, (n) => String(n))!;
      for (const k of ["d1", "d9", "d10"] as const) expect([Math.floor(bt[k].earlier), Math.floor(bt[k].later)], k).toEqual(r2.birth_time_minutes[k]);
      expect(bt.sensitive).toEqual({ d1: false, d9: true, d10: true });
    });

    it("cleanups: Manglik signed total, Dasha balance from the timeline, no 'felt in' for a cancelled Kemadruma", () => {
      expect(computeManglik(chart).grahavani.steps.at(-1)).toContain(r2.manglik_total);
      expect(dashaBalanceText(chart.vimshottari.timeline[0].start, chart.vimshottari.timeline[0])).toBe(r2.dasha_balance);
      expect(kemadrumaCard(chart, chart.vimshottari.current.as_of).windows).toEqual([]);
    });

    it("marriage windows: significator Antardashas with a same-target double transit, well under half the span", () => {
      const asOf = chart.vimshottari.current.as_of;
      const w = marriageWindows(chart, asOf, 20);
      expect(w.map((x) => [x.start.slice(0, 7), x.period])).toEqual(r2.marriage_windows);
      expect(w.every((x) => x.rank === "MD and AD")).toBe(true);
      const span = new Date(chart.vimshottari.timeline.find((p) => p.lord === "Jupiter")!.end).getTime() - new Date(asOf).getTime();
      const covered = w.reduce((t, x) => t + new Date(x.end).getTime() - new Date(x.start).getTime(), 0);
      expect(covered / span).toBeLessThan(0.15);
    });
  });
});
