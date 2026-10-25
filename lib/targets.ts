import "server-only";
import { db } from "./db";
import { ensureFreshDasha, getOrCreateManglik, loadDoshaData } from "./cache";
import { kundliFacts, manglikFacts, milanFacts } from "./ai/facts";
import type { Milan } from "./kundlit-schemas";
import type { ReadingKind } from "./ai/schemas";

const DAY = 86400_000;

export async function loadProfile(slug: string) {
  const p = await db.profile.findUnique({
    where: { slug },
    include: { birthChart: { include: { manglik: true } } },
  });
  if (p && Date.now() - p.lastViewedAt.getTime() > DAY) {
    await db.profile.update({ where: { id: p.id }, data: { lastViewedAt: new Date() } });
  }
  return p;
}

export async function loadMatch(slug: string) {
  const include = { birthChart: { include: { manglik: true } } } as const;
  const m = await db.match.findUnique({
    where: { slug },
    include: { boyProfile: { include }, girlProfile: { include }, milanResult: true },
  });
  if (m && Date.now() - m.lastViewedAt.getTime() > DAY) {
    await db.match.update({ where: { id: m.id }, data: { lastViewedAt: new Date() } });
  }
  return m;
}

/**
 * FACTS + validation context for a reading (`followup = false`, cached by
 * facts hash) or a follow-up question (`followup = true`, adds transit dates
 * and timing candidates). Dosha data that can't be fetched becomes "not
 * available" rather than failing.
 */
export async function factsFor(kind: ReadingKind, slug: string, followup = false) {
  if (kind === "milan") {
    const m = await loadMatch(slug);
    if (!m) return null;
    const [groom, bride] = await Promise.all([loadDoshaData(m.boyProfile.birthChart), loadDoshaData(m.girlProfile.birthChart)]);
    return {
      ...milanFacts(
        m.milanResult.result as Milan,
        { ...groom, birthDate: m.boyProfile.birthDate },
        { ...bride, birthDate: m.girlProfile.birthDate },
      ),
      link: { milanResultId: m.milanResultId },
    };
  }
  const p = await loadProfile(slug);
  if (!p) return null;
  if (kind === "manglik") {
    // The stored Kundlit row only links cached readings; the facts use Grahavani's computed Manglik.
    const [mg, doshas] = await Promise.all([p.birthChart.manglik ?? getOrCreateManglik(p.birthChart), loadDoshaData(p.birthChart)]);
    return { ...manglikFacts(doshas.manglik, doshas.chart, p.birthDate), link: { manglikResultId: mg.id } };
  }
  const [dasha, doshas] = await Promise.all([ensureFreshDasha(p.birthChart), loadDoshaData(p.birthChart)]);
  return {
    ...kundliFacts(doshas.chart, dasha, { manglik: doshas.manglik, kaalSarp: doshas.kaalSarp, birthDate: p.birthDate }, followup),
    link: { birthChartId: p.birthChartId },
  };
}
