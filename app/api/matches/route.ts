// Creates a Gun Milan match (Groom + Bride) and returns its share slug.
// (Stored as boy/girl columns; shown as Groom/Bride.)
// Only the essential calls: two charts and the Milan (cached people cost 0).
// Manglik / Kaal Sarp load lazily on the result page.
import { z } from "zod";
import { db } from "@/lib/db";
import { personInput, toBirth, type PersonInput } from "@/lib/input";
import { getOrCreateChart, getOrCreateMilan } from "@/lib/cache";
import { newSlug } from "@/lib/ids";
import { clientIpHash, jsonError, verifyTurnstile, withinCap } from "@/lib/request";
import { calculationErrorResponse } from "@/lib/errors";
import { auth } from "@/auth";

export const maxDuration = 60;

const body = z.object({
  boy: personInput.extend({ gender: z.literal("male") }),
  girl: personInput.extend({ gender: z.literal("female") }),
  turnstileToken: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Please check the form.", { issues: parsed.error.issues });
  const { boy, girl, turnstileToken } = parsed.data;

  if (!(await verifyTurnstile(turnstileToken))) return jsonError(403, "Please complete the human check again.");
  if (!(await withinCap(await clientIpHash(), "newMatch")))
    return jsonError(429, "You have created many matches in the last hour. Please try again later.");

  try {
    const boyChart = await getOrCreateChart(toBirth(boy));
    const girlChart = await getOrCreateChart(toBirth(girl));
    const milan = await getOrCreateMilan(boyChart, girlChart);

    const userId = (await auth())?.user?.id ?? null;
    const profileData = (p: PersonInput, chartId: string) => ({
      slug: newSlug(),
      userId,
      name: p.name,
      gender: p.gender,
      birthDate: p.birthDate,
      birthTime: p.birthTime,
      placeLabel: p.place.label,
      placeId: p.place.id ?? null,
      lat: p.place.lat,
      lon: p.place.lon,
      timezone: p.place.timezone,
      birthChartId: chartId,
      createdVia: "milan",
    });
    const match = await db.$transaction(async (tx) => {
      const b = await tx.profile.create({ data: profileData(boy, boyChart.id) });
      const g = await tx.profile.create({ data: profileData(girl, girlChart.id) });
      return tx.match.create({
        data: { slug: newSlug(), userId, boyProfileId: b.id, girlProfileId: g.id, milanResultId: milan.id },
      });
    });
    return Response.json({ slug: match.slug, url: `/milan/${match.slug}` });
  } catch (e) {
    return calculationErrorResponse(e);
  }
}
