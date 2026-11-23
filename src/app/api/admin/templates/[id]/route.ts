import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

type P = { params: Promise<{ id: string }> };

export const DELETE = route(async (req: Request, { params }: P) => {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const db = (await getDb());
  if (!(await db.get("SELECT id FROM templates WHERE id = ?", id))) err("NOT_FOUND", "القالب غير موجود");
  if ((await db.get("SELECT id FROM invitation_designs WHERE template_id = ? LIMIT 1", id)))
    err("CONFLICT", "القالب مستخدم في تصاميم دعوات — لا يمكن حذفه");
  (await db.run("DELETE FROM templates WHERE id = ?", id));
  (await writeAudit(db, {
    orgId: "platform", actorId: admin.id, action: "platform.template.delete",
    objectType: "template", objectId: id, ip: clientIp(req),
  }));
  return ok({ ok: true });
});
