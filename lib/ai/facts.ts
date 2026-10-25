// Builds the FACTS sent to OpenAI from cached Kundlit results (plus the
// Antardasha split in lib/dasha.ts and timing candidates in lib/timing.ts).
// Never includes names, places, birth date or birth time.
import { GRAHAS, KOOTS, cancellationLabel, graha, kootLabel, rashi, nakshatra, severity, verdict } from "../glossary";
import type { Chart, DashaCurrent, KaalSarp, Manglik, Milan } from "../kundlit-schemas";
import { dateOnly } from "../format";
import { antardashas, contains, type Window } from "../dasha";
import { sharedLinks, yogaChecklist } from "../yogas";
import { buildDoshas, kaalSarpCard, kemadrumaCard, manglikCard, saturnReturnLines, type DoshaCard } from "../doshas";
import { timingCandidates } from "../timing";
import { doshaState, sortKoots } from "../summaries";
import { rateKootDosha, rateManglik, ratingPhrase, type Rating } from "../strength";
import { chartStrengths } from "../astro/planet-strength";
import { functionalNature } from "../astro/functional";
import { dignityFact, vargaReading, type Dignity } from "../astro/relations";
import { ownHouseLords } from "../astro/rules";
import { marriageFactors, type MarriageFactors } from "../astro/marriage";
import { marriageSignificators, marriageTiming, windowsLordsNote } from "../astro/marriage-timing";
import { birthTimeCheck, careerD10, d10Fact, lagnaLordCheck, transitOverlaps, type BirthTimeCheck, type CareerD10, type LordCheck } from "../astro/timing-checks";
import { readDashaLord, type DashaLordReading } from "../astro/dasha-lords";
import { JUPITER_GOOD_FROM_MOON, slowTransits } from "../astro/transits";
import { dasamsaSign } from "../astro/varga";
import type { ManglikResult } from "../astro/manglik";

/** What the validator is allowed to see mentioned in the AI text. */
export type ValidationContext = {
  placements: { graha: string; rashi: string; bhava?: number; chart: "d1" | "d9" | "d10" }[];
  koots?: { api: string; earned: number; max: number }[];
  total?: number;
  dasha?: { mahadashaLords: string[]; antardashaLords: string[]; pratyantardasha: string };
  /** Every "D Mon YYYY" date the text may use (all dates in FACTS, plus birth dates). */
  allowedDates?: string[];
  /** Rated Yogas / Doshas: the names the text may use for each, and its fixed rating phrase. */
  ratings?: RatingEntry[];
  /** Signs Saturn and Jupiter transit over the computed span (allowed in sentences about transits). */
  transitPlacements?: { graha: string; rashi: string; bhava?: number }[];
  /** Planets (API names) whose composite strength lists Dig bala as a factor. */
  digBalaFactor?: string[];
  /** Each planet's one dignity (compound relation or own / exalted / …) per chart. */
  dignities?: Record<string, { d1?: string; d9?: string; d10?: string }>;
  /** Charts whose Lagna changes within minutes of the birth time (their Lagna-dependent claims are tentative), and planets that could change their own varga sign. */
  birthTimeSensitive?: { d9: boolean; d10: boolean; planets?: string[]; firmLords?: { d9: boolean; d10: boolean } };
  /** Names of doshas that are formed but cancelled (they traditionally do not operate). */
  cancelledDoshas?: string[];
  /** Marriage timing windows: how many there are, and whether any rank above another. */
  windows?: { count: number; listed?: number; ranked: boolean };
};

export type RatingEntry = { key: string; names: string[]; rating: string };

const EXTRA_NAMES: Record<string, string[]> = {
  "Raj Yoga": ["Raja Yoga"],
  "Neechabhanga Raj Yoga": ["Neechabhanga Raja Yoga", "Neecha Bhanga Raj Yoga"],
  "Manglik Dosha": ["Mangal Dosha", "Kuja Dosha"],
  "Shani Dhaiya": ["Dhaiya", "Shani's Dhaiya", "Ardhashtama Shani", "Kantaka Shani"],
  "Sade Sati": ["Sadesati", "Sade Sati of Shani"],
  "Kaal Sarp Dosha": ["Kaal Sarpa Dosha", "Kalsarp Dosha", "Kaal Sarpa"],
  "Kemadruma Dosha": ["Kemadruma Yoga"],
};

