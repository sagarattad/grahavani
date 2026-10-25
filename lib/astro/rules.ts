// Grahavani's own classical yoga / dosha rules (Parashari), computed from the
// chart's positions. Each result is one of three states: formed, formed but
// cancelled (with the reason), or not formed. Kundlit's versions of these
// (Neecha Bhanga, Dhana, Kemadruma) are replaced by these in the app.
import type { Chart, Graha } from "../kundlit-schemas";
import { EXALTATION_SIGN, SIGN_LORD, debilitationSign, isPlanet, signDistance, type Planet } from "./relations";
import { houseLords } from "./functional";

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];

export type RuleState = "formed" | "cancelled" | "not formed";

export const byName = (chart: Chart, n: string) => chart.grahas.find((g) => g.name === n)!;
/** Houses (1–12) counted from `from` sign to `to` sign. */
export const houseFrom = (fromSign: number, toSign: number) => signDistance(fromSign, toSign);
export const inKendraFrom = (fromSign: number, toSign: number) => KENDRA.includes(houseFrom(fromSign, toSign));
export const conjunct = (a: Graha, b: Graha) => a.name !== b.name && a.sign_num === b.sign_num;

const ASPECT_OFFSETS: Record<string, number[]> = { Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10], Rahu: [5, 7, 9], Ketu: [5, 7, 9] };
/** Parashari full aspects: every graha the 7th; Mars 4/8, Jupiter 5/9, Saturn 3/10, nodes 5/9. */
export function aspects(from: Graha, to: Graha): boolean {
  if (from.name === to.name) return false;
  return (ASPECT_OFFSETS[from.name] ?? [7]).includes(houseFrom(from.sign_num, to.sign_num));
}
/** Grahas a graha aspects (same rule Kundlit uses; checked in tests). */
export const aspectedBy = (chart: Chart, g: Graha) => chart.grahas.filter((x) => aspects(g, x)).map((x) => x.name);

// ---------- Neecha Bhanga ----------

export type NeechaBhanga = {
  planet: Planet;
  state: RuleState; // "formed" = debility cancelled; "not formed" = debility stands
  rules: string[]; // the classical conditions that fire
  cancelling: string[]; // planets involved in the cancellation
  /** Conditions grouped by the planet that provides them (the D9 rule counts under the planet itself). */
  byPlanet: { planet: string; rules: number }[];
  /** "3 conditions from 2 planets (Mercury meets 2)". */
  countText: string;
  /** Neecha Bhanga Raja Yoga: full when the planet also sits in a kendra / trikona from the Lagna and is not combust. */
  raja: { state: "full" | "partial" | "not formed"; why: string };
};

/**
 * For each debilitated planet, the classical cancellation conditions, each
 * checked from both the Lagna and the Moon where a kendra is involved:
 * 1. lord of the debilitation sign (dispositor) in a kendra;
 * 2. lord of the planet's exaltation sign in a kendra;
 * 3. those two lords in mutual kendra;
 * 4. the planet conjunct or aspected by its dispositor;
 * 5. the planet conjunct the planet whose exaltation sign it is (sign level, BPHS);
 * 6. the planet exalted in the D9.
 */
