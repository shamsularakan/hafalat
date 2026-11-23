/**
 * الدخول والاستقبال (القسم 04-F) — تحقق فوري من الصلاحية والسعة والاستخدام.
 * منع إعادة الدخول وفق إعداد صريح؛ إجراء يدوي مبرر وموثق عند الاستثناء (AC-09/AC-10).
 */
import { newId, nowIso, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { assertGateAccess, requireEventAccess } from "@/lib/permissions";
import { hashToken } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import type { InvitationRow } from "./invitations";

export interface ScanResult {
  ok: boolean;
  result: "checked_in" | "reentry" | "denied";
  code?: string;
  message: string;
  guest_name?: string;
  persons?: number;
  invitation_id?: string;
  checkin_id?: string;
  override?: boolean;
}

function attendanceCount(db: DB, eventId: string, unit: string): number {
  if (unit === "card") {
    return db.get<{ n: number }>(
      "SELECT COUNT(DISTINCT invitation_id) n FROM checkins WHERE event_id = ?", eventId
    )!.n;
  }
  return db.get<{ n: number }>(
    "SELECT COALESCE(SUM(persons),0) n FROM checkins WHERE event_id = ?", eventId
  )!.n;
}

export function scanCheckin(
  ctx: Ctx,
  input: { token?: string; invitation_id?: string; gate_id?: string | null; persons?: number; idempotency_key?: string }
): ScanResult {
  if (input.idempotency_key) {
    const prior = ctx.db.get<{ result_json: string }>(
      "SELECT result_json FROM idempotency_keys WHERE scope = 'scan' AND key = ?",
      `${ctx.actor.orgId}:${input.idempotency_key}`
    );
    if (prior) return JSON.parse(prior.result_json);
  }

  let inv: InvitationRow | undefined;
  if (input.token) {
    inv = ctx.db.get<InvitationRow>(
      "SELECT * FROM invitations WHERE token_hash = ?", hashToken(input.token)
    );
    if (!inv) return denied("INVALID_TOKEN", "رمز غير صالح — الدعوة غير موجودة");
  } else if (input.invitation_id) {
    inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE id = ?", input.invitation_id);
    if (!inv) return denied("NOT_FOUND", "الدعوة غير موجودة");
  } else {
    err("VALIDATION", "رمز أو معرّف دعوة مطلوب");
  }
  if (inv.organization_id !== ctx.actor.orgId)
    return denied("FORBIDDEN", "الدعوة خارج نطاق مؤسستك");

  const { event, role } = requireEventAccess(ctx, inv.event_id, ["owner", "manager", "supervisor", "receptionist"]);
  assertGateAccess(ctx, event, role, input.gate_id ?? null);

  const guest = ctx.db.get<{ name: string }>("SELECT name FROM guests WHERE id = ?", inv.guest_id)!;
  const result = processCheckin(ctx, inv, event, guest.name, input.gate_id ?? null, input.persons, "scan", null);
  if (input.idempotency_key) {
    ctx.db.run(
      "INSERT INTO idempotency_keys (scope, key, organization_id, result_json) VALUES ('scan', ?, ?, ?)",
      `${ctx.actor.orgId}:${input.idempotency_key}`, ctx.actor.orgId, JSON.stringify(result)
    );
  }
  return result;
}

/** إجراء يدوي مبرر (تعطل كاميرا/استثناء) — يتطلب سببًا ويوثق في التدقيق */
export function manualCheckin(
  ctx: Ctx,
  input: { token?: string; invitation_id?: string; gate_id?: string | null; persons?: number; reason: string; override?: boolean }
): ScanResult {
  if (!input.reason?.trim()) err("VALIDATION", "سبب الإجراء اليدوي مطلوب");
  let inv: InvitationRow | undefined;
  if (input.token) {
    inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE token_hash = ?", hashToken(input.token));
  } else if (input.invitation_id) {
    inv = ctx.db.get<InvitationRow>("SELECT * FROM invitations WHERE id = ?", input.invitation_id);
  }
  if (!inv || inv.organization_id !== ctx.actor.orgId) err("NOT_FOUND", "الدعوة غير موجودة");
  const { event, role } = requireEventAccess(ctx, inv.event_id, ["owner", "manager", "supervisor", "receptionist"]);
  assertGateAccess(ctx, event, role, input.gate_id ?? null);
  const guest = ctx.db.get<{ name: string }>("SELECT name FROM guests WHERE id = ?", inv.guest_id)!;
  return processCheckin(ctx, inv, event, guest.name, input.gate_id ?? null, input.persons, "manual", input.reason.trim(), input.override);
}

function denied(code: string, message: string): ScanResult {
  return { ok: false, result: "denied", code, message };
}

function processCheckin(
  ctx: Ctx, inv: InvitationRow, event: any, guestName: string,
  gateId: string | null, personsInput: number | undefined,
  mode: "scan" | "manual", reason: string | null, override?: boolean
): ScanResult {
  if (["cancelled", "expired", "draft"].includes(inv.status))
    return denied("INVALID_TOKEN", "دعوة ملغاة أو غير صالحة");
  if (inv.expires_at && inv.expires_at < nowIso() && !override)
    return denied("EXPIRED", "انتهت صلاحية الدعوة");
  if (!["published", "ongoing"].includes(event.status) && !override)
    return denied("EVENT_CLOSED", "المناسبة ليست في حالة استقبال");
  if (inv.status === "declined" && !override)
    return denied("DECLINED_INVITATION", "الدعوة معتذر عنها — يلزم إجراء يدوي مبرر");

  const prior = ctx.db.get<{ n: number }>(
    "SELECT COUNT(*) n FROM checkins WHERE invitation_id = ?", inv.id
  )!.n;
  if (prior > 0 && !event.allow_reentry && !override)
    return denied("REENTRY_DENIED", "تم تسجيل دخول هذه الدعوة مسبقًا");

  const latestRsvp = ctx.db.get<{ persons_confirmed: number }>(
    "SELECT persons_confirmed FROM rsvps WHERE invitation_id = ? AND answer = 'confirmed' ORDER BY occurred_at DESC LIMIT 1",
    inv.id
  );
  const maxPersons = 1 + inv.companions_allowed;
  let persons = personsInput ?? latestRsvp?.persons_confirmed ?? 1;
  if (!Number.isInteger(persons) || persons < 1) persons = 1;
  if (persons > maxPersons && !override)
    return denied("VALIDATION", `العدد يتجاوز المسموح (${maxPersons})`);

  const current = attendanceCount(ctx.db, event.id, event.quota_unit);
  const adding = event.quota_unit === "card" ? (prior > 0 ? 0 : 1) : persons;
  if (current + adding > event.capacity && !override)
    return denied("CAPACITY_EXCEEDED", "بلغت المناسبة سعتها — يلزم إجراء يدوي مبرر");

  return ctx.db.tx(() => {
    const id = newId();
    ctx.db.run(
      `INSERT INTO checkins (id, invitation_id, event_id, organization_id, gate_id, staff_id, persons, mode, manual_reason, is_reentry)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      id, inv.id, event.id, ctx.actor.orgId, gateId, ctx.actor.user.id,
      persons, mode, reason, prior > 0 ? 1 : 0
    );
    ctx.db.run("UPDATE invitations SET status = 'checked_in' WHERE id = ?", inv.id);
    writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: event.id, actorId: ctx.actor.user.id,
      action: mode === "manual" ? "checkin.manual" : "checkin.scan",
      objectType: "invitation", objectId: inv.id,
      detail: { persons, gate: gateId, reentry: prior > 0, override: !!override, reason }, ip: ctx.ip,
    });
    return {
      ok: true,
      result: prior > 0 ? "reentry" : "checked_in",
      message: prior > 0 ? `إعادة دخول — ${guestName}` : `تم الدخول — ${guestName}`,
      guest_name: guestName, persons, invitation_id: inv.id, checkin_id: id,
      override: !!override,
    };
  });
}

/** لوحة الحضور اللحظي (تحديث كل 15–60 ثانية من العميل) */
export function liveBoard(ctx: Ctx, eventId: string) {
  const { event, role, delegation } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "receptionist", "delegate"]);
  const totals = ctx.db.get(
    `SELECT
      (SELECT COUNT(*) FROM invitations WHERE event_id = ? AND status NOT IN ('draft','cancelled','expired')) issued,
      (SELECT COUNT(*) FROM invitations WHERE event_id = ? AND status = 'confirmed') confirmed,
      (SELECT COUNT(*) FROM invitations WHERE event_id = ? AND status = 'declined') declined,
      (SELECT COUNT(*) FROM invitations WHERE event_id = ? AND status = 'checked_in') checked_in_cards,
      (SELECT COALESCE(SUM(persons),0) FROM checkins WHERE event_id = ?) actual_persons`,
    eventId, eventId, eventId, eventId, eventId
  )!;
  const recent = ctx.db.all(
    `SELECT c.id, c.persons, c.mode, c.is_reentry, c.occurred_at, g.name guest_name, ga.name gate_name, u.name staff_name
     FROM checkins c JOIN invitations i ON i.id = c.invitation_id JOIN guests g ON g.id = i.guest_id
     LEFT JOIN gates ga ON ga.id = c.gate_id LEFT JOIN users u ON u.id = c.staff_id
     WHERE c.event_id = ? ORDER BY c.occurred_at DESC LIMIT 30`,
    eventId
  );
  const gates = ctx.db.all("SELECT * FROM gates WHERE event_id = ?", eventId);
  return { event: { id: event.id, title: event.title, status: event.status, capacity: event.capacity, quota_unit: event.quota_unit, allow_reentry: event.allow_reentry }, totals, recent, gates, role };
}
