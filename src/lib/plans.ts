import { DB } from "./db";
import { err } from "./errors";
import type { PlanRow } from "./types";
import { PLANS_SEED } from "./seeds";

export { PLANS_SEED };
export { seedPlans } from "./seeds";

export async function getOrgPlan(db: DB, orgId: string): Promise<PlanRow>{
  const row = (await db.get<PlanRow>(
    `SELECT p.* FROM plans p JOIN organizations o ON o.plan_id = p.id WHERE o.id = ?`,
    orgId
  ));
  if (!row) err("NOT_FOUND", "الباقة غير موجودة");
  return row;
}

export async function assertPlanEventLimit(db: DB, orgId: string) {
  const plan = (await getOrgPlan(db, orgId));
  const active = (await db.get<{ n: number }>(
    `SELECT COUNT(*) n FROM events WHERE organization_id = ? AND status NOT IN ('archived','cancelled','ended')`,
    orgId
  ))!.n;
  if (active >= plan.max_active_events)
    err("PLAN_LIMIT", `بلغت حد المناسبات النشطة (${plan.max_active_events}) في باقة «${plan.name_ar}»`);
}

export async function assertPlanGuestLimit(db: DB, orgId: string, eventId: string, adding = 1) {
  const plan = (await getOrgPlan(db, orgId));
  const n = (await db.get<{ n: number }>(
    "SELECT COUNT(*) n FROM guests WHERE event_id = ?", eventId
  ))!.n;
  if (n + adding > plan.max_guests_per_event)
    err("PLAN_LIMIT", `بلغت حد الضيوف (${plan.max_guests_per_event}) في باقة «${plan.name_ar}»`);
}

export async function assertPlanDelegateLimit(db: DB, orgId: string, eventId: string) {
  const plan = (await getOrgPlan(db, orgId));
  const n = (await db.get<{ n: number }>(
    "SELECT COUNT(*) n FROM delegations WHERE event_id = ? AND status IN ('active','pending')",
    eventId
  ))!.n;
  if (n >= plan.max_delegates_per_event)
    err("PLAN_LIMIT", `بلغت حد المفوّضين (${plan.max_delegates_per_event}) في باقة «${plan.name_ar}»`);
}

export async function assertPlanStorage(db: DB, orgId: string, addingBytes: number) {
  const plan = (await getOrgPlan(db, orgId));
  const used = (await db.get<{ n: number }>(
    "SELECT COALESCE(SUM(bytes),0) n FROM media_assets WHERE organization_id = ? AND status = 'active'",
    orgId
  ))!.n;
  if (used + addingBytes > plan.storage_mb * 1024 * 1024)
    err("PLAN_LIMIT", "بلغت حد التخزين في الباقة الحالية");
}
