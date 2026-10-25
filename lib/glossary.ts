// The single source of truth for every Jyotish term and spelling shown in the
// app and sent to the AI. Kundlit returns some names in English ("Sun") or in
// other spellings ("Vasya"); everything is mapped here.
// `hi` labels are left empty until the Hindi launch.

export type Label = { en: string; hi: string; meaning?: string };

export const RASHIS: Record<number, Label> = {
  1: { en: "Mesha", hi: "", meaning: "Aries" },
  2: { en: "Vrishabha", hi: "", meaning: "Taurus" },
  3: { en: "Mithuna", hi: "", meaning: "Gemini" },
  4: { en: "Karka", hi: "", meaning: "Cancer" },
  5: { en: "Simha", hi: "", meaning: "Leo" },
  6: { en: "Kanya", hi: "", meaning: "Virgo" },
  7: { en: "Tula", hi: "", meaning: "Libra" },
  8: { en: "Vrishchika", hi: "", meaning: "Scorpio" },
  9: { en: "Dhanu", hi: "", meaning: "Sagittarius" },
  10: { en: "Makara", hi: "", meaning: "Capricorn" },
  11: { en: "Kumbha", hi: "", meaning: "Aquarius" },
  12: { en: "Meena", hi: "", meaning: "Pisces" },
};

export const NAKSHATRAS: Record<number, Label> = {
  1: { en: "Ashwini", hi: "" },
  2: { en: "Bharani", hi: "" },
  3: { en: "Krittika", hi: "" },
  4: { en: "Rohini", hi: "" },
  5: { en: "Mrigashira", hi: "" },
  6: { en: "Ardra", hi: "" },
  7: { en: "Punarvasu", hi: "" },
  8: { en: "Pushya", hi: "" },
  9: { en: "Ashlesha", hi: "" },
  10: { en: "Magha", hi: "" },
  11: { en: "Purva Phalguni", hi: "" },
  12: { en: "Uttara Phalguni", hi: "" },
  13: { en: "Hasta", hi: "" },
  14: { en: "Chitra", hi: "" },
  15: { en: "Swati", hi: "" },
  16: { en: "Vishakha", hi: "" },
  17: { en: "Anuradha", hi: "" },
  18: { en: "Jyeshtha", hi: "" },
  19: { en: "Mula", hi: "" },
  20: { en: "Purva Ashadha", hi: "" },
  21: { en: "Uttara Ashadha", hi: "" },
  22: { en: "Shravana", hi: "" },
  23: { en: "Dhanishtha", hi: "" },
  24: { en: "Shatabhisha", hi: "" },
  25: { en: "Purva Bhadrapada", hi: "" },
  26: { en: "Uttara Bhadrapada", hi: "" },
  27: { en: "Revati", hi: "" },
};

// Keyed by Kundlit's English graha name.
export const GRAHAS: Record<string, Label & { short: string }> = {
  Sun: { en: "Surya", hi: "", meaning: "Sun", short: "Su" },
  Moon: { en: "Chandra", hi: "", meaning: "Moon", short: "Mo" },
  Mars: { en: "Mangal", hi: "", meaning: "Mars", short: "Ma" },
  Mercury: { en: "Budh", hi: "", meaning: "Mercury", short: "Me" },
  Jupiter: { en: "Guru", hi: "", meaning: "Jupiter", short: "Ju" },
  Venus: { en: "Shukra", hi: "", meaning: "Venus", short: "Ve" },
  Saturn: { en: "Shani", hi: "", meaning: "Saturn", short: "Sa" },
  Rahu: { en: "Rahu", hi: "", meaning: "North Node", short: "Ra" },
  Ketu: { en: "Ketu", hi: "", meaning: "South Node", short: "Ke" },
};

export const GRAHA_ORDER = Object.keys(GRAHAS);

// Standard Ashtakoot order. Keys are Kundlit's koot names.
export const KOOTS: { api: string; label: Label; max: number }[] = [
  { api: "Varna", label: { en: "Varna", hi: "", meaning: "temperament group" }, max: 1 },
  { api: "Vasya", label: { en: "Vashya", hi: "", meaning: "mutual attraction" }, max: 2 },
  { api: "Tara", label: { en: "Tara", hi: "", meaning: "birth-star harmony" }, max: 3 },
  { api: "Yoni", label: { en: "Yoni", hi: "", meaning: "nature and intimacy" }, max: 4 },
  { api: "Graha Maitri", label: { en: "Graha Maitri", hi: "", meaning: "friendship of Moon-sign lords" }, max: 5 },
  { api: "Gana", label: { en: "Gana", hi: "", meaning: "temperament" }, max: 6 },
  { api: "Bhakoot", label: { en: "Bhakoot", hi: "", meaning: "Moon-sign relationship" }, max: 7 },
  { api: "Nadi", label: { en: "Nadi", hi: "", meaning: "constitution" }, max: 8 },
];

