// Groups Kundlit's yoga list (one entry per combination) into one item per
// yoga, attaches Bhanga (cancellation) entries, and builds the checklist.
import { DOSHA_YOGA_IDS, YOGA_CHECKLIST, graha, humanize, yogaCategory } from "./glossary";
import { activationWindows, type Window } from "./dasha";
import type { Chart, Yoga } from "./kundlit-schemas";
import { rateYoga, type Rating, type YogaLevel } from "./strength";
import { chartStrengths } from "./astro/planet-strength";
import { SEVEN_HOUSE_AKRITI_KEYS, adhi, budhaditya, dhana, neechaBhanga, sevenHouseAkriti, viparita } from "./astro/rules";
import { functionalNature } from "./astro/functional";
import { SEVEN } from "./astro/relations";

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
// Detected by Grahavani's own rules (lib/astro/rules.ts); Kundlit's versions are dropped.
// Kundlit forms the seven-house akriti yogas from "all 7 within 7 consecutive houses";
// Grahavani requires each of the seven houses to be occupied.
const REPLACED = new Set(["yoga.dhana", "yoga.neechabhanga", "yoga.kemadruma", "yoga.budhaditya", ...SEVEN_HOUSE_AKRITI_KEYS]);

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
    if (REPLACED.has(key) || REPLACED.has(`yoga.${key.slice(BHANGA.length)}`)) continue; // Grahavani's rules below
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

  const own = grahavaniYogas(chart);
  for (const g of own) groups.set(g.item.key, g.item);

  const { timeline } = chart.vimshottari;
  const strengths = chartStrengths(chart);
  for (const g of groups.values()) {
    // Every period of the current and next Mahadasha; displays say "and N more" when they shorten the list.
    if (!g.nabhasa) g.windows = activationWindows(g.participants, timeline, asOf, Infinity);
    const special = own.find((o) => o.item === g);
    g.rating = special?.rating ?? rateYoga(g, chart, strengths);
    if (special?.capModerate && g.rating.level === "Strong") {
      g.rating = { ...g.rating, level: "Moderate", label: "Rated Moderate", reasons: [...g.rating.reasons, special.capModerate] };
    }
  }

  const order = new Map(YOGA_CHECKLIST.map((c, i) => [c.ruleId, i]));
  return [...groups.values()].sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
}

export type SharedLink = { planets: string[]; yogas: string[]; placement?: { planet: string; sign: string } };

/** "Harsha, Anapha and Vasi rest on the same placement (Guru in Kumbha): read them as one support, not as separate strengths." */
export function sharedLinkText(l: SharedLink): string {
  const names = l.yogas.length > 2 ? `${l.yogas.slice(0, -1).join(", ")} and ${l.yogas.at(-1)}` : l.yogas.join(" and ");
  const what = l.placement ? `placement (${graha(l.placement.planet)} in ${l.placement.sign})` : `${l.planets.map(graha).join("–")} link`;
  return `${names} rest on the same ${what}: read them as one support, not as separate strengths.`;
}

/**
 * Present yogas that rest on the same support, read as one, not several:
 * - yogas sharing a planet pair (Gajakesari and Raj Yoga from Moon–Jupiter;
 *   Chandra yogas always count the Moon, being formed from it);
 * - yogas resting on one and the same planet's placement (Harsha, Anapha
 *   and Vasi all from Jupiter in Kumbha).
 * Each yoga's set is its rated combination's planets. Nabhasa (whole-chart
 * pattern) yogas and unrated items such as Neecha Bhanga are left out.
 */
export function sharedLinks(present: YogaItem[], chart?: Chart): SharedLink[] {
  const nodes = (ps: string[]) => ps.filter((p) => p !== "Rahu" && p !== "Ketu");
  const ys = present
    .filter((y) => !y.nabhasa && y.rating.level) // unrated items (Neecha Bhanga itself, Nabhasa) are not supports
    .map((y) => {
      const core = nodes(y.rating.basis ?? y.participants);
      return { y, core, set: [...new Set([...core, ...(y.category === "Chandra yoga" ? ["Moon"] : [])])] };
    })
    .filter((x) => x.core.length > 0);
  const linked = (a: (typeof ys)[number], b: (typeof ys)[number]) =>
    a.set.filter((p) => b.set.includes(p)).length >= 2 || (a.core.length === 1 && b.core.length === 1 && a.core[0] === b.core[0]);
  // Union of linked yogas.
  const group = ys.map((_, i) => i);
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) if (linked(ys[i], ys[j])) group[find(i)] = find(j);
  const out = new Map<number, (typeof ys)[number][]>();
  ys.forEach((x, i) => out.set(find(i), [...(out.get(find(i)) ?? []), x]));
  return [...out.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const common = g.map((x) => x.set).reduce((a, b) => a.filter((p) => b.includes(p)));
      const planets = (common.length ? common : g[0].core).sort();
      const single = planets.length === 1 && chart ? chart.grahas.find((x) => x.name === planets[0]) : undefined;
      return { planets, yogas: g.map((x) => x.y.name), ...(single ? { placement: { planet: planets[0], sign: single.sign } } : {}) };
    });
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

