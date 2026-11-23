import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireEventAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { err } from "@/lib/errors";
import { newId } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

/** طاقم المناسبة: مدير/مشرف/استقبال/مصمم — بصلاحيات مستقلة */
export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  requireEventAccess(ctx, id, ["owner", "manager"]);
  return ok(ctx.db.all(
    `SELECT m.id, m.role, m.permissions, u.id user_id, u.name, u.email, u.phone
     FROM event_members m JOIN users u ON u.id = m.user_id WHERE m.event_id = ?`,
    id
  ));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  requireEventAccess(ctx, id, ["owner", "manager"]);
  const body = await readJson(req);
  const role = body.role;
  if (!["manager", "supervisor", "receptionist", "designer"].includes(role))
    err("VALIDATION", "دور غير صالح لطاقم المناسبة");
  const email = body.email ? normalizeEmail(body.email) : null;
  const phone = body.phone ? normalizePhone(body.phone) : null;
  const user = ctx.db.get<{ id: string }>(
    "SELECT id FROM users WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?)",
    email, email, phone, phone
  );
  if (!user) err("NOT_FOUND", "لا يوجد حساب مسجل بهذا البريد/الهاتف");
  const perms = JSON.stringify({ gates: body.gates ?? [] });
  ctx.db.run(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')
     ON CONFLICT(organization_id, user_id) DO NOTHING`,
    ctx.actor.orgId, user.id
  );
  try {
    ctx.db.run(
      "INSERT INTO event_members (id, event_id, organization_id, user_id, role, permissions) VALUES (?,?,?,?,?,?)",
      newId(), id, ctx.actor.orgId, user.id, role, perms
    );
  } catch {
    err("DUPLICATE_ENTRY", "المستخدم مكلف بهذا الدور بالفعل");
  }
  writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId: id, actorId: ctx.actor.user.id,
    action: "event.member_add", objectType: "user", objectId: user.id,
    detail: { role }, ip: ctx.ip,
  });
  return ok({ ok: true }, 201);
});
