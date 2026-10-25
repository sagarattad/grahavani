// "Get reading": returns a cached reading, or streams a new one as NDJSON events.
import { z } from "zod";
import { db } from "@/lib/db";
import { factsFor } from "@/lib/targets";
import { aiBudgetLeft, readingCacheKey, streamReading } from "@/lib/ai/reading";
import { clientIpHash, jsonError, verifyTurnstile, withinCap } from "@/lib/request";

// Two attempts (one retry after a failed check) can take about 90 s each with the v8 facts.
export const maxDuration = 300;

const body = z.object({
  kind: z.enum(["kundli", "milan", "manglik"]),
  slug: z.string().min(10).max(40),
  language: z.enum(["en"]).default("en"),
  turnstileToken: z.string().nullish(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Bad request");
  const { kind, slug, language, turnstileToken } = parsed.data;

  const target = await factsFor(kind, slug);
  if (!target) return jsonError(404, "Not found");

  const { cacheKey } = readingCacheKey(kind, target.facts, language);
  const cached = await db.aiReading.findUnique({ where: { cacheKey } });
  if (cached) return Response.json({ cached: true, output: cached.output });

  if (!process.env.OPENAI_API_KEY) return jsonError(503, "Readings are not set up yet.");
  if (!(await verifyTurnstile(turnstileToken))) return jsonError(403, "Please complete the human check again.");
  if (!(await aiBudgetLeft()))
    return jsonError(503, "Readings are paused for this month. All chart data is still available.", { code: "budget" });
  if (!(await withinCap(await clientIpHash(), "reading")))
    return jsonError(429, "You have reached today's limit for new readings. Please try again tomorrow.");

  const stream = streamReading({ kind, facts: target.facts, ctx: target.ctx, language, link: target.link });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
