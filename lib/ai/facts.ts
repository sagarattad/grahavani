// Builds the FACTS sent to OpenAI from cached Kundlit results (plus the
// Antardasha split in lib/dasha.ts and timing candidates in lib/timing.ts).
// Never includes names, places, birth date or birth time.
import { GRAHAS, KOOTS, cancellationLabel, dignity, graha, kootLabel, rashi, nakshatra, severity, verdict } from "../glossary";
import type { Chart, DashaCurrent, KaalSarp, Manglik, Milan } from "../kundlit-schemas";
import { dateOnly } from "../format";
import { antardashas, contains, type Window } from "../dasha";
import { yogaChecklist } from "../yogas";
import { buildDoshas, kaalSarpCard, kemadrumaCard, manglikCard, type DoshaCard } from "../doshas";
import { timingCandidates } from "../timing";
import { doshaState, sortKoots } from "../summaries";
import { rateKootDosha, rateManglik, ratingPhrase, type Rating } from "../strength";

/** What the validator is allowed to see mentioned in the AI text. */
export type ValidationContext = {
  placements: { graha: string; rashi: string; bhava?: number; chart: "d1" | "d9" }[];
  koots?: { api: string; earned: number; max: number }[];
  total?: number;
  dasha?: { mahadashaLords: string[]; antardashaLords: string[]; pratyantardasha: string };
  /** Every "D Mon YYYY" date the text may use (all dates in FACTS, plus birth dates). */
  allowedDates?: string[];
  /** Rated Yogas / Doshas: the names the text may use for each, and its fixed rating phrase. */
  ratings?: RatingEntry[];
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
    ...(c.rating.level ? { rating: ratingPhrase(c.rating, "dosha"), rating_reasons: c.rating.reasons } : {}),
    details: c.details,
    traditionally_felt_in: c.windows.map(windowFact),
    dates: c.ranges.map((r) => ({ phase: r.label, from: dateOnly(r.start), to: dateOnly(r.end), running_now: r.current })),
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

type KundliExtras = { manglik: Manglik | null; kaalSarp: KaalSarp | null; birthDate?: string };

/**
 * Facts for the full Kundli reading (cached by facts hash) and, with
 * `followup`, for follow-up questions (not cached). Transit-based dates
 * (Sade Sati, Dhaiya) and timing candidates are follow-up only, so a yearly
 * transit refresh never changes the reading's hash.
 */
export function kundliFacts(chart: Chart, dasha: DashaCurrent, extras: KundliExtras, followup = false) {
  const asOf = dasha.as_of; // stable until the Dasha refreshes, keeps the hash stable
  const { timeline } = chart.vimshottari;
  const now = new Date(asOf).getTime();
  const mdIndex = Math.max(timeline.findIndex((p) => contains(p, now)), 0);
  const { present, absent } = yogaChecklist(chart, asOf);
  const adTable = timeline.slice(mdIndex, mdIndex + 3).flatMap((md) => antardashas(md, timeline));

  const doshaCards = followup
    ? buildDoshas({ chart, manglik: extras.manglik, kaalSarp: extras.kaalSarp, asOf })
    : [manglikCard(extras.manglik, chart, asOf), kaalSarpCard(extras.kaalSarp, chart, asOf), kemadrumaCard(chart, asOf)];

  const raw = {
    lagna: {
      rashi: rashi(chart.lagna.sign_num),
      degree_in_rashi: Number(chart.lagna.deg_in_sign.toFixed(1)),
      nakshatra: nakshatra(chart.lagna.nakshatra_num),
      pada: chart.lagna.pada,
      lagna_lord: g(chart.lagna.lord),
    },
    navamsa_lagna: rashi(chart.navamsha_lagna.sign_num),
    grahas: chart.grahas.map((x) => ({
      graha: g(x.name),
      rashi: rashi(x.sign_num),
      bhava: x.house,
      nakshatra: nakshatra(x.nakshatra_num),
      pada: x.pada,
      retrograde: x.retrograde,
      combust: x.combust,
      dignity: dignity(x.dignity),
      ...(x.avastha ? { avastha: x.avastha } : {}),
      navamsa_rashi: rashi(x.navamsha.sign_num),
      vargottama: x.vargottama,
    })),
    bhava_lords: Object.fromEntries(Object.entries(chart.functional.house_lords).map(([h, l]) => [h, graha(l)])),
    yogakarakas: chart.functional.yogakarakas.map(graha),
    functional_benefics: chart.functional.functional_benefics.map(graha),
    functional_malefics: chart.functional.functional_malefics.map(graha),
    yogas_present: present.map((y) => ({
      yoga: y.name,
      category: y.category,
      status: y.status === "cancelled" ? "present but cancelled (Bhanga)" : "present",
      rating: ratingPhrase(y.rating, "yoga"),
      rating_reasons: y.rating.reasons,
      combinations: y.combinations.map((c) => c.claim),
      cancellations: y.cancellations,
      traditionally_active_in: y.nabhasa ? "throughout life (Nabhasa yoga)" : y.windows.map(windowFact),
    })),
    yogas_not_present: absent.map((a) => a.name),
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
  };
  return { facts, ctx };
}

function manglikPart(m: Manglik | null) {
  if (!m) return { status: "not available" };
  return {
    manglik: m.manglik,
    severity: m.manglik ? severity(m.severity) : "None",
    ...(m.manglik ? { rating: ratingPhrase(rateManglik(m), "dosha"), rating_reasons: rateManglik(m).reasons } : {}),
    from_lagna: m.ascendant_check,
    from_chandra: m.moon_check,
    from_shukra: m.venus_check,
    cancellations: m.cancellations,
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
