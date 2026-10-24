import { connection } from "next/server";
import { db } from "@/lib/db";

// Backup keep-alive target (pinged weekly by GitHub Actions).
export async function GET() {
  await connection();
  await db.$queryRaw`SELECT 1`;
  return Response.json({ ok: true });
}
