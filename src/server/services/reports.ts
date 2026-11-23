/** التحليلات والتقارير (القسم 04-G) — الأرقام تُشتق من السجلات الفعلية (AC-12) */
import type { Ctx } from "@/lib/types";
import { delegationPerms, requireEventAccess } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import { err } from "@/lib/errors";

export function eventAnalytics(ctx: Ctx, eventId: string) {
  const { event, role, delegation } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate", "receptionist"]);
  const db = ctx.db;
  const scoped = (role === "delegate" || role === "supervisor") && delegation && !delegationPerms(delegation).can_view_all;
  const invWhere = scoped ? "event_id = ? AND delegation_id = ?" : "event_id = ?";
  const invParams = scoped ? [eventId, delegation!.id] : [eventId];

  const byStatus = db.all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) n FROM invitations WHERE ${invWhere} GROUP BY status`, ...invParams
  );
  const statusMap: Record<string, number> = {};
  for (const r of byStatus) statusMap[r.status] = r.n;
  const active = ["issued", "delivered", "seen", "confirmed", "declined", "checked_in", "no_show"];
  const issuedTotal = active.reduce((s, k) => s + (statusMap[k] ?? 0), 0);
  const confirmed = statusMap["confirmed"] ?? 0;
  const declined = statusMap["declined"] ?? 0;
  const checkedInCards = statusMap["checked_in"] ?? 0;
  // AC-12: المؤكد + المعتذر + المنتظر = الدعوات الفعّالة
  const pending = issuedTotal - confirmed - declined - checkedInCards - (statusMap["no_show"] ?? 0);

  const actualPersons = db.get<{ n: number }>(
    scoped
      ? `SELECT COALESCE(SUM(c.persons),0) n FROM checkins c JOIN invitations i ON i.id = c.invitation_id WHERE i.event_id = ? AND i.delegation_id = ?`
      : `SELECT COALESCE(SUM(persons),0) n FROM checkins WHERE event_id = ?`,
    ...invParams
  )!.n;

  const quota = scoped
    ? { allocated: delegation!.quota_allocated, used: delegation!.quota_used, remaining: delegation!.quota_allocated - delegation!.quota_used }
    : (() => {
        const agg = db.get<{ allocated: number; used: number }>(
          `SELECT COALESCE(SUM(quota_allocated),0) allocated, COALESCE(SUM(quota_used),0) used FROM delegations WHERE event_id = ? AND status IN ('active','pending','suspended')`,
          eventId
        )!;
        const direct = db.get<{ n: number }>(
          `SELECT COALESCE(SUM(persons_reserved),0) n FROM invitations WHERE event_id = ? AND delegation_id IS NULL AND status NOT IN ('draft','cancelled','expired')`,
          eventId
        )!.n;
        return { allocated: event.capacity, used: agg.used + direct, remaining: event.capacity - agg.used - direct, delegated: agg.allocated, pool: event.capacity - agg.allocated };
      })();

  const perDelegate = scoped ? [] : db.all(
    `SELECT d.id, d.invitee_name, d.quota_allocated, d.quota_used, d.status,
      (SELECT COUNT(*) FROM invitations i WHERE i.delegation_id = d.id AND i.status NOT IN ('draft','cancelled','expired')) issued,
      (SELECT COUNT(*) FROM invitations i WHERE i.delegation_id = d.id AND i.status = 'confirmed') confirmed,
      (SELECT COUNT(*) FROM invitations i WHERE i.delegation_id = d.id AND i.status = 'declined') declined,
      (SELECT COUNT(*) FROM invitations i WHERE i.delegation_id = d.id AND i.status = 'checked_in') checked_in,
      (SELECT COALESCE(SUM(c.persons),0) FROM checkins c JOIN invitations i ON i.id = c.invitation_id WHERE i.delegation_id = d.id) actual_persons
     FROM delegations d WHERE d.event_id = ? ORDER BY d.created_at`,
    eventId
  );

  const perGroup = db.all(
    `SELECT gr.name, COUNT(i.id) n,
      SUM(CASE WHEN i.status = 'confirmed' THEN 1 ELSE 0 END) confirmed,
      SUM(CASE WHEN i.status = 'checked_in' THEN 1 ELSE 0 END) checked_in
     FROM invitations i JOIN guests g ON g.id = i.guest_id LEFT JOIN guest_groups gr ON gr.id = g.group_id
     WHERE i.${invWhere} AND i.status NOT IN ('draft','cancelled','expired') GROUP BY gr.name`,
    ...invParams
  );

  const perChannel = db.all(
    `SELECT channel, state, COUNT(*) n FROM delivery_jobs WHERE organization_id = ? AND invitation_id IN (SELECT id FROM invitations WHERE ${invWhere}) GROUP BY channel, state`,
    ctx.actor.orgId, ...invParams
  );

  const perGate = db.all(
    `SELECT ga.name, COUNT(c.id) scans, COALESCE(SUM(c.persons),0) persons
     FROM checkins c LEFT JOIN gates ga ON ga.id = c.gate_id WHERE c.event_id = ? GROUP BY ga.name`,
    eventId
  );

  const perDay = db.all(
    `SELECT substr(occurred_at,1,10) day, COUNT(*) scans, SUM(persons) persons FROM checkins WHERE event_id = ? GROUP BY day ORDER BY day`,
    eventId
  );

  return {
    event: { id: event.id, title: event.title, status: event.status, capacity: event.capacity, quota_unit: event.quota_unit, starts_at: event.starts_at },
    totals: {
      issued: issuedTotal, confirmed, declined, pending,
      checked_in_cards: checkedInCards, actual_persons: actualPersons,
      cancelled: statusMap["cancelled"] ?? 0, no_show: statusMap["no_show"] ?? 0,
      drafts: statusMap["draft"] ?? 0,
      capacity_remaining: event.capacity - (event.quota_unit === "card" ? checkedInCards : actualPersons),
    },
    quota, per_delegate: perDelegate, per_group: perGroup, per_channel: perChannel, per_gate: perGate, per_day: perDay,
    consistency: { ok: confirmed + declined + pending + checkedInCards + (statusMap["no_show"] ?? 0) === issuedTotal },
  };
}

export function exportReport(ctx: Ctx, eventId: string, kind: "guests" | "invitations" | "checkins" | "summary"): string {
  const { role, delegation } = requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate"]);
  const db = ctx.db;
  const scoped = (role === "delegate" || role === "supervisor") && delegation && !delegationPerms(delegation).can_view_all;
  if (kind === "summary") {
    const a = eventAnalytics(ctx, eventId);
    return toCsv(
      ["المؤشر", "القيمة"],
      [
        ["المناسبة", a.event.title], ["الحالة", a.event.status], ["السعة", a.event.capacity],
        ["دعوة صادرة", a.totals.issued], ["مؤكد", a.totals.confirmed], ["معتذر", a.totals.declined],
        ["بانتظار الرد", a.totals.pending], ["بطاقات دخلت", a.totals.checked_in_cards],
        ["حضور فعلي (أشخاص)", a.totals.actual_persons], ["ملغاة", a.totals.cancelled],
        ["الحصة المستخدمة", a.quota.used], ["الحصة المتبقية", a.quota.remaining],
      ]
    );
  }
  if (kind === "guests") {
    const rows = db.all(
      `SELECT g.name, g.phone, g.email, gr.name group_name, d.invitee_name inviter, od.invitee_name original_inviter, g.created_at
       FROM guests g LEFT JOIN guest_groups gr ON gr.id = g.group_id LEFT JOIN delegations d ON d.id = g.inviter_id
       LEFT JOIN delegations od ON od.id = g.original_inviter_id
       WHERE g.event_id = ? ${scoped ? "AND g.inviter_id = ?" : ""} ORDER BY g.created_at`,
      ...(scoped ? [eventId, delegation!.id] : [eventId])
    );
    return toCsv(["الاسم", "الهاتف", "البريد", "الفئة", "الداعي الحالي", "الداعي الأصلي", "تاريخ الإضافة"],
      rows.map((r: any) => [r.name, r.phone, r.email, r.group_name, r.inviter ?? "المالك", r.original_inviter ?? r.inviter ?? "المالك", r.created_at]));
  }
  if (kind === "invitations") {
    const rows = db.all(
      `SELECT g.name, i.status, i.persons_reserved, i.companions_allowed, i.issued_at, i.seen_at, d.invitee_name delegate,
        (SELECT answer FROM rsvps r WHERE r.invitation_id = i.id ORDER BY occurred_at DESC LIMIT 1) last_answer,
        (SELECT persons_confirmed FROM rsvps r WHERE r.invitation_id = i.id ORDER BY occurred_at DESC LIMIT 1) last_persons
       FROM invitations i JOIN guests g ON g.id = i.guest_id LEFT JOIN delegations d ON d.id = i.delegation_id
       WHERE i.event_id = ? ${scoped ? "AND i.delegation_id = ?" : ""} ORDER BY i.created_at`,
      ...(scoped ? [eventId, delegation!.id] : [eventId])
    );
    return toCsv(["الضيف", "الحالة", "وحدات محجوزة", "مرافقون مسموحون", "تاريخ الإصدار", "تاريخ المشاهدة", "المفوّض", "آخر رد", "عدد مؤكد"],
      rows.map((r: any) => [r.name, r.status, r.persons_reserved, r.companions_allowed, r.issued_at, r.seen_at, r.delegate ?? "المالك", r.last_answer, r.last_persons]));
  }
  if (kind === "checkins") {
    const rows = db.all(
      `SELECT g.name, c.persons, c.mode, c.is_reentry, c.manual_reason, ga.name gate_name, u.name staff_name, c.occurred_at
       FROM checkins c JOIN invitations i ON i.id = c.invitation_id JOIN guests g ON g.id = i.guest_id
       LEFT JOIN gates ga ON ga.id = c.gate_id LEFT JOIN users u ON u.id = c.staff_id
       WHERE c.event_id = ? ORDER BY c.occurred_at`,
      eventId
    );
    return toCsv(["الضيف", "أشخاص", "الوضع", "إعادة دخول", "سبب يدوي", "البوابة", "الموظف", "الوقت"],
      rows.map((r: any) => [r.name, r.persons, r.mode, r.is_reentry, r.manual_reason, r.gate_name, r.staff_name, r.occurred_at]));
  }
  err("VALIDATION", "نوع تصدير غير صالح");
}
