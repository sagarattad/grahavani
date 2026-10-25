import { describe, expect, it } from "vitest";
import { compoundRelation, debilitationSign, dignityOf, dignityText, naturalRelation, ownSigns, temporaryFriend, vargaChange, DIGNITY_RANK } from "./relations";
import { functionalNature, houseLords } from "./functional";

describe("planetary relationships", () => {
  it("natural relations follow Parashara", () => {
    expect(naturalRelation("Jupiter", "Mars")).toBe("friend");
    expect(naturalRelation("Jupiter", "Mercury")).toBe("enemy");
    expect(naturalRelation("Jupiter", "Saturn")).toBe("neutral");
    expect(naturalRelation("Moon", "Saturn")).toBe("neutral"); // the Moon has no enemies
    expect(naturalRelation("Saturn", "Sun")).toBe("enemy");
  });

  it("temporary friends sit 2, 3, 4, 10, 11 or 12 signs away", () => {
    expect(temporaryFriend(8, 7)).toBe(true); // Tula is 12th from Vrishchika
    expect(temporaryFriend(8, 11)).toBe(true); // 4th
    expect(temporaryFriend(8, 2)).toBe(false); // 7th
    expect(temporaryFriend(8, 8)).toBe(false); // same sign
  });

  it("compound (panchadha) relation", () => {
    expect(compoundRelation("friend", true)).toBe("great friend");
    expect(compoundRelation("friend", false)).toBe("neutral");
    expect(compoundRelation("neutral", true)).toBe("friend");
    expect(compoundRelation("neutral", false)).toBe("enemy");
    expect(compoundRelation("enemy", true)).toBe("neutral");
    expect(compoundRelation("enemy", false)).toBe("great enemy");
  });

  it("Jupiter in Vrishchika with Mars in Tula: friend's sign, compound great friend", () => {
    const d = dignityOf("Jupiter", 8, { Jupiter: 8, Mars: 7 }, 14.4);
    expect(d).toMatchObject({ label: "great friend", natural: "friend", compound: "great friend", signLord: "Mars" });
    expect(dignityText(d)).toBe("friend's sign (compound: great friend)");
  });

  it("BPHS degree zones apply in the D1 for every planet", () => {
    const at = (p: Parameters<typeof dignityOf>[0], sign: number, deg: number) => dignityOf(p, sign, {}, deg).label;
    expect([at("Mercury", 6, 10), at("Mercury", 6, 17), at("Mercury", 6, 25)]).toEqual(["exalted", "moolatrikona", "own"]);
    expect([at("Moon", 2, 2), at("Moon", 2, 12)]).toEqual(["exalted", "moolatrikona"]);
    expect([at("Sun", 5, 10), at("Sun", 5, 25), at("Sun", 1, 25)]).toEqual(["moolatrikona", "own", "exalted"]);
    expect([at("Mars", 1, 5), at("Mars", 1, 20), at("Mars", 8, 5)]).toEqual(["moolatrikona", "own", "own"]);
    expect([at("Jupiter", 9, 5), at("Jupiter", 9, 15)]).toEqual(["moolatrikona", "own"]);
    expect([at("Venus", 7, 10), at("Venus", 7, 20), at("Venus", 6, 10)]).toEqual(["moolatrikona", "own", "debilitated"]);
    expect([at("Saturn", 11, 10), at("Saturn", 11, 25), at("Saturn", 7, 25)]).toEqual(["moolatrikona", "own", "exalted"]);
  });

  it("vargas: sign level, exaltation wins over own / moolatrikona", () => {
    expect(dignityOf("Mercury", 6, {}).label).toBe("exalted");
    expect(dignityOf("Moon", 2, {}).label).toBe("exalted");
    expect(dignityOf("Sun", 5, {}).label).toBe("own");
  });

  it("temporary friendship uses the D1 signs passed in, not the varga signs", () => {
    const d1 = { Moon: 2, Mercury: 6, Saturn: 11, Venus: 6, Sun: 5 };
    expect(dignityOf("Moon", 11, d1).label).toBe("friend");
    expect(dignityOf("Mercury", 5, d1).label).toBe("great friend");
    expect(dignityOf("Saturn", 3, d1).label).toBe("neutral");
    expect(dignityOf("Venus", 11, d1).label).toBe("neutral");
  });

  it("D1 → D9 rank: improved, weakened, confirmed; moolatrikona above own", () => {
    expect(DIGNITY_RANK.indexOf("moolatrikona")).toBeGreaterThan(DIGNITY_RANK.indexOf("own"));
    const deb = dignityOf("Venus", 6, {}, 10);
    expect(vargaChange(deb, dignityOf("Venus", 11, { Venus: 6, Saturn: 11 }))).toBe("improved");
    expect(vargaChange(dignityOf("Mars", 10, {}), dignityOf("Mars", 4, {}))).toBe("weakened");
    expect(vargaChange(dignityOf("Jupiter", 12, {}), dignityOf("Jupiter", 9, {}))).toBe("confirmed");
  });

  it("D9 dignity is computed from signs (no Kundlit class)", () => {
    expect(dignityOf("Mars", 10, {}).label).toBe("exalted");
    expect(dignityOf("Mars", 4, {}).label).toBe("debilitated");
    expect(dignityOf("Jupiter", 12, {}).label).toBe("own");
    expect(debilitationSign("Venus")).toBe(6);
    expect(ownSigns("Saturn")).toEqual([10, 11]);
  });
});

describe("functional nature by Lagna", () => {
  it("yogakaraka: Karka/Simha → Mars, Vrishabha/Tula → Saturn, Makara/Kumbha → Venus, others none", () => {
    const yk = (l: number) => functionalNature(l).yogakarakas;
    expect(yk(4)).toEqual(["Mars"]);
    expect(yk(5)).toEqual(["Mars"]);
    expect(yk(2)).toEqual(["Saturn"]);
    expect(yk(7)).toEqual(["Saturn"]);
    expect(yk(10)).toEqual(["Venus"]);
    expect(yk(11)).toEqual(["Venus"]);
    for (const l of [1, 3, 6, 8, 9, 12]) expect(yk(l), `Lagna ${l}`).toEqual([]);
  });

  it("Karka Lagna: Mars rules 5 and 10; marakas are the 2nd and 7th lords", () => {
    const f = functionalNature(4);
    expect(f.roles.Mars).toMatchObject({ houses: [5, 10], nature: "yogakaraka" });
    expect(f.marakas.sort()).toEqual(["Saturn", "Sun"]);
    expect(f.benefics).toContain("Moon"); // Lagna lord
    expect(f.malefics).toContain("Mercury"); // 3rd and 12th lord
    expect(houseLords(4)[8]).toBe("Saturn");
  });

  it("no planet is both benefic and malefic", () => {
    for (let l = 1; l <= 12; l++) {
      const f = functionalNature(l);
      expect(f.benefics.filter((p) => f.malefics.includes(p)), `Lagna ${l}`).toEqual([]);
    }
  });
});