/** "Dhana Yoga" may also be written "Dhana"; "Manglik Dosha" as "Manglik". */
export function ratingEntry(key: string, name: string, rating: Rating<string>, kind: "yoga" | "dosha"): RatingEntry {
  const short = name.replace(/ (Yoga|Dosha)$/, "");
  return { key, names: [...new Set([name, short, ...(EXTRA_NAMES[name] ?? [])])], rating: ratingPhrase(rating, kind) };
}

const g = (apiName: string) => {
  const e = GRAHAS[apiName];
  return e ? `${e.en} (${e.meaning})` : apiName;
};

function placementsOf(chart: Chart): ValidationContext["placements"] {
  return chart.grahas.flatMap((x) => [
    { graha: x.name, rashi: rashi(x.sign_num), bhava: x.house, chart: "d1" as const },
    { graha: x.name, rashi: rashi(x.navamsha.sign_num), chart: "d9" as const },
    { graha: x.name, rashi: rashi(x.dashamsha?.sign_num ?? dasamsaSign(x.sign_num, x.deg_in_sign)), chart: "d10" as const },
  ]);
}

const DATE_RE = /\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g;
/** All "D Mon YYYY" dates appearing anywhere in a FACTS object. */
export const datesIn = (facts: unknown) => [...new Set(JSON.stringify(facts).match(DATE_RE) ?? [])];

const windowFact = (w: Window) => ({
  period: w.ad ? `${graha(w.md)} Mahadasha – ${graha(w.ad)} Antardasha` : `${graha(w.md)} Mahadasha`,
  from: dateOnly(w.start),
  to: dateOnly(w.end),
  running_now: w.current,
});

function doshaFact(c: DoshaCard) {
  return {
    dosha: c.name,
    status: c.statusLabel,
    ...(c.rating.level ? { rating: ratingPhrase(c.rating, "dosha"), rating_reasons: compoundOnly(c.rating.reasons) } : {}),
    details: c.details,
    traditionally_felt_in: c.windows.map(windowFact),
    dates: c.ranges.map((r) => ({
      phase: r.label,
      from: dateOnly(r.start),
      to: dateOnly(r.end),
      running_now: r.current,
      ...(r.startsBefore ? { started_before_from: true } : {}),
      ...(r.continuesBeyond ? { continues_beyond_to: true } : {}),
      ...(r.earlyEntries?.length ? { brief_earlier_entries: r.earlyEntries.map((e) => ({ from: dateOnly(e.start), to: dateOnly(e.end) })) } : {}),
      ...(r.dips?.length ? { saturn_briefly_elsewhere: r.dips.map((d) => ({ in: rashi(d.sign), direction: d.direction, from: dateOnly(d.start), to: dateOnly(d.end) })) } : {}),
    })),
  };
}

/** Replaces every occurrence of one date string (the birth date) with "birth". */
function scrubDate<T>(value: T, date: string): T {
  if (typeof value === "string") return (value === date ? "birth" : value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDate(v, date)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDate(v, date)])) as T;
  }
  return value;
}

/** D9 dignity judged on its own: supportive / neutral / weakening, and whether it improves a neutral-or-worse D1. */
function d9Fact(d1: Dignity, d9: Dignity) {
  const r = vargaReading(d1, d9);
  return { navamsa_role: r.role, ...(r.improved ? { navamsa_improves_d1: true } : {}) };
}

/** Rating reasons for the AI: "D1 Tula: neutral (compound friend)" → "D1 Tula: friend" (one dignity per planet, rule D1). */
const compoundOnly = (reasons: string[]) =>
  reasons.map((r) => r.replace(/\b(?:friend|neutral|enemy)\s+\(compound (great friend|great enemy|friend|neutral|enemy)\)/g, "$1"));

