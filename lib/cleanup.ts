import "server-only";
import { db } from "./db";

const RETENTION_MONTHS = 12;

/**
 * Removes shared cache rows that no profile or match points to any more.
 * AI readings and Manglik results cascade with their chart / milan row.
 */
export async function deleteOrphans() {
  const milans = await db.milanResult.deleteMany({ where: { matches: { none: {} } } });
  const charts = await db.birthChart.deleteMany({
    where: {
      profiles: { none: {} },
      milansAsBoy: { none: {} },
      milansAsGirl: { none: {} },
    },
  });
  return { milans: milans.count, charts: charts.count };
}

/** Anonymous items nobody has opened for 12 months are deleted. Saved items stay. */
export async function deleteExpired() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const matches = await db.match.deleteMany({ where: { userId: null, lastViewedAt: { lt: cutoff } } });
  const profiles = await db.profile.deleteMany({
    where: {
      userId: null,
      lastViewedAt: { lt: cutoff },
      matchesAsBoy: { none: {} },
      matchesAsGirl: { none: {} },
    },
  });
  const oldWindows = await db.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 2 * 86400_000) } },
  });
  const orphans = await deleteOrphans();
  return { matches: matches.count, profiles: profiles.count, rateLimitRows: oldWindows.count, ...orphans };
}