export function neechaBhanga(chart: Chart): NeechaBhanga[] {
  const lagna = chart.lagna.sign_num;
  const moon = byName(chart, "Moon").sign_num;
  return chart.grahas
    .filter((g): g is Graha & { name: Planet } => isPlanet(g.name) && g.sign_num === debilitationSign(g.name))
    .map((g) => {
      const p = g.name;
      const rules: string[] = [];
      const cancelling = new Set<string>();
      const counts = new Map<string, number>();
      const dispName = SIGN_LORD[g.sign_num];
      const exLordName = SIGN_LORD[EXALTATION_SIGN[p]];
      const disp = byName(chart, dispName);
      const exLord = byName(chart, exLordName);
      const kendraFrom = (x: Graha) => [inKendraFrom(lagna, x.sign_num) && "Lagna", inKendraFrom(moon, x.sign_num) && "Moon"].filter(Boolean).join(" and ");

      const fire = (text: string, ...by: string[]) => {
        rules.push(text);
        for (const n of by) cancelling.add(n);
        for (const n of by.length ? by : [p]) counts.set(n, (counts.get(n) ?? 0) + 1);
      };

      const d = kendraFrom(disp);
      if (dispName !== p && d) fire(`${dispName}, lord of the debilitation sign, is in a kendra from the ${d}`, dispName);
      const e = kendraFrom(exLord);
      if (exLordName !== p && e) fire(`${exLordName}, lord of ${p}'s exaltation sign, is in a kendra from the ${e}`, exLordName);
      if (dispName !== p && exLordName !== p && dispName !== exLordName && inKendraFrom(disp.sign_num, exLord.sign_num)) fire(`${dispName} and ${exLordName} are in mutual kendras`, dispName, exLordName);
      if (dispName !== p && (conjunct(g, disp) || aspects(disp, g)))
        fire(`${p} is ${conjunct(g, disp) ? "conjunct" : "aspected by"} its dispositor ${dispName}`, dispName);
      const exaltedHere = chart.grahas.find((x) => isPlanet(x.name) && EXALTATION_SIGN[x.name] === g.sign_num);
      if (exaltedHere && conjunct(g, exaltedHere)) fire(`${p} is conjunct ${exaltedHere.name}, whose exaltation sign this is`, exaltedHere.name);
      if (g.navamsha.sign_num === EXALTATION_SIGN[p]) fire(`${p} is exalted in the D9`);

      const state: RuleState = rules.length ? "formed" : "not formed";
      const goodHouse = KENDRA.includes(g.house) || TRIKONA.includes(g.house);
      const raja: NeechaBhanga["raja"] = !rules.length
        ? { state: "not formed", why: "the debility is not cancelled" }
        : goodHouse && !g.combust
          ? { state: "full", why: `${p} is in Bhava ${g.house} (kendra / trikona) and not combust` }
          : {
              state: "partial",
              why: [!goodHouse && `${p} is in Bhava ${g.house}, not a kendra or trikona`, g.combust && `${p} is combust`].filter(Boolean).join("; "),
            };
      const byPlanet = [...counts].map(([planet, n]) => ({ planet, rules: n }));
      const WORDS = ["", "one", "two", "three", "four", "five", "six"];
      const multi = byPlanet.filter((x) => x.rules > 1).map((x) => `${x.planet} meets ${WORDS[x.rules] ?? x.rules} of them`);
      const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
      const countText = `${plural(rules.length, "condition")} from ${plural(byPlanet.length, "planet")}${multi.length ? `; ${multi.join("; ")}` : ""}`;
      return { planet: p, state, rules, cancelling: [...cancelling], byPlanet, countText, raja };
    });
}

// ---------- Viparita Raja Yogas ----------

export type Viparita = { key: "yoga.harsha" | "yoga.sarala" | "yoga.vimala"; name: string; lordOf: 6 | 8 | 12; lord: Planet; house: number; formed: boolean };

/** Harsha (6th lord), Sarala (8th lord), Vimala (12th lord) in the 6th, 8th or 12th. */
export function viparita(chart: Chart): Viparita[] {
  const lords = houseLords(chart.lagna.sign_num);
  return (
    [
      ["yoga.harsha", "Harsha", 6],
      ["yoga.sarala", "Sarala", 8],
      ["yoga.vimala", "Vimala", 12],
    ] as const
  ).map(([key, name, h]) => {
    const lord = lords[h];
    const house = byName(chart, lord).house;
    return { key, name, lordOf: h, lord, house, formed: [6, 8, 12].includes(house) };
  });
}

// ---------- Kemadruma ----------

export type Kemadruma = { state: RuleState; why: string; cancellations: string[] };

const NOT_FOR_KEMADRUMA = new Set(["Sun", "Rahu", "Ketu"]);

/**
 * Formed when no planet other than the Sun, Rahu or Ketu is 2nd or 12th from
 * the Moon. Cancelled (bhanga) by: a planet in a kendra from the Moon; a planet
 * with the Moon; Jupiter aspecting the Moon; the Moon in a kendra from the Lagna.
 */
