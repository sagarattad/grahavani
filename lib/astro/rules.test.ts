import { describe, expect, it } from "vitest";
import { adhi, aspectedBy, dhana, kemadruma, neechaBhanga, ownHouseLords, viparita } from "./rules";
import { computeManglik } from "./manglik";
import { functionalNature } from "./functional";
import { loadKundliFixtures } from "../../tests/fixtures";
import type { Chart } from "../kundlit-schemas";

const fx = loadKundliFixtures();
const chartOf = (part: string) => fx.find((f) => f.file.includes(part))!.chart;
/** Moves grahas to new signs (houses follow from the Lagna) for rule tests. */
const place = (base: Chart, lagna: number, signs: Record<string, number>): Chart => ({
  ...base,
  lagna: { ...base.lagna, sign_num: lagna },
  grahas: base.grahas.map((g) => {
    const sign = signs[g.name] ?? g.sign_num;
    return { ...g, sign_num: sign, house: ((sign - lagna + 12) % 12) + 1, combust: false };
  }),
});

describe("aspects", () => {
  it("match Kundlit's aspect_grahas on every fixture", () => {
    for (const f of fx) {
      for (const g of f.chart.grahas) {
        if (g.aspect_grahas) expect([...aspectedBy(f.chart, g)].sort(), `${f.file} ${g.name}`).toEqual([...g.aspect_grahas].sort());
      }
    }
  });
});

describe("Neecha Bhanga", () => {
  it("lists every classical condition that fires, from Lagna and Moon", () => {
    const [jup] = neechaBhanga(chartOf("mumbai")); // Jupiter debilitated in Makara
    expect(jup.planet).toBe("Jupiter");
    expect(jup.state).toBe("formed");
    expect(jup.rules).toContain("Saturn, lord of the debilitation sign, is in a kendra from the Lagna");
    expect(jup.rules).toContain("Jupiter is aspected by its dispositor Saturn");
  });

  it("a planet that rules its own exaltation sign doesn't fire 'mutual kendra' by itself", () => {
    const merc = neechaBhanga(chartOf("1999-04-12")).find((n) => n.planet === "Mercury")!;
    expect(merc.rules.join()).not.toMatch(/Mercury are in mutual kendras/);
  });

  it("Raja Yoga: full in a kendra / trikona and not combust; partial otherwise, with the reason", () => {
    expect(neechaBhanga(chartOf("2021-06-15")).find((n) => n.planet === "Mars")!.raja.state).toBe("full"); // Bhava 7
    const jup = neechaBhanga(chartOf("mumbai"))[0];
    expect(jup.raja).toMatchObject({ state: "partial", why: "Jupiter is in Bhava 12, not a kendra or trikona" });
  });

  it("no debilitated planet → nothing", () => {
    expect(neechaBhanga(chartOf("raipur"))).toEqual([]);
  });
});

describe("Viparita Raja Yogas", () => {
  it("Harsha: 6th lord in 6, 8 or 12", () => {
    const h = viparita(chartOf("bengaluru")).find((v) => v.key === "yoga.harsha")!; // Karka: Jupiter rules 6, sits in 12
    expect(h).toMatchObject({ lord: "Jupiter", house: 12, formed: true });
  });

  it("not formed when the lord is elsewhere", () => {
    expect(viparita(chartOf("raipur")).every((v) => !v.formed)).toBe(true);
  });
});

describe("Kemadruma", () => {
  it("formed but cancelled, with each classical reason", () => {
    const k = kemadruma(chartOf("raipur"));
    expect(k.state).toBe("cancelled");
    expect(k.cancellations).toEqual(["Mars is in a kendra (4th) from the Moon", "the Moon is in a kendra (Bhava 4) from the Lagna"]);
  });

  it("not formed when a planet flanks the Moon (the Sun and nodes don't count)", () => {
    expect(kemadruma(chartOf("1999-04-12"))).toMatchObject({ state: "not formed" });
  });

  it("formed and uncancelled", () => {
    // Moon alone in Mesha; everyone else (apart from Sun / nodes) in Kanya, the 6th from it; Lagna Vrishabha.
    const c = place(chartOf("raipur"), 2, { Moon: 1, Mars: 6, Mercury: 6, Jupiter: 6, Venus: 6, Saturn: 6, Sun: 9, Rahu: 9, Ketu: 3 });
    expect(kemadruma(c)).toMatchObject({ state: "formed", cancellations: [] });
  });
});

