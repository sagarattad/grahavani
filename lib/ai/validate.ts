// Code-side check run on every AI response before it is shown as final or cached.
// It only checks claims that can be compared with the computed facts; general
// numbers such as "8 koots", "36 points" or "12 houses" are ignored.
import { DOSHAS, GRAHAS, KOOTS, RASHIS, YOGA_CHECKLIST } from "../glossary";
import type { ValidationContext } from "./facts";

/**
 * Problems with wording rather than facts (how often "tentative" or
 * "borderline" is said, method wording, an ambiguous rating phrase, ranking
 * words). They are sent back for a rewrite like any problem, but a last
 * attempt with only these is accepted (lib/ai/reading.ts): a correct reading
 * is never thrown away over style.
 */
export const STYLE = "[style] ";
export const isStyleProblem = (p: string) => p.startsWith(STYLE);

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

const EXTRA_GRAHA_ALIASES: Record<string, string> = {
  ravi: "Sun",
  chandrama: "Moon",
  mangala: "Mars",
  budha: "Mercury",
  brihaspati: "Jupiter",
  shanidev: "Saturn",
};

const grahaAlias = new Map<string, string>();
for (const [api, e] of Object.entries(GRAHAS)) {
  grahaAlias.set(api.toLowerCase(), api);
  grahaAlias.set(e.en.toLowerCase(), api);
  if (e.meaning && !e.meaning.includes(" ")) grahaAlias.set(e.meaning.toLowerCase(), api);
}
for (const [a, api] of Object.entries(EXTRA_GRAHA_ALIASES)) grahaAlias.set(a, api);

const rashiAlias = new Map<string, string>();
for (const r of Object.values(RASHIS)) {
  rashiAlias.set(r.en.toLowerCase(), r.en);
  if (r.meaning) rashiAlias.set(r.meaning.toLowerCase(), r.en);
}

const kootAlias = new Map<string, string>([
  ["varna", "Varna"],
  ["vashya", "Vasya"],
  ["vasya", "Vasya"],
  ["tara", "Tara"],
  ["yoni", "Yoni"],
  ["graha maitri", "Graha Maitri"],
  ["gana", "Gana"],
  ["bhakoot", "Bhakoot"],
  ["bhakut", "Bhakoot"],
  ["nadi", "Nadi"],
]);

const alt = (keys: Iterable<string>) =>
  [...keys].sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, "\\s+")).join("|");

const GRAHA_RE = alt(grahaAlias.keys());
const RASHI_RE = alt(rashiAlias.keys());
const KOOT_RE = new RegExp(`\\b(${alt(kootAlias.keys())})\\b`, "gi");

