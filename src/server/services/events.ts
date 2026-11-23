import { DB, newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx, EventStatus } from "@/lib/types";
import { EVENT_TYPES } from "@/lib/types";
import {
  canManageEvent, effectiveEventRole, loadEventScoped, requireEventAccess, requireOrgRole,
} from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertPlanEventLimit } from "@/lib/plans";
import { applyTemplate } from "./planning";

const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ["ready", "cancelled"],
  ready: ["published", "draft", "cancelled"],
  published: ["ongoing", "cancelled"],
  ongoing: ["ended"],
  ended: ["archived"],
  archived: [],
  cancelled: ["archived"],
};

export interface EventInput {
  title: string;
  type: string;
  host_name?: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string;
  venue_name?: string;
  venue_address?: string;
  map_url?: string;
  is_virtual?: boolean;
  virtual_url?: string;
  capacity?: number;
  quota_unit?: "card" | "person";
  cancel_returns_quota?: boolean;
  rsvp_deadline?: string | null;
  allow_reentry?: boolean;
}

function validateInput(input: Partial<EventInput>, partial = false) {
  if (!partial || input.title !== undefined) {
    if (!input.title?.trim()) err("VALIDATION", "اسم المناسبة مطلوب");
  }
  if (!partial || input.type !== undefined) {
    if (!EVENT_TYPES.some((t) => t.id === input.type))
      err("VALIDATION", "نوع المناسبة غير صالح");
  }
  if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1))
    err("VALIDATION", "السعة عدد صحيح موجب");
  if (input.starts_at && isNaN(Date.parse(input.starts_at)))
    err("VALIDATION", "تاريخ البداية غير صالح");
  if (input.ends_at && input.starts_at && Date.parse(input.ends_at) < Date.parse(input.starts_at))
    err("VALIDATION", "تاريخ النهاية قبل البداية");
}

export async function createEvent(ctx: Ctx, input: EventInput) {
  requireOrgRole(ctx, ["owner", "admin", "member"]);
  validateInput(input);
  (await assertPlanEventLimit(ctx.db, ctx.actor.orgId));
  const id = newId();
  const event = (await ctx.db.tx(async () => {
    (await ctx.db.run(
      `INSERT INTO events (id, organization_id, owner_id, title, type, host_name, description, starts_at, ends_at, timezone,
        venue_name, venue_address, map_url, is_virtual, virtual_url, capacity, quota_unit, cancel_returns_quota, rsvp_deadline, allow_reentry, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft')`,
      id, ctx.actor.orgId, ctx.actor.user.id, input.title.trim(), input.type,
      input.host_name ?? null, input.description ?? null,
      input.starts_at ? new Date(input.starts_at).toISOString() : null,
      input.ends_at ? new Date(input.ends_at).toISOString() : null,
      input.timezone ?? "Asia/Riyadh",
      input.venue_name ?? null, input.venue_address ?? null, input.map_url ?? null,
      input.is_virtual ? 1 : 0, input.virtual_url ?? null,
      input.capacity ?? 100, input.quota_unit ?? "card",
      input.cancel_returns_quota === false ? 0 : 1,
      input.rsvp_deadline ?? null, input.allow_reentry ? 1 : 0
    ));
    (await ctx.db.run(
      "INSERT INTO event_members (id, event_id, organization_id, user_id, role) VALUES (?,?,?,?,'owner')",
      newId(), id, ctx.actor.orgId, ctx.actor.user.id
    ));
    // فئات افتراضية + بوابة رئيسية
    const groups = [
      { name: "VIP", kind: "vip", companion_max: 4, is_vip: 1, sort: 0 },
      { name: "أفراد", kind: "individuals", companion_max: 0, is_vip: 0, sort: 1 },
      { name: "عائلات", kind: "families", companion_max: 5, is_vip: 0, sort: 2 },
      { name: "شركات", kind: "corporate", companion_max: 2, is_vip: 0, sort: 3 },
    ];
    for (const g of groups) {
      (await ctx.db.run(
        "INSERT INTO guest_groups (id, event_id, organization_id, name, kind, companion_max, is_vip, sort_order) VALUES (?,?,?,?,?,?,?,?)",
        newId(), id, ctx.actor.orgId, g.name, g.kind, g.companion_max, g.is_vip, g.sort
      ));
    }
    (await ctx.db.run(
      "INSERT INTO gates (id, event_id, organization_id, name) VALUES (?,?,?,'البوابة الرئيسية')",
      newId(), id, ctx.actor.orgId
    ));
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: id, actorId: ctx.actor.user.id,
      action: "event.create", objectType: "event", objectId: id,
      detail: { title: input.title, type: input.type }, ip: ctx.ip,
    }));
    return (await loadEventScoped(ctx.db, ctx.actor.orgId, id));
  }));
  // خطة تلقائية حسب نوع المناسبة (مهام/ميزانية/قائمة تجهيز/جدول زمني)
  try { (await applyTemplate(ctx, id)); } catch { /* لا يمنع إنشاء المناسبة إن تعذر القالب */ }
  return event;
}

