// Zod schemas for the parts of Kundlit responses we use. Zod drops every key
// not listed here, which is how bulky fields (yoga citations, transits, ...)
// are stripped before anything is stored.
import { z } from "zod";

const signNum = z.number().int().min(1).max(12);

export const attributionSchema = z.object({
  source: z.string(),
  tool: z.string(),
  url: z.string(),
  citation: z.string(),
});

const position = z.object({
  sign: z.string(),
  sign_num: signNum,
  deg_in_sign: z.number(),
  longitude: z.number(),
  nakshatra: z.string(),
  nakshatra_num: z.number().int().min(1).max(27),
  pada: z.number().int().min(1).max(4),
});

const lagnaSchema = position.extend({
  lord: z.string(),
  lagna_confidence_minutes: z.number().nullish(),
});

const grahaSchema = position.extend({
  name: z.string(),
  house: z.number().int().min(1).max(12),
  retrograde: z.boolean(),
  combust: z.boolean(),
  dignity: z.string(),
  // Baladi avastha (Bala, Kumara, Yuva, Vriddha, Mrita). Missing on charts
  // cached before Oct 2026; lib/cache.ts refreshes them. Kundlit's
  // strength_score / strength_components are deliberately NOT parsed (they
  // don't track Shadbala; see PLAN.md), so Zod strips them.
  avastha: z.string().nullish(),
  navamsha: z.object({ sign: z.string(), sign_num: signNum, lord: z.string() }),
  vargottama: z.boolean(),
});

const bhavaSchema = z.object({
  num: z.number().int().min(1).max(12),
  sign: z.string(),
  sign_num: signNum,
  lord: z.string(),
  occupants: z.array(z.string()),
});

const period = z.object({ lord: z.string(), start: z.string(), end: z.string() });

export const dashaCurrentSchema = z.object({
  as_of: z.string(),
  mahadasha: period,
  antardasha: period,
  pratyantardasha: period,
});

const vimshottariSchema = z.object({
  birth: z.object({
    mahadasha: z.object({
      lord: z.string(),
      balance_years: z.number(),
      balance_ymd: z.array(z.number()),
    }),
    antardasha: z.object({ lord: z.string(), balance_ymd: z.array(z.number()) }),
  }),
  current: dashaCurrentSchema,
  timeline: z.array(period),
});

const yogaSchema = z.object({
  rule_id: z.string().nullish(),
  name: z.string().nullable(),
  category: z.string().nullable(),
  claim: z.string(),
  participants: z.array(z.string()).default([]),
});

// Transit-based timings (Sade Sati, Shani Dhaiya). Kundlit computes them as of
// the call date, 10 years ahead; lib/cache.ts refreshes them yearly.
const range = z.object({ start_dt: z.string(), end_dt: z.string(), sign_num: z.number().nullish() });
const transitSchema = z.object({
  as_of: z.string(),
  sade_sati: z.object({ active: z.boolean(), phase: z.string() }),
  // Kundlit lists only periods that END within `horizon_years` of as_of.
  sade_sati_lifecycle: z.object({
    horizon_years: z.number().nullish(),
    occurrences: z.array(
      z.object({
        rising_start: z.string().nullish(),
        rising_end: z.string().nullish(),
        peak_start: z.string().nullish(),
        peak_end: z.string().nullish(),
        setting_start: z.string().nullish(),
        setting_end: z.string().nullish(),
      }),
    ),
  }),
  dhaiya_lifecycle: z.object({
    horizon_years: z.number().nullish(),
    kantaka_occurrences: z.array(range),
    ardha_ashtama_occurrences: z.array(range),
  }),
});

export const chartSchema = z.object({
  birth_dt: z.string(),
  ayanamsha_deg: z.number(),
  lagna: lagnaSchema,
  grahas: z.array(grahaSchema).length(9),
  bhavas: z.array(bhavaSchema).length(12),
  vimshottari: vimshottariSchema,
  navamsha_lagna: z.object({ sign: z.string(), sign_num: signNum, lord: z.string() }),
  functional: z.object({
    house_lords: z.record(z.string(), z.string()),
    yogakarakas: z.array(z.string()),
    functional_benefics: z.array(z.string()),
    functional_malefics: z.array(z.string()),
  }),
  yogas: z.array(yogaSchema),
  transit: transitSchema.optional(), // missing on charts saved before Oct 2026
});

export const janamKundaliResponse = z.object({
  chart: chartSchema,
  attribution: attributionSchema,
});

// The /dasha endpoint names the timestamp `asOf`; the chart names it `as_of`.
export const dashaResponse = z.object({
  result: z.object({
    current: z
      .object({ asOf: z.string(), mahadasha: period, antardasha: period, pratyantardasha: period })
      .transform(({ asOf, ...rest }) => ({ as_of: asOf, ...rest })),
  }),
  attribution: attributionSchema,
});

export const manglikSchema = z.object({
  manglik: z.boolean(),
  severity: z.string(),
  ascendant_check: z.boolean(),
  moon_check: z.boolean(),
  venus_check: z.boolean(),
  cancellations: z.array(z.string()),
  // Kundlit also sends `remedies`; it is deliberately not listed, so Zod drops
  // it and remedies never reach the UI, PDF or AI.
});

export const kaalSarpSchema = z.object({
  present: z.boolean(),
  type: z.string().nullable(),
  full_or_partial: z.string(),
  affected_houses: z.array(z.number()),
  explanation: z.string(),
});

export const kaalSarpResponse = kaalSarpSchema.extend({ attribution: attributionSchema });

export const manglikResponse = manglikSchema.extend({ attribution: attributionSchema });

const kootSchema = z
  .object({
    koot: z.string(),
    max_points: z.number(),
    earned: z.number(),
    passed: z.boolean(),
    dosha: z.string().nullable(),
    cancelled_by: z.string().nullable(),
    skipped: z.boolean(),
    skip_reason: z.string().nullable(),
    claim: z.object({ claim: z.string() }).nullable(),
  })
  .transform(({ claim, ...k }) => ({ ...k, compared: claim?.claim ?? null }));

export const milanSchema = z.object({
  koots: z.array(kootSchema).length(8),
  total_36: z.number(),
  verdict: z.string(),
});

export const milanResponse = milanSchema.extend({ attribution: attributionSchema });

export type Attribution = z.infer<typeof attributionSchema>;
export type Chart = z.infer<typeof chartSchema>;
export type Graha = Chart["grahas"][number];
export type DashaCurrent = z.infer<typeof dashaCurrentSchema>;
export type Manglik = z.infer<typeof manglikSchema>;
export type KaalSarp = z.infer<typeof kaalSarpSchema>;
export type Transit = z.infer<typeof transitSchema>;
export type Yoga = Chart["yogas"][number];
export type Milan = z.infer<typeof milanSchema>;
export type Koot = Milan["koots"][number];
