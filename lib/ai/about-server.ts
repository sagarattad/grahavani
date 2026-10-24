import "server-only";
import { generateText, Output } from "ai";
import { db } from "../db";
import { sha256, stableStringify } from "../ids";
import { chartOf, loadDoshaData } from "../cache";
import { loadMatch, loadProfile } from "../targets";
import { ABOUT_PROMPT_VERSION, AI_MODELS } from "@/config/ai";
import { SYSTEM_PROMPT, TASK_PROMPTS } from "./prompts";
import { aboutSchema } from "./schemas";
import { providerOptions, recordUsage, userPrompt } from "./reading";
import { languageModel } from "./models";
import { aboutFacts, aboutItemsForChart, milanAboutFacts, milanAboutItems, validateAbout, type AboutTexts } from "./about";
import type { Milan } from "../kundlit-schemas";

export type AboutType = "kundli" | "milan";

/**
 * Items, FACTS and cache key for a chart's (by profile slug) or a match's
 * About texts. Dosha data that can't be fetched just means fewer items.
 */
export async function aboutTarget(type: AboutType, slug: string, language = "en") {
  const model = AI_MODELS.about;
  if (type === "kundli") {
    const p = await loadProfile(slug);
    if (!p) return null;
    const data = await loadDoshaData(p.birthChart);
    const items = aboutItemsForChart(data.chart, data);
    const { facts, ctx } = aboutFacts(data.chart, items);
    return finish("about", items, facts, ctx, { birthChartId: p.birthChartId });
  }
  const m = await loadMatch(slug);
  if (!m) return null;
  const items = milanAboutItems(m.milanResult.result as Milan);
  const { facts, ctx } = milanAboutFacts(chartOf(m.boyProfile.birthChart), chartOf(m.girlProfile.birthChart), items);
  return finish("about_milan", items, facts, ctx, { milanResultId: m.milanResultId });

  function finish(
    kind: "about" | "about_milan",
    items: ReturnType<typeof milanAboutItems>,
    facts: unknown,
    ctx: Parameters<typeof validateAbout>[2],
    link: { birthChartId?: string; milanResultId?: string },
  ) {
    const factsHash = sha256(stableStringify(facts));
    const cacheKey = sha256([kind, factsHash, language, ABOUT_PROMPT_VERSION, model].join("|"));
    return { kind, items, facts, ctx, link, factsHash, cacheKey, model, language };
  }
}

type Target = NonNullable<Awaited<ReturnType<typeof aboutTarget>>>;

/** Cached texts (key → text), or null if not generated yet. Never calls OpenAI. */
export async function cachedAboutFor(t: Target): Promise<AboutTexts | null> {
  if (t.items.length === 0) return {};
  const row = await db.aiReading.findUnique({ where: { cacheKey: t.cacheKey } });
  if (!row) return null;
  const out = row.output as { items: { key: string; about: string }[] };
  return Object.fromEntries(out.items.map((i) => [i.key, i.about]));
}

export async function cachedAbout(type: AboutType, slug: string): Promise<AboutTexts | null> {
  const t = await aboutTarget(type, slug);
  return t ? cachedAboutFor(t) : null;
}

/** Generates, checks (one retry) and caches the texts. Returns null if both attempts fail. */
export async function generateAbout(t: Target): Promise<AboutTexts | null> {
  if (t.items.length === 0) return {};
  const keys = t.items.map((i) => i.key);
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output, totalUsage } = await generateText({
        model: languageModel(t.model),
        system: SYSTEM_PROMPT,
        prompt: userPrompt(TASK_PROMPTS[t.kind], t.facts, t.language, feedback),
        output: Output.object({ schema: aboutSchema }),
        ...providerOptions(t.model),
      });
      const cost = await recordUsage(t.model, totalUsage.inputTokens ?? 0, totalUsage.outputTokens ?? 0);
      const problems = validateAbout(output, keys, t.ctx, t.items);
      if (problems.length === 0) {
        await db.aiReading.upsert({
          where: { cacheKey: t.cacheKey },
          create: {
            cacheKey: t.cacheKey,
            kind: t.kind,
            factsHash: t.factsHash,
            language: t.language,
            promptVersion: ABOUT_PROMPT_VERSION,
            model: t.model,
            output,
            inputTokens: totalUsage.inputTokens ?? 0,
            outputTokens: totalUsage.outputTokens ?? 0,
            estCostUsd: cost,
            ...t.link,
          },
          update: {},
        });
        return Object.fromEntries(output.items.map((i) => [i.key, i.about]));
      }
      console.warn("ai_about_validation_failed", problems);
      feedback = `\n\nYour previous answer had problems:\n- ${problems.join("\n- ")}\nFix them and return every key exactly once.`;
    } catch (e) {
      console.error("ai_about_error", (e as Error).message);
    }
  }
  return null;
}
