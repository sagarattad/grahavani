import { describe, expect, it } from "vitest";
import { d1Houses, d9Houses, houseLabels, placeInHouses } from "./northIndian";
import { loadKundliFixtures } from "../../tests/fixtures";

const fixtures = loadKundliFixtures();

describe.each(fixtures)("North Indian placement: $file", ({ chart }) => {
  it("puts every graha in the same D1 house as the API", () => {
    const houses = d1Houses(chart);
    for (const g of chart.grahas) {
      const h = houses.find((x) => x.grahas.some((y) => y.name === g.name))!;
      expect(h.house, g.name).toBe(g.house);
    }
  });

  it("matches the API's bhava signs and occupants", () => {
    const houses = d1Houses(chart);
    for (const b of chart.bhavas) {
      const h = houses[b.num - 1];
      expect(h.signNum).toBe(b.sign_num);
      expect(h.grahas.map((g) => g.name).sort()).toEqual([...b.occupants].sort());
    }
  });

  it("D9: house 1 is the Navamsa Lagna and every graha sits in its Navamsa sign", () => {
    const houses = d9Houses(chart);
    expect(houses[0].signNum).toBe(chart.navamsha_lagna.sign_num);
    for (const g of chart.grahas) {
      const h = houses.find((x) => x.grahas.some((y) => y.name === g.name))!;
      expect(h.signNum, g.name).toBe(g.navamsha.sign_num);
    }
  });

  it("places all 9 grahas exactly once in D1 and D9", () => {
    for (const houses of [d1Houses(chart), d9Houses(chart)]) {
      expect(houses.flatMap((h) => h.grahas).length).toBe(9);
    }
  });
});

describe("houseLabels", () => {
  const g = (name: string) => ({ name, signNum: 1, retro: false, combust: false });
  const short = (n: string) => n.slice(0, 2);

  it("lays out a corner house 2 per row (same positions as before the refactor)", () => {
    const labels = houseLabels({ house: 9, signNum: 10, grahas: [g("Sun"), g("Venus"), g("Rahu")] }, short);
    expect(labels.map((l) => [l.short, l.x, l.y, l.fontSize])).toEqual([
      ["Su", 349.25, 291, 15],
      ["Ve", 380.75, 291, 15],
      ["Ra", 365, 309, 15],
    ]);
  });

  it("puts La first in house 1 and shrinks crowded houses", () => {
    const labels = houseLabels({ house: 1, signNum: 2, grahas: [g("Sun"), g("Moon"), g("Mars")] }, short);
    expect(labels[0]).toMatchObject({ short: "La", lagna: true, fontSize: 13 });
    expect(labels).toHaveLength(4);
  });
});

describe("placeInHouses edge cases", () => {
  it("wraps around for every ascendant 1–12", () => {
    for (let asc = 1; asc <= 12; asc++) {
      const grahas = Array.from({ length: 12 }, (_, i) => ({ name: `G${i + 1}`, signNum: i + 1, retro: false, combust: false }));
      const houses = placeInHouses(asc, grahas);
      expect(houses[0].signNum).toBe(asc);
      expect(houses[0].grahas[0].signNum).toBe(asc);
      // a graha in the sign just before the ascendant is in house 12
      const prev = asc === 1 ? 12 : asc - 1;
      expect(houses[11].signNum).toBe(prev);
      expect(houses.every((h) => h.grahas.length === 1)).toBe(true);
    }
  });

  it("Meena Lagna: Mesha is house 2", () => {
    const houses = placeInHouses(12, [{ name: "Mars", signNum: 1, retro: false, combust: false }]);
    expect(houses[1].signNum).toBe(1);
    expect(houses[1].grahas[0].name).toBe("Mars");
  });
});
