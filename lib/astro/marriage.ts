// Marriage factors from the D1 and the Navamsa (D9): D9 Lagna, the D9 7th and
// its lord, Venus in the D9, Darakaraka (Jaimini chara karaka) and Upapada
// Lagna, with D9 strengths weighed against D1 weaknesses explicitly.
import type { Chart } from "../kundlit-schemas";
import { SEVEN, SIGN_LORD, dignityOf, dignityText, type Dignity, type Planet } from "./relations";
import { houseLords } from "./functional";
import { chartStrengths, type StrengthLevel } from "./planet-strength";
import { byName, houseFrom } from "./rules";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;
const GOOD = new Set(["exalted", "moolatrikona", "own", "great friend", "friend"]);
const BAD = new Set(["debilitated", "great enemy", "enemy"]);

export type MarriageFactors = {
  d1: { seventhSign: number; seventhLord: Planet; lordHouse: number; lordStrength: StrengthLevel; venusStrength: StrengthLevel; venusDignity: string };
  d9: {
    lagnaSign: number;
    seventhSign: number;
    seventhLord: Planet;
    lordD9Sign: number;
    lordD9Dignity: Dignity;
    lordVargottama: boolean;
    venusD9Sign: number;
    venusD9Dignity: Dignity;
  };
  darakaraka: { planet: string; scheme: string; degInSign: number; eightKaraka: string };
  /** Atmakaraka: highest degree in its sign (same 7-karaka scheme). */
  atmakaraka: string;
  upapada: { sign: number; lord: Planet; method: string };
  /** Plain comparisons: where the D9 improves or confirms the D1. */
  comparison: string[];
};

/**
 * Darakaraka: the planet with the lowest degree within its sign. 7-karaka
 * scheme (Sun–Saturn) is used; the 8-karaka result (Rahu counted as 30° minus
 * its degree) is given for reference.
 */
export function darakaraka(chart: Chart): MarriageFactors["darakaraka"] {
  const seven = chart.grahas.filter((g) => (SEVEN as readonly string[]).includes(g.name));
  const dk = [...seven].sort((a, b) => a.deg_in_sign - b.deg_in_sign)[0];
  const rahu = byName(chart, "Rahu");
  const eight = [...seven.map((g) => ({ name: g.name, d: g.deg_in_sign })), { name: "Rahu", d: 30 - rahu.deg_in_sign }].sort((a, b) => a.d - b.d)[0];
  return { planet: dk.name, scheme: "7-karaka (Sun to Saturn)", degInSign: dk.deg_in_sign, eightKaraka: eight.name };
}

/** Atmakaraka: the planet with the highest degree within its sign (7-karaka scheme). */
export function atmakaraka(chart: Chart): string {
  return [...chart.grahas.filter((g) => (SEVEN as readonly string[]).includes(g.name))].sort((a, b) => b.deg_in_sign - a.deg_in_sign)[0].name;
}

/**
 * Upapada Lagna: the arudha of the 12th house. Count from the 12th to its lord,
 * then the same count again from the lord. If that lands on the 12th itself or
 * the 7th from it, take the 10th from there. (Vrishchika and Kumbha use their
 * classical lords Mars and Saturn.)
 */
export function upapada(chart: Chart): MarriageFactors["upapada"] {
  const twelfth = wrap(chart.lagna.sign_num + 11);
  const lord = SIGN_LORD[twelfth];
  const lordSign = byName(chart, lord).sign_num;
  let ul = wrap(lordSign + houseFrom(twelfth, lordSign) - 1);
  let method = `12th house ${twelfth}, lord ${lord} in sign ${lordSign}; counted ${houseFrom(twelfth, lordSign)} from the 12th, same again from ${lord}`;
  if (ul === twelfth || houseFrom(twelfth, ul) === 7) {
    ul = wrap(ul + 9);
    method += "; it fell on the 12th or 7th from it, so the 10th from there is used";
  }
  return { sign: ul, lord: SIGN_LORD[ul], method };
}

export function marriageFactors(chart: Chart): MarriageFactors {
  const strengths = chartStrengths(chart);
  const lords = houseLords(chart.lagna.sign_num);
  const d9Signs = Object.fromEntries(chart.grahas.map((g) => [g.name, g.navamsha.sign_num]));
  const seventhLord = lords[7];
  const venus = byName(chart, "Venus");
  const lordG = byName(chart, seventhLord);

  const d9Lagna = chart.navamsha_lagna.sign_num;
  const d9Seventh = wrap(d9Lagna + 6);
  const d9Lord = SIGN_LORD[d9Seventh];
  const d9LordG = byName(chart, d9Lord);
  const d9LordDignity = dignityOf(d9Lord, d9LordG.navamsha.sign_num, d9Signs);
  const venusD9 = dignityOf("Venus", venus.navamsha.sign_num, d9Signs);
  const venusS = strengths.get("Venus")!;

  const comparison: string[] = [];
  const d9Good = GOOD.has(venusD9.label);
  if (venusS.level === "weak" && d9Good) comparison.push(`Venus is weak in the D1 but in ${dignityText(venusD9)} in the D9, which improves it.`);
  else if (venusS.level === "weak") comparison.push(`Venus is weak in the D1 and not improved in the D9 (${dignityText(venusD9)}).`);
  else if (BAD.has(venusD9.label)) comparison.push(`Venus is ${venusS.level} in the D1 but in ${dignityText(venusD9)} in the D9, which weakens it.`);
  else comparison.push(`Venus: ${venusS.level} in the D1, ${dignityText(venusD9)} in the D9.`);
  comparison.push(
    `D9 7th lord ${d9Lord}: ${dignityText(d9LordDignity)}${d9LordG.vargottama ? ", Vargottama (same sign in D1 and D9, a strong confirmation)" : ""}.`,
  );
  const l7 = strengths.get(seventhLord)!;
  comparison.push(`D1 7th lord ${seventhLord}: ${l7.level}, in Bhava ${lordG.house}.`);

  return {
    d1: { seventhSign: wrap(chart.lagna.sign_num + 6), seventhLord, lordHouse: lordG.house, lordStrength: l7.level, venusStrength: venusS.level, venusDignity: dignityText(venusS.dignity!) },
    d9: {
      lagnaSign: d9Lagna,
      seventhSign: d9Seventh,
      seventhLord: d9Lord,
      lordD9Sign: d9LordG.navamsha.sign_num,
      lordD9Dignity: d9LordDignity,
      lordVargottama: d9LordG.vargottama,
      venusD9Sign: venus.navamsha.sign_num,
      venusD9Dignity: venusD9,
    },
    darakaraka: darakaraka(chart),
    atmakaraka: atmakaraka(chart),
    upapada: upapada(chart),
    comparison,
  };
}