export const MILAN_VERDICTS: Record<string, Label & { tone: "good" | "ok" | "low" }> = {
  excellent: { en: "Excellent", hi: "", tone: "good" },
  very_good: { en: "Very good", hi: "", tone: "good" },
  good: { en: "Good", hi: "", tone: "good" },
  acceptable: { en: "Acceptable", hi: "", tone: "ok" },
  below_threshold: { en: "Below the traditional minimum", hi: "", tone: "low" },
};

// Kundlit returns cancellation rule ids such as
// "compat.ashtakoot.nadi.cancellation.same_rasi_different_pada".
export const KOOT_CANCELLATIONS: Record<string, Label> = {
  same_lord: { en: "Both Moon signs have the same lord", hi: "" },
  same_rasi_different_pada: { en: "Same Rashi, different Nakshatra Pada", hi: "" },
  same_rasi_different_nakshatra: { en: "Same Rashi, different Nakshatra", hi: "" },
  same_nakshatra_different_rasi: { en: "Same Nakshatra, different Rashi", hi: "" },
  friendly_lords: { en: "The Moon-sign lords are friends", hi: "" },
};

export const MANGLIK_SEVERITY: Record<string, Label> = {
  none: { en: "None", hi: "" },
  low: { en: "Low", hi: "" },
  cancelled: { en: "Formed but cancelled", hi: "" },
  mild: { en: "Mild", hi: "" },
  medium: { en: "Medium", hi: "" },
  moderate: { en: "Moderate", hi: "" },
  partial: { en: "Partial", hi: "" },
  high: { en: "High", hi: "" },
  severe: { en: "Strong", hi: "" },
};

// The yoga checklist. Kundlit rule ids have appeared in real Kundlit responses
// (see tests/fixtures/kundlit and docs/crosscheck.md); `grahavani: true` ids are
// detected by Grahavani's own rules (lib/astro/rules.ts). Either way a missing
// one can honestly be shown as "Not formed". Order = display order.
export const YOGA_CHECKLIST: { ruleId: string; label: Label; grahavani?: true }[] = [
  { ruleId: "yoga.ruchaka", label: { en: "Ruchaka", hi: "", meaning: "Pancha Mahapurusha of Mangal" } },
  { ruleId: "yoga.bhadra", label: { en: "Bhadra", hi: "", meaning: "Pancha Mahapurusha of Budh" } },
  { ruleId: "yoga.hamsa", label: { en: "Hamsa", hi: "", meaning: "Pancha Mahapurusha of Guru" } },
  { ruleId: "yoga.malavya", label: { en: "Malavya", hi: "", meaning: "Pancha Mahapurusha of Shukra" } },
  { ruleId: "yoga.sasa", label: { en: "Sasa", hi: "", meaning: "Pancha Mahapurusha of Shani" } },
  { ruleId: "yoga.gajakesari", label: { en: "Gajakesari", hi: "", meaning: "Guru in a kendra from Chandra" } },
  { ruleId: "yoga.raja", label: { en: "Raj Yoga", hi: "", meaning: "kendra and trikona lords linked" } },
  { ruleId: "yoga.dhana", label: { en: "Dhana Yoga", hi: "", meaning: "lords of 1, 2, 5, 9, 11 linked by conjunction, mutual aspect or exchange" }, grahavani: true },
  { ruleId: "yoga.neecha_bhanga", label: { en: "Neecha Bhanga", hi: "", meaning: "a debilitated graha's weakness cancelled" }, grahavani: true },
  { ruleId: "yoga.neechabhanga", label: { en: "Neechabhanga Raj Yoga", hi: "", meaning: "a cancelled debility that also gives rise (needs kendra / trikona, not combust)" }, grahavani: true },
  { ruleId: "yoga.harsha", label: { en: "Harsha", hi: "", meaning: "Viparita Raja Yoga: 6th lord in 6, 8 or 12" }, grahavani: true },
  { ruleId: "yoga.sarala", label: { en: "Sarala", hi: "", meaning: "Viparita Raja Yoga: 8th lord in 6, 8 or 12" }, grahavani: true },
  { ruleId: "yoga.vimala", label: { en: "Vimala", hi: "", meaning: "Viparita Raja Yoga: 12th lord in 6, 8 or 12" }, grahavani: true },
  { ruleId: "yoga.adhi", label: { en: "Adhi Yoga", hi: "", meaning: "natural benefics 6th, 7th and 8th from Chandra" }, grahavani: true },
  { ruleId: "yoga.parivartana_maha", label: { en: "Maha Parivartana", hi: "", meaning: "two planets in each other's signs, neither in the 3rd, 6th, 8th or 12th" }, grahavani: true },
  { ruleId: "yoga.parivartana_khala", label: { en: "Khala Parivartana", hi: "", meaning: "a sign exchange involving the 3rd house" }, grahavani: true },
  { ruleId: "yoga.parivartana_dainya", label: { en: "Dainya Parivartana", hi: "", meaning: "a sign exchange involving the 6th, 8th or 12th house" }, grahavani: true },
  { ruleId: "yoga.yogakaraka_kendra", label: { en: "Yogakaraka in a kendra", hi: "", meaning: "the planet ruling both a kendra and a trikona, placed in a kendra" }, grahavani: true },
  { ruleId: "yoga.chandra_mangala", label: { en: "Chandra-Mangala", hi: "", meaning: "Chandra and Mangal together" } },
  { ruleId: "yoga.sunaphaa", label: { en: "Sunapha", hi: "", meaning: "a graha 2nd from Chandra" } },
  { ruleId: "yoga.anaphaa", label: { en: "Anapha", hi: "", meaning: "a graha 12th from Chandra" } },
  { ruleId: "yoga.durdhura", label: { en: "Durudhura", hi: "", meaning: "grahas on both sides of Chandra" } },
  { ruleId: "yoga.budhaditya", label: { en: "Budhaditya", hi: "", meaning: "Surya and Budh together" }, grahavani: true },
  { ruleId: "yoga.vesi", label: { en: "Vesi", hi: "", meaning: "a graha 2nd from Surya" } },
  { ruleId: "yoga.vasi", label: { en: "Vasi", hi: "", meaning: "a graha 12th from Surya" } },
  { ruleId: "yoga.ubhayachari", label: { en: "Ubhayachari", hi: "", meaning: "grahas on both sides of Surya" } },
];

