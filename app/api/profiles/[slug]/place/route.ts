// "Wrong place? Edit": stores the corrected place on THIS profile only (the
// shared places cache is never changed) and recalculates.
import { z } from "zod";
import { db } from "@/lib/db";
import { placeInput } from "@/lib/input";
import { getOrCreateChart, getOrCreateManglik, getOrCreateMilan } from "@/lib/cache";
import { canModify } from "@/lib/ownership";
import { clientIpHash, jsonError, verifyTurnstile, withinCap } from "@/lib/request";
import { calculationErrorResponse } from "@/lib/errors";

export const maxDuration = 60;

const body = z.object({ place: placeInput, turnstileToken: z.string().min(1) });

export async function POST(req: Request, ctx: RouteContext<"/api/profiles/[slug]/place">) {
  const { slug } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Please pick a place from the list.");
  const { place, turnstileToken } = parsed.data;

  const profile = await db.profile.findUnique({
    where: { slug },
    include: { matchesAsBoy: true, matchesAsGirl: true },
  });
  if (!profile) return jsonError(404, "Not found");
  if (!(await canModify(profile.userId))) return jsonError(403, "Only the account that saved this can edit it.");
  if (!(await verifyTurnstile(turnstileToken))) return jsonError(403, "Please complete the human check again.");
  if (!(await withinCap(await clientIpHash(), "newChart")))
    return jsonError(429, "Too many changes in the last hour. Please try again later.");

  try {
    const chart = await getOrCreateChart({
      birth_date: profile.birthDate,
      birth_time: profile.birthTime,
      latitude: place.lat,
      longitude: place.lon,
      timezone: place.timezone,
    });
    if (profile.createdVia === "manglik") await getOrCreateManglik(chart); // that page's main content

    await db.profile.update({
      where: { id: profile.id },
      data: {
        placeLabel: place.label,
        placeId: place.id ?? null,
        lat: place.lat,
        lon: place.lon,
        timezone: place.timezone,
        placeEdited: true,
        birthChartId: chart.id,
      },
    });

    // A profile inside a match: recalculate that match's Gun Milan.
    for (const m of [...profile.matchesAsBoy, ...profile.matchesAsGirl]) {
      const full = await db.match.findUnique({
        where: { id: m.id },
        include: { boyProfile: { include: { birthChart: true } }, girlProfile: { include: { birthChart: true } } },
      });
      if (!full) continue;
      const milan = await getOrCreateMilan(full.boyProfile.birthChart, full.girlProfile.birthChart);
      await db.match.update({ where: { id: m.id }, data: { milanResultId: milan.id } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return calculationErrorResponse(e);
  }
}
