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
import { marriageTiming, marriageWindows } from "./marriage-timing";
import { dhaiyaRanges, sadeSatiRanges } from "./transits";
import { kundliFacts } from "../ai/facts";
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

  describe("round 4 (Oct 2026)", () => {
    const r4 = present ? expected.round4 : null!;
    const asOf = present ? chart.vimshottari.current.as_of : "";

    it("a cancelled dosha shows intensity Cancelled", () => {
      expect(kemadrumaCard(chart, asOf).rating.label).toBe(r4.kemadruma_rating);
    });

    it("Saturn phases: Rising from the first entry, later phases from the final entry, never overlapping", () => {
      const ss = sadeSatiRanges(chart, asOf).slice(0, 3);
      expect(Object.fromEntries(ss.map((r) => [r.label, r.start.slice(0, 10)]))).toEqual(r4.phase_starts);
      const back = ss[0].dips!.find((d) => d.direction === "back")!;
      expect([back.start.slice(0, 10), back.end.slice(0, 10)]).toEqual(expected.round5.rising_dip_back);
      expect(ss[1].earlyEntries![0].start.slice(0, 10)).toBe(expected.round5.peak_early_entry);
      for (let i = 1; i < ss.length; i++) expect(ss[i].start).toBe(ss[i - 1].end);
    });

    it("birth time: only Lagna-dependent D9 / D10 claims are tentative; planets' own signs are firm", () => {
      const { facts } = kundliFacts(chart, chart.vimshottari.current, { manglik: null, kaalSarp: null });
      const bt = facts.birth_time as { tentative: string[]; firm: string };
      for (const t of expected.round5.tentative_contains) expect(bt.tentative.join(" | ")).toContain(t);
      // Only the Moon moves fast enough: it sits 0.03° from a D10 boundary (about 3 minutes).
      expect(bt.firm).toBe(expected.round5.firm);
      expect(bt.firm).not.toMatch(/Mangal|Guru/); // Mars exalted in the D9 and Jupiter Vargottama stay firm
      expect((facts.marriage as Record<string, unknown>).timing_windows_tentative).toBe(false);
    });

    it("no repeated labels in the marriage lines", () => {
      const lines = marriageFactors(chart).comparison;
      expect(lines.find((l) => l.includes("D1 7th lord"))).toContain(r4.comparison_saturn);
      expect(lines.join()).not.toMatch(/\b(\w+): \1\b/);
    });
  });

  describe("round 3 (Oct 2026)", () => {
    const r3 = present ? expected.round3 : null!;
    const asOf = present ? chart.vimshottari.current.as_of : "";

    it("the AI gets one compound dignity; the D9 is judged on its own", () => {
      const { facts, ctx } = kundliFacts(chart, chart.vimshottari.current, { manglik: null, kaalSarp: null });
      for (const [n, v] of Object.entries(r3.d10_fact)) expect(ctx.dignities![n].d10, n).toBe(v);
      const byName = (n: string) => facts.grahas.find((g) => g.graha.includes(`(${n === "Moon" ? "Moon" : n})`))! as Record<string, unknown>;
      for (const [n, v] of Object.entries(r3.d9_role)) expect(byName(n).navamsa_role, n).toBe(v);
      expect(facts.grahas.filter((g) => (g as Record<string, unknown>).navamsa_improves_d1).map((g) => g.graha.match(/\((\w+)\)/)![1])).toEqual(r3.d9_improved);
      expect(JSON.stringify(facts.grahas)).not.toMatch(/compound/);
      expect(marriageFactors(chart).comparison).toHaveLength(r3.comparison_lines);
      expect(marriageFactors(chart).comparison.join()).not.toMatch(/weakened/);
    });

    it("Saturn phases: each once, cut at the span marked; Ashtama names", () => {
      const ss = sadeSatiRanges(chart, asOf);
      expect(ss.map((r) => r.label)).toEqual(r3.sade_sati_labels);
      expect(Boolean(ss.at(-1)!.continuesBeyond)).toBe(r3.last_sade_sati_continues_beyond);
      expect(dhaiyaRanges(chart, asOf).map((r) => r.label)).toEqual(r3.dhaiya_labels);
    });

    it("marriage windows: count, and the short overlaps left out", () => {
      const t = marriageTiming(chart, asOf);
      expect(t.windows).toHaveLength(r3.windows);
      expect(t.brief.map((w) => w.start.slice(0, 7))).toEqual(r3.brief_windows);
    });

    it("text: yogakaraka reason labels D1 and D9 separately", () => {
      const y = groupYogas(chart, asOf).find((x) => x.key === "yoga.yogakaraka_kendra")!;
      expect(y.rating.reasons.join()).toContain(r3.yogakaraka_reason);
    });
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
      for (const [n, v] of Object.entries(r2.d10_dignity)) expect(d10.planets.find((p) => p.name === n)!.fact, n).toBe(v);
    });

    it("yoga ratings, the level-average arithmetic, Dhana and shared links", () => {
      expect(Object.fromEntries(Object.keys(r2.yogas).map((k) => [k, by(k)?.rating.level]))).toEqual(r2.yogas);
      expect(by("vesi")!.rating.reasons.join()).toMatch(/average \d(\.\d+)?, rounded down/);
      expect(Boolean(by("dhana"))).toBe(r2.dhana_formed);
      expect(sharedLinks(ys)).toEqual([r2.shared_link]);
    });

    it("Venus D1 → D9 change", () => {
      expect(marriageFactors(chart).comparison[0]).toContain(r2.venus_d9 === "improved" ? "improved from the D1 (a mitigation)" : "");
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
