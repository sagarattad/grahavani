import { z } from "zod";

const para = z.string().min(1);

export const kundliReadingSchema = z.object({
  personality: para,
  career: para,
  marriage: para,
  health_wellbeing: para,
  current_dasha: para,
  yogas: para,
  doshas: para,
  summary: para,
  karmic_perspective: para,
});

export const milanReadingSchema = z.object({
  overall: para,
  koots: z
    .array(z.object({ koot: z.string(), earned: z.number(), max: z.number(), explanation: para }))
    .length(8),
  doshas_and_cancellations: para,
  manglik_both: para,
  summary: para,
});

export const manglikReadingSchema = z.object({
  status: para,
  what_triggered: para,
  cancellations: para,
  summary: para,
});

export const aboutSchema = z.object({
  items: z.array(z.object({ key: z.string(), about: para })),
});

export const followupSchema = z.object({
  answer: para,
  out_of_scope: z.boolean(),
});

export const READING_SCHEMAS = {
  kundli: kundliReadingSchema,
  milan: milanReadingSchema,
  manglik: manglikReadingSchema,
} as const;

export type ReadingKind = keyof typeof READING_SCHEMAS;

// Card titles, in display order.
export const READING_CARDS: Record<ReadingKind, { key: string; title: string }[]> = {
  kundli: [
    { key: "personality", title: "Personality" },
    { key: "career", title: "Career" },
    { key: "marriage", title: "Marriage" },
    { key: "health_wellbeing", title: "Health & wellbeing" },
    { key: "current_dasha", title: "Current Dasha" },
    { key: "yogas", title: "Yogas" },
    { key: "doshas", title: "Doshas" },
    { key: "summary", title: "Summary" },
    { key: "karmic_perspective", title: "Karmic perspective (traditional Vedic belief)" },
  ],
  milan: [
    { key: "overall", title: "Overall" },
    { key: "koots", title: "Koot by koot" },
    { key: "doshas_and_cancellations", title: "Doshas & cancellations" },
    { key: "manglik_both", title: "Manglik Dosha for the Groom and the Bride" },
    { key: "summary", title: "Summary" },
  ],
  manglik: [
    { key: "status", title: "Status" },
    { key: "what_triggered", title: "What triggered it" },
    { key: "cancellations", title: "Cancellations" },
    { key: "summary", title: "Summary" },
  ],
};
