import "server-only";
import { openai } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Model ids starting with "gemini" go to Google (key in GOOGLE_API_KEY);
// everything else goes to OpenAI (OPENAI_API_KEY). Both keys stay server-side.
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

export const isGemini = (model: string) => model.startsWith("gemini");

export function languageModel(model: string) {
  return isGemini(model) ? google(model) : openai(model);
}

/** True when the API key for this model's provider is set. */
export const hasKeyFor = (model: string) => Boolean(isGemini(model) ? process.env.GOOGLE_API_KEY : process.env.OPENAI_API_KEY);
