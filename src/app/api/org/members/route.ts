import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireOrgRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { err } from "@/lib/errors";
import { normalizeEmail } from "@/lib/auth";
import { getOrgPlan } from "@/lib/plans";

/** إضافة عضو مؤسسة (مستخدم مسجل) بدور مستقل عن أدوار المناسبة */
export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  requireOrgRole(ctx, ["owner", "admin"]);
  const { email, role } = await readJson(req);
  if (!["admin", "member"].includes(role)) err("VALIDATION", "دور غير صالح");
  const plan = getOrgPlan(ctx.db, ctx.actor.orgId);
  if (!plan.multi_seat && role === "admin")
    err("PLAN_LIMIT", "إضافة مشرفين تتطلب باقة الشركات");
  const user = ctx.db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", normalizeEmail(email ?? ""));
  if (!user) err("NOT_FOUND", "لا يوجد حساب بهذا البريد — اطلب منه التسجيل أولًا");
  const existing = ctx.db.get("SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?", ctx.actor.orgId, user.id);
  if (existing) err("DUPLICATE_ENTRY", "المستخدم عضو بالفعل");
  ctx.db.run(
    "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,?)",
    ctx.actor.orgId, user.id, role
  );
  writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, actorId: ctx.actor.user.id,
    action: "org.member_add", objectType: "user", objectId: user.id,
    detail: { role }, ip: ctx.ip,
  });
  return ok({ ok: true }, 201);
});
