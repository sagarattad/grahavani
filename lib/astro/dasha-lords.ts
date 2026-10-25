// Reading a Dasha lord: house lordship, placement, composite strength,
// functional role and the yogas / Neecha Bhanga it takes part in. Rahu and
// Ketu give the results of their dispositor and of the planets they sit with;
// a node with the yogakaraka in a kendra is flagged.
import type { Chart } from "../kundlit-schemas";
import { SIGN_LORD, isPlanet, type Planet } from "./relations";
import { functionalNature } from "./functional";
import { chartStrengths, type PlanetStrength } from "./planet-strength";
import { byName, neechaBhanga, ord } from "./rules";
import type { YogaItem } from "../yogas";

export type DashaLordReading = {
  lord: string;
  houseRuled: number[];
  placedIn: { house: number; sign: string };
  strength: { level: string; score: number; factors: string[] };
  role: string; // yogakaraka / functional benefic / malefic / neutral / maraka
  yogas: string[];
  neechaBhanga: string | null;
  /** Rahu / Ketu only. */
  node: { dispositor: string; dispositorStrength: string; conjunct: string[]; withYogakarakaInKendra: boolean } | null;
  summary: string[];
};

const KENDRA = [1, 4, 7, 10];

export function readDashaLord(chart: Chart, lord: string, yogas: YogaItem[], strengths: Map<string, PlanetStrength> = chartStrengths(chart)): DashaLordReading {
  const g = byName(chart, lord);
  const fn = functionalNature(chart.lagna.sign_num);
  const s = strengths.get(lord)!;
  const factors = [...s.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 4).map((f) => f.label);
  const houseRuled = isPlanet(lord) ? fn.roles[lord].houses : [];
  const roles: string[] = [];
  if (isPlanet(lord)) {
    roles.push(fn.roles[lord].nature === "yogakaraka" ? "yogakaraka" : `functional ${fn.roles[lord].nature}`);
    if (fn.marakas.includes(lord)) roles.push("maraka (2nd / 7th lord)");
  }
  const inYogas = yogas.filter((y) => !y.nabhasa && y.participants.includes(lord)).map((y) => `${y.name}${y.rating.level ? ` (rated ${y.rating.level})` : ""}`);
  const nb = neechaBhanga(chart).find((n) => n.planet === lord);

  let node: DashaLordReading["node"] = null;
  const summary: string[] = [];
  if (!isPlanet(lord)) {
    const disp = SIGN_LORD[g.sign_num];
    const conj = chart.grahas.filter((x) => x.name !== lord && x.sign_num === g.sign_num && isPlanet(x.name)).map((x) => x.name);
    const yk = conj.filter((c) => fn.yogakarakas.includes(c as Planet));
    node = { dispositor: disp, dispositorStrength: strengths.get(disp)!.level, conjunct: conj, withYogakarakaInKendra: yk.length > 0 && KENDRA.includes(g.house) };
    summary.push(`${lord} gives the results of its dispositor ${disp} (${node.dispositorStrength}, rules ${fn.roles[disp].houses.map(ord).join(" and ")})`);
    if (conj.length) summary.push(`and of ${conj.join(", ")}, which it sits with in Bhava ${g.house}`);
    if (node.withYogakarakaInKendra) summary.push(`${lord} sits with the yogakaraka ${yk.join(", ")} in a kendra (Bhava ${g.house}), a supportive combination`);
  } else {
    summary.push(`${lord} rules ${houseRuled.map(ord).join(" and ")}, sits in Bhava ${g.house} (${g.sign}), ${s.level} (${factors.slice(0, 3).join(", ")}), ${roles.join(", ")}`);
  }
  if (nb?.state === "formed") summary.push(`${lord}'s debility is cancelled (Neecha Bhanga)`);
  if (inYogas.length) summary.push(`takes part in ${inYogas.join(", ")}`);

  return {
    lord,
    houseRuled,
    placedIn: { house: g.house, sign: g.sign },
    strength: { level: s.level, score: s.score, factors },
    role: roles.join(", ") || "node",
    yogas: inYogas,
    neechaBhanga: nb?.state === "formed" ? nb.rules.join("; ") : null,
    node,
    summary,
  };
}
