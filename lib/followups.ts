import "server-only";
import { db } from "./db";
import { FOLLOWUP_LIMITS } from "@/config/ai";

const since = () => new Date(Date.now() - 86400_000);

/** Follow-up questions left today for this visitor on this page. */
export async function remainingFollowups(ipHash: string, userId: string | null, slug: string) {
  const [mine, page] = await Promise.all([
    db.followup.count({ where: { createdAt: { gte: since() }, ...(userId ? { userId } : { ipHash }) } }),
    db.followup.count({ where: { createdAt: { gte: since() }, targetSlug: slug } }),
  ]);
  return Math.max(0, Math.min(FOLLOWUP_LIMITS.perVisitorPerDay - mine, FOLLOWUP_LIMITS.perPagePerDay - page));
}
