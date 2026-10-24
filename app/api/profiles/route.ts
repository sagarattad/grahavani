// Creates a Kundli or Manglik profile (one person) and returns its share slug.
import { z } from "zod";
import { db } from "@/lib/db";
import { personInput, toBirth } from "@/lib/input";
import { getOrCreateChart, getOrCreateManglik } from "@/lib/cache";
import { newSlug } from "@/lib/ids";
import { clientIpHash, jsonError, verifyTurnstile, withinCap } from "@/lib/request";
import { calculationErrorResponse } from "@/lib/errors";
import { auth } from "@/auth";

export const maxDuration = 60;

const body = z.object({
  kind: z.enum(["kundli", "manglik"]),
  person: personInput,
  turnstileToken: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Please check the form.", { issues: parsed.error.issues });
  const { kind, person, turnstileToken } = parsed.data;

  if (!(await verifyTurnstile(turnstileToken))) return jsonError(403, "Please complete the human check again.");
  if (!(await withinCap(await clientIpHash(), "newChart")))
    return jsonError(429, "You have created many charts in the last hour. Please try again later.");

  try {
    const chart = await getOrCreateChart(toBirth(person));
    if (kind === "manglik") await getOrCreateManglik(chart);
    const session = await auth();
    const profile = await db.profile.create({
      data: {
        slug: newSlug(),
        userId: session?.user?.id ?? null,
        name: person.name,
        gender: person.gender,
        birthDate: person.birthDate,
        birthTime: person.birthTime,
        placeLabel: person.place.label,
        placeId: person.place.id ?? null,
        lat: person.place.lat,
        lon: person.place.lon,
        timezone: person.place.timezone,
        birthChartId: chart.id,
        createdVia: kind,
      },
    });
    return Response.json({ slug: profile.slug, url: `/${kind}/${profile.slug}` });
  } catch (e) {
    return calculationErrorResponse(e);
  }
}
