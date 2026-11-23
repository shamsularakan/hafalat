import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

export const GET = route(async (req: Request) => {
  await requirePlatformAdmin();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const rows = q
    ? getDb().all(
        `SELECT o.*, u.name owner_name, u.email owner_email,
          (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id) members,
          (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id) events
         FROM organizations o JOIN users u ON u.id = o.owner_id
         WHERE o.name LIKE ? OR u.email LIKE ? ORDER BY o.created_at DESC`,
        `%${q}%`, `%${q}%`
      )
    : getDb().all(
        `SELECT o.*, u.name owner_name, u.email owner_email,
          (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id) members,
          (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id) events
         FROM organizations o JOIN users u ON u.id = o.owner_id ORDER BY o.created_at DESC`
      );
  return ok(rows);
});

/** تغيير باقة مؤسسة (ترقية/هبوط إداري) */
export const PATCH = route(async (req: Request) => {
  const admin = await requirePlatformAdmin();
  const { org_id, plan_id } = await readJson(req);
  const db = getDb();
  if (!db.get("SELECT id FROM organizations WHERE id = ?", org_id)) err("NOT_FOUND", "المؤسسة غير موجودة");
  if (!db.get("SELECT id FROM plans WHERE id = ?", plan_id)) err("VALIDATION", "الباقة غير موجودة");
  db.run("UPDATE organizations SET plan_id = ? WHERE id = ?", plan_id, org_id);
  db.run("UPDATE subscriptions SET plan_id = ? WHERE organization_id = ?", plan_id, org_id);
  writeAudit(db, {
    orgId: "platform", actorId: admin.id, action: "platform.org.plan_change",
    objectType: "organization", objectId: org_id,
    detail: { plan_id }, ip: clientIp(req),
  });
  return ok({ ok: true });
});