export function kemadruma(chart: Chart): Kemadruma {
  const moon = byName(chart, "Moon");
  const counts = chart.grahas.filter((g) => g.name !== "Moon" && !NOT_FOR_KEMADRUMA.has(g.name));
  const flank = counts.filter((g) => [2, 12].includes(houseFrom(moon.sign_num, g.sign_num)));
  if (flank.length) return { state: "not formed", why: `${flank.map((g) => g.name).join(", ")} 2nd or 12th from the Moon`, cancellations: [] };
  const c: string[] = [];
  for (const g of counts.filter((g) => [4, 7, 10].includes(houseFrom(moon.sign_num, g.sign_num))))
    c.push(`${g.name} is in a kendra (${houseFrom(moon.sign_num, g.sign_num)}th) from the Moon`);
  for (const g of counts.filter((g) => conjunct(g, moon))) c.push(`${g.name} is with the Moon`);
  const jup = byName(chart, "Jupiter");
  if (aspects(jup, moon)) c.push("Jupiter aspects the Moon");
  if (KENDRA.includes(moon.house)) c.push(`the Moon is in a kendra (Bhava ${moon.house}) from the Lagna`);
  return { state: c.length ? "cancelled" : "formed", why: "no planet (other than the Sun and the nodes) 2nd or 12th from the Moon", cancellations: c };
}

// ---------- Dhana and Adhi ----------

export type Link = { a: Planet; b: Planet; how: string };

export const ord = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/**
 * Dhana Yoga: two different planets linked by conjunction, mutual aspect or
 * exchange, where one is a wealth lord (2nd or 11th) and the other a lord of
 * the 1st, 5th or 9th, or the 2nd and 11th lords together. A link of only
 * 1st / 5th / 9th lords is a Raj Yoga, not counted again here.
 */
export function dhana(chart: Chart): Link[] {
  const lords = houseLords(chart.lagna.sign_num);
  const houses = [1, 2, 5, 9, 11];
  const rolesOf = (p: Planet) => houses.filter((h) => lords[h] === p);
  const wealth = (h: number) => h === 2 || h === 11;
  const qualifies = (a: number[], b: number[]) =>
    a.some((x) => b.some((y) => (wealth(x) && (wealth(y) ? x !== y : [1, 5, 9].includes(y))) || (wealth(y) && [1, 5, 9].includes(x))));
  const planets = [...new Set(houses.map((h) => lords[h]))];
  const links: Link[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      if (!qualifies(rolesOf(planets[i]), rolesOf(planets[j]))) continue;
      const A = byName(chart, planets[i]);
      const B = byName(chart, planets[j]);
      const exchange = SIGN_LORD[A.sign_num] === B.name && SIGN_LORD[B.sign_num] === A.name;
      const how = conjunct(A, B) ? `conjunction in ${A.sign}` : exchange ? "exchange of signs" : aspects(A, B) && aspects(B, A) ? "mutual aspect" : null;
      if (!how) continue;
      const label = (p: Planet) => `${p} (lord of ${rolesOf(p).map(ord).join(" and ")})`;
      links.push({ a: planets[i], b: planets[j], how: `${label(planets[i])} and ${label(planets[j])}: ${how}` });
    }
  }
  return links;
}

const NATURAL_BENEFICS: Planet[] = ["Mercury", "Jupiter", "Venus"];

/** Adhi Yoga: natural benefics in the 6th, 7th and 8th from the Moon (all three = full, one or two = partial). */
export function adhi(chart: Chart): { state: "full" | "partial" | "not formed"; planets: { name: Planet; from: number }[] } {
  const moon = byName(chart, "Moon").sign_num;
  const planets = NATURAL_BENEFICS.map((n) => ({ name: n, from: houseFrom(moon, byName(chart, n).sign_num) })).filter((x) => [6, 7, 8].includes(x.from));
  return { state: planets.length === 3 ? "full" : planets.length ? "partial" : "not formed", planets };
}

// ---------- Notable placements ----------

/** House lords sitting in their own house, e.g. "2nd lord Sun in the 2nd (own sign)". */
export function ownHouseLords(chart: Chart): { lord: Planet; house: number; text: string }[] {
  const lords = houseLords(chart.lagna.sign_num);
  return Object.entries(lords)
    .map(([h, lord]) => ({ lord, house: Number(h), at: byName(chart, lord).house }))
    .filter((x) => x.house === x.at)
    .map((x) => ({ lord: x.lord, house: x.house, text: `${ord(x.house)} lord ${x.lord} in the ${ord(x.house)} (own sign)` }));
}