// Yogas Kundlit returns that are treated as doshas (shown only under Doshas).
export const DOSHA_YOGA_IDS = new Set(["yoga.kemadruma"]);

export const YOGA_CATEGORIES: Record<string, string> = {
  mahapurusha: "Pancha Mahapurusha",
  lunar: "Chandra yoga",
  solar: "Surya yoga",
  raja: "Raj yoga",
  dhana: "Dhana yoga",
  cancellation: "Bhanga",
  viparita: "Viparita Raja Yoga",
  neecha_bhanga: "Debility cancelled",
};
export const yogaCategory = (c: string | null | undefined) =>
  !c ? "" : c.startsWith("nabhasa") ? "Nabhasa yoga" : (YOGA_CATEGORIES[c] ?? humanize(c));

export const DOSHAS = {
  manglik: { en: "Manglik Dosha", hi: "", meaning: "Mars affliction" },
  kaalSarp: { en: "Kaal Sarp Dosha", hi: "", meaning: "all grahas between Rahu and Ketu" },
  kemadruma: { en: "Kemadruma Dosha", hi: "", meaning: "Chandra without support" },
  sadeSati: { en: "Sade Sati", hi: "", meaning: "Shani's 7½-year transit over Chandra" },
  dhaiya: { en: "Shani Dhaiya", hi: "", meaning: "Shani's 2½-year transit, 4th or 8th from Chandra" },
} satisfies Record<string, Label>;

export const SADE_SATI_PHASES: Record<string, string> = {
  rising: "Rising (first 2½ years)",
  peak: "Peak (middle 2½ years)",
  setting: "Setting (last 2½ years)",
  not_active: "Not running",
  none: "Not running",
};

export const DIGNITY: Record<string, Label> = {
  exalted: { en: "Uchcha", hi: "", meaning: "exalted" },
  debilitated: { en: "Neecha", hi: "", meaning: "debilitated" },
  own: { en: "Swakshetra", hi: "", meaning: "own sign" },
  moolatrikona: { en: "Moolatrikona", hi: "", meaning: "favoured sign" },
  friend: { en: "Mitra", hi: "", meaning: "friendly sign" },
  enemy: { en: "Shatru", hi: "", meaning: "enemy sign" },
  neutral: { en: "Sama", hi: "", meaning: "neutral sign" },
};

