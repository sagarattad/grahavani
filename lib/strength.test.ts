import { describe, expect, it } from "vitest";
import { rateKaalSarp, rateKootDosha, rateManglik, rateSadeSati, rateYoga } from "./strength";
import { groupYogas } from "./yogas";
import { cancellationLabel } from "./glossary";
import { janamKundaliResponse } from "./kundlit-schemas";
import { loadKaalSarpFixtures, loadKundliFixtures, loadManglikFixtures, loadMilanFixtures, rawFixture } from "../tests/fixtures";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
const ratings = (part: string) => {
  const c = chartOf(part);
  return Object.fromEntries(groupYogas(c, c.vimshottari.current.as_of).filter((y) => !y.nabhasa).map((y) => [y.key.split(".").pop(), y.rating.level?.[0] ?? null]));
};

describe("yoga ratings match the calibration on all fixtures", () => {
  // Average of the forming planets' levels, rounded down (Oct 2026 round 2). Dhana
  // now needs a 2nd or 11th lord, so 1st–9th-only links (Bengaluru, 2014) are gone.
  it.each([
    // Neecha Bhanga itself is not rated (null); its Raja Yoga is.
    // Partial Adhi with one benefic is rated Weak (a mild effect).
    ["mumbai", { raja: "S", neecha_bhanga: null, neechabhanga: "W", adhi: "W", ubhayachari: "M" }],
    ["raipur", { ruchaka: "M", raja: "M", dhana: "W", adhi: "W", vasi: "W" }],
    ["bengaluru", { ruchaka: "S", malavya: "S", raja: "M", harsha: "W", adhi: "W", yogakaraka_kendra: "S", chandra_mangala: "M", vasi: "M" }],
    ["1999-04-12", { hamsa: "M", raja: "M", dhana: "W", neecha_bhanga: null, neechabhanga: "M", vimala: "M", sunaphaa: "M", vesi: "W" }],
    ["2014-12-15", { ruchaka: "M", hamsa: "M", raja: "S", vimala: "W", yogakaraka_kendra: "S", vesi: "W" }],
    ["2018-06-25", { bhadra: "S", raja: "S", dhana: "W", neecha_bhanga: null, neechabhanga: "W", harsha: "M", adhi: "W", durdhura: "S", vesi: "W" }],
    ["2021-06-15", { sasa: "M", gajakesari: "M", raja: "M", dhana: "M", neecha_bhanga: null, neechabhanga: "W", sarala: "W", adhi: "W", anaphaa: "W", ubhayachari: "M" }],
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
    expect(r.level).toBe("Moderate"); // Mars strong, one level lower
    expect(r.reasons.join()).toMatch(/Bhanga/);
    expect(r.reasons[0]).toMatch(/Pancha Mahapurusha conditions met/);
  });

  it("reasons name each planet's strength and main factors", () => {
    expect(by("yoga.raja").rating.reasons.join(" | ")).toMatch(/Shukra: strong — .*combust/);
  });

  it("2-planet yogas: the average of the two levels, rounded down", () => {
    // Synthetic strengths, so every pair is covered regardless of the fixtures.
    const lvl = { strong: { score: 4, level: "strong" }, moderate: { score: 1, level: "moderate" }, weak: { score: -1, level: "weak" } } as const;
    const rate = (a: keyof typeof lvl, b: keyof typeof lvl, status: "present" | "cancelled" = "present") => {
      const m = new Map([
        ["Mars", { name: "Mars", factors: [], borderline: null, ...lvl[a] }],
        ["Venus", { name: "Venus", factors: [], borderline: null, ...lvl[b] }],
      ]) as unknown as Parameters<typeof rateYoga>[2];
      return rateYoga({ key: "yoga.test", nabhasa: false, status, combinations: [{ participants: ["Mars", "Venus"] }] }, raipur, m).level;
    };
    expect([rate("strong", "strong"), rate("strong", "moderate"), rate("strong", "weak")]).toEqual(["Strong", "Moderate", "Moderate"]);
    expect([rate("moderate", "moderate"), rate("moderate", "weak"), rate("weak", "weak")]).toEqual(["Moderate", "Weak", "Weak"]);
    expect(rate("strong", "strong", "cancelled")).toBe("Moderate"); // a Bhanga lowers one level
  });

  it("3 planets: Strong + Strong + Weak averages 1.33, rounded down to Moderate", () => {
    const m = new Map(
      (["Mars", "Venus", "Jupiter"] as const).map((n, i) => [n, { name: n, factors: [], borderline: null, score: i < 2 ? 4 : -1, level: i < 2 ? "strong" : "weak" }]),
    ) as unknown as Parameters<typeof rateYoga>[2];
    const r = rateYoga({ key: "yoga.test", nabhasa: false, status: "present", combinations: [{ participants: ["Mars", "Venus", "Jupiter"] }] }, raipur, m);
    expect(r.level).toBe("Moderate");
    expect(r.reasons.join()).toMatch(/average 1\.33, rounded down → Moderate/);
  });

  it("a weak planet caps the yoga and the reason says so", () => {
    const r = rateYoga({ key: "yoga.test", nabhasa: false, status: "present", combinations: [{ participants: ["Mars", "Saturn"] }] }, raipur);
    expect(r.level).not.toBe("Strong"); // Saturn is weak (8th, combust)
    expect(r.basis).toEqual(["Mars", "Saturn"]);
  });

  it("nodes are left out when another graha takes part", () => {
    const r = rateYoga({ key: "yoga.test", nabhasa: false, status: "present", combinations: [{ participants: ["Mars", "Rahu"] }] }, raipur);
    expect(r.reasons.join()).not.toMatch(/Rahu/);
  });

  it("Nabhasa yogas are not rated", () => {
    expect(by("nabhasa.pasha").rating).toMatchObject({ level: null, label: "Not rated" });
  });

  it("missing avastha no longer blocks a rating (it is a minor factor)", () => {
    const old = { ...raipur, grahas: raipur.grahas.map((g) => ({ ...g, avastha: undefined })) };
    expect(groupYogas(old, asOf).find((y) => y.key === "yoga.raja")!.rating.level).not.toBeNull();
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
    for (const m of loadManglikFixtures().filter((f) => f.severity === "mild")) {
      const r = rateManglik(m); // the Raipur and Bengaluru fixtures: mild, with 1 and 2 cancellations
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
