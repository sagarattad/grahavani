// Follow-up questions answered from the computed facts (gpt-6.1-sol). Timing
// windows come from lib/timing.ts; refused topics never reach the model.
import { z } from "zod";
import { db } from "@/lib/db";
import { factsFor } from "@/lib/targets";
import { aiBudgetLeft, answerFollowup } from "@/lib/ai/reading";
import { clientIpHash, jsonError, verifyTurnstile } from "@/lib/request";
import { remainingFollowups } from "@/lib/followups";
import { refusalAnswer, refusalTopic } from "@/lib/ai/refusal";
import { auth } from "@/auth";

export const maxDuration = 60;

const body = z.object({
  kind: z.enum(["kundli", "milan", "manglik"]),
  slug: z.string().min(10).max(40),
  question: z.string().trim().min(3).max(300),
  language: z.enum(["en"]).default("en"),
  turnstileToken: z.string().nullish(),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Please type a question of 3–300 characters.");
  const { kind, slug, question, language, turnstileToken } = parsed.data;

  // Refused topics are answered in code: no OpenAI call, no cost, no cap used.
  const refused = refusalTopic(question);
  if (refused) return Response.json({ answer: { answer: refusalAnswer(refused), out_of_scope: true }, remaining: null });

  if (!process.env.OPENAI_API_KEY) return jsonError(503, "Questions are not set up yet.");
  if (!(await verifyTurnstile(turnstileToken))) return jsonError(403, "Please complete the human check again.");

  const ipHash = await clientIpHash();
  const userId = (await auth())?.user?.id ?? null;
  const left = await remainingFollowups(ipHash, userId, slug);
  if (left <= 0) return jsonError(429, "You have reached today's limit for questions.", { remaining: 0 });
  if (!(await aiBudgetLeft())) return jsonError(503, "Questions are paused for this month.");

  const target = await factsFor(kind, slug, true);
  if (!target) return jsonError(404, "Not found");

  try {
    const answer = await answerFollowup({ facts: target.facts, ctx: target.ctx, question, language });
    if (!answer) return Response.json({ answer: null, remaining: left - 1 });
    await db.followup.create({ data: { kind, targetSlug: slug, question, answer, userId, ipHash } });
    return Response.json({ answer, remaining: left - 1 });
  } catch (e) {
    console.error("followup_error", e);
    return jsonError(503, "Could not answer right now. Please try again later.");
  }
}
