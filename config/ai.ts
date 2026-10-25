// All OpenAI model choices and settings live here.
// GPT-6-family models do not accept `temperature`, so we use low reasoning
// effort instead (see node_modules/@ai-sdk/openai/docs/03-openai.mdx).

export const AI_MODELS = {
  fullReading: "gpt-6.1-sol",
  followUp: "gpt-6.1-sol", // timing questions need stronger reasoning (~$0.01–0.02 each)
  about: "gpt-5.4-mini", // "About this Yoga/Dosha" texts, once per chart (~$0.01); clearer than gpt-6-luna in a side-by-side test
} as const;

export const MODEL_SETTINGS: Record<
  string,
  { temperature?: number; reasoningEffort?: "low" | "minimal" | "none"; thinkingLevel?: "minimal" | "low" | "medium" | "high" }
> = {
  "gpt-6.1-sol": { reasoningEffort: "low" },
  "gpt-6-luna": { reasoningEffort: "low" },
  "gpt-5.4-mini": { reasoningEffort: "low" },
  "gemini-3.8-flash": { thinkingLevel: "low" }, // not in use; Gemini 3+: thinkingLevel, not thinkingBudget
};

// USD per 1M tokens. Third-party listings, Oct 2026 — confirm on
// https://developers.openai.com/api/docs/pricing before launch.
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-6.1-sol": { input: 2.0, output: 10.0 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  // Not in use (Google free tier, no charge; slow under load in Oct 2026).
  "gemini-3.8-flash": { input: 0, output: 0 },
};

export const PROMPT_VERSION = "v14"; // v3: ratings in fixed phrases; v4: direct tone; v5: karmic perspective; v6: no positive spin; v7: positivity rules removed; v8: evidence rules, D9 / D10, Dasha lords, transits; v9: shared links, borderline, marriage windows, Jupiter transits, no method wording; v10: one compound dignity, D9 role, window count, borderline once; v11: cancelled doshas, tentative everywhere, Jupiter now and next; v12: tentative scope, shared placements, Sade Sati unrated; v13: window total, "first N of M"; v14: "Low intensity" form, windows note, firm lords
// Separate version for the About texts, so changing them never regenerates readings.
export const ABOUT_PROMPT_VERSION = "a12"; // a3: longer, plain-language texts; a4: ratings; a5: direct tone; a6: rating first, no positive spin; a7: Grahavani dignity, level-average yoga rule; a8: one compound dignity; a9: intensity: Cancelled; a10: Budhaditya, akriti rule, Moon not combust; a11: rating as its own sentence, no chart-note wording; a12: "Low intensity" form

// Per visitor (or signed-in user) across all pages, and per chart / match across all visitors.
export const FOLLOWUP_LIMITS = { perVisitorPerDay: 10, perPagePerDay: 20 };

export function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model] ?? { input: 10, output: 30 }; // unknown model: assume expensive
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