describe("Dhana and Adhi", () => {
  it("Dhana: lords of 1, 2, 5, 9, 11 by conjunction, exchange or mutual aspect", () => {
    expect(dhana(chartOf("raipur")).map((l) => l.how)).toEqual([
      "Mercury (lord of 2nd and 5th) and Saturn (lord of 9th): conjunction in Dhanu",
      "Mercury (lord of 2nd and 5th) and Jupiter (lord of 11th): exchange of signs",
      "Saturn (lord of 9th) and Jupiter (lord of 11th): mutual aspect",
    ]);
  });

  it("Adhi: benefics 6/7/8 from the Moon: three = full, one or two = partial, none = not formed", () => {
    const base = chartOf("raipur");
    expect(adhi(place(base, 2, { Moon: 1, Mercury: 6, Jupiter: 7, Venus: 8 })).state).toBe("full");
    expect(adhi(place(base, 2, { Moon: 1, Mercury: 6, Jupiter: 7, Venus: 3 })).state).toBe("partial");
    expect(adhi(place(base, 2, { Moon: 1, Mercury: 6, Jupiter: 3, Venus: 3 })).state).toBe("partial");
    expect(adhi(place(base, 2, { Moon: 1, Mercury: 3, Jupiter: 3, Venus: 3 })).state).toBe("not formed");
  });

  it("functional nature: a trikona lord stays benefic (Jupiter, 6th and 9th lord, for Karka); badhaka by Lagna type", () => {
    const f = functionalNature(4);
    expect(f.benefics).toContain("Jupiter");
    expect(f.badhaka).toBe("Venus"); // movable Lagna: 11th lord
    expect(functionalNature(2).badhaka).toBe("Saturn"); // fixed: 9th lord
    expect(functionalNature(3).badhaka).toBe("Jupiter"); // dual: 7th lord
    for (const fx2 of fx) expect([functionalNature(fx2.chart.lagna.sign_num).badhaka], fx2.file).toEqual((fx2.chart.functional as { badhakas?: string[] }).badhakas ?? [functionalNature(fx2.chart.lagna.sign_num).badhaka]);
  });

  it("own-house lords are noted", () => {
    expect(ownHouseLords(chartOf("raipur")).map((x) => x.text)).toEqual(["7th lord Mars in the 7th (own sign)"]);
  });
});

describe("Manglik (Grahavani)", () => {
  it("Mars from Lagna, Moon and Venus; South Indian 2nd shown separately", () => {
    const m = computeManglik(chartOf("mumbai"));
    expect(m.grahavani.refs.map((r) => [r.from, r.house, r.north, r.southOnly])).toEqual([
      ["Lagna", 2, false, true],
      ["Moon", 10, false, false],
      ["Venus", 1, true, false],
    ]);
  });

  it("cancellations reduce the intensity, with each step shown", () => {
    const b = computeManglik(chartOf("bengaluru")); // Karka Lagna, Mars exalted with the Moon
    expect(b.grahavani.cancellations.filter((c) => c.applies).map((c) => c.text)).toEqual([
      "Mars is yogakaraka for Karka Lagna (Karka / Simha exemption)",
      "Mars in its own or exaltation sign",
      "Mars conjunct the Moon",
    ]);
    expect(b.severity).toBe("low");
    expect(b.grahavani.steps.at(-1)).toBe("Total +1 + 1 + 1 − 1 − 1 − 0.5 = 0.5 → Low (≤ 0 cancelled, < 1 low, < 2 medium, else high)");
  });

  it("formed but cancelled when the cancellations outweigh it", () => {
    const m = computeManglik(chartOf("2014-12-15"));
    expect(m).toMatchObject({ manglik: false, severity: "cancelled" });
  });

  it("high with no cancellations", () => {
    expect(computeManglik(chartOf("2021-06-15")).severity).toBe("high");
  });

  it("Rahu with Mars is noted as disputed, never applied", () => {
    for (const f of fx) {
      const r = computeManglik(f.chart).grahavani.cancellations.find((c) => c.text === "Rahu with Mars")!;
      expect(r.applies).toBe(false);
      expect(r.note).toMatch(/disputed/);
    }
  });
});
