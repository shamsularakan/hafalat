/**
 * إصدار الدعوات — ذرّي داخل معاملة BEGIN IMMEDIATE (AC-02 / AC-11).
 * الرمز غير قابل للتخمين ومخزن بصيغة sha256 فقط؛ يعاد اشتقاقه للمشاركة عبر HMAC.
 */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import {
  assertDelegationUsable, delegationPerms, requireEventAccess,
  type DelegationRow,
} from "@/lib/permissions";
import { deriveToken, hashToken, invitationUrl, newNonce } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import { reservedUnits } from "./events";
import { getGuestScoped } from "./guests";

export interface InvitationRow {
  id: string;
  event_id: string;
  organization_id: string;
  guest_id: string;
  delegation_id: string | null;
  token_hash: string;
  token_nonce: string;
  status: string;
  persons_reserved: number;
  companions_allowed: number;
  issued_at: string | null;
  expires_at: string | null;
  seen_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface IssueInput {
  guest_id: string;
  delegation_id?: string | null; // إصدار نيابة عن مفوّض (للمالك/المدير)
  idempotency_key?: string | null;
}

export function issueInvitation(ctx: Ctx, eventId: string, input: IssueInput) {
  const { event, role, delegation: ownDelegation } = requireEventAccess(
    ctx, eventId, ["owner", "manager", "supervisor", "delegate"]
  );
  if (!["published", "ongoing"].includes(event.status))
    err("EVENT_CLOSED", "انشر المناسبة قبل إصدار الدعوات");

  // إعادة نفس المفتاح تعيد نفس النتيجة دون حرق حصة جديد (AC-11)
  const idemKey = input.idempotency_key?.trim() || null;
  if (idemKey) {
    const prior = ctx.db.get<{ result_json: string }>(
      "SELECT result_json FROM idempotency_keys WHERE scope = 'issue_invitation' AND key = ?",
      `${ctx.actor.orgId}:${idemKey}`
    );
    if (prior) return JSON.parse(prior.result_json);
  }

  return ctx.db.tx(() => {
    const guest = getGuestScoped(ctx.db, ctx.actor.orgId, eventId, input.guest_id);

    // تحديد التفويض المُصدر منه
    let delegation: DelegationRow | null = null;
    if (role === "delegate" || role === "supervisor") {
      delegation = ownDelegation;
      assertDelegationUsable(delegation, "can_issue");
      if (guest.inviter_id && guest.inviter_id !== delegation!.id && !delegationPerms(delegation).can_view_all)
        err("FORBIDDEN", "هذا الضيف ليس ضمن ضيوفك");
    } else if (input.delegation_id) {
      delegation = ctx.db.get<DelegationRow>(
        "SELECT * FROM delegations WHERE id = ? AND event_id = ?",
        input.delegation_id, eventId
      ) ?? null;
      if (!delegation) err("NOT_FOUND", "التفويض غير موجود");
      if (delegation.status !== "active") err("FORBIDDEN", "التفويض غير نشط");
      if (delegation.expires_at && delegation.expires_at < nowIso()) err("EXPIRED", "انتهت مدة التفويض");
    }

    // دعوة موجودة مسبقًا؟
    const existing = ctx.db.get<InvitationRow>(
      "SELECT * FROM invitations WHERE event_id = ? AND guest_id = ?", eventId, guest.id
    );
    if (existing && existing.status !== "draft" && existing.status !== "cancelled" && existing.status !== "expired")
      err("CONFLICT", "توجد دعوة فعّالة لهذا الضيف بالفعل");

    const group = guest.group_id
      ? ctx.db.get<{ companion_max: number; is_vip: number; name: string }>(
          "SELECT companion_max, is_vip, name FROM guest_groups WHERE id = ?", guest.group_id
        )
      : null;

    const perms = delegation ? delegationPerms(delegation) : null;
    if (delegation && group?.is_vip && !perms!.allow_vip)
      err("FORBIDDEN", "فئة VIP غير مسموحة ضمن تفويضك");
    if (delegation && perms!.allowed_group_ids && guest.group_id && !perms!.allowed_group_ids.includes(guest.group_id))
      err("FORBIDDEN", "هذه الفئة غير مسموحة ضمن تفويضك");

    const companionsAllowed = group
      ? (delegation && !perms!.allow_companions ? 0 : group.companion_max)
      : 0;
    const reserveUnits = event.quota_unit === "person" ? 1 + companionsAllowed : 1;

    // فحص الحصة الذرّي (AC-02)
    if (delegation) {
      const fresh = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", delegation.id)!;
      if (fresh.quota_used + reserveUnits > fresh.quota_allocated)
        err("QUOTA_EXCEEDED", `حصتك لا تكفي (المتبقي ${fresh.quota_allocated - fresh.quota_used})`);
    }
    // فحص سعة المناسبة
    const reserved = reservedUnits(ctx.db, eventId);
    if (reserved + reserveUnits > event.capacity)
      err("CAPACITY_EXCEEDED", "سعة المناسبة لا تكفي لهذه الدعوة");

    const id = existing?.id ?? newId();
    const nonce = newNonce();
    const rawToken = deriveToken(id, nonce);
    const expiresAt = event.ends_at
      ? new Date(Date.parse(event.ends_at) + 24 * 3600e3).toISOString()
      : event.starts_at
        ? new Date(Date.parse(event.starts_at) + 48 * 3600e3).toISOString()
        : null;

    if (existing) {
      ctx.db.run(
        `UPDATE invitations SET token_hash = ?, token_nonce = ?, status = 'issued', persons_reserved = ?,
         companions_allowed = ?, delegation_id = ?, issued_at = ?, expires_at = ?, cancelled_at = NULL,
         cancel_reason = NULL, idempotency_key = ? WHERE id = ?`,
        hashToken(rawToken), nonce, reserveUnits, companionsAllowed,
        delegation?.id ?? null, nowIso(), expiresAt, idemKey, id
      );
    } else {
      ctx.db.run(
        `INSERT INTO invitations (id, event_id, organization_id, guest_id, delegation_id, token_hash, token_nonce,
          status, persons_reserved, companions_allowed, issued_at, expires_at, idempotency_key)
         VALUES (?,?,?,?,?,?,?, 'issued', ?,?,?,?,?)`,
        id, eventId, ctx.actor.orgId, guest.id, delegation?.id ?? null,
        hashToken(rawToken), nonce, reserveUnits, companionsAllowed, nowIso(), expiresAt, idemKey
      );
    }

    if (delegation) {
      ctx.db.run(
        "UPDATE delegations SET quota_used = quota_used + ? WHERE id = ?", reserveUnits, delegation.id
      );
      const after = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", delegation.id)!;
      ctx.db.run(
        `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, invitation_id, delta, balance_after, reason, actor_id)
         VALUES (?,?,?,?,?,?,?, 'issue', ?)`,
        newId(), ctx.actor.orgId, eventId, delegation.id, id, -reserveUnits,
        after.quota_allocated - after.quota_used, ctx.actor.user.id
      );
    }
    // قفل وحدة الحصة بعد أول إصدار
    if (!event.unit_locked)
      ctx.db.run("UPDATE events SET unit_locked = 1 WHERE id = ?", eventId);

    // ربط الضيف بالمفوّض إن لم يكن له داعٍ
    if (delegation && !guest.inviter_id) {
      ctx.db.run(
        "UPDATE guests SET inviter_id = ?, original_inviter_id = COALESCE(original_inviter_id, ?) WHERE id = ?",
        delegation.id, delegation.id, guest.id
      );
    }

    const result = {
      invitation_id: id,
      token: rawToken,
      url: invitationUrl(rawToken),
      persons_reserved: reserveUnits,
      companions_allowed: companionsAllowed,
    };
    if (idemKey) {
      ctx.db.run(
        "INSERT INTO idempotency_keys (scope, key, organization_id, result_json) VALUES ('issue_invitation', ?, ?, ?)",
        `${ctx.actor.orgId}:${idemKey}`, ctx.actor.orgId, JSON.stringify(result)
      );
    }
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
      action: "invitation.issue", objectType: "invitation", objectId: id,
      detail: { guest_id: guest.id, delegation_id: delegation?.id ?? null, reserve: reserveUnits }, ip: ctx.ip,
    });
    return result;
  });
}