/** Lagna-dependent claims made tentative by a sensitive birth time: houses in that chart, its 7th / 10th and their lords. */
function tentativeClaims(bt: BirthTimeCheck, mf: MarriageFactors, d10: CareerD10 | null): string[] {
  const out: string[] = [];
  if (bt.sensitive.d1) out.push("D1 Lagna and D1 house positions");
  const d9Lord = lagnaLordCheck(bt, "d9", mf.d9.lagnaSign, 7);
  if (d9Lord)
    out.push(`D9 Lagna (${rashi(mf.d9.lagnaSign)}), D9 house positions, the D9 7th house (${rashi(mf.d9.seventhSign)})${d9Lord.firm ? "" : ` and its lord ${g(mf.d9.seventhLord)} as D9 7th lord`}`);
  const d10Lord = d10 ? lagnaLordCheck(bt, "d10", d10.lagnaSign, 10) : null;
  if (d10 && d10Lord)
    out.push(`D10 Lagna (${rashi(d10.lagnaSign)}), D10 house positions, the D10 10th house (${rashi(d10.tenthSign)})${d10Lord.firm ? "" : ` and its lord ${g(d10.tenthLord)} as D10 10th lord`}`);
  for (const k of ["d9", "d10"] as const) if (bt.uninterpretable[k]) out.push(`${k.toUpperCase()}: not interpreted (its Lagna changes within 2 minutes)`);
  for (const k of ["d1", "d9", "d10"] as const) for (const p of bt.planetsSensitive[k]) out.push(`${g(p)}'s own ${k.toUpperCase()} sign and dignity there`);
  return out;
}

/**
 * What stays firm despite a sensitive Lagna: each planet's own varga sign, its
 * dignity there and Vargottama, and a 7th / 10th lord that is the same planet
 * under the neighbouring Lagna(s).
 */
function firmClaims(bt: BirthTimeCheck, mf: MarriageFactors, d10: CareerD10 | null): string {
  const moving = (["d1", "d9", "d10"] as const).flatMap((k) => bt.planetsSensitive[k].map((p) => `${g(p)}'s ${k.toUpperCase()} sign`));
  const lords: [LordCheck | null, string][] = [
    [lagnaLordCheck(bt, "d9", mf.d9.lagnaSign, 7), "D9 7th lord"],
    [d10 ? lagnaLordCheck(bt, "d10", d10.lagnaSign, 10) : null, "D10 10th lord"],
  ];
  const firmLords = lords.flatMap(([c, what]) =>
    c?.firm && c.neighbours.length
      ? [` The ${what} (${g(c.lord)}) is firm too: ${g(c.lord)} also rules that house under the neighbouring Lagna (${c.neighbours.map((n) => rashi(n.lagna)).join(", ")}).`]
      : [],
  );
  return `Planets' own D9 / D10 signs, their dignities there and Vargottama are firm${moving.length ? `, except ${moving.join(", ")}` : ""}.${firmLords.join("")}`;
}

type KundliExtras = { manglik: Manglik | null; kaalSarp: KaalSarp | null; birthDate?: string };

/**
 * Facts for the full Kundli reading (cached by facts hash) and, with
 * `followup`, for follow-up questions (not cached). The Sade Sati / Dhaiya
 * cards and timing candidates are follow-up only; the reading gets the Saturn
 * transit overlaps with its Dasha periods (so a yearly transit refresh does
 * regenerate it once).
 */
