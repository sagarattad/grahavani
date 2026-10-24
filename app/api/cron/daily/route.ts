// Daily Vercel Cron: keeps the free Supabase project awake (any query counts
// as activity) and deletes anonymous items not opened for 12 months.
import { db } from "@/lib/db";
import { deleteExpired } from "@/lib/cleanup";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await db.$queryRaw`SELECT 1`;
  const removed = await deleteExpired();
  const [{ size }] = await db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
  const mb = Number(size) / 1_048_576;
  if (mb > 350) console.warn("db_storage_high", `${mb.toFixed(0)} MB of 500 MB`);
  return Response.json({ ok: true, removed, dbMb: Math.round(mb) });
}