type OwnYoga = { item: YogaItem; rating?: Rating<YogaLevel>; capModerate?: string };

const item = (key: string, category: string, combinations: { claim: string; participants: string[] }[]): YogaItem => {
  const meta = YOGA_CHECKLIST.find((c) => c.ruleId === key);
  return {
    key,
    name: meta?.label.en ?? key,
    meaning: meta?.label.meaning,
    category,
    status: "present",
    combinations,
    cancellations: [],
    participants: [...new Set(combinations.flatMap((c) => c.participants))],
    nabhasa: false,
    windows: [],
    rating: { level: null, label: "Not rated", reasons: [] },
  };
};

/**
 * Grahavani's own yogas: Neecha Bhanga and its Raja Yoga (checked from Lagna and
 * Moon), Viparita Raja Yogas, Dhana (explicit lords and links) and Adhi.
 */
export function grahavaniYogas(chart: Chart): OwnYoga[] {
  const out: OwnYoga[] = [];
  const nb = neechaBhanga(chart).filter((n) => n.state === "formed");
  if (nb.length) {
    out.push({
      item: item(
        "yoga.neecha_bhanga",
        "Debility cancelled",
        nb.map((n) => ({ claim: `${n.planet}'s debility is cancelled: ${n.rules.join("; ")}`, participants: [n.planet, ...n.cancelling] })),
      ),
      rating: { level: null, label: "Not rated", reasons: ["Cancels a debility; its strength shows in Neechabhanga Raj Yoga and the planet's own strength"] },
    });
    const raja = nb.filter((n) => n.raja.state !== "not formed");
    const full = raja.filter((n) => n.raja.state === "full");
    const it = item(
      "yoga.neechabhanga",
      "Raj yoga",
      raja.map((n) => ({ claim: `${n.planet}: ${n.raja.state === "full" ? "formed" : "partial"} (${n.raja.why})`, participants: [n.planet, ...n.cancelling] })),
    );
    if (raja.length) {
      out.push(
        full.length
          ? { item: { ...it, combinations: it.combinations.filter((c) => full.some((n) => n.planet === c.participants[0])) } }
          : { item: it, rating: { level: "Weak", label: "Rated Weak", reasons: raja.map((n) => `Partial for ${n.planet}: ${n.raja.why}`), basis: raja.map((n) => n.planet) } },
      );
    }
  }
  for (const v of viparita(chart).filter((x) => x.formed)) {
    out.push({ item: item(v.key, "Viparita Raja Yoga", [{ claim: `${v.lord}, lord of the ${v.lordOf}th, is in the ${v.house}th${v.house === v.lordOf ? " (own sign)" : ""}`, participants: [v.lord] }]) });
  }
  const links = dhana(chart);
  if (links.length) out.push({ item: item("yoga.dhana", "Dhana yoga", links.map((l) => ({ claim: l.how, participants: [l.a, l.b] }))) });
  const ba = budhaditya(chart);
  if (ba) out.push({ item: item("yoga.budhaditya", "Surya yoga", [{ claim: `Surya and Budh together in ${ba.sign}`, participants: ["Sun", "Mercury"] }]) });
  const ak = sevenHouseAkriti(chart);
  if (ak) {
    const it = item(ak.key, "Nabhasa yoga", [{ claim: `All seven planets in seven consecutive houses, from the ${ak.startHouse}th`, participants: [...SEVEN] }]);
    out.push({ item: { ...it, name: ak.name, nabhasa: true } });
  }
  const a = adhi(chart);
  if (a.state !== "not formed") {
    const claim = `${a.state === "full" ? "Full" : "Partial"}: ${a.planets.map((p) => `${p.name} ${p.from}th from the Moon`).join(", ")}`;
    const it = item("yoga.adhi", "Chandra yoga", [{ claim, participants: a.planets.map((p) => p.name) }]);
    if (a.planets.length === 1) {
      out.push({ item: it, rating: { level: "Weak", label: "Rated Weak", reasons: [`Partial Adhi Yoga with one benefic (${a.planets[0].name}): a mild effect only`], basis: [a.planets[0].name] } });
    } else out.push({ item: it, capModerate: a.state === "partial" ? "Partial Adhi Yoga (two of the three benefics), so at most Moderate" : undefined });
  }
  // The yogakaraka in a kendra from the Lagna: a notable source of rise in its own right.
  const fnat = functionalNature(chart.lagna.sign_num);
  for (const yk of fnat.yogakarakas) {
    const g = chart.grahas.find((x) => x.name === yk)!;
    if ([1, 4, 7, 10].includes(g.house)) {
      const withNode = chart.grahas.filter((x) => (x.name === "Rahu" || x.name === "Ketu") && x.sign_num === g.sign_num).map((x) => x.name);
      out.push({
        item: item("yoga.yogakaraka_kendra", "Raj yoga", [
          { claim: `${yk} rules the ${fnat.roles[yk].houses.join(" and ")} and sits in Bhava ${g.house}, a kendra${withNode.length ? `, with ${withNode.join(" and ")}` : ""}`, participants: [yk] },
        ]),
      });
    }
  }
  return out;
}
