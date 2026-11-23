import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireOrgRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { err } from "@/lib/errors";

export const GET = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const org = ctx.db.get("SELECT * FROM organizations WHERE id = ?", ctx.actor.orgId);
  const members = ctx.db.all(
    `SELECT u.id, u.name, u.email, u.phone, m.role, m.created_at
     FROM organization_members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ?`,
    ctx.actor.orgId
  );
  return ok({ org, members, my_role: ctx.actor.orgRole });
});

export const PATCH = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  requireOrgRole(ctx, ["owner", "admin"]);
  const body = await readJson(req);
  const name = body.name?.trim();
  if (body.name !== undefined && !name) err("VALIDATION", "اسم مساحة العمل مطلوب");
  const retention = body.retention_days;
  if (retention !== undefined && (!Number.isInteger(retention) || retention < 30 || retention > 3650))
    err("VALIDATION", "مدة الاحتفاظ بين 30 و3650 يومًا");
  ctx.db.run(
    `UPDATE organizations SET name = COALESCE(?, name), contact_email = COALESCE(?, contact_email),
     contact_phone = COALESCE(?, contact_phone), retention_days = COALESCE(?, retention_days) WHERE id = ?`,
    name ?? null, body.contact_email ?? null, body.contact_phone ?? null, retention ?? null, ctx.actor.orgId
  );
  writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, actorId: ctx.actor.user.id,
    action: "org.update", objectType: "organization", objectId: ctx.actor.orgId, ip: ctx.ip,
  });
  return ok(ctx.db.get("SELECT * FROM organizations WHERE id = ?", ctx.actor.orgId));
});