// General terms. `meaning` is shown in brackets on first use, e.g. "Rashi (Moon sign)".
export const TERMS = {
  kundli: { en: "Kundli", hi: "", meaning: "birth chart" },
  lagna: { en: "Lagna", hi: "", meaning: "ascendant" },
  rashi: { en: "Rashi", hi: "", meaning: "Moon sign" },
  sign: { en: "Rashi", hi: "", meaning: "sign" },
  nakshatra: { en: "Nakshatra", hi: "", meaning: "lunar mansion" },
  pada: { en: "Pada", hi: "", meaning: "quarter" },
  graha: { en: "Graha", hi: "", meaning: "planet" },
  bhava: { en: "Bhava", hi: "", meaning: "house" },
  dasha: { en: "Dasha", hi: "", meaning: "planetary period" },
  mahadasha: { en: "Mahadasha", hi: "", meaning: "major period" },
  antardasha: { en: "Antardasha", hi: "", meaning: "sub-period" },
  pratyantardasha: { en: "Pratyantar Dasha", hi: "", meaning: "sub-sub-period" },
  vimshottari: { en: "Vimshottari Dasha", hi: "", meaning: "120-year period system" },
  yoga: { en: "Yoga", hi: "", meaning: "planetary combination" },
  navamsa: { en: "Navamsa", hi: "", meaning: "D9 chart" },
  lagnaChart: { en: "Lagna chart", hi: "", meaning: "D1" },
  gunMilan: { en: "Gun Milan", hi: "", meaning: "compatibility score" },
  kundliMilan: { en: "Kundli Milan", hi: "", meaning: "horoscope matching" },
  ashtakoot: { en: "Ashtakoot", hi: "", meaning: "eight-factor matching" },
  koot: { en: "Koot", hi: "", meaning: "matching factor" },
  manglik: { en: "Manglik Dosha", hi: "", meaning: "Mars affliction" },
  nadiDosha: { en: "Nadi Dosha", hi: "", meaning: "same-constitution affliction" },
  bhakootDosha: { en: "Bhakoot Dosha", hi: "", meaning: "Moon-sign affliction" },
  vakri: { en: "Vakri", hi: "", meaning: "retrograde" },
  asta: { en: "Asta", hi: "", meaning: "combust" },
  vargottama: { en: "Vargottama", hi: "", meaning: "same sign in D1 and D9" },
  groom: { en: "Groom", hi: "", meaning: "Var" },
  bride: { en: "Bride", hi: "", meaning: "Vadhu" },
  dosha: { en: "Dosha", hi: "", meaning: "affliction" },
} satisfies Record<string, Label>;

export type TermId = keyof typeof TERMS;

export function humanize(raw: string): string {
  const s = raw.replace(/[_.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const rashi = (n: number) => RASHIS[n]?.en ?? `Rashi ${n}`;
export const nakshatra = (n: number) => NAKSHATRAS[n]?.en ?? `Nakshatra ${n}`;
export const graha = (apiName: string) => GRAHAS[apiName]?.en ?? apiName;
export const grahaShort = (apiName: string) => GRAHAS[apiName]?.short ?? apiName.slice(0, 2);
export const grahaWithMeaning = (apiName: string) => {
  const g = GRAHAS[apiName];
  return g ? `${g.en} (${g.meaning})` : apiName;
};
export const kootLabel = (api: string) => KOOTS.find((k) => k.api === api)?.label.en ?? api;
export const verdict = (v: string) => MILAN_VERDICTS[v] ?? { en: humanize(v), hi: "", tone: "ok" as const };
export const severity = (s: string) => MANGLIK_SEVERITY[s]?.en ?? humanize(s);
export const dignity = (d: string) => DIGNITY[d]?.en ?? humanize(d);

export function cancellationLabel(ruleId: string | null | undefined): string | null {
  if (!ruleId) return null;
  const tail = ruleId.split(".").pop() ?? ruleId;
  return KOOT_CANCELLATIONS[tail]?.en ?? humanize(tail);
}

// Kundlit names Rashis in their own spelling; map by number when we have it,
// and by name only for free text (e.g. Manglik cancellation strings).
const RASHI_BY_API_NAME: Record<string, string> = Object.fromEntries(
  Object.values(RASHIS).map((r) => [r.en.toLowerCase(), r.en]),
);
export const isKnownRashiName = (s: string) => s.toLowerCase() in RASHI_BY_API_NAME;