export async function listEvents(ctx: Ctx) {
  const role = ctx.actor.orgRole;
  if (role === "owner" || role === "admin" || ctx.actor.isPlatformAdmin) {
    return (await ctx.db.all(
      "SELECT * FROM events WHERE organization_id = ? ORDER BY created_at DESC",
      ctx.actor.orgId
    ));
  }
  // عضو/مفوّض/استقبال: فقط المناسبات المكلف بها
  return (await ctx.db.all(
    `SELECT e.* FROM events e
     WHERE e.organization_id = ? AND (
       e.owner_id = ? OR
       EXISTS (SELECT 1 FROM event_members m WHERE m.event_id = e.id AND m.user_id = ?) OR
       EXISTS (SELECT 1 FROM delegations d WHERE d.event_id = e.id AND d.user_id = ? AND d.status IN ('active','pending'))
     ) ORDER BY e.created_at DESC`,
    ctx.actor.orgId, ctx.actor.user.id, ctx.actor.user.id, ctx.actor.user.id
  ));
}

export async function getEvent(ctx: Ctx, eventId: string) {
  const event = (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
  const role = (await effectiveEventRole(ctx.db, ctx, event));
  if (!role) err("FORBIDDEN");
  const groups = (await ctx.db.all("SELECT * FROM guest_groups WHERE event_id = ? ORDER BY sort_order", eventId));
  const gates = (await ctx.db.all("SELECT * FROM gates WHERE event_id = ? ORDER BY created_at", eventId));
  return { event, role, groups, gates };
}

export async function updateEvent(ctx: Ctx, eventId: string, input: Partial<EventInput>) {
  const { event, role } = (await requireEventAccess(ctx, eventId, ["owner", "manager"]));
  validateInput(input, true);
  if (event.status === "archived" || event.status === "cancelled")
    err("EVENT_CLOSED", "المناسبة مؤرشفة أو ملغاة");
  const unitChange = input.quota_unit && input.quota_unit !== event.quota_unit;
  if (unitChange && event.unit_locked)
    err("UNIT_LOCKED", "لا يمكن تبديل وحدة الحصة بعد أول إصدار إلا بترحيل محكوم");
  if (input.capacity !== undefined && input.capacity < event.capacity) {
    const reserved = (await reservedUnits(ctx.db, eventId));
    if (input.capacity < reserved)
      err("CAPACITY_EXCEEDED", `السعة الجديدة أقل من المحجوز حاليًا (${reserved})`);
  }
  const fields: [string, any][] = [];
  const map: Record<string, any> = {
    title: input.title?.trim(), type: input.type, host_name: input.host_name,
    description: input.description,
    starts_at: input.starts_at === undefined ? undefined : input.starts_at ? new Date(input.starts_at).toISOString() : null,
    ends_at: input.ends_at === undefined ? undefined : input.ends_at ? new Date(input.ends_at).toISOString() : null,
    timezone: input.timezone, venue_name: input.venue_name, venue_address: input.venue_address,
    map_url: input.map_url, is_virtual: input.is_virtual === undefined ? undefined : input.is_virtual ? 1 : 0,
    virtual_url: input.virtual_url, capacity: input.capacity, quota_unit: input.quota_unit,
    cancel_returns_quota: input.cancel_returns_quota === undefined ? undefined : input.cancel_returns_quota ? 1 : 0,
    rsvp_deadline: input.rsvp_deadline, allow_reentry: input.allow_reentry === undefined ? undefined : input.allow_reentry ? 1 : 0,
  };
  for (const [k, v] of Object.entries(map)) if (v !== undefined) fields.push([k, v]);
  if (fields.length === 0) return event;
  (await ctx.db.run(
    `UPDATE events SET ${fields.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
    ...fields.map(([, v]) => v), nowIso(), eventId
  ));
  (await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "event.update", objectType: "event", objectId: eventId,
    detail: Object.fromEntries(fields), ip: ctx.ip,
  }));
  return (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
}

export async function transitionEvent(ctx: Ctx, eventId: string, to: EventStatus) {
  const { event } = (await requireEventAccess(ctx, eventId, ["owner", "manager"]));
  const from = event.status as EventStatus;
  if (!TRANSITIONS[from]?.includes(to))
    err("CONFLICT", `انتقال غير مسموح: ${from} → ${to}`);
  if (to === "published" || to === "ready") {
    if (!event.title?.trim()) err("VALIDATION", "أكمل اسم المناسبة قبل النشر");
    if (to === "published" && !event.starts_at)
      err("VALIDATION", "حدد تاريخ المناسبة قبل النشر");
    if (event.capacity < 1) err("VALIDATION", "السعة غير صالحة");
  }
  (await ctx.db.run("UPDATE events SET status = ?, updated_at = ? WHERE id = ?", to, nowIso(), eventId));
  if (to === "ended") {
    // تثبيت حالات عدم الحضور للمؤكدين الذين لم يدخلوا
    (await ctx.db.run(
      `UPDATE invitations SET status = 'no_show'
       WHERE event_id = ? AND status IN ('issued','delivered','seen','confirmed')`,
      eventId
    ));
  }
  (await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "event.status", objectType: "event", objectId: eventId,
    detail: { from, to }, ip: ctx.ip,
  }));
  return (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
}

export async function cloneEvent(ctx: Ctx, eventId: string) {
  const { event } = (await requireEventAccess(ctx, eventId, ["owner", "manager"]));
  (await assertPlanEventLimit(ctx.db, ctx.actor.orgId));
  const newEventId = newId();
  return (await ctx.db.tx(async () => {
    (await ctx.db.run(
      `INSERT INTO events (id, organization_id, owner_id, title, type, host_name, description, starts_at, ends_at, timezone,
        venue_name, venue_address, map_url, is_virtual, virtual_url, capacity, quota_unit, cancel_returns_quota, rsvp_deadline, allow_reentry, status)
       SELECT ?, organization_id, ?, title || ' (نسخة)', type, host_name, description, NULL, NULL, timezone,
        venue_name, venue_address, map_url, is_virtual, virtual_url, capacity, quota_unit, cancel_returns_quota, NULL, allow_reentry, 'draft'
       FROM events WHERE id = ?`,
      newEventId, ctx.actor.user.id, eventId
    ));
    (await ctx.db.run(
      "INSERT INTO event_members (id, event_id, organization_id, user_id, role) VALUES (?,?,?,?,'owner')",
      newId(), newEventId, ctx.actor.orgId, ctx.actor.user.id
    ));
    const groups = (await ctx.db.all("SELECT * FROM guest_groups WHERE event_id = ?", eventId));
    for (const g of groups) {
      (await ctx.db.run(
        "INSERT INTO guest_groups (id, event_id, organization_id, name, kind, companion_max, is_vip, sort_order) VALUES (?,?,?,?,?,?,?,?)",
        newId(), newEventId, ctx.actor.orgId, g.name, g.kind, g.companion_max, g.is_vip, g.sort_order
      ));
    }
    (await ctx.db.run(
      "INSERT INTO gates (id, event_id, organization_id, name) VALUES (?,?,?,'البوابة الرئيسية')",
      newId(), newEventId, ctx.actor.orgId
    ));
    const design = (await ctx.db.get(
      "SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'published'", eventId
    )) ?? (await ctx.db.get("SELECT * FROM invitation_designs WHERE event_id = ? ORDER BY updated_at DESC LIMIT 1", eventId));
    if (design) {
      (await ctx.db.run(
        "INSERT INTO invitation_designs (id, event_id, organization_id, template_id, scenes_json, version, state, audio_asset_id) VALUES (?,?,?,?,?,1,'draft',?)",
        newId(), newEventId, ctx.actor.orgId, design.template_id, design.scenes_json, design.audio_asset_id
      ));
    }
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId: newEventId, actorId: ctx.actor.user.id,
      action: "event.clone", objectType: "event", objectId: newEventId,
      detail: { source: eventId }, ip: ctx.ip,
    }));
    return (await loadEventScoped(ctx.db, ctx.actor.orgId, newEventId));
  }));
}

/** الوحدات المحجوزة فعليًا على مستوى المناسبة (لا تشمل المسودات/الملغاة/المنتهية) */
export async function reservedUnits(db: DB, eventId: string): Promise<number>{
  return (await db.get<{ n: number }>(
    `SELECT COALESCE(SUM(persons_reserved),0) n FROM invitations
     WHERE event_id = ? AND status NOT IN ('draft','cancelled','expired')`,
    eventId
  ))!.n;
}

export async function unallocatedPool(db: DB, eventId: string): Promise<number>{
  const ev = (await loadEventById(db, eventId));
  const allocated = (await db.get<{ n: number }>(
    `SELECT COALESCE(SUM(quota_allocated),0) n FROM delegations WHERE event_id = ? AND status IN ('active','pending','suspended')`,
    eventId
  ))!.n;
  return ev.capacity - allocated;
}

export async function loadEventById(db: DB, eventId: string) {
  const ev = (await db.get<any>("SELECT * FROM events WHERE id = ?", eventId));
  if (!ev) err("NOT_FOUND");
  return ev;
}

export { canManageEvent };