/** إلغاء دعوة — الحصة تعود أو تبقى وفق سياسة المناسبة المحفوظة (AC-03) */
export function cancelInvitation(ctx: Ctx, invitationId: string, reason: string) {
  if (!reason?.trim()) err("VALIDATION", "سبب الإلغاء مطلوب");
  const inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE id = ?", invitationId);
  if (!inv || inv.organization_id !== ctx.actor.orgId) err("NOT_FOUND", "الدعوة غير موجودة");
  const { event, role, delegation } = requireEventAccess(ctx, inv.event_id, ["owner", "manager", "supervisor", "delegate"]);
  if (role === "delegate" || role === "supervisor") {
    assertDelegationUsable(delegation, "can_cancel");
    if (inv.delegation_id !== delegation!.id) err("FORBIDDEN", "لا يمكنك إلغاء دعوة غيرك");
  }
  if (["cancelled", "expired"].includes(inv.status)) err("CONFLICT", "الدعوة ملغاة أو منتهية بالفعل");
  if (inv.status === "checked_in") err("CONFLICT", "لا يمكن إلغاء دعوة تم تسجيل دخولها");

  return ctx.db.tx(() => {
    ctx.db.run(
      "UPDATE invitations SET status = 'cancelled', cancelled_at = ?, cancel_reason = ? WHERE id = ?",
      nowIso(), reason.trim(), invitationId
    );
    const returns = event.cancel_returns_quota === 1;
    if (inv.delegation_id) {
      if (returns) {
        ctx.db.run(
          "UPDATE delegations SET quota_used = MAX(0, quota_used - ?) WHERE id = ?",
          inv.persons_reserved, inv.delegation_id
        );
      }
      const after = ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ?", inv.delegation_id)!;
      ctx.db.run(
        `INSERT INTO quota_ledger (id, organization_id, event_id, delegation_id, invitation_id, delta, balance_after, reason, note, actor_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        newId(), ctx.actor.orgId, inv.event_id, inv.delegation_id, invitationId,
        returns ? inv.persons_reserved : 0,
        after.quota_allocated - after.quota_used,
        returns ? "cancel_return" : "cancel_burn",
        reason.trim(), ctx.actor.user.id
      );
    }
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: inv.event_id, actorId: ctx.actor.user.id,
      action: "invitation.cancel", objectType: "invitation", objectId: invitationId,
      detail: { reason: reason.trim(), quota_returned: returns }, ip: ctx.ip,
    });
    return { ok: true, quota_returned: returns };
  });
}

/** قائمة الدعوات مع روابط المشاركة المعاد اشتقاقها (لا يُخزن الرمز الخام) */
export function listInvitations(ctx: Ctx, eventId: string, filters?: { status?: string; delegation_id?: string; q?: string }) {
  const { role, delegation } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate", "receptionist"]);
  const where: string[] = ["i.event_id = ?", "i.organization_id = ?"];
  const params: any[] = [eventId, ctx.actor.orgId];
  if (role === "delegate" && delegation) {
    const perms = delegationPerms(delegation);
    if (!perms.can_view_all) { where.push("i.delegation_id = ?"); params.push(delegation.id); }
  }
  if (filters?.status) { where.push("i.status = ?"); params.push(filters.status); }
  if (filters?.delegation_id) { where.push("i.delegation_id = ?"); params.push(filters.delegation_id); }
  if (filters?.q) { where.push("g.name LIKE ?"); params.push(`%${filters.q}%`); }
  const rows = ctx.db.all(
    `SELECT i.*, g.name guest_name, g.phone guest_phone, g.email guest_email, d.invitee_name delegate_name
     FROM invitations i JOIN guests g ON g.id = i.guest_id
     LEFT JOIN delegations d ON d.id = i.delegation_id
     WHERE ${where.join(" AND ")} ORDER BY i.created_at DESC`,
    ...params
  );
  return rows.map((r: any) => ({
    ...r,
    token: deriveToken(r.id, r.token_nonce),
    url: invitationUrl(deriveToken(r.id, r.token_nonce)),
    token_hash: undefined,
  }));
}

/** تفاصيل دعوة واحدة ضمن النطاق (لصفحة الإرسال/المشاركة) */
export function getInvitation(ctx: Ctx, invitationId: string) {
  const inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE id = ?", invitationId);
  if (!inv || inv.organization_id !== ctx.actor.orgId) err("NOT_FOUND");
  const { role, delegation } = requireEventAccess(ctx, inv.event_id, ["owner", "manager", "supervisor", "delegate", "receptionist"]);
  if ((role === "delegate" || role === "supervisor") && delegation && inv.delegation_id !== delegation.id && !delegationPerms(delegation).can_view_all)
    err("FORBIDDEN");
  const guest = ctx.db.get("SELECT id, name, phone, email FROM guests WHERE id = ?", inv.guest_id);
  const rawToken = deriveToken(inv.id, inv.token_nonce);
  return { ...inv, token_hash: undefined, guest, token: rawToken, url: invitationUrl(rawToken) };
}

/** تسجيل إرسال يدوي (واتساب/نسخ رابط) مع منع التكرار غير المقصود */
export function logDelivery(ctx: Ctx, invitationId: string, channel: "whatsapp_manual" | "link_copy" | "email", idempotencyKey?: string) {
  const inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE id = ?", invitationId);
  if (!inv || inv.organization_id !== ctx.actor.orgId) err("NOT_FOUND");
  const { role, delegation } = requireEventAccess(ctx, inv.event_id, ["owner", "manager", "supervisor", "delegate"]);
  if (role === "delegate" || role === "supervisor") {
    assertDelegationUsable(delegation, "can_send");
    if (inv.delegation_id !== delegation!.id) err("FORBIDDEN");
  }
  if (["cancelled", "expired", "draft"].includes(inv.status)) err("EVENT_CLOSED", "الدعوة غير قابلة للإرسال");
  if (idempotencyKey) {
    const prior = ctx.db.get(
      "SELECT id FROM delivery_jobs WHERE invitation_id = ? AND idempotency_key = ?", invitationId, idempotencyKey
    );
    if (prior) return { ok: true, deduplicated: true };
  }
  // منع التكرار غير المقصود: نفس القناة خلال 60 ثانية
  const recent = ctx.db.get(
    `SELECT id FROM delivery_jobs WHERE invitation_id = ? AND channel = ? AND created_at > ?`,
    invitationId, channel, new Date(Date.now() - 60e3).toISOString()
  );
  if (recent) return { ok: true, deduplicated: true };

  ctx.db.run(
    `INSERT INTO delivery_jobs (id, organization_id, invitation_id, channel, state, idempotency_key, attempts)
     VALUES (?,?,?,?, 'manual_sent', ?, 1)`,
    newId(), ctx.actor.orgId, invitationId, channel, idempotencyKey ?? null
  );
  if (inv.status === "issued")
    ctx.db.run("UPDATE invitations SET status = 'delivered' WHERE id = ?", invitationId);
  writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId: inv.event_id, actorId: ctx.actor.user.id,
    action: "delivery.manual", objectType: "invitation", objectId: invitationId,
    detail: { channel }, ip: ctx.ip,
  });
  return { ok: true };
}
