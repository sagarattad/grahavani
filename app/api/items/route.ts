// Delete or save (to "My charts") a chart or match by its share slug.
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteOrphans } from "@/lib/cleanup";
import { canModify } from "@/lib/ownership";
import { jsonError } from "@/lib/request";
import { auth } from "@/auth";

const body = z.object({
  action: z.enum(["delete", "save"]),
  type: z.enum(["profile", "match"]),
  slug: z.string().min(10).max(40),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Bad request");
  const { action, type, slug } = parsed.data;

  const item =
    type === "match"
      ? await db.match.findUnique({ where: { slug } })
      : await db.profile.findUnique({ where: { slug } });
  if (!item) return jsonError(404, "Not found");

  if (action === "save") {
    const userId = (await auth())?.user?.id;
    if (!userId) return jsonError(401, "Please log in to save.");
    if (item.userId && item.userId !== userId) return jsonError(403, "This item belongs to another account.");
    if (type === "match") {
      const m = item as { boyProfileId: string; girlProfileId: string };
      await db.match.update({ where: { slug }, data: { userId } });
      await db.profile.updateMany({ where: { id: { in: [m.boyProfileId, m.girlProfileId] } }, data: { userId } });
    } else {
      await db.profile.update({ where: { slug }, data: { userId } });
    }
    return Response.json({ ok: true });
  }

  if (!(await canModify(item.userId))) return jsonError(403, "Only the account that saved this can delete it.");
  if (type === "match") {
    const m = item as { id: string; boyProfileId: string; girlProfileId: string };
    await db.match.delete({ where: { id: m.id } });
    await db.profile.deleteMany({ where: { id: { in: [m.boyProfileId, m.girlProfileId] }, createdVia: "milan" } });
  } else {
    await db.profile.delete({ where: { slug } });
  }
  await deleteOrphans();
  return Response.json({ ok: true });
}
