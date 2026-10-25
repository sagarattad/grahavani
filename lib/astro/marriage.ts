// Marriage factors from the D1 and the Navamsa (D9): D9 Lagna, the D9 7th and
// its lord, Venus in the D9, Darakaraka (Jaimini chara karaka) and Upapada
// Lagna, with D9 strengths weighed against D1 weaknesses explicitly.
import type { Chart } from "../kundlit-schemas";
import { SEVEN, SIGN_LORD, dignityFact, dignityOf, vargaReading, type Dignity, type Planet } from "./relations";
import { rashi } from "../glossary";
import { houseLords } from "./functional";
import { chartStrengths, type StrengthLevel } from "./planet-strength";
import { byName, houseFrom } from "./rules";
import { tempSigns } from "./varga";
import { birthTimeCheck } from "./timing-checks";

const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;

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
    /** The D9 Lagna changes within 2 minutes of the birth time: its 7th house and lord are not used. */
    suppressed: boolean;
  };
  darakaraka: { planet: string; scheme: string; degInSign: number; eightKaraka: string };
  /** Atmakaraka: highest degree in its sign (same 7-karaka scheme). */
  atmakaraka: string;
  upapada: { sign: number; lord: Planet; method: string };
  /** Plain comparisons by dignity rank: where the D9 improves (mitigates), confirms or weakens the D1. */
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
  const d1Temp = tempSigns(chart, "d1");
  const d9Temp = tempSigns(chart, "d9");
  const seventhLord = lords[7];
  const venus = byName(chart, "Venus");
  const lordG = byName(chart, seventhLord);

  const d9Lagna = chart.navamsha_lagna.sign_num;
  const d9Seventh = wrap(d9Lagna + 6);
  const d9Lord = SIGN_LORD[d9Seventh];
  const d9LordG = byName(chart, d9Lord);
  const d9LordDignity = dignityOf(d9Lord, d9LordG.navamsha.sign_num, d9Temp);
  const venusD9 = dignityOf("Venus", venus.navamsha.sign_num, d9Temp);
  const venusS = strengths.get("Venus")!;
  const l7 = strengths.get(seventhLord)!;

  // Each planet once: its D1 dignity, then the D9 dignity judged on its own
  // (friend or better supports, neutral is neutral, enemy or worse weakens),
  // and "improved" only when a neutral-or-worse D1 dignity is bettered.
  const roles = new Map<Planet, string[]>();
  // A suppressed D9 (Lagna within 2 minutes) gives no 7th lord to read.
  const d9Suppressed = Boolean(birthTimeCheck(chart, rashi)?.uninterpretable.d9);
  const planets: [Planet, string][] = [["Venus", "Venus"], [seventhLord, "D1 7th lord"], ...(d9Suppressed ? [] : ([[d9Lord, "D9 7th lord"]] as [Planet, string][]))];
  for (const [p, role] of planets) roles.set(p, [...(roles.get(p) ?? []), role]);
  const comparison = [...roles].map(([p, labels]) => {
    const g = byName(chart, p);
    const st = strengths.get(p)!;
    const d1 = dignityOf(p, g.sign_num, d1Temp, g.deg_in_sign);
    const d9 = dignityOf(p, g.navamsha.sign_num, d9Temp);
    const { role, improved } = vargaReading(d1, d9);
    const who = labels.filter((l) => l !== p).join(" and ");
    // "neutral" as both the dignity and its role is said once.
    const d9Text = dignityFact(d9) === role ? role : `${dignityFact(d9)}, ${role}`;
    return (
      `${who ? `${who} ` : ""}${p} (${st.level}, Bhava ${g.house}): ${dignityFact(d1)} in the D1; in the D9 (${rashi(g.navamsha.sign_num)}) ${d9Text}` +
      `${improved ? ", improved from the D1 (a mitigation)" : ""}${g.vargottama ? "; Vargottama (same sign in D1 and D9, a strong confirmation)" : ""}.`
    );
  });

  return {
    d1: { seventhSign: wrap(chart.lagna.sign_num + 6), seventhLord, lordHouse: lordG.house, lordStrength: l7.level, venusStrength: venusS.level, venusDignity: dignityFact(venusS.dignity!) },
    d9: {
      lagnaSign: d9Lagna,
      seventhSign: d9Seventh,
      seventhLord: d9Lord,
      lordD9Sign: d9LordG.navamsha.sign_num,
      lordD9Dignity: d9LordDignity,
      lordVargottama: d9LordG.vargottama,
      venusD9Sign: venus.navamsha.sign_num,
      venusD9Dignity: venusD9,
      suppressed: d9Suppressed,
    },
    darakaraka: darakaraka(chart),
    atmakaraka: atmakaraka(chart),
    upapada: upapada(chart),
    comparison,
  };
}
