import "server-only";
import { db } from "./db";

// Fixed-window counters stored in Postgres, so every serverless instance shares them.

function windowStart(windowSeconds: number, now = Date.now()) {
  return new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
}

/**
 * Tries to take one slot in the current window.
 * Returns 0 when a slot was taken, otherwise the seconds until the next window.
 */
export async function takeSlot(bucket: string, limit: number, windowSeconds: number): Promise<number> {
  const now = Date.now();
  const start = windowStart(windowSeconds, now);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (bucket, window_start, count)
    VALUES (${bucket}, ${start}, 1)
    ON CONFLICT (bucket, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    WHERE rate_limits.count < ${limit}
    RETURNING count`;
  if (rows.length > 0) return 0;
  return Math.max(1, Math.ceil((start.getTime() + windowSeconds * 1000 - now) / 1000));
}

/** Per-visitor caps, e.g. new charts per hour. Returns true when allowed. */
export async function allow(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  return (await takeSlot(bucket, limit, windowSeconds)) === 0;
}

/** Seconds we must still wait before calling this endpoint again (0 = free). */
export async function getCooldown(endpoint: string): Promise<number> {
  const row = await db.providerCooldown.findUnique({ where: { endpoint } });
  if (!row) return 0;
  return Math.max(0, Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000));
}

export async function setCooldown(endpoint: string, seconds: number) {
  const blockedUntil = new Date(Date.now() + seconds * 1000);
  await db.providerCooldown.upsert({
    where: { endpoint },
    create: { endpoint, blockedUntil },
    update: { blockedUntil },
  });
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export async function countKundlitCall() {
  const month = currentMonth();
  await db.usageMonthly.upsert({
    where: { month },
    create: { month, kundlitCalls: 1 },
    update: { kundlitCalls: { increment: 1 } },
  });
}
