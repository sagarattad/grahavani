// "About this Yoga / Dosha" texts. GET returns cached texts only (free);
// POST generates them once per chart or match (one AI call for all items).
import { z } from "zod";
import { aboutTarget, cachedAboutFor, generateAbout } from "@/lib/ai/about-server";
import { aiBudgetLeft } from "@/lib/ai/reading";
import { hasKeyFor } from "@/lib/ai/models";
import { clientIpHash, jsonError, verifyTurnstile, withinCap } from "@/lib/request";

export const maxDuration = 60;

const type = z.enum(["kundli", "milan"]);
const slug = z.string().min(10).max(40);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = z.object({ type, slug }).safeParse({ type: url.searchParams.get("type"), slug: url.searchParams.get("slug") });
  if (!parsed.success) return jsonError(400, "Bad request");
  const t = await aboutTarget(parsed.data.type, parsed.data.slug);
  if (!t) return jsonError(404, "Not found");
  const texts = await cachedAboutFor(t);
  return Response.json(texts ? { cached: true, texts } : { cached: false }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const parsed = z
    .object({ type, slug, turnstileToken: z.string().nullish() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Bad request");
  const t = await aboutTarget(parsed.data.type, parsed.data.slug);
  if (!t) return jsonError(404, "Not found");

  const cached = await cachedAboutFor(t);
  if (cached) return Response.json({ texts: cached });

  if (!hasKeyFor(t.model)) return jsonError(503, "Descriptions are not set up yet.");
  if (!(await verifyTurnstile(parsed.data.turnstileToken))) return jsonError(403, "Please try again.");
  if (!(await aiBudgetLeft())) return jsonError(503, "Descriptions are paused for this month.");
  if (!(await withinCap(await clientIpHash(), "about")))
    return jsonError(429, "You have opened many new descriptions today. Please try again tomorrow.");

  const texts = await generateAbout(t);
  if (!texts) return jsonError(503, "Couldn't write this right now.");
  return Response.json({ texts });
}