const PLACEMENT_RE = new RegExp(
  `\\b(${GRAHA_RE})\\b(?:\\s*\\([^)]*\\))?\\s+(?:(?:is|sits|placed|located|being|positioned)\\s+)*in\\s+(?:the\\s+|your\\s+)?` +
    `(?:(${RASHI_RE})\\b|(\\d{1,2})(?:st|nd|rd|th)\\s+(?:bhava|house)|(${ORDINALS.join("|")})\\s+(?:bhava|house)|(?:bhava|house)\\s+(\\d{1,2}))`,
  "gi",
);
const DASHA_RE = new RegExp(
  `\\b(${GRAHA_RE})\\b(?:\\s*\\([^)]*\\))?\\s+(maha\\s*dasha|antar\\s*dasha|pratyantar(?:\\s*dasha)?)`,
  "gi",
);
const FRACTION_RE = /(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/gi;
const POINTS_RE = /(\d+(?:\.\d+)?)\s+points?\b/gi;
const GENERAL_SCORE_CONTEXT = /minimum|at least|threshold|or more|or above|or below|traditionally considered/i;

function collectStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

// Ratings may only be stated in these fixed forms (see ratingPhrase in lib/strength.ts).
// English only: localise together with the prompts when other languages are added.
export const RATING_RE = /\b(?:rated\s+(strong|moderate|weak)|(high|medium|low)\s+intensity)\b/gi;
// The old "intensity: Low" form (and "carries / has intensity: …", "intensity is: …"): rejected; write "Low intensity" or "is cancelled".
export const INTENSITY_COLON_RE = /\bintensity\s*(?:is\s*)?:\s*(?:high|medium|low|cancelled)\b|\bintensity\s+(?:of\s+)?(?:high|medium|low|cancelled)\b/i;
const cap = (w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase();
export const normRating = (m: RegExpMatchArray) => (m[1] ? `rated ${cap(m[1])}` : `${cap(m[2])} intensity`);

// Grahavani's rating is not Shadbala. A sentence that mentions Shadbala together
// with a rating word is rejected unless it says Shadbala is not covered.
const SHADBALA_RE = /shadbala/i;
const RATING_WORD_RE = /\b(rating|rated|intensity|strong|moderate|weak|high|medium|low)\b/i;
// "partial Shadbala components" (Uccha, Dig, Paksha) are in FACTS and may be named.
const NOT_COVERED_RE = /\b(not|isn['’]t|no|never|doesn['’]t|different|separate|without|partial)\b/i;

// Absolute or deterministic negative phrasing (item 11 of the Oct 2026 review).
const DETERMINISTIC_RE = /\b(very little results?|marked difficult(?:y|ies)|will (?:never|certainly|definitely)\b[^.]*|is (?:certain|guaranteed|bound) to|no chance of)\b/i;

// Method / pipeline wording belongs in the page footnotes, not in the reading.
const META_RE = /\b(not computed|(?:explicitly )?not counted|recorded as|rating basis|the data shows|the chart (?:names|gives|lists|records))\b/i;
const META_CASED_RE = /\bFACTS\b/;

// A qualitative Dig bala / directional strength claim ("low directional strength").
const DIG_CLAIM_RE = /\b(?:(?:low|weak|poor|little|high|strong|good|full)\s+(?:directional strength|dig\s*bala)|(?:directional strength|dig\s*bala)\s+(?:is\s+|of\s+)?(?:low|weak|poor|high|strong|good|full))\b/i;
const GRAHA_NAME_RE = new RegExp(`\\b(${GRAHA_RE})\\b`, "gi");

// A dignity word attached to a planet ("in an enemy's sign", "neutral dignity", "compound: friend").
const DIGNITY_WORD_RE = /\b(?:(great enemy|great friend|enemy|friend|neutral)(?:['’]s)?\s+(?:sign|rashi|dignity)|compound:?\s+(great enemy|great friend|enemy|friend|neutral))\b/gi;
const OTHER_DOSHA_NAMES = [...Object.values(DOSHAS).map((d) => d.en.replace(/ Dosha$/, "")), "Nadi", "Bhakoot", "Sade Sati", "Dhaiya"];
// Residual-effect wording, not allowed for a dosha that is formed but cancelled (rule C1).
const RESIDUAL_RE = /\b(not (?:fully )?(?:erased|removed|eliminated)|without (?:removing|erasing)|rather than (?:remov|eras)\w*|retains?|residual|still (?:operates?|active|felt|present)|reduces?|reduced|weakens? but)\b/i;

// A birth-time caveat, required in every field that makes a D9 / D10 claim when that chart is sensitive (rule E4).
const TENTATIVE_RE = /tentativ|sensitive to (?:the )?(?:exact )?birth[- ]time|birth[- ]time[- ]sensitive|if the birth time is (?:exact|accurate)|depends? on (?:the )?exact birth time/i;

// A sentence about transits ("double transit", "Shani aspecting from Mithuna").
const TRANSIT_CUE_RE = new RegExp(`\\btransit|\\bwindows?\\b|\\binfluenc|\\baspect\\w* from\\b|\\bfrom (?:${RASHI_RE})\\b`, "i");
// Claims that depend on a chart's Lagna: its houses, its 7th / 10th and their lords.
const LAGNA_DEP_RE = /\b(lagna|ascendant|house|bhava|7th|seventh|10th|tenth|lord)\b/i;
// "D9 7th lord", "D9's 7th house", "Navamsa Lagna" (right after the chart's name) and
// "7th house of the D9", "lord of the D9 7th" (just before it).
const DEP_AFTER_RE = /^(?:['’]s)?\s+(?:chart\s+)?(?:lagna|ascendant|\d{1,2}(?:st|nd|rd|th)|seventh|tenth|house|bhava)\b/i;
// "D9 7th lord" / "lord of the D9 7th": a claim about the lord only.
const LORD_AFTER_RE = /^(?:['’]s)?\s+(?:\d{1,2}(?:st|nd|rd|th)|seventh|tenth)\s+(?:house\s+)?lord\b/i;
const LORD_BEFORE_RE = /\blord\s+(?:of|in|from)\s+(?:the\s+|its\s+)?$/i;
const DEP_BEFORE_RE = /\b(?:lagna|ascendant|house|bhava|7th|seventh|10th|tenth|lord)\s+(?:of|in|from)\s+(?:the\s+|its\s+)?$/i;
// A planet's own varga sign or dignity there.
const FIRM_CLAIM_RE = /\b(exalted|debilitated|own sign|moolatrikona|vargottama|great friend|great enemy|friend|enemy|neutral)\b/gi;

// "two windows", "3 timing windows"
const WINDOW_COUNT_RE = /\b(one|two|three|four|five|six|seven|eight|\d{1,2})\s+(?:[a-z-]+\s+){0,3}?windows?\b/gi;
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
// "the first three of five windows"
const FIRST_N_OF_M_RE = /\bfirst (one|two|three|four|five|six|seven|eight|\d{1,2}) of (?:the )?(one|two|three|four|five|six|seven|eight|\d{1,2})\b/i;
const RANK_WORD_RE = /\b(strong(?:er|est)|best|better|weak(?:er|est)|worse|worst|most promising)\b/i;

/**
 * The planet a word at `at` is about: the one named nearest before it within
 * `maxBefore` characters, else the first one named within `maxAfter` after it.
 * A word further from any planet name ("the 10th lord's great enemy dignity")
 * is left unattributed.
 */
function planetNear(sentence: string, at: number, maxBefore = 45, maxAfter = 25): string | undefined {
  const names = [...sentence.matchAll(GRAHA_NAME_RE)].map((m) => ({ at: m.index!, end: m.index! + m[0].length, api: grahaAlias.get(m[1].toLowerCase().replace(/\s+/g, " ")) }));
  const before = names.filter((n) => n.end <= at && at - n.end <= maxBefore);
  if (before.length) return before[before.length - 1].api;
  return names.find((n) => n.at > at && n.at - at <= maxAfter)?.api;
}

// Every Yoga / Dosha name the app knows, so naming an unrated one (e.g. "Neechabhanga
// Raj Yoga" in a chart that only has "Raj Yoga") counts as its own item.
const KNOWN_ITEM_NAMES = [...YOGA_CHECKLIST.map((c) => c.label.en), ...Object.values(DOSHAS).map((d) => d.en), "Nadi Dosha", "Bhakoot Dosha"]
  .flatMap((n) => [n, n.replace(/ (Yoga|Dosha)$/, "")])
  .map((n) => [n.toLowerCase(), `name:${n.toLowerCase().replace(/ (yoga|dosha)$/, "")}`] as const);

/** "Chandra-Mangala" and "Chandra Mangala" are the same name. */
const normName = (s: string) => s.toLowerCase().replace(/[-\s]+/g, " ").trim();

/**
 * Checks the fixed rating phrases in one text field against FACTS. Each phrase
 * belongs to:
 * - the one item named since the previous phrase in its sentence
 *   ("Gajakesari is rated Strong, while Vesi is rated Weak");
 * - else the sentence's only item ("Rated Strong, Raj Yoga…");
 * - else the item named most recently before it in the field
 *   ("Manglik Dosha is present. It is of Medium intensity").
 * Two items before one phrase ("Raj Yoga and Dhana Yoga are rated Moderate") is
 * ambiguous and rejected; a phrase with no item named anywhere before it too.
 */
function checkRatings(text: string, ratings: NonNullable<ValidationContext["ratings"]>): string[] {
  const phrases = [...text.matchAll(RATING_RE)];
  if (!phrases.length) return [];
  const byName = new Map([
    ...KNOWN_ITEM_NAMES.map(([n, key]) => [normName(n), key] as const),
    ...ratings.flatMap((r) => r.names.map((n) => [normName(n), r.key] as const)),
  ]);
  const pattern = [...byName.keys()]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[-\\s]+"))
    .join("|");
  const names = [...text.matchAll(new RegExp(`\\b(${pattern})\\b`, "gi"))].map((m) => ({ at: m.index!, key: byName.get(normName(m[1]))! }));
  // Sentence boundaries (a semicolon does not end a sentence here).
  const starts = [0, ...[...text.matchAll(/[.!?\n]\s*/g)].map((m) => m.index! + m[0].length)];
  const sentenceOf = (i: number) => {
    const start = Math.max(...starts.filter((s) => s <= i));
    const end = Math.min(...starts.filter((s) => s > i), text.length);
    return { start, end };
  };

  const problems: string[] = [];
  let from = 0;
  for (const m of phrases) {
    const at = m.index!;
    const { start, end } = sentenceOf(at);
    const since = new Set(names.filter((n) => n.at >= Math.max(from, start) && n.at < at).map((n) => n.key));
    // The phrase's own clause ("Ruchaka has a Bhanga, Manglik Dosha remains of Medium intensity").
    const clauseStart = Math.max(from, start, ...[...text.slice(start, at).matchAll(/[,;:–—]|\bwhile\b/g)].map((c) => start + c.index! + c[0].length));
    const inClause = new Set(names.filter((n) => n.at >= clauseStart && n.at < at).map((n) => n.key));
    const inSentence = new Set(names.filter((n) => n.at >= start && n.at < end).map((n) => n.key));
    const before = names.filter((n) => n.at < at);
    from = at + m[0].length;
    const owner =
      inClause.size === 1
        ? [...inClause][0]
        : since.size === 1
        ? [...since][0]
        : since.size > 1
          ? null
          : inSentence.size === 1
            ? [...inSentence][0]
            : inSentence.size === 0 && before.length
              ? before[before.length - 1].key
              : null;
    // "Dhana Yoga and Vasi are each rated Weak": fine when every item named has that rating.
    const shared = inClause.size > 1 ? inClause : since;
    const ratedAs = (key: string) => ratings.some((r) => r.key === key && r.rating === normRating(m));
    if (!owner && shared.size > 1 && [...shared].every(ratedAs)) continue;
    if (!owner) {
      problems.push(`${STYLE}Rating "${m[0]}" must clearly belong to one Yoga or Dosha (name it just before the rating)`);
      continue;
    }
    const mine = ratings.filter((r) => r.key === owner);
    const allowed = new Set(mine.map((r) => r.rating));
    if (!allowed.has(normRating(m))) {
      const label = mine[0]?.names[0] ?? owner.slice("name:".length);
      problems.push(`${label}: text says "${m[0]}", computed ${allowed.size ? [...allowed].join(" / ") : "no rating"}`);
    }
  }
  return problems;
}

const sentencesOf = (text: string) => text.split(/(?<=[.!?;])\s+|\n+/).filter(Boolean);

const D9_RE = /navamsa|navamsha|\bd-?9\b/i;
const D10_RE = /dashamsha|dasamsa|dashamsa|\bd-?10\b/i;
// Only an explicit "in the D1 / birth chart" switches back to the D1 ("improved from the D1" does not).
const D1_RE = /\bin (?:the |your )?(?:d-?1(?: chart)?|birth chart|rashi chart|lagna chart)\b/i;

/**
 * Sentences with the divisional charts they may refer to. A sentence naming
 * the D9 or D10 sets it for the rest of its paragraph ("The D10 has Karka
 * Lagna. Mangal in Meena…") until a sentence names another chart.
 */
function sentencesWithVarga(fields: string[]) {
  const out: { sentence: string; d9: boolean; d10: boolean; prev: string }[] = [];
  for (const para of fields.flatMap((f) => f.split(/\n+/))) {
    let carried: "d9" | "d10" | null = null;
    let prev = "";
    for (const sentence of sentencesOf(para)) {
      const d9 = D9_RE.test(sentence);
      const d10 = D10_RE.test(sentence);
      if (d9 !== d10) carried = d9 ? "d9" : "d10";
      else if (!d9 && D1_RE.test(sentence)) carried = null;
      out.push({ sentence, d9: d9 || carried === "d9", d10: d10 || carried === "d10", prev });
      prev = sentence;
    }
  }
  return out;
}

export function validateReading(output: unknown, ctx: ValidationContext): string[] {
  const problems: string[] = [];

  // 1. Structured koot points must equal the API values exactly.
  if (ctx.koots && output && typeof output === "object" && "koots" in output) {
    const items = (output as { koots: { koot: string; earned: number; max: number }[] }).koots;
    if (items.length !== ctx.koots.length) problems.push(`Expected ${ctx.koots.length} koots, got ${items.length}`);
    ctx.koots.forEach((k, i) => {
      const item = items[i];
      if (!item) return;
      const api = kootAlias.get(item.koot.toLowerCase()) ?? item.koot;
      if (api !== k.api) problems.push(`Koot ${i + 1} should be ${k.api}, got ${item.koot}`);
      if (item.earned !== k.earned || item.max !== k.max)
        problems.push(`${k.api}: points must be ${k.earned}/${k.max}, got ${item.earned}/${item.max}`);
    });
  }

  // Birth-time caveat per field (rule E4). Only claims that depend on a sensitive chart's Lagna
  // (its houses, its 7th / 10th and their lords) are tentative; they need "tentative" in their
  // field, said once. A planet's own varga sign, dignity or Vargottama is firm unless the planet
  // itself is listed as sensitive, so "tentative" must not be attached to it.
  if (ctx.birthTimeSensitive && output && typeof output === "object") {
    const bt = ctx.birthTimeSensitive;
    for (const [field, value] of Object.entries(output as Record<string, unknown>)) {
      if (typeof value !== "string") continue;
      const sentences = sentencesOf(value);
      // Lagna-dependent only when the house / Lagna / lord word is attached to the chart's name:
      // right after it ("the D9 7th lord", "Navamsa Lagna") or just before it ("7th house of the
      // D9"), not a D1 house elsewhere in the sentence ("in Bhava 9 and own sign in the D9").
      // A claim about only the 7th / 10th lord is not tentative when that lord is the same
      // under the neighbouring Lagna(s) (FACTS.birth_time.firm).
      const dependent = (re: RegExp, firmLord: boolean) =>
        sentences.some((x) =>
          [...x.matchAll(new RegExp(re.source, "gi"))].some((m) => {
            const after = x.slice(m.index! + m[0].length, m.index! + m[0].length + 22);
            const before = x.slice(Math.max(0, m.index! - 30), m.index!);
            if (firmLord && (LORD_AFTER_RE.test(after) || LORD_BEFORE_RE.test(before))) return false;
            return DEP_AFTER_RE.test(after) || DEP_BEFORE_RE.test(before);
          }),
        );
      const caveat = TENTATIVE_RE.test(value);
      for (const [chart, re, on, firmLord] of [["D9", D9_RE, bt.d9, bt.firmLords?.d9], ["D10", D10_RE, bt.d10, bt.firmLords?.d10]] as const) {
        if (on && !caveat && dependent(re, Boolean(firmLord))) problems.push(`${STYLE}${field}: ${chart} Lagna-dependent claims (houses, 7th / 10th and their lords) need "tentative" in this field`);
      }
      const count = (value.match(/tentativ/gi) ?? []).length;
      if (count > 1) problems.push(`${STYLE}${field}: say "tentative" once per section, on the specific claim (${count} times)`);
      for (const x of sentences) {
        if (!/tentativ/i.test(x) || LAGNA_DEP_RE.test(x)) continue;
        const firm = [...x.matchAll(FIRM_CLAIM_RE)].map((m) => planetNear(x, m.index!)).find((p) => p && !(bt.planets ?? []).includes(p));
        if (firm) problems.push(`${STYLE}"${x.slice(0, 80)}": ${firm}'s own varga sign and dignity are firm; do not call them tentative`);
      }
    }
  }

  // 0. Ratings: fixed phrases must match FACTS (checked per text field).
  if (ctx.ratings?.length) for (const field of collectStrings(output)) problems.push(...checkRatings(field, ctx.ratings));

  const borderline = new Map<string, number>();
  let windowCountStated = false;
  for (const { sentence, d9, d10, prev } of sentencesWithVarga(collectStrings(output))) {
    // Never present a rating as Shadbala.
    if (SHADBALA_RE.test(sentence) && RATING_WORD_RE.test(sentence) && !NOT_COVERED_RE.test(sentence))
      problems.push(`"${sentence.slice(0, 80)}" presents a rating as Shadbala`);

    // Ratings use "Low intensity" / "is cancelled", never "intensity: Low" (rule R1).
    const colon = sentence.match(INTENSITY_COLON_RE);
    if (colon) problems.push(`${STYLE}"${colon[0]}": write "${colon[0].match(/high|medium|low/i)?.[0].replace(/^./, (c) => c.toUpperCase()) ?? "Low"} intensity" (or "is cancelled") instead`);

    // "Both Dasha lords are not significators" reads as the opposite of what is meant (rule W1).
    const awkward = sentence.match(/\bboth (?:dasha|period) lords are not\b/i);
    if (awkward) problems.push(`${STYLE}"${awkward[0]}": say "Neither window has both Dasha lords as significators" (FACTS.marriage.timing_windows_note)`);

    // Methodology wording stays out of the reading (rule E8).
    const meta = sentence.match(META_RE) ?? sentence.match(META_CASED_RE);
    if (meta) problems.push(`${STYLE}"${meta[0]}" describes the method; keep methodology in the footnotes`);

    // A Dig bala claim must be about a planet whose strength factors list it (rule E1).
    if (ctx.digBalaFactor && DIG_CLAIM_RE.test(sentence)) {
      const named = [...new Set([...sentence.matchAll(GRAHA_NAME_RE)].map((m) => grahaAlias.get(m[1].toLowerCase().replace(/\s+/g, " "))).filter(Boolean))];
      if (named.length && !named.some((n) => ctx.digBalaFactor!.includes(n!)))
        problems.push(`"${sentence.slice(0, 80)}" claims a Dig bala that is not among ${named.join(", ")}'s strength factors`);
    }

    // A planet's dignity word must be its compound dignity in a chart the sentence is about (rule D1).
    if (ctx.dignities) {
      for (const m of sentence.matchAll(DIGNITY_WORD_RE)) {
        const word = (m[1] ?? m[2]).toLowerCase();
        const api = planetNear(sentence, m.index!);
        const dg = api ? ctx.dignities[api] : undefined;
        if (!dg) continue;
        const allowed = [dg.d1, d9 ? dg.d9 : undefined, d10 ? dg.d10 : undefined].filter(Boolean);
        if (!allowed.includes(word)) problems.push(`"${m[0]}" for ${api}: its dignity is ${allowed.join(" / ")} (use the compound dignity from FACTS)`);
      }
    }

    // A cancelled dosha traditionally does not operate: no residual-effect wording (rule C1).
    if (ctx.cancelledDoshas?.length) {
      // The dosha may be named in this sentence or the one before ("Kemadruma is cancelled; the cancellations reduce…").
      const norm = (t: string) => t.toLowerCase().replace(/-/g, " ");
      const has = (t: string, n: string) => norm(t).includes(norm(n));
      // A sentence about another dosha stands on its own.
      const other = OTHER_DOSHA_NAMES.some((n) => has(sentence, n) && !ctx.cancelledDoshas!.some((c) => has(c, n) || has(n, c)));
      const named = ctx.cancelledDoshas.find((n) => has(sentence, n) || (!other && has(prev, n)));
      const residual = named && sentence.match(RESIDUAL_RE);
      if (residual) problems.push(`"${residual[0]}" about ${named}: a cancelled dosha is noted for completeness and traditionally does not operate`);
    }

    // Window count and ranking must follow FACTS.marriage (rule W1).
    if (ctx.windows) {
      const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUMBER_WORDS.indexOf(w.toLowerCase()));
      const firstOf = sentence.match(FIRST_N_OF_M_RE);
      if (firstOf) {
        if (num(firstOf[2]) !== ctx.windows.count || num(firstOf[1]) !== (ctx.windows.listed ?? ctx.windows.count))
          problems.push(`"${firstOf[0]}": there are ${ctx.windows.count} timing windows, ${ctx.windows.listed ?? ctx.windows.count} listed`);
      } else {
        for (const m of sentence.matchAll(WINDOW_COUNT_RE)) {
          if (num(m[1]) !== ctx.windows.count) problems.push(`"${m[0]}": there are ${ctx.windows.count} timing windows`);
        }
      }
      if (WINDOW_COUNT_RE.test(sentence) || firstOf) windowCountStated = true;
      WINDOW_COUNT_RE.lastIndex = 0;
      if (!ctx.windows.ranked && /\bwindows?\b/i.test(sentence) && RANK_WORD_RE.test(sentence))
        problems.push(`${STYLE}"${sentence.slice(0, 80)}" ranks timing windows, but none ranks above another`);
    }

    // "Borderline" once per planet, where its rating first matters (rule E7).
    for (const m of sentence.matchAll(/\bborderline\b/gi)) {
      const api = planetNear(sentence, m.index!);
      if (api) borderline.set(api, (borderline.get(api) ?? 0) + 1);
    }

    // No absolute negative verdicts (they need several strong factors, which the prompt asks to name).
    const absolute = sentence.match(DETERMINISTIC_RE);
    if (absolute) problems.push(`"${absolute[0]}" is an absolute negative; describe the factors and their balance instead`);

    // 2. Graha–Rashi / Graha–Bhava pairs must exist in the facts (D9 / D10 when the paragraph has named them).
    const mentionsD9 = d9;
    const mentionsD10 = d10;
    for (const m of sentence.matchAll(PLACEMENT_RE)) {
      const api = grahaAlias.get(m[1].toLowerCase().replace(/\s+/g, " "));
      if (!api) continue;
      const mine = [
        ...ctx.placements.filter((p) => p.graha === api && (p.chart === "d1" || (mentionsD9 && p.chart === "d9") || (mentionsD10 && p.chart === "d10"))),
        // A sentence about transits may name where Saturn or Jupiter transits.
        ...(TRANSIT_CUE_RE.test(sentence) ? (ctx.transitPlacements ?? []).filter((p) => p.graha === api) : []),
      ];
      if (m[2]) {
        const r = rashiAlias.get(m[2].toLowerCase());
        if (r && !mine.some((p) => p.rashi === r)) problems.push(`"${m[0]}" is not in the computed facts`);
      } else {
        const bhava = m[3] ? Number(m[3]) : m[4] ? ORDINALS.indexOf(m[4].toLowerCase()) + 1 : Number(m[5]);
        if (!mine.some((p) => p.bhava === bhava)) problems.push(`"${m[0]}" is not in the computed facts`);
      }
    }

    // 3. Dasha lords must match the computed periods.
    if (ctx.dasha) {
      for (const m of sentence.matchAll(DASHA_RE)) {
        const api = grahaAlias.get(m[1].toLowerCase());
        const level = m[2].toLowerCase().replace(/\s+/g, "");
        const ok = level.startsWith("maha")
          ? ctx.dasha.mahadashaLords.includes(api ?? "")
          : level.startsWith("antar")
            ? ctx.dasha.antardashaLords.includes(api ?? "")
            : api === ctx.dasha.pratyantardasha;
        if (!ok) problems.push(`"${m[0]}" does not match the computed Dasha`);
      }
    }

    // 4. Total score "N / 36".
    if (ctx.total !== undefined && !GENERAL_SCORE_CONTEXT.test(sentence)) {
      for (const m of sentence.matchAll(FRACTION_RE)) {
        if (Number(m[2]) === 36 && Number(m[1]) !== ctx.total)
          problems.push(`Total must be ${ctx.total}/36, text says "${m[0]}"`);
      }
    }

    // 5. Points mentioned next to exactly one koot name.
    if (ctx.koots) {
      const named = new Set([...sentence.matchAll(KOOT_RE)].map((m) => kootAlias.get(m[1].toLowerCase().replace(/\s+/g, " "))));
      if (named.size === 1) {
        const k = ctx.koots.find((x) => x.api === [...named][0]);
        if (k) {
          for (const m of sentence.matchAll(FRACTION_RE)) {
            if (Number(m[2]) === k.max && Number(m[1]) !== k.earned)
              problems.push(`${k.api}: text says "${m[0]}", computed ${k.earned}/${k.max}`);
          }
          for (const m of sentence.matchAll(POINTS_RE)) {
            const n = Number(m[1]);
            if (n !== k.earned && n !== k.max && n !== 36 && n !== ctx.total)
              problems.push(`${k.api}: text says "${m[0]}", computed ${k.earned}/${k.max}`);
          }
        }
      }
    }
  }
  // The marriage section states how many windows there are (rule W1).
  const marriageText = output && typeof output === "object" ? (output as Record<string, unknown>).marriage : undefined;
  if (ctx.windows?.count && typeof marriageText === "string" && /\bwindows?\b/i.test(marriageText) && !windowCountStated)
    problems.push(`${STYLE}marriage: say how many timing windows there are (${ctx.windows.count})`);
  for (const [api, n] of borderline) if (n > 1) problems.push(`${STYLE}${api} is called borderline ${n} times; say it once, where its rating first matters`);

  // 6. Dates: every date must be one that appears in FACTS (or a birth date).
  if (ctx.allowedDates) problems.push(...checkDates(collectStrings(output).join("\n"), ctx.allowedDates));

  return [...new Set(problems)];
}

const MON = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const FULL_DATE_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? (${MON})[a-z]* (\\d{4})\\b`, "g");
const MONTH_YEAR_RE = new RegExp(`\\b(${MON})[a-z]*,? (\\d{4})\\b`, "g");
const YEAR_RE = /\b(19\d{2}|20\d{2}|21\d{2})\b/g;

/**
 * "25 Jan 2026" must equal a FACTS date exactly; "January 2026" must match the
 * month and year of one; a bare "2026" must match the year of one.
 */
export function checkDates(text: string, allowed: string[]): string[] {
  const problems: string[] = [];
  const full = new Set(allowed);
  const monthYears = new Set(allowed.map((d) => d.split(" ").slice(1).join(" ")));
  const years = new Set(allowed.map((d) => d.split(" ")[2]));
  let rest = text.replace(FULL_DATE_RE, (m, d, mon, y) => {
    const norm = `${Number(d)} ${mon} ${y}`;
    if (!full.has(norm)) problems.push(`Date "${m}" is not in the computed facts`);
    return " ";
  });
  rest = rest.replace(MONTH_YEAR_RE, (m, mon, y) => {
    if (!monthYears.has(`${mon} ${y}`)) problems.push(`Date "${m}" is not in the computed facts`);
    return " ";
  });
  for (const m of rest.matchAll(YEAR_RE)) {
    if (!years.has(m[1])) problems.push(`Year "${m[1]}" is not in the computed facts`);
  }
  return problems;
}

export const KOOT_NAMES_FOR_TESTS = KOOTS.map((k) => k.api);
