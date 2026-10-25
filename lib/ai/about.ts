// "About this Yoga / Dosha": the items that get a short AI-written text, the
// FACTS for that call, and the code-side checks. Pure (no database, no OpenAI)
// so it can be unit-tested; see about-server.ts for generation and caching.
import { GRAHAS, cancellationLabel, graha, nakshatra, rashi } from "../glossary";
import { yogaChecklist } from "../yogas";
import { buildDoshas } from "../doshas";
import { comparedText, doshaState, sortKoots } from "../summaries";
import { points } from "../format";
import { INTENSITY_COLON_RE, RATING_RE, normRating, validateReading } from "./validate";
import type { ValidationContext } from "./facts";
import { rateKootDosha, ratingPhrase } from "../strength";
import type { Chart, KaalSarp, Manglik, Milan } from "../kundlit-schemas";
import { chartStrengths } from "../astro/planet-strength";
import { dignityFact } from "../astro/relations";

export type AboutTexts = Record<string, string>; // item key → text

export type AboutItem = {
  key: string;
  name: string;
  kind: "yoga" | "dosha";
  status: string;
  details: string[];
  cancellations: string[];
  rating: string; // fixed phrase, e.g. "rated Moderate", "Low intensity", "cancelled", "not rated"
  rating_reasons: string[];
};

/** Dosha card statuses that count as "present" and get an About text. */
export const ABOUT_DOSHA_STATUSES: ReadonlySet<string> = new Set(["present", "cancelled", "running"]);

const g = (apiName: string) => {
  const e = GRAHAS[apiName];
  return e ? `${e.en} (${e.meaning})` : apiName;
};

function mangalPlacement(chart: Chart): string[] {
  const m = chart.grahas.find((x) => x.name === "Mars");
  return m ? [`Mangal (Mars) is in ${rashi(m.sign_num)}, Bhava ${m.house}`] : [];
}

/** Present Yogas and Doshas of one chart. No dates or activation windows. */
export function aboutItemsForChart(chart: Chart, extras: { manglik: Manglik | null; kaalSarp: KaalSarp | null }): AboutItem[] {
  const asOf = chart.vimshottari.current.as_of;
  const yogas: AboutItem[] = yogaChecklist(chart, asOf).present.map((y) => ({
    key: y.key,
    name: y.name,
    kind: "yoga",
    status: y.status === "cancelled" ? "present but cancelled (Bhanga)" : "present",
    details: y.combinations.map((c) => c.claim),
    cancellations: y.cancellations,
    rating: ratingPhrase(y.rating, "yoga"),
    rating_reasons: y.rating.reasons,
  }));
  const doshas: AboutItem[] = buildDoshas({ chart, manglik: extras.manglik, kaalSarp: extras.kaalSarp, asOf })
    .filter((c) => ABOUT_DOSHA_STATUSES.has(c.status))
    .map((c) => ({
      key: c.key,
      name: c.name,
      kind: "dosha",
      status: c.statusLabel,
      details: [
        // About texts carry no dates, so dated transit notes stay out.
        ...c.details.filter((d) => !d.startsWith("Cancellation: ") && !d.startsWith("Transiting Shani over")),
        // Manglik: say where Mangal is, so the text can explain it in plain words.
        ...(c.key === "manglik" ? mangalPlacement(chart) : []),
        // Transit doshas: name the running phase (never its dates).
        ...c.ranges.filter((r) => r.current).map((r) => `Running phase: ${r.label}`),
      ],
      cancellations: c.details.filter((d) => d.startsWith("Cancellation: ")).map((d) => d.slice("Cancellation: ".length)),
      rating: ratingPhrase(c.rating, "dosha"),
      rating_reasons: c.rating.reasons,
    }));
  return [...yogas, ...doshas];
}

/** FACTS for a chart's About texts: placements to tailor from, plus the items. */
export function aboutFacts(chart: Chart, items: AboutItem[]) {
  const strengths = chartStrengths(chart);
  const facts = {
    lagna: { rashi: rashi(chart.lagna.sign_num), lagna_lord: g(chart.lagna.lord) },
    // Grahavani's dignity (BPHS degree zones, compound relation), not Kundlit's coarser class.
    grahas: chart.grahas.map((x) => {
      const d = strengths.get(x.name)?.dignity;
      return { graha: g(x.name), rashi: rashi(x.sign_num), bhava: x.house, dignity: d ? dignityFact(d) : "node" };
    }),
    bhava_lords: Object.fromEntries(Object.entries(chart.functional.house_lords).map(([h, l]) => [h, graha(l)])),
    items,
  };
  const ctx: ValidationContext = {
    placements: chart.grahas.map((x) => ({ graha: x.name, rashi: rashi(x.sign_num), bhava: x.house, chart: "d1" as const })),
    allowedDates: [], // About texts never contain dates
  };
  return { facts, ctx };
}

/** Nadi and Bhakoot Dosha of a Gun Milan, when present (cancelled counts). */
export function milanAboutItems(milan: Milan): AboutItem[] {
  return sortKoots(milan.koots)
    .filter((k) => (k.koot === "Nadi" || k.koot === "Bhakoot") && doshaState(k) !== "none")
    .map((k) => ({
      key: k.koot === "Nadi" ? "nadiDosha" : "bhakootDosha",
      name: k.koot === "Nadi" ? "Nadi Dosha" : "Bhakoot Dosha",
      kind: "dosha",
      status: doshaState(k) === "cancelled" ? "present but cancelled" : "present",
      details: [`${k.koot} koot: ${points(k.earned)} / ${k.max_points}`, ...(comparedText(k) ? [`Compared: ${comparedText(k)}`] : [])],
      cancellations: cancellationLabel(k.cancelled_by) ? [cancellationLabel(k.cancelled_by)!] : [],
      rating: ratingPhrase(rateKootDosha(k, cancellationLabel(k.cancelled_by)), "dosha"),
      rating_reasons: rateKootDosha(k, cancellationLabel(k.cancelled_by)).reasons,
    }));
}

