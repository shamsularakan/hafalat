import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

/** منح/سحب صلاحية مدير المنصة — لا يمكن سحب صلاحية النفس */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const { is_platform_admin } = await readJson(req);
  const value = is_platform_admin ? 1 : 0;
  if (id === admin.id && value === 0)
    err("FORBIDDEN", "لا يمكن سحب صلاحية مدير المنصة عن نفسك");
  const db = getDb();
  const user = db.get<{ id: string; name: string; email: string }>("SELECT id, name, email FROM users WHERE id = ?", id);
  if (!user) err("NOT_FOUND", "المستخدم غير موجود");
  db.run("UPDATE users SET is_platform_admin = ? WHERE id = ?", value, id);
  writeAudit(db, {
    orgId: "platform", actorId: admin.id,
    action: value ? "platform.admin.grant" : "platform.admin.revoke",
    objectType: "user", objectId: id,
    detail: { email: user.email, name: user.name }, ip: clientIp(req),
  });
  return ok({ ok: true });
});
