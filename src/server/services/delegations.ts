/**
 * نظام التفويض والحصص (القسم 06) — كل العمليات الحساسة داخل معاملات ذرّية.
 * وحدة الحصة (بطاقة/شخص) تُقفل لكل مناسبة بعد أول إصدار.
 * الإلغاء يعيد الحصة أو يبقيها مستهلكة وفق السياسة المحفوظة (AC-03).
 */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx, DelegationPermissions } from "@/lib/types";
import { DEFAULT_DELEGATE_PERMISSIONS } from "@/lib/types";
import {
  assertDelegationUsable, delegationPerms, loadEventScoped, requireEventAccess,
  type DelegationRow,
} from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertPlanDelegateLimit } from "@/lib/plans";
import { normalizePhone } from "@/lib/auth";
import { unallocatedPool } from "./events";

export interface DelegationInput {
  invitee_name: string;
  invitee_phone?: string;
  invitee_email?: string;
  user_id?: string; // ربط بمستخدم موجود (اختياري)
  role?: "delegate" | "supervisor";
  quota: number;
  permissions?: Partial<DelegationPermissions>;
  expires_at?: string | null;
}

export function createDelegation(ctx: Ctx, eventId: string, input: DelegationInput) {
  const { event, role } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor"]);
  if (role === "supervisor") {
    // المشرف ينشئ فرقًا فرعية من حصته فقط عند السماح الصريح
    const own = ctx.db.get<DelegationRow>(
      "SELECT * FROM delegations WHERE event_id = ? AND user_id = ? AND role = 'supervisor' AND status = 'active'",
      eventId, ctx.actor.user.id
    );
    if (!own || !delegationPerms(own).can_delegate_sub)
      err("FORBIDDEN", "إنشاء المفوّضين يتطلب إذنًا صريحًا");
  }
  if (!input.invitee_name?.trim()) err("VALIDATION", "اسم المفوّض مطلوب");
  if (!Number.isInteger(input.quota) || input.quota < 0)
    err("VALIDATION", "الحصة عدد صحيح غير سالب");
  assertPlanDelegateLimit(ctx.db, ctx.actor.orgId, eventId);

  return ctx.db.tx(() => {
    let parentDelegation: DelegationRow | null = null;
    if (role === "supervisor") {
      // المفوّض الفرعي يأخذ من حصة المفوّض الأعلى ولا يخلق حصة إضافية (القسم 06)
      parentDelegation = ctx.db.get<DelegationRow>(
        "SELECT * FROM delegations WHERE event_id = ? AND user_id = ? AND role = 'supervisor' AND status = 'active'",
        eventId, ctx.actor.user.id
      )!;
      const ownRemaining = parentDelegation.quota_allocated - parentDelegation.quota_used;
      if (input.quota > ownRemaining)
        err("QUOTA_EXCEEDED", `حصتك المتبقية لا تكفي (${ownRemaining})`);
    } else {
      const pool = unallocatedPool(ctx.db, eventId);
      if (input.quota > pool)
        err("QUOTA_EXCEEDED", `الحصة المطلوبة أكبر من غير الموزع (${pool})`);
    }
    const phone = input.invitee_phone ? normalizePhone(input.invitee_phone) : null;
    if (input.invitee_phone && !phone) err("VALIDATION", "رقم هاتف المفوّض غير صالح");
    // ربط تلقائي بمستخدم موجود بنفس الهاتف/البريد
    let linkedUserId = input.user_id ?? null;
    if (!linkedUserId && (phone || input.invitee_email)) {
      const email = input.invitee_email?.trim().toLowerCase() ?? null;
      const found = ctx.db.get<{ id: string }>(
        "SELECT id FROM users WHERE (? IS NOT NULL AND phone = ?) OR (? IS NOT NULL AND email = ?)",
        phone, phone, email, email
      );
      if (found) linkedUserId = found.id;
    }
    const id = newId();
    const perms = { ...DEFAULT_DELEGATE_PERMISSIONS, ...(input.permissions ?? {}) };
    if (role === "supervisor") {
      perms.can_issue = true; // المفوّض الفرعي يأخذ من حصة الأعلى (مرحلة متقدمة جزئيًا)
    }
    ctx.db.run(
      `INSERT INTO delegations (id, event_id, organization_id, parent_id, user_id, invitee_name, invitee_phone, invitee_email, role,
        quota_allocated, quota_used, permissions, status, expires_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`,
      id, eventId, ctx.actor.orgId,
      parentDelegation?.id ?? null,
      linkedUserId, input.invitee_name.trim(), phone,
      input.invitee_email?.trim().toLowerCase() ?? null,
      input.role ?? "delegate", input.quota, JSON.stringify(perms),
      linkedUserId ? "active" : "pending",
      input.expires_at ?? null, ctx.actor.user.id
    );
    // ربط بعضوية المنظمة والمناسبة
    if (linkedUserId) {
      ctx.db.run(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')
         ON CONFLICT(organization_id, user_id) DO NOTHING`,
        ctx.actor.orgId, linkedUserId
      );
      ctx.db.run(
        `INSERT INTO event_members (id, event_id, organization_id, user_id, role, permissions) VALUES (?,?,?,?,?,?)
         ON CONFLICT(event_id, user_id, role) DO NOTHING`,
        newId(), eventId, ctx.actor.orgId, linkedUserId, input.role ?? "delegate", "{}"
      );
    }
    if (input.quota > 0) {
      ctx.db.run(
        `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, delta, balance_after, reason, actor_id)
         VALUES (?,?,?,?,?,?, 'allocation', ?)`,
        newId(), ctx.actor.orgId, eventId, id, input.quota, input.quota, ctx.actor.user.id
      );
    }
    if (parentDelegation && input.quota > 0) {
      // خصم من حصة المشرف الأعلى — لا حصة إضافية تُخلق
      ctx.db.run(
        "UPDATE delegations SET quota_allocated = quota_allocated - ? WHERE id = ?",
        input.quota, parentDelegation.id
      );
      const after = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", parentDelegation.id)!;
      ctx.db.run(
        `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, delta, balance_after, reason, note, actor_id)
         VALUES (?,?,?,?,?,?, 'reallocate_out', 'تفويض فرعي', ?)`,
        newId(), ctx.actor.orgId, eventId, parentDelegation.id, -input.quota,
        after.quota_allocated - after.quota_used, ctx.actor.user.id
      );
    }
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
      action: "delegation.create", objectType: "delegation", objectId: id,
      detail: { name: input.invitee_name, quota: input.quota, role: input.role ?? "delegate" }, ip: ctx.ip,
    });
    return ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", id)!;
  });
}

export function listDelegations(ctx: Ctx, eventId: string) {
  const { role, delegation } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate"]);
  if (role === "delegate") {
    // المفوّض يرى تفويضه فقط
    return delegation ? [withStats(ctx, delegation)] : [];
  }
  const rows = ctx.db.all<DelegationRow>(
    "SELECT * FROM delegations WHERE event_id = ? ORDER BY created_at", eventId
  );
  return rows.map((d) => withStats(ctx, d));
}

function withStats(ctx: Ctx, d: DelegationRow) {
  const stats = ctx.db.get(
    `SELECT
       COUNT(*) total,
       SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) confirmed,
       SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) declined,
       SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) checked_in
     FROM invitations WHERE delegation_id = ? AND status NOT IN ('draft','cancelled','expired')`,
    d.id
  );
  const actualPersons = ctx.db.get<{ n: number }>(
    `SELECT COALESCE(SUM(c.persons),0) n FROM checkins c JOIN invitations i ON i.id = c.invitation_id WHERE i.delegation_id = ?`,
    d.id
  )!.n;
  return {
    ...d,
    permissions_parsed: delegationPerms(d),
    remaining: d.quota_allocated - d.quota_used,
    stats: { ...stats, actual_persons: actualPersons },
  };
}

/** تعديل حصة/صلاحيات/حالة مفوّض — المالك/المدير فقط (المفوّض لا يعدّل حصته) */
export function updateDelegation(
  ctx: Ctx, delegationId: string,
  input: { quota?: number; permissions?: Partial<DelegationPermissions>; expires_at?: string | null; status?: "active" | "suspended" | "revoked"; suspended_policy?: "keep" | "transfer"; note?: string }
) {
  const d = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", delegationId);
  if (!d || d.organization_id !== ctx.actor.orgId) err("NOT_FOUND", "التفويض غير موجود");
  requireEventAccess(ctx, d.event_id, ["owner", "manager"]);

  return ctx.db.tx(() => {
    if (input.quota !== undefined) {
      if (!Number.isInteger(input.quota) || input.quota < 0) err("VALIDATION", "حصة غير صالحة");
      if (input.quota < d.quota_used)
        err("QUOTA_EXCEEDED", `لا يمكن خفض الحصة دون المستخدم (${d.quota_used})`);
      const delta = input.quota - d.quota_allocated;
      if (delta > 0) {
        const pool = unallocatedPool(ctx.db, d.event_id);
        if (delta > pool) err("QUOTA_EXCEEDED", `غير الموزع لا يكفي (${pool})`);
      }
      ctx.db.run("UPDATE delegations SET quota_allocated = ? WHERE id = ?", input.quota, delegationId);
      if (delta !== 0) {
        ctx.db.run(
          `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, delta, balance_after, reason, note, actor_id)
           VALUES (?,?,?,?,?,?, 'adjust', ?, ?)`,
          newId(), ctx.actor.orgId, d.event_id, delegationId, delta,
          input.quota - d.quota_used, input.note ?? null, ctx.actor.user.id
        );
      }
    }
    if (input.permissions) {
      const merged = { ...delegationPerms(d), ...input.permissions };
      ctx.db.run("UPDATE delegations SET permissions = ? WHERE id = ?", JSON.stringify(merged), delegationId);
    }
    if (input.expires_at !== undefined)
      ctx.db.run("UPDATE delegations SET expires_at = ? WHERE id = ?", input.expires_at, delegationId);
    if (input.status) {
      ctx.db.run("UPDATE delegations SET status = ? WHERE id = ?", input.status, delegationId);
      if (input.suspended_policy)
        ctx.db.run("UPDATE delegations SET suspended_policy = ? WHERE id = ?", input.suspended_policy, delegationId);
      if (input.status === "suspended" || input.status === "revoked") {
        // تتوقف الدعوات الجديدة؛ الصادرة تبقى (keep) أو تنتقل إدارتها للمالك (transfer) مع بقاء الإسناد الأصلي
        writeAudit(ctx.db, {
          orgId: ctx.actor.orgId, eventId: d.event_id, actorId: ctx.actor.user.id,
          action: "delegation.suspend", objectType: "delegation", objectId: delegationId,
          detail: { status: input.status, policy: input.suspended_policy ?? d.suspended_policy }, ip: ctx.ip,
        });
      }
    }
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: d.event_id, actorId: ctx.actor.user.id,
      action: "delegation.update", objectType: "delegation", objectId: delegationId,
      detail: { quota: input.quota, status: input.status, note: input.note }, ip: ctx.ip,
    });
    return ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", delegationId)!;
  });
}

/** إعادة تخصيص رصيد غير مستخدم بين مفوّضين — بسبب وشخص منفذ موثق */
export function reallocateQuota(ctx: Ctx, fromId: string, toId: string, amount: number, reason: string) {
  if (!Number.isInteger(amount) || amount <= 0) err("VALIDATION", "كمية غير صالحة");
  if (!reason?.trim()) err("VALIDATION", "سبب إعادة التخصيص مطلوب");
  const from = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", fromId);
  const to = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", toId);
  if (!from || !to || from.organization_id !== ctx.actor.orgId || to.organization_id !== ctx.actor.orgId)
    err("NOT_FOUND");
  if (from.event_id !== to.event_id) err("VALIDATION", "التفويضان ليسا لنفس المناسبة");
  requireEventAccess(ctx, from.event_id, ["owner", "manager", "supervisor"]);

  return ctx.db.tx(() => {
    if (from.quota_allocated - from.quota_used < amount)
      err("QUOTA_EXCEEDED", "الرصيد غير المستخدم لا يكفي");
    if (to.status !== "active" && to.status !== "pending")
      err("CONFLICT", "التفويض المستلم غير نشط");
    ctx.db.run("UPDATE delegations SET quota_allocated = quota_allocated - ? WHERE id = ?", amount, fromId);
    ctx.db.run("UPDATE delegations SET quota_allocated = quota_allocated + ? WHERE id = ?", amount, toId);
    const fromAfter = from.quota_allocated - amount - from.quota_used;
    const toAfter = to.quota_allocated + amount - to.quota_used;
    ctx.db.run(
      `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, delta, balance_after, reason, note, actor_id)
       VALUES (?,?,?,?,?, ?, 'reallocate_out', ?, ?)`,
      newId(), ctx.actor.orgId, from.event_id, fromId, -amount, fromAfter, reason.trim(), ctx.actor.user.id
    );
    ctx.db.run(
      `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, delta, balance_after, reason, note, actor_id)
       VALUES (?,?,?,?,?, ?, 'reallocate_in', ?, ?)`,
      newId(), ctx.actor.orgId, to.event_id, toId, amount, toAfter, reason.trim(), ctx.actor.user.id
    );
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: from.event_id, actorId: ctx.actor.user.id,
      action: "quota.reallocate", objectType: "delegation", objectId: fromId,
      detail: { from: fromId, to: toId, amount, reason: reason.trim() }, ip: ctx.ip,
    });
    return { ok: true };
  });
}

export function getLedger(ctx: Ctx, eventId: string, delegationId?: string) {
  requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate"]);
  if (delegationId) {
    const d = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ? AND event_id = ?", delegationId, eventId);
    if (!d) err("NOT_FOUND");
    return ctx.db.all("SELECT * FROM quota_ledger WHERE delegation_id = ? ORDER BY created_at DESC", delegationId);
  }
  return ctx.db.all("SELECT * FROM quota_ledger WHERE event_id = ? ORDER BY created_at DESC LIMIT 500", eventId);
}

/** قبول تفويض معلق بالهاتف/البريد عند تسجيل المستخدم */
export function claimPendingDelegations(db: any, userId: string, phone: string | null, email: string | null) {
  const rows = db.all(
    `SELECT * FROM delegations WHERE status = 'pending' AND user_id IS NULL AND ((? IS NOT NULL AND invitee_phone = ?) OR (? IS NOT NULL AND invitee_email = ?))`,
    phone, phone, email, email
  );
  for (const d of rows) {
    db.run("UPDATE delegations SET user_id = ?, status = 'active' WHERE id = ?", userId, d.id);
    db.run(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')
       ON CONFLICT(organization_id, user_id) DO NOTHING`,
      d.organization_id, userId
    );
    db.run(
      `INSERT INTO event_members (id, event_id, organization_id, user_id, role, permissions) VALUES (?,?,?,?,?,?)
       ON CONFLICT(event_id, user_id, role) DO NOTHING`,
      newId(), d.event_id, d.organization_id, userId, d.role, "{}"
    );
  }
  return rows.length;
}

export { assertDelegationUsable };
