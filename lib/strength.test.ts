import { describe, expect, it } from "vitest";
import { grahaPoints, rateKaalSarp, rateKootDosha, rateManglik, rateSadeSati, rateYoga } from "./strength";
import { groupYogas } from "./yogas";
import { cancellationLabel } from "./glossary";
import { janamKundaliResponse } from "./kundlit-schemas";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures, rawFixture } from "../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
const ratings = (part: string) => {
  const c = chartOf(part);
  return Object.fromEntries(groupYogas(c, c.vimshottari.current.as_of).filter((y) => !y.nabhasa).map((y) => [y.key.split(".").pop(), y.rating.level?.[0]]));
};

describe("graha points", () => {
  const raipur = chartOf("raipur");
  const g = (n: string) => raipur.grahas.find((x) => x.name === n)!;

  it("gives reasons for each factor", () => {
    expect(grahaPoints(g("Mars"))!.reason).toBe("Mangal: own sign, Bhava 7 (+), Bala (quarter results)");
    expect(grahaPoints(g("Venus"))!.reason).toMatch(/combust/);
    expect(grahaPoints(g("Mars"))!.points).toBe(1.5 + 1 + 0.25);
  });

  it("counts house 1 once (kendra and trikona)", () => {
    const lagnaGraha = { ...g("Jupiter"), house: 1, dignity: "neutral", combust: false, avastha: "Vriddha" };
    expect(grahaPoints(lagnaGraha)!.points).toBe(1);
  });

  it("Pancha Mahapurusha mode skips dignity and house", () => {
    expect(grahaPoints(g("Mars"), "mahapurusha")!.points).toBe(0.25);
  });

  it("node-only mode uses house points only", () => {
    expect(grahaPoints(g("Rahu"), "node")!.points).toBe(1); // Bhava 9
  });

  it("missing avastha means not rated", () => {
    expect(grahaPoints({ ...g("Mars"), avastha: undefined })).toBeNull();
  });
});

describe("yoga ratings match the calibration on all fixtures", () => {
  it.each([
    ["mumbai", { ubhayachari: "W", raja: "M", neechabhanga: "W" }],
    ["raipur", { ruchaka: "W", vasi: "W", raja: "M", dhana: "M" }],
    ["bengaluru", { ruchaka: "S", malavya: "M", chandra_mangala: "S", vasi: "M", raja: "S" }],
    ["1999-04-12", { hamsa: "W", sunaphaa: "M", vesi: "W", raja: "M", dhana: "W", neechabhanga: "M" }],
    ["2014-12-15", { ruchaka: "M", hamsa: "W", vesi: "W", raja: "S", dhana: "S" }],
    ["2018-06-25", { bhadra: "W", durdhura: "M", vesi: "M", raja: "S", dhana: "M" }],
    ["2021-06-15", { sasa: "M", gajakesari: "W", anaphaa: "W", ubhayachari: "W", raja: "M", dhana: "M", neechabhanga: "W" }],
  ])("%s", (part, expected) => {
    expect(ratings(part)).toEqual(expected);
  });
});

describe("yoga rating rules", () => {
  const raipur = chartOf("raipur");
  const asOf = raipur.vimshottari.current.as_of;
  const by = (k: string) => groupYogas(raipur, asOf).find((y) => y.key === k)!;

  it("a Bhanga lowers the rating one level and says so", () => {
    const r = by("yoga.ruchaka").rating;
    expect(r.level).toBe("Weak");
    expect(r.reasons.join()).toMatch(/Bhanga/);
    expect(r.reasons[0]).toMatch(/Pancha Mahapurusha conditions met/);
  });

  it("the strongest combination wins", () => {
    const dhana = by("yoga.dhana");
    const one = rateYoga({ ...dhana, combinations: [dhana.combinations[0]] }, raipur);
    expect(["Moderate", "Weak"]).toContain(one.level);
    expect(dhana.rating.level).toBe("Moderate");
  });

  it("nodes are left out when another graha takes part", () => {
    const r = rateYoga({ key: "yoga.test", nabhasa: false, status: "present", combinations: [{ participants: ["Mars", "Rahu"] }] }, raipur);
    expect(r.reasons.join()).not.toMatch(/Rahu/);
  });

  it("Nabhasa yogas are not rated", () => {
    expect(by("nabhasa.pasha").rating).toMatchObject({ level: null, label: "Not rated" });
  });

  it("missing avastha gives 'Not rated'", () => {
    const old = { ...raipur, grahas: raipur.grahas.map((g) => ({ ...g, avastha: undefined })) };
    expect(groupYogas(old, asOf).find((y) => y.key === "yoga.raja")!.rating.level).toBeNull();
  });

  it("Kundlit's strength_score is stripped at parse time", () => {
    const parsed = janamKundaliResponse.parse(rawFixture("janam-kundali-1990-01-15-raipur.json"));
    expect("strength_score" in parsed.chart.grahas[0]).toBe(false);
    expect("strength_components" in parsed.chart.grahas[0]).toBe(false);
    expect(parsed.chart.grahas[0].avastha).toBe("Mrita");
  });
});

describe("dosha intensity", () => {
  it("Manglik: Kundlit severity, not lowered again for cancellations", () => {
    for (const m of loadManglikFixtures()) {
      const r = rateManglik(m); // both fixtures are mild, with 1 and 2 cancellations
      expect(r.level).toBe("Low");
      expect(r.reasons.join()).toMatch(/already reflected/);
    }
    expect(rateManglik({ ...loadManglikFixtures()[0], severity: "medium", cancellations: [] }).level).toBe("Medium");
  });

  it("Kaal Sarp full → High", () => {
    expect(rateKaalSarp(loadKaalSarpFixtures().find((k) => k.file.includes("present"))!).level).toBe("High");
  });

  it("Nadi / Bhakoot: not cancelled → High, cancelled → Low (real fixtures)", () => {
    const koot = (file: string, name: string) => loadMilanFixtures().find((f) => f.file.includes(file))!.koots.find((k) => k.koot === name)!;
    const rate = (k: ReturnType<typeof koot>) => rateKootDosha(k, cancellationLabel(k.cancelled_by));
    expect(rate(koot("nadi-dosha", "Nadi")).level).toBe("High"); // 0 / 8
    const nadiCancelled = rate(koot("nadi-cancelled", "Nadi")); // 4 / 8
    expect(nadiCancelled.level).toBe("Low");
    expect(nadiCancelled.reasons.join()).toMatch(/partial points .*4 \/ 8/);
    expect(rate(koot("bhakoot-cancelled", "Bhakoot")).level).toBe("Low"); // 3.5 / 7
  });

  it("Sade Sati: Peak → High, Rising / Setting → Medium", () => {
    expect(rateSadeSati("Peak").level).toBe("High");
    expect(rateSadeSati("Setting").level).toBe("Medium");
    expect(rateSadeSati(null).level).toBeNull();
  });
});
