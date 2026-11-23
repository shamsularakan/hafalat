/**
 * نموذج الصلاحيات والعزل — يُتحقق منه دائمًا في جهة الخادم (القسم 02).
 * لا يرى المفوّض ضيوف غيره افتراضيًا، ولا يعدّل حصته، ولا يفوّض آخرين إلا بإذن.
 */
import { DB } from "./db";
import { err } from "./errors";
import type {
  Ctx, DelegationPermissions, EventRole, OrgRole, UserRow,
} from "./types";
import { DEFAULT_DELEGATE_PERMISSIONS } from "./types";

export interface EventRow {
  id: string;
  organization_id: string;
  owner_id: string;
  title: string;
  type: string;
  host_name: string | null;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  is_virtual: number;
  virtual_url: string | null;
  capacity: number;
  quota_unit: "card" | "person";
  unit_locked: number;
  cancel_returns_quota: number;
  rsvp_deadline: string | null;
  allow_reentry: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DelegationRow {
  id: string;
  event_id: string;
  organization_id: string;
  parent_id: string | null;
  user_id: string | null;
  invitee_name: string;
  invitee_phone: string | null;
  invitee_email: string | null;
  role: string;
  quota_allocated: number;
  quota_used: number;
  permissions: string;
  status: string;
  expires_at: string | null;
  suspended_policy: string;
  created_at: string;
  created_by: string;
}

export async function getOrgMembership(db: DB, orgId: string, userId: string) {
  return (await db.get<{ role: OrgRole }>(
    "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?",
    orgId, userId
  ));
}

export function requireOrgRole(ctx: Ctx, roles: OrgRole[]) {
  if (ctx.actor.isPlatformAdmin) return;
  if (!roles.includes(ctx.actor.orgRole)) err("FORBIDDEN");
}

/** تحميل مناسبة ضمن نطاق المنظمة فقط — عزل المستأجرين (AC-01) */
export async function loadEventScoped(db: DB, orgId: string, eventId: string): Promise<EventRow>{
  const ev = (await db.get<EventRow>(
    "SELECT * FROM events WHERE id = ? AND organization_id = ?",
    eventId, orgId
  ));
  if (!ev) err("NOT_FOUND", "المناسبة غير موجودة");
  return ev;
}

const ROLE_RANK: Record<EventRole, number> = {
  owner: 6, manager: 5, supervisor: 4, designer: 3, delegate: 2, receptionist: 1,
};

/** الدور الفعّال للمستخدم على مناسبة: عضوية مباشرة، أو اشتقاقًا من دور المنظمة */
export async function effectiveEventRole(db: DB, ctx: Ctx, event: EventRow): Promise<EventRole | null>{
  const rows = (await db.all<{ role: EventRole }>(
    "SELECT role FROM event_members WHERE event_id = ? AND user_id = ?",
    event.id, ctx.actor.user.id
  ));
  let best: EventRole | null = null;
  for (const r of rows) {
    if (!best || ROLE_RANK[r.role] > ROLE_RANK[best]) best = r.role;
  }
  if (event.owner_id === ctx.actor.user.id) best = "owner";
  if (!best) {
    if (ctx.actor.orgRole === "owner") best = "owner";
    else if (ctx.actor.orgRole === "admin") best = "manager";
  }
  if (ctx.actor.isPlatformAdmin && !best) best = "manager";
  return best;
}

export interface EventAccess {
  event: EventRow;
  role: EventRole;
  delegation: DelegationRow | null;
}

/** حاجز الوصول للمناسبة: عضوية + دور مسموح (AC-01 / AC-10) */
export async function requireEventAccess(
  ctx: Ctx, eventId: string, allowed: EventRole[]
): Promise<EventAccess>{
  const event = (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
  const role = (await effectiveEventRole(ctx.db, ctx, event));
  if (!role || !allowed.includes(role)) err("FORBIDDEN", "لا تملك صلاحية على هذه المناسبة");
  let delegation: DelegationRow | null = null;
  if (role === "delegate" || role === "supervisor") {
    delegation = (await getActiveDelegation(ctx.db, event.id, ctx.actor.user.id, role));
  }
  return { event, role, delegation };
}

export async function getActiveDelegation(
  db: DB, eventId: string, userId: string, role?: string
): Promise<DelegationRow | null>{
  const d = (await db.get<DelegationRow>(
    `SELECT * FROM delegations WHERE event_id = ? AND user_id = ? AND status IN ('active','pending')
     ${role ? "AND role = ?" : ""} ORDER BY created_at DESC LIMIT 1`,
    ...(role ? [eventId, userId, role] : [eventId, userId])
  ));
  return d ?? null;
}

export function delegationPerms(d: DelegationRow | null): DelegationPermissions {
  if (!d) return { ...DEFAULT_DELEGATE_PERMISSIONS, can_view_all: true };
  try {
    return { ...DEFAULT_DELEGATE_PERMISSIONS, ...JSON.parse(d.permissions || "{}") };
  } catch {
    return { ...DEFAULT_DELEGATE_PERMISSIONS };
  }
}

export function assertDelegationUsable(d: DelegationRow | null, action: keyof DelegationPermissions) {
  if (!d) err("FORBIDDEN", "لا يوجد تفويض فعّال لك على هذه المناسبة");
  if (d.status !== "active") err("FORBIDDEN", "التفويض غير نشط");
  if (d.expires_at && d.expires_at < new Date().toISOString())
    err("EXPIRED", "انتهت مدة التفويض");
  const perms = delegationPerms(d);
  if (!perms[action]) err("FORBIDDEN", "صلاحية غير ممنوحة ضمن تفويضك");
}

/** حاجز موظف الاستقبال: البوابة ضمن تكليفه (AC-10) */
export async function assertGateAccess(ctx: Ctx, event: EventRow, role: EventRole, gateId: string | null) {
  if (role === "owner" || role === "manager" || role === "supervisor") return;
  const gate = gateId
    ? (await ctx.db.get<{ id: string; event_id: string }>(
        "SELECT id, event_id FROM gates WHERE id = ? AND organization_id = ?",
        gateId, ctx.actor.orgId
      ))
    : null;
  if (gateId && (!gate || gate.event_id !== event.id)) err("NOT_FOUND", "البوابة غير موجودة");
  const mem = (await ctx.db.get<{ permissions: string }>(
    "SELECT permissions FROM event_members WHERE event_id = ? AND user_id = ? AND role = 'receptionist'",
    event.id, ctx.actor.user.id
  ));
  let allowedGates: string[] = [];
  try { allowedGates = JSON.parse(mem?.permissions ?? "{}").gates ?? []; } catch { /* */ }
  if (allowedGates.length > 0 && gateId && !allowedGates.includes(gateId))
    err("FORBIDDEN", "هذه البوابة خارج نطاق تكليفك");
}

export function canManageEvent(role: EventRole) {
  return role === "owner" || role === "manager";
}

export function sessionUser(ctx: Ctx): UserRow {
  return ctx.actor.user;
}
