import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { writeAudit } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

/** تبديل المفضلة لمستخدم ضمن مؤسسته */
export const POST = route(async (req: Request, { params }: P) => {
  const ctx = await buildCtx(clientIp(req));
  const { id } = await params;
  const db = (await getDb());
  if (!(await db.get("SELECT id FROM templates WHERE id = ?", id))) err("NOT_FOUND", "القالب غير موجود");
  const exists = (await db.get(
    "SELECT 1 FROM template_favorites WHERE user_id = ? AND template_id = ?", ctx.actor.user.id, id
  ));
  if (exists) (await db.run("DELETE FROM template_favorites WHERE user_id = ? AND template_id = ?", ctx.actor.user.id, id));
  else (await db.run(
    "INSERT INTO template_favorites (organization_id, user_id, template_id) VALUES (?,?,?)",
    ctx.actor.orgId, ctx.actor.user.id, id
  ));
  (await writeAudit(db, {
    orgId: ctx.actor.orgId, eventId: null, actorId: ctx.actor.user.id,
    action: "template.favorite", objectType: "template", objectId: id,
    detail: { favorite: !exists }, ip: ctx.ip,
  }));
  return ok({ favorite: !exists });
});