export function kundliFacts(chart: Chart, dasha: DashaCurrent, extras: KundliExtras, followup = false) {
  const asOf = dasha.as_of; // stable until the Dasha refreshes, keeps the hash stable
  const { timeline } = chart.vimshottari;
  const now = new Date(asOf).getTime();
  const mdIndex = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const { present, absent } = yogaChecklist(chart, asOf);
  const adTable = timeline.slice(mdIndex, mdIndex + 3).flatMap((md) => antardashas(md, timeline));
  const strengths = chartStrengths(chart);
  const fn = functionalNature(chart.lagna.sign_num);
  const mf = marriageFactors(chart);
  const d10 = careerD10(chart);
  const bt = birthTimeCheck(chart, rashi);
  const tr = transitOverlaps(chart, asOf);
  const jupiterNext = tr.jupiter.find((j) => new Date(j.from).getTime() > now);
  const sig = marriageSignificators(chart);
  const { windows, total: windowsTotal, brief } = marriageTiming(chart, asOf);
  const windowsRanked = new Set(windows.map((w) => w.rank)).size > 1;
  const lordFact = (r: DashaLordReading) => ({
    lord: g(r.lord),
    reading: r.summary,
    strength: r.strength.level,
    role: r.role,
    ...(r.node ? { dispositor: g(r.node.dispositor), conjunct: r.node.conjunct.map(graha), with_yogakaraka_in_kendra: r.node.withYogakarakaInKendra } : {}),
  });

  const doshaCards = followup
    ? buildDoshas({ chart, manglik: extras.manglik, kaalSarp: extras.kaalSarp, asOf })
    : [manglikCard(chart, asOf), kaalSarpCard(extras.kaalSarp, chart, asOf), kemadrumaCard(chart, asOf)];

  const raw = {
    lagna: {
      rashi: rashi(chart.lagna.sign_num),
      degree_in_rashi: Number(chart.lagna.deg_in_sign.toFixed(1)),
      nakshatra: nakshatra(chart.lagna.nakshatra_num),
      pada: chart.lagna.pada,
      lagna_lord: g(chart.lagna.lord),
    },
    navamsa_lagna: rashi(chart.navamsha_lagna.sign_num),
    grahas: chart.grahas.map((x) => {
      const s = strengths.get(x.name)!;
      return {
        graha: g(x.name),
        rashi: rashi(x.sign_num),
        bhava: x.house,
        nakshatra: nakshatra(x.nakshatra_num),
        pada: x.pada,
        retrograde: x.retrograde,
        combust: x.combust,
        // One dignity (the compound relation); the natural relation is named separately.
        dignity: s.dignity ? dignityFact(s.dignity) : "node",
        ...(s.dignity?.natural ? { natural_relation_to_sign_lord: s.dignity.natural } : {}),
        navamsa_rashi: rashi(x.navamsha.sign_num),
        ...(s.d9Dignity ? { navamsa_dignity: dignityFact(s.d9Dignity) } : {}),
        vargottama: x.vargottama,
        ...(x.avastha ? { avastha: `${x.avastha} (minor factor)` } : {}),
        strength: s.level,
        ...(s.borderline ? { strength_borderline: "close to a level threshold; a small change in one factor would change the level" } : {}),
        // Every factor of the composite strength, so the reading never names one that is not here.
        strength_factors: [...s.factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map((f) => f.fact ?? f.label),
        ...(s.dignity && s.d9Dignity ? d9Fact(s.dignity, s.d9Dignity) : {}),
        ...(s.shadbala.uccha !== null
          ? { partial_shadbala_virupas: { uccha: Math.round(s.shadbala.uccha), dig: Math.round(s.shadbala.dig!), ...(s.shadbala.paksha !== null ? { paksha: Math.round(s.shadbala.paksha) } : {}) } }
          : {}),
      };
    }),
    bhava_lords: Object.fromEntries(Object.entries(chart.functional.house_lords).map(([h, l]) => [h, graha(l)])),
    functional_nature: {
      yogakarakas: fn.yogakarakas.map(graha),
      functional_benefics: fn.benefics.map(graha),
      functional_malefics: fn.malefics.map(graha),
      marakas: fn.marakas.map(graha),
      badhaka: graha(fn.badhaka),
      atmakaraka: g(mf.atmakaraka),
    },
    own_house_lords: ownHouseLords(chart).map((x) => x.text),
    marriage: {
      d1_7th_lord: { graha: g(mf.d1.seventhLord), bhava: mf.d1.lordHouse, strength: mf.d1.lordStrength },
      venus_d1: { dignity: mf.d1.venusDignity, strength: mf.d1.venusStrength },
      d9_lagna: rashi(mf.d9.lagnaSign),
      d9_7th: rashi(mf.d9.seventhSign),
      d9_7th_lord: { graha: g(mf.d9.seventhLord), d9_rashi: rashi(mf.d9.lordD9Sign), d9_dignity: dignityFact(mf.d9.lordD9Dignity), vargottama: mf.d9.lordVargottama },
      venus_d9: { rashi: rashi(mf.d9.venusD9Sign), dignity: dignityFact(mf.d9.venusD9Dignity) },
      darakaraka: { graha: g(mf.darakaraka.planet), scheme: mf.darakaraka.scheme, eight_karaka_scheme: g(mf.darakaraka.eightKaraka) },
      upapada_lagna: { rashi: rashi(mf.upapada.sign), lord: g(mf.upapada.lord) },
      d1_vs_d9: mf.comparison,
      significators: [...sig.primary].map(([p, why]) => ({ graha: g(p), as: why })),
      // The total, and how many are listed below when that is fewer ("the first N of M").
      timing_windows_count: windowsTotal,
      ...(windows.length < windowsTotal ? { timing_windows_listed: windows.length } : {}),
      ...(windowsLordsNote(windows) ? { timing_windows_note: windowsLordsNote(windows) } : {}),
      // Windows use the D1 Lagna and the Dashas: tentative only when the D1 Lagna is sensitive.
      timing_windows_tentative: Boolean(bt?.sensitive.d1),
      // Windows differ in rank only by whether both Dasha lords are significators; nothing else ranks them.
      timing_windows_ranked: windowsRanked,
      timing_windows_shorter_than_30_days_left_out: brief.length,
      timing_windows: windows.map((w) => ({
        from: dateOnly(w.start),
        to: dateOnly(w.end),
        dasha: w.period.split("–").map(graha).join("–"),
        ...(windowsRanked ? { rank: w.rank === "MD and AD" ? 1 : 2 } : {}),
        both_lords_significators: w.rank === "MD and AD",
        double_transit: w.why,
        also_from_chandra: w.moonAlso,
        ...(w.secondary.length ? { secondary: w.secondary } : {}),
      })),
    },
    ...(d10
      ? {
          // A D10 whose Lagna changes within 2 minutes is shown on the page but not interpreted.
          career_d10: bt?.uninterpretable.d10
            ? { d10_lagna: rashi(d10.lagnaSign), not_interpreted: true }
            : {
                d10_lagna: rashi(d10.lagnaSign),
                d10_10th: rashi(d10.tenthSign),
                d10_10th_lord: g(d10.tenthLord),
                planets_in_d10: d10.planets.map((p) => ({ graha: g(p.name), d10_rashi: rashi(p.sign), dignity: p.fact })),
                ...(bt?.sensitive.d10 ? { lagna_dependent_claims_tentative: bt.notesBy.d10 } : {}),
              },
        }
      : {}),
    ...(bt
      ? {
          birth_time: {
            minutes_until_d1_lagna_changes: { earlier: Math.floor(bt.d1.earlier), later: Math.floor(bt.d1.later) },
            minutes_until_d9_lagna_changes: { earlier: Math.floor(bt.d9.earlier), later: Math.floor(bt.d9.later) },
            minutes_until_d10_lagna_changes: { earlier: Math.floor(bt.d10.earlier), later: Math.floor(bt.d10.later) },
            warning: bt.warn,
            notes: bt.notes,
            // Only claims that depend on a sensitive chart's Lagna are tentative; planets' own signs are firm.
            tentative: tentativeClaims(bt, mf, d10),
            firm: firmClaims(bt, mf, d10),
          },
        }
      : {}),
    dasha_lords: {
      mahadasha: lordFact(readDashaLord(chart, dasha.mahadasha.lord, present, strengths)),
      antardasha: lordFact(readDashaLord(chart, dasha.antardasha.lord, present, strengths)),
    },
    transits: {
      ...(saturnReturnLines(chart, asOf).length ? { saturn_return: saturnReturnLines(chart, asOf) } : {}),
      saturn_overlaps: tr.overlaps.map((o) => ({ transit: o.transit, from: dateOnly(o.from), to: dateOnly(o.to), overlaps_dasha: `${graha(o.period.split("–")[0])}–${graha(o.period.split("–")[1])}`, dasha_from: dateOnly(o.periodFrom), dasha_to: dateOnly(o.periodTo) })),
      jupiter_now: {
        rashi: rashi(tr.jupiterNow.sign),
        house_from_chandra: tr.jupiterNow.fromMoon,
        house_from_lagna: tr.jupiterNow.fromLagna,
        favourable_from_chandra: JUPITER_GOOD_FROM_MOON.includes(tr.jupiterNow.fromMoon),
      },
      // Only the next sign change: the full Jupiter table is on the page, not in the reading.
      ...(jupiterNext
        ? {
            jupiter_next: {
              rashi: rashi(jupiterNext.sign),
              from: dateOnly(jupiterNext.from),
              to: dateOnly(jupiterNext.to),
              house_from_chandra: jupiterNext.fromMoon,
              house_from_lagna: jupiterNext.fromLagna,
              favourable_from_chandra: jupiterNext.favourable,
            },
          }
        : {}),
    },
    yogas_present: present.map((y) => ({
      yoga: y.name,
      category: y.category,
      status: y.status === "cancelled" ? "present but cancelled (Bhanga)" : "present",
      rating: ratingPhrase(y.rating, "yoga"),
      rating_reasons: compoundOnly(y.rating.reasons),
      combinations: y.combinations.map((c) => c.claim),
      cancellations: y.cancellations,
      traditionally_active_in: y.nabhasa ? "throughout life (Nabhasa yoga)" : y.windows.map(windowFact),
    })),
    yogas_not_present: absent.map((a) => a.name),
    shared_links: sharedLinks(present, chart).map((l) => ({
      yogas: l.yogas,
      ...(l.placement ? { same_placement: `${graha(l.placement.planet)} in ${l.placement.sign}` } : { same_planets: l.planets.map(graha) }),
      note: "these yogas rest on the same support; count it as one",
    })),
    doshas: doshaCards.map(doshaFact),
    dasha: {
      as_of: dateOnly(asOf),
      mahadasha: { lord: g(dasha.mahadasha.lord), ends: dateOnly(dasha.mahadasha.end) },
      antardasha: { lord: g(dasha.antardasha.lord), ends: dateOnly(dasha.antardasha.end) },
      pratyantar_dasha: { lord: g(dasha.pratyantardasha.lord), ends: dateOnly(dasha.pratyantardasha.end) },
      mahadasha_timeline: timeline.map((p) => ({ lord: graha(p.lord), from: dateOnly(p.start), to: dateOnly(p.end) })),
      antardashas: adTable.map((ad) => ({ mahadasha: graha(ad.parent), antardasha: graha(ad.lord), from: dateOnly(ad.start), to: dateOnly(ad.end) })),
    },
    ...(followup ? { timing_candidates: timingCandidates(chart, asOf) } : {}),
  };
  // The first Dasha period starts at the moment of birth; never send that date.
  const facts = scrubDate(raw, dateOnly(timeline[0].start));

  const ctx: ValidationContext = {
    placements: placementsOf(chart),
    transitPlacements: [...new Set((["Saturn", "Jupiter"] as const).flatMap((p) => slowTransits(chart, asOf, p).map((x) => `${p}|${rashi(x.sign)}`)))].map((k) => {
      const [graha, r] = k.split("|");
      return { graha, rashi: r };
    }),
    dasha: {
      mahadashaLords: timeline.map((p) => p.lord),
      antardashaLords: [...new Set(adTable.map((a) => a.lord))],
      pratyantardasha: dasha.pratyantardasha.lord,
    },
    allowedDates: [...datesIn(facts), ...(extras.birthDate ? [dateOnly(extras.birthDate)] : [])],
    ratings: [
      ...present.map((y) => ratingEntry(y.key, y.name, y.rating, "yoga")),
      ...doshaCards.filter((c) => c.rating.level).map((c) => ratingEntry(c.key, c.name, c.rating, "dosha")),
    ],
    digBalaFactor: [...strengths.values()].filter((s) => s.factors.some((f) => f.label.startsWith("dig bala"))).map((s) => s.name),
    dignities: Object.fromEntries(
      [...strengths.values()]
        .filter((s) => s.dignity)
        .map((s) => [s.name, { d1: dignityFact(s.dignity!), d9: dignityFact(s.d9Dignity!), d10: d10Fact(chart, s.name) }]),
    ),
    windows: { count: windowsTotal, listed: windows.length, ranked: windowsRanked },
    ...(bt
      ? {
          birthTimeSensitive: {
            d9: bt.sensitive.d9 && !bt.uninterpretable.d9,
            d10: bt.sensitive.d10 && !bt.uninterpretable.d10,
            planets: [...new Set([...bt.planetsSensitive.d9, ...bt.planetsSensitive.d10])],
            firmLords: {
              d9: Boolean(lagnaLordCheck(bt, "d9", mf.d9.lagnaSign, 7)?.firm),
              d10: Boolean(d10 && lagnaLordCheck(bt, "d10", d10.lagnaSign, 10)?.firm),
            },
          },
        }
      : {}),
    cancelledDoshas: doshaCards.filter((c) => c.status === "cancelled").flatMap((c) => ratingEntry(c.key, c.name, c.rating, "dosha").names),
  };
  return { facts, ctx };
}

function manglikPart(m: Manglik | ManglikResult | null) {
  if (!m) return { status: "not available" };
  const gv = "grahavani" in m ? m.grahavani : null;
  return {
    manglik: m.manglik,
    severity: severity(m.severity),
    ...(m.manglik ? { rating: ratingPhrase(rateManglik(m), "dosha"), rating_reasons: rateManglik(m).reasons } : {}),
    ...(gv
      ? {
          house_set: gv.houseSet,
          mars_from: gv.refs.map((r) => ({ from: r.from, house: r.house, counts: r.north ? "yes (North Indian set)" : r.southOnly ? "South Indian rule only" : "no" })),
          cancellations_tradition_dependent: gv.cancellations.filter((c) => c.weight > 0).map((c) => ({ rule: c.text, applies: c.applies })),
          disputed: gv.cancellations.filter((c) => c.note).map((c) => `${c.text}: ${c.note}`),
          intensity_steps: gv.steps,
        }
      : { from_lagna: m.ascendant_check, from_chandra: m.moon_check, from_shukra: m.venus_check, cancellations: m.cancellations }),
  };
}

export function manglikFacts(m: Manglik, chart: Chart, birthDate?: string) {
  const facts = manglikPart(m);
  return {
    facts,
    ctx: {
      placements: placementsOf(chart).filter((p) => p.chart === "d1"),
      allowedDates: birthDate ? [dateOnly(birthDate)] : [],
      ratings: m.manglik ? [ratingEntry("manglik", "Manglik Dosha", rateManglik(m), "dosha")] : [],
    } satisfies ValidationContext,
  };
}

type MilanPerson = { chart: Chart; manglik: Manglik | null; kaalSarp: KaalSarp | null; birthDate?: string };

export function milanFacts(milan: Milan, groom: MilanPerson, bride: MilanPerson) {
  const moon = (c: Chart) => {
    const m = c.grahas.find((x) => x.name === "Moon")!;
    return { rashi: rashi(m.sign_num), nakshatra: nakshatra(m.nakshatra_num), pada: m.pada };
  };
  const doshaStatus = (p: MilanPerson) => {
    const asOf = p.chart.vimshottari.current.as_of;
    return [kaalSarpCard(p.kaalSarp, p.chart, asOf), kemadrumaCard(p.chart, asOf)].map((c) => ({
      dosha: c.name,
      status: c.statusLabel,
      ...(c.rating.level ? { rating: ratingPhrase(c.rating, "dosha") } : {}),
    }));
  };
  const kootDosha = (k: (typeof milan.koots)[number]) =>
    (k.koot === "Nadi" || k.koot === "Bhakoot") && doshaState(k) !== "none" ? rateKootDosha(k, cancellationLabel(k.cancelled_by)) : null;
  const koots = sortKoots(milan.koots);
  const facts = {
    total: milan.total_36,
    out_of: 36,
    verdict: verdict(milan.verdict).en,
    koots: koots.map((k) => ({
      koot: kootLabel(k.koot),
      meaning: KOOTS.find((x) => x.api === k.koot)?.label.meaning,
      earned: k.earned,
      max: k.max_points,
      passed: k.passed,
      dosha: k.dosha,
      ...(kootDosha(k) ? { dosha_rating: ratingPhrase(kootDosha(k)!, "dosha"), dosha_rating_reasons: kootDosha(k)!.reasons } : {}),
      cancellation: cancellationLabel(k.cancelled_by),
      skipped: k.skipped ? (k.skip_reason ?? true) : false,
      compared: k.compared,
    })),
    groom: { chandra: moon(groom.chart), manglik: manglikPart(groom.manglik), other_doshas: doshaStatus(groom) },
    bride: { chandra: moon(bride.chart), manglik: manglikPart(bride.manglik), other_doshas: doshaStatus(bride) },
  };
  const moonPlacements = (c: Chart) => placementsOf(c).filter((p) => p.graha === "Moon" && p.chart === "d1");
  const ctx: ValidationContext = {
    placements: [...moonPlacements(groom.chart), ...moonPlacements(bride.chart)],
    koots: koots.map((k) => ({ api: k.koot, earned: k.earned, max: k.max_points })),
    total: milan.total_36,
    allowedDates: [groom.birthDate, bride.birthDate].filter(Boolean).map((d) => dateOnly(d!)),
    ratings: [
      ...koots.flatMap((k) => (kootDosha(k) ? [ratingEntry(`${k.koot}Dosha`, `${k.koot} Dosha`, kootDosha(k)!, "dosha")] : [])),
      ...[groom, bride].flatMap((p) => {
        const asOf = p.chart.vimshottari.current.as_of;
        const cards = [kaalSarpCard(p.kaalSarp, p.chart, asOf), kemadrumaCard(p.chart, asOf)];
        return [
          ...(p.manglik?.manglik ? [ratingEntry("manglik", "Manglik Dosha", rateManglik(p.manglik), "dosha")] : []),
          ...cards.filter((c) => c.rating.level).map((c) => ratingEntry(c.key, c.name, c.rating, "dosha")),
        ];
      }),
    ],
  };
  return { facts, ctx };
}
