// "Download PDF": builds the PDF on the server from cached results. The AI
// reading is included only if one was already generated for these facts —
// a download never calls OpenAI.
import { db } from "@/lib/db";
import { ensureFreshDasha, loadDoshaData } from "@/lib/cache";
import { buildDoshas } from "@/lib/doshas";
import { factsFor, loadMatch, loadProfile } from "@/lib/targets";
import { readingCacheKey } from "@/lib/ai/reading";
import { cachedAbout } from "@/lib/ai/about-server";
import { clientIpHash, jsonError, withinCap } from "@/lib/request";
import { renderPdf, pdfDisposition, type PdfInput } from "@/lib/pdf/render";
import type { Attribution, Milan } from "@/lib/kundlit-schemas";
import type { Reading } from "@/lib/pdf/layout";
import type { ReadingKind } from "@/lib/ai/schemas";

export const maxDuration = 30;

const KINDS = ["kundli", "manglik", "milan"] as const;

async function cachedReading(kind: ReadingKind, slug: string): Promise<Reading | null> {
  const target = await factsFor(kind, slug);
  if (!target) return null;
  const { cacheKey } = readingCacheKey(kind, target.facts, "en");
  const row = await db.aiReading.findUnique({ where: { cacheKey } });
  return (row?.output as Reading | undefined) ?? null;
}

const personOf = (p: { name: string; birthDate: string; birthTime: string; placeLabel: string }) => ({
  name: p.name,
  birthDate: p.birthDate,
  birthTime: p.birthTime,
  placeLabel: p.placeLabel,
});

async function buildInput(kind: (typeof KINDS)[number], slug: string): Promise<{ input: PdfInput; names: string[] } | null> {
  if (kind === "milan") {
    const m = await loadMatch(slug);
    if (!m) return null;
    const side = async (p: typeof m.boyProfile) => {
      const data = await loadDoshaData(p.birthChart); // failures become "Not available"
      return {
        ...personOf(p),
        chart: data.chart,
        manglik: data.manglik,
        doshas: buildDoshas({ ...data, asOf: data.chart.vimshottari.current.as_of }),
        about: await cachedAbout("kundli", p.slug), // never generates
      };
    };
    const [groom, bride] = await Promise.all([side(m.boyProfile), side(m.girlProfile)]);
    return {
      names: [m.boyProfile.name, m.girlProfile.name],
      input: {
        kind,
        data: {
          groom,
          bride,
          about: await cachedAbout("milan", slug),
          milan: m.milanResult.result as Milan,
          attribution: m.milanResult.attribution as Attribution,
          reading: await cachedReading("milan", slug),
        },
      },
    };
  }
  const p = await loadProfile(slug);
  if (!p) return null;
  if (kind === "manglik") {
    const data = await loadDoshaData(p.birthChart); // Grahavani's computed Manglik
    return {
      names: [p.name],
      input: {
        kind,
        data: {
          person: personOf(p),
          manglik: data.manglik,
          attribution: p.birthChart.attribution as Attribution,
          reading: await cachedReading("manglik", slug),
        },
      },
    };
  }
  const [dasha, doshaData] = await Promise.all([ensureFreshDasha(p.birthChart), loadDoshaData(p.birthChart)]);
  return {
    names: [p.name],
    input: {
      kind,
      data: {
        person: personOf(p),
        chart: doshaData.chart,
        dasha,
        doshas: buildDoshas({ ...doshaData, asOf: dasha.as_of }),
        about: await cachedAbout("kundli", slug),
        attribution: p.birthChart.attribution as Attribution,
        reading: await cachedReading("kundli", slug),
      },
    },
  };
}

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/[kind]/[slug]">) {
  const { kind, slug } = await ctx.params;
  if (!(KINDS as readonly string[]).includes(kind) || slug.length < 10 || slug.length > 40) return jsonError(404, "Not found");
  if (!(await withinCap(await clientIpHash(), "pdf")))
    return jsonError(429, "You have downloaded many PDFs in the last hour. Please try again later.");

  const built = await buildInput(kind as (typeof KINDS)[number], slug);
  if (!built) return jsonError(404, "Not found");

  try {
    const pdf = await renderPdf(built.input);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": pdfDisposition(built.input.kind, built.names),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("pdf_render_failed", e);
    return jsonError(500, "Could not create the PDF. Please try again.");
  }
}