export function milanAboutFacts(groom: Chart, bride: Chart, items: AboutItem[]) {
  const moon = (c: Chart) => {
    const m = c.grahas.find((x) => x.name === "Moon")!;
    return { rashi: rashi(m.sign_num), nakshatra: nakshatra(m.nakshatra_num) };
  };
  const moonPlacement = (c: Chart) => {
    const m = c.grahas.find((x) => x.name === "Moon")!;
    return { graha: "Moon", rashi: rashi(m.sign_num), bhava: m.house, chart: "d1" as const };
  };
  return {
    facts: { groom_chandra: moon(groom), bride_chandra: moon(bride), items },
    ctx: { placements: [moonPlacement(groom), moonPlacement(bride)], allowedDates: [] } satisfies ValidationContext,
  };
}

const REMEDY_RE = /\b(remed\w*|puja|pooja|mantras?|gemstones?|gems?|yantras?|donat\w*|fasting|fasts|vrat)\b/i;
// Awkward rating constructions and references to the chart's own notes (About prompt rules).
const ABOUT_WORDING_RE = /\bintensity is:?\s+(?:high|medium|low|cancelled)\b|\bits intensity:?\s+\w+,?\s+because\b|\bthe chart['’]s own notes?\b|\bwhat the chart (?:names|calls)\b|\bthe chart names\b/i;

// "2nd and 11th", "2nd–5th", "9th and the 11th lords": a pair of houses named together.
const HOUSE_PAIR_RE = /\b(\d{1,2})(?:st|nd|rd|th)\b(?:\s+(?:house|bhava|lord)s?)?\s*(?:and|&|–|-|with|to)\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/gi;
/** House numbers in one computed combination: "lord of 2nd and 7th", "lord of [6, 9]", "Bhava 5". */
const housesIn = (claim: string) =>
  new Set([
    ...[...claim.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b/g)].map((m) => Number(m[1])),
    ...[...claim.matchAll(/\[([\d,\s]+)\]/g)].flatMap((m) => m[1].split(",").map(Number)),
    ...[...claim.matchAll(/\bBhava (\d{1,2})\b/g)].map((m) => Number(m[1])),
  ]);

/**
 * House pairs named in a Yoga's About text must be linked in one of its
 * computed combinations (e.g. Dhana from the 2nd–5th and 9th–11th lords must
 * not be described as "the 2nd and 11th").
 */
function checkAboutHouses(output: { items: { key: string; about: string }[] }, items: AboutItem[]): string[] {
  const problems: string[] = [];
  for (const i of output.items) {
    const item = items.find((x) => x.key === i.key);
    if (!item || item.kind !== "yoga") continue;
    const combos = item.details.map(housesIn).filter((s) => s.size);
    if (!combos.length) continue;
    for (const m of i.about.matchAll(HOUSE_PAIR_RE)) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (!combos.some((s) => s.has(a) && s.has(b))) problems.push(`"${i.key}": "${m[0]}" are not linked in this Yoga (its links: ${item.details.join("; ")})`);
    }
  }
  return problems;
}

/** Each About text may state only its own item's rating, in the fixed form. */
function checkAboutRatings(output: { items: { key: string; about: string }[] }, items: AboutItem[]): string[] {
  const problems: string[] = [];
  for (const i of output.items) {
    const want = items.find((x) => x.key === i.key)?.rating;
    for (const m of i.about.matchAll(RATING_RE)) {
      const got = normRating(m);
      if (got !== want) problems.push(`"${i.key}": text says "${m[0]}", computed ${want ?? "no rating"}`);
    }
  }
  return problems;
}

/** Problems with an About output: wrong keys, remedies, ratings, or facts/dates not in FACTS. */
export function validateAbout(
  output: { items: { key: string; about: string }[] },
  keys: string[],
  ctx: ValidationContext,
  items: AboutItem[] = [],
): string[] {
  const problems: string[] = [];
  const got = output.items.map((i) => i.key);
  const missing = keys.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !keys.includes(k));
  if (missing.length) problems.push(`Missing items: ${missing.join(", ")}`);
  if (extra.length) problems.push(`Unexpected items: ${extra.join(", ")}`);
  if (new Set(got).size !== got.length) problems.push("Duplicate items");
  for (const i of output.items) {
    const m = i.about.match(REMEDY_RE);
    if (m) problems.push(`"${i.key}" mentions a remedy ("${m[0]}")`);
    const w = i.about.match(ABOUT_WORDING_RE) ?? i.about.match(INTENSITY_COLON_RE);
    if (w) problems.push(`"${i.key}": "${w[0]}": state the rating as its own sentence ("it is of Low intensity", "it is cancelled") and do not refer to the chart's notes`);
  }
  problems.push(...checkAboutRatings(output, items));
  problems.push(...checkAboutHouses(output, items));
  problems.push(...validateReading(output, ctx));
  return problems;
}
