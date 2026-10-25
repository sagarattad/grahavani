// Groups Kundlit's yoga list (one entry per combination) into one item per
// yoga, attaches Bhanga (cancellation) entries, and builds the checklist.
import { DOSHA_YOGA_IDS, YOGA_CHECKLIST, graha, humanize, yogaCategory } from "./glossary";
import { activationWindows, type Window } from "./dasha";
import type { Chart, Yoga } from "./kundlit-schemas";
import { rateYoga, type Rating, type YogaLevel } from "./strength";
import { chartStrengths } from "./astro/planet-strength";
import { SEVEN_HOUSE_AKRITI_KEYS, adhi, budhaditya, dhana, exchanges, neechaBhanga, sevenHouseAkriti, viparita } from "./astro/rules";
import { functionalNature, houseLords } from "./astro/functional";
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

  // Raj Yoga also forms by exchange between a kendra lord and a trikona lord (as Dhana does).
  const lordsOf = houseLords(chart.lagna.sign_num);
  const rules = (p: string) => Object.entries(lordsOf).filter(([, l]) => l === p).map(([h]) => Number(h));
  for (const x of exchanges(chart)) {
    const [ra, rb] = [rules(x.a), rules(x.b)];
    const kendra = (hs: number[]) => hs.some((h) => [1, 4, 7, 10].includes(h));
    const trikona = (hs: number[]) => hs.some((h) => [1, 5, 9].includes(h));
    if (!((kendra(ra) && trikona(rb)) || (trikona(ra) && kendra(rb)))) continue;
    const g =
      groups.get("yoga.raja") ??
      ({ ...item("yoga.raja", yogaCategory("raja"), []) } satisfies YogaItem);
    if (g.combinations.some((c) => c.participants.includes(x.a) && c.participants.includes(x.b) && c.participants.length === 2)) continue;
    const label = (p: string, hs: number[]) => `${p} (lord of [${hs.join(", ")}])`;
    g.combinations.push({ claim: `${label(x.a, ra)} and ${label(x.b, rb)} exchange signs — a Raj yoga.`, participants: [x.a, x.b] });
    g.participants = [...new Set([...g.participants, x.a, x.b])];
    groups.set("yoga.raja", g);
  }

  // Raj Yoga: mark each combination that includes the 8th lord (rated one level lower, lib/strength.ts).
  const raja = groups.get("yoga.raja");
  if (raja) {
    const eighth = functionalNature(chart.lagna.sign_num).roles;
    const lord8 = (Object.keys(eighth) as (keyof typeof eighth)[]).find((p) => eighth[p].houses.includes(8));
    // "… — a Raj yoga." → "… — a Raj yoga (blemished: Shani rules the 8th)."
    const mark = (claim: string) => `${claim.replace(/\.\s*$/, "")} (blemished: ${graha(lord8!)} rules the 8th).`;
    if (lord8) raja.combinations = raja.combinations.map((c) => (c.participants.includes(lord8) ? { ...c, claim: mark(c.claim) } : c));
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

export type SharedLink = {
  planets: string[];
  /** Each yoga in the group; a yoga with several links is named by this one ("Dhana Yoga's Mangal–Shani link"). */
  yogas: string[];
  placement?: { planet: string; sign: string };
  /** Other links of those yogas, which are not part of this group. */
  separate?: string[];
};

const listText = (xs: string[]) => (xs.length > 2 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs.join(" and "));

/** "Dhana Yoga's Mangal–Shani link, Neechabhanga Raj Yoga and Durudhura share the Mangal–Shani link: … Dhana Yoga's Budh–Surya link is separate." */
export function sharedLinkText(l: SharedLink): string {
  const what = l.placement ? `rest on the same placement (${graha(l.placement.planet)} in ${l.placement.sign})` : `share the ${l.planets.map(graha).join("–")} link`;
  const sep = l.separate?.length ? ` ${listText(l.separate)} ${l.separate.length > 1 ? "are" : "is"} separate.` : "";
  return `${listText(l.yogas)} ${what}: read them as one support, not as separate strengths.${sep}`;
}

/**
 * Rated yogas that rest on the same support, grouped per link (not per whole
 * yoga), so one link is read as one support:
 * - a planet pair inside any combination of two or more yogas (Gajakesari and
 *   Raj Yoga from Moon–Jupiter; Chandra yogas always count the Moon);
 * - one planet's placement behind single-planet yogas (Harsha, Anapha and Vasi
 *   from Jupiter in Kumbha).
 * A yoga with several links is named by the one in the group, and its other
 * links are listed as separate. Nabhasa yogas and unrated items are left out.
 */
export function sharedLinks(present: YogaItem[], chart?: Chart): SharedLink[] {
  const noNodes = (ps: string[]) => ps.filter((p) => p !== "Rahu" && p !== "Ketu");
  type Entry = { y: YogaItem; combo: number };
  const groups = new Map<string, Entry[]>();
  const add = (key: string, e: Entry) => {
    const list = groups.get(key) ?? [];
    if (!list.some((x) => x.y === e.y)) list.push(e);
    groups.set(key, list);
  };
  const combosOf = (y: YogaItem) => y.combinations.map((c) => noNodes(c.participants));
  for (const y of present.filter((x) => !x.nabhasa && x.rating.level)) {
    combosOf(y).forEach((core, combo) => {
      const set = [...new Set([...core, ...(y.category === "Chandra yoga" ? ["Moon"] : [])])].sort();
      for (let a = 0; a < set.length; a++) for (let b = a + 1; b < set.length; b++) add(`${set[a]}+${set[b]}`, { y, combo });
      if (core.length === 1) add(`single:${core[0]}`, { y, combo });
    });
  }
  const pairName = (ps: string[]) => noNodes(ps).map(graha).join("–");
  return [...groups.entries()]
    .filter(([, es]) => es.length > 1)
    .map(([key, es]) => {
      const planets = key.startsWith("single:") ? [key.slice(7)] : key.split("+");
      const single = key.startsWith("single:") && chart ? chart.grahas.find((x) => x.name === planets[0]) : undefined;
      const label = (e: Entry) => (e.y.combinations.length > 1 ? `${e.y.name}'s ${pairName(e.y.combinations[e.combo].participants)} link` : e.y.name);
      const separate = es.flatMap((e) =>
        e.y.combinations.length > 1
          ? e.y.combinations.filter((c, k) => k !== e.combo && !planets.every((p) => noNodes(c.participants).includes(p))).map((c) => `${e.y.name}'s ${pairName(c.participants)} link`)
          : [],
      );
      return {
        planets,
        yogas: es.map(label),
        ...(single ? { placement: { planet: planets[0], sign: single.sign } } : {}),
        ...(separate.length ? { separate: [...new Set(separate)] } : {}),
      };
    })
    // A group whose yogas all appear in a larger group adds nothing.
    .filter((g, _, all) => !all.some((o) => o !== g && o.yogas.length > g.yogas.length && g.yogas.every((n) => o.yogas.includes(n))));
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
/**
 * Neechabhanga Raj Yoga (formed): rated on the debilitated planet's own level,
 * one level higher when two or more planets give independent (not
 * tradition-dependent) cancellations, and at most Moderate when the planet is
 * weak. The cancelling planets are not averaged in.
 */
function rateNeechabhangaRaja(full: ReturnType<typeof neechaBhanga>, strengths: ReturnType<typeof chartStrengths>): Rating<YogaLevel> {
  const LEVELS: YogaLevel[] = ["Weak", "Moderate", "Strong"];
  const each = full.map((n) => {
    const s = strengths.get(n.planet)!;
    const base = s.level === "strong" ? 2 : s.level === "moderate" ? 1 : 0;
    const boost = n.independent.length >= 2 ? 1 : 0;
    const idx = Math.min(base + boost, s.level === "weak" ? 1 : 2);
    const reasons = [
      `Rated on ${graha(n.planet)}'s own strength (${s.level})`,
      ...(boost ? [`${n.independent.length} planets give independent cancellations (${n.independent.map(graha).join(", ")}): one level higher`] : []),
      ...(s.level === "weak" && base + boost > 1 ? [`at most Moderate because ${graha(n.planet)} is weak`] : []),
    ];
    return { idx, reasons, planet: n.planet };
  });
  const best = each.sort((a, b) => b.idx - a.idx)[0];
  return { level: LEVELS[best.idx], label: `Rated ${LEVELS[best.idx]}`, reasons: best.reasons, basis: [best.planet] };
}

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
          ? { item: { ...it, combinations: it.combinations.filter((c) => full.some((n) => n.planet === c.participants[0])) }, rating: rateNeechabhangaRaja(full, chartStrengths(chart)) }
          : { item: it, rating: { level: "Weak", label: "Rated Weak", reasons: raja.map((n) => `Partial for ${n.planet}: ${n.raja.why}`), basis: raja.map((n) => n.planet) } },
      );
    }
  }
  for (const v of viparita(chart).filter((x) => x.formed)) {
    out.push({ item: item(v.key, "Viparita Raja Yoga", [{ claim: `${v.lord}, lord of the ${v.lordOf}th, is in the ${v.house}th${v.house === v.lordOf ? " (own sign)" : ""}`, participants: [v.lord] }]) });
  }
  const links = dhana(chart);
  if (links.length) out.push({ item: item("yoga.dhana", "Dhana yoga", links.map((l) => ({ claim: l.how, participants: [l.a, l.b] }))) });
  for (const x of exchanges(chart)) {
    const lords = houseLords(chart.lagna.sign_num);
    const rules = (p: string) => Object.entries(lords).filter(([, l]) => l === p).map(([h]) => `${h}`).join("/");
    out.push({
      item: item(`yoga.parivartana_${x.kind.toLowerCase()}`, "Parivartana yoga", [
        { claim: `${x.a} (lord of ${rules(x.a)}) in Bhava ${x.houses[0]} and ${x.b} (lord of ${rules(x.b)}) in Bhava ${x.houses[1]} exchange signs`, participants: [x.a, x.b] },
      ]),
    });
  }
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
