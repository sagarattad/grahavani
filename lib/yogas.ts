// Groups Kundlit's yoga list (one entry per combination) into one item per
// yoga, attaches Bhanga (cancellation) entries, and builds the checklist.
import { DOSHA_YOGA_IDS, YOGA_CHECKLIST, humanize, yogaCategory } from "./glossary";
import { activationWindows, type Window } from "./dasha";
import type { Chart, Yoga } from "./kundlit-schemas";
import { rateYoga, type Rating, type YogaLevel } from "./strength";

export type YogaItem = {
  key: string;
  name: string;
  meaning?: string;
  category: string;
  status: "present" | "cancelled";
  combinations: { claim: string; participants: string[] }[];
  cancellations: string[];
  participants: string[];
  nabhasa: boolean;
  windows: Window[]; // traditional activation: Dasha periods of the participating grahas
  rating: Rating<YogaLevel>; // Grahavani's classical rating (lib/strength.ts)
};

const BHANGA = "yoga.bhanga.";

/**
 * Kundlit's rule id. Charts cached before rule ids were stored only have a
 * name, so map names back to known ids ("Raj Yoga" → yoga.raja,
 * "Ruchaka Bhanga" → yoga.bhanga.ruchaka) before falling back to the name.
 */
export function keyOf(y: Yoga): string {
  if (y.rule_id) return y.rule_id;
  const name = (y.name ?? "yoga").trim();
  const bhanga = name.match(/^(.*) Bhanga$/i);
  const base = (bhanga ? bhanga[1] : name).toLowerCase();
  const id =
    base === "kemadruma"
      ? "yoga.kemadruma"
      : YOGA_CHECKLIST.find((c) => c.label.en.toLowerCase() === base)?.ruleId;
  if (id) return bhanga ? `${BHANGA}${id.slice("yoga.".length)}` : id;
  return `name:${name.toLowerCase()}`;
}

/** "Raj Yoga yoga present: Sun (lord of [4]) and …" → "Sun (lord of [4]) and …" */
export const cleanClaim = (claim: string) => claim.replace(/^.*?\byoga present:\s*/i, "").replace(/ -- /g, " — ");

export function groupYogas(chart: Chart, asOf: string): YogaItem[] {
  const groups = new Map<string, YogaItem>();
  const bhangas: Yoga[] = [];

  for (const y of chart.yogas) {
    const key = keyOf(y);
    if (DOSHA_YOGA_IDS.has(key) || key.startsWith(`${BHANGA}kemadruma`)) continue; // shown under Doshas
    if (key.startsWith(BHANGA)) {
      bhangas.push(y);
      continue;
    }
    const meta = YOGA_CHECKLIST.find((c) => c.ruleId === key);
    const g =
      groups.get(key) ??
      ({
        key,
        name: meta?.label.en ?? y.name ?? humanize(key.split(".").pop() ?? "Yoga"),
        meaning: meta?.label.meaning,
        category: yogaCategory(y.category),
        status: "present",
        combinations: [],
        cancellations: [],
        participants: [],
        nabhasa: !!y.category?.startsWith("nabhasa") || key.startsWith("nabhasa."),
        windows: [],
        rating: { level: null, label: "Not rated", reasons: [] },
      } satisfies YogaItem);
    g.combinations.push({ claim: cleanClaim(y.claim), participants: y.participants });
    g.participants = [...new Set([...g.participants, ...y.participants])];
    groups.set(key, g);
  }

  for (const b of bhangas) {
    const target = groups.get(`yoga.${keyOf(b).slice(BHANGA.length)}`);
    if (!target) continue;
    target.status = "cancelled";
    target.cancellations.push(cleanClaim(b.claim).replace(/^.*?is cancelled because:\s*/i, ""));
  }

  const { timeline } = chart.vimshottari;
  for (const g of groups.values()) {
    if (!g.nabhasa) g.windows = activationWindows(g.participants, timeline, asOf, 3);
    g.rating = rateYoga(g, chart);
  }

  const order = new Map(YOGA_CHECKLIST.map((c, i) => [c.ruleId, i]));
  return [...groups.values()].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
}

/** Present yogas (grouped) plus the checklist yogas that are not formed. */
export function yogaChecklist(chart: Chart, asOf: string) {
  const present = groupYogas(chart, asOf);
  const have = new Set(present.map((p) => p.key));
  const absent = YOGA_CHECKLIST.filter((c) => !have.has(c.ruleId)).map((c) => ({
    key: c.ruleId,
    name: c.label.en,
    meaning: c.label.meaning,
  }));
  return { present, absent };
}
