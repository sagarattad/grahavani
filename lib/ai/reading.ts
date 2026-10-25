import type { SharedV4ProviderOptions } from "@ai-sdk/provider";
import "server-only";
import { streamText, generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "../db";
import { sha256, stableStringify } from "../ids";
import { currentMonth } from "../rateLimit";
import { AI_MODELS, MODEL_SETTINGS, PROMPT_VERSION, estimateCost } from "@/config/ai";
import { SYSTEM_PROMPT, TASK_PROMPTS } from "./prompts";
import { READING_SCHEMAS, followupSchema, type ReadingKind } from "./schemas";
import { STYLE, isStyleProblem, validateReading } from "./validate";
import type { ValidationContext } from "./facts";
import { GRAHAS, KOOTS, RASHIS, TERMS } from "../glossary";
import { isGemini } from "./models";

// Short glossary block so the model uses our spellings.
const GLOSSARY_BLOCK = stableStringify({
  terms: Object.values(TERMS).map((t) => `${t.en} (${t.meaning})`),
  rashis: Object.values(RASHIS).map((r) => r.en),
  grahas: Object.values(GRAHAS).map((g) => `${g.en} (${g.meaning})`),
  koots: KOOTS.map((k) => `${k.label.en} (${k.label.meaning})`),
});

export function providerOptions(model: string): { temperature?: number; providerOptions: SharedV4ProviderOptions } {
  const s = MODEL_SETTINGS[model] ?? {};
  if (isGemini(model)) {
    return {
      temperature: s.temperature,
      providerOptions: { google: { thinkingConfig: { includeThoughts: false, ...(s.thinkingLevel ? { thinkingLevel: s.thinkingLevel } : {}) } } },
    };
  }
  return {
    temperature: s.temperature,
    providerOptions: {
      openai: { store: false, reasoningSummary: null, ...(s.reasoningEffort ? { reasoningEffort: s.reasoningEffort } : {}) },
    },
  };
}

export function userPrompt(task: string, facts: unknown, language: string, extra = "") {
  return `${task}\n\nLANGUAGE: ${language}\n\nGLOSSARY:\n${GLOSSARY_BLOCK}\n\nFACTS:\n${JSON.stringify(facts, null, 1)}${extra}`;
}

export function readingCacheKey(kind: ReadingKind, facts: unknown, language: string) {
  const factsHash = sha256(stableStringify(facts));
  const model = AI_MODELS.fullReading;
  return { factsHash, model, cacheKey: sha256([kind, factsHash, language, PROMPT_VERSION, model].join("|")) };
}

export async function recordUsage(model: string, inputTokens: number, outputTokens: number) {
  const cost = estimateCost(model, inputTokens, outputTokens);
  const month = currentMonth();
  await db.usageMonthly.upsert({
    where: { month },
    create: { month, aiRequests: 1, inputTokens, outputTokens, estCostUsd: cost },
    update: {
      aiRequests: { increment: 1 },
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      estCostUsd: { increment: cost },
    },
  });
  return cost;
}

export async function aiBudgetLeft(): Promise<boolean> {
  const budget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? "0");
  const row = await db.usageMonthly.findUnique({ where: { month: currentMonth() } });
  return (row?.estCostUsd ?? 0) < budget;
}

export type ReadingEvent =
  | { type: "partial"; data: unknown }
  | { type: "retry" }
  | { type: "done"; data: unknown }
  | { type: "failed" };

type Link = { birthChartId?: string; manglikResultId?: string; milanResultId?: string };

/**
 * Streams a reading as NDJSON events. The final output is validated against
 * the facts; on failure we retry once, then give up (the page keeps the data).
 * Only validated readings are cached.
 */
/** Attempts per reading: the first, then rewrites with the validator's feedback (each ~40–60 s; the route allows 300 s). */
const ATTEMPTS = 3;

export function streamReading(opts: {
  kind: ReadingKind;
  facts: unknown;
  ctx: ValidationContext;
  language: string;
  link: Link;
}): ReadableStream<Uint8Array> {
  const { kind, facts, ctx, language, link } = opts;
  const { factsHash, model, cacheKey } = readingCacheKey(kind, facts, language);
  const enc = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // If the browser disconnects, keep going: the reading is still checked and saved,
      // and the panel picks it up from the cache (ReadingPanel's recovery).
      let open = true;
      const send = (e: ReadingEvent) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
        }
      };
      const close = () => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // already closed by a disconnect
        }
      };
      let feedback = "";
      try {
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
          if (attempt > 0) send({ type: "retry" });
          const result = streamText({
            model: openai(model),
            system: SYSTEM_PROMPT,
            prompt: userPrompt(TASK_PROMPTS[kind], facts, language, feedback),
            // The union of three schemas confuses the SDK's types; each is a plain z.object.
            output: Output.object({ schema: READING_SCHEMAS[kind] as typeof READING_SCHEMAS.kundli }),
            ...providerOptions(model),
            onError: ({ error }) => console.error("ai_stream_error", error),
          });
          for await (const partial of result.partialOutputStream) send({ type: "partial", data: partial });

          let output: unknown;
          try {
            output = await result.output;
          } catch (e) {
            console.error("ai_output_invalid", (e as Error).message);
            feedback = "\n\nYour previous answer did not match the JSON schema. Return every field.";
            continue;
          }
          const usage = await result.totalUsage;
          const cost = await recordUsage(model, usage.inputTokens ?? 0, usage.outputTokens ?? 0);

          const problems = validateReading(output, ctx);
          // On the last attempt, wording-only problems do not discard a factually correct reading.
          const last = attempt === ATTEMPTS - 1;
          if (problems.length && last && problems.every(isStyleProblem)) console.warn("ai_style_accepted", kind, problems);
          if (problems.length === 0 || (last && problems.every(isStyleProblem))) {
            await db.aiReading.upsert({
              where: { cacheKey },
              create: {
                cacheKey,
                kind,
                factsHash,
                language,
                promptVersion: PROMPT_VERSION,
                model,
                output: output as object,
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                estCostUsd: cost,
                ...link,
              },
              update: {},
            });
            send({ type: "done", data: output });
            close();
            return;
          }
          console.warn("ai_validation_failed", kind, problems);
          feedback =
            "\n\nYour previous answer contained statements that do not match FACTS:\n- " +
            problems.map((p) => p.replace(STYLE, "")).join("\n- ") +
            "\nRewrite it using only values from FACTS.";
        }
        send({ type: "failed" });
      } catch (e) {
        console.error("ai_reading_error", e);
        send({ type: "failed" });
      }
      close();
    },
  });
}

export async function answerFollowup(opts: { facts: unknown; ctx: ValidationContext; question: string; language: string }) {
  const model = AI_MODELS.followUp;
  const { output, totalUsage } = await generateText({
    model: openai(model),
    system: SYSTEM_PROMPT,
    prompt: userPrompt(TASK_PROMPTS.followup, opts.facts, opts.language, `\n\nQUESTION:\n${opts.question}`),
    output: Output.object({ schema: followupSchema }),
    ...providerOptions(model),
  });
  await recordUsage(model, totalUsage.inputTokens ?? 0, totalUsage.outputTokens ?? 0);
  // A single attempt: wording-only problems are logged, not fatal.
  const problems = validateReading(output, opts.ctx);
  if (problems.length > 0 && !problems.every(isStyleProblem)) {
    console.warn("ai_followup_validation_failed", problems);
    return null;
  }
  if (problems.length) console.warn("ai_style_accepted", "followup", problems);
  return output;
}
