import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "vitest";
import { createTestDb, DB, newId } from "@/lib/db";
import { registerUser } from "@/lib/auth";
import type { Ctx, OrgRole, UserRow } from "@/lib/types";
import { createEvent, transitionEvent } from "@/server/services/events";
import { createGuest } from "@/server/services/guests";
import { createDelegation } from "@/server/services/delegations";
import type { DelegationRow } from "@/lib/permissions";

// بيئة اختبار معزولة
process.env.DAWAT_UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dawat-uploads-"));
process.env.DAWAT_SECRET = "test-secret-dawat";
process.env.DAWAT_PAYMENT_MODE = "stub";

let counter = 0;

export async function makeUser(db: DB, label?: string) {
  counter++;
  const n = `${label ?? "user"}${counter}_${newId().slice(0, 6)}`;
  const { user, orgId } = (await registerUser(db, {
    name: `مستخدم ${n}`,
    email: `${n}@test.local`,
    password: "Password123!",
    orgName: `منظمة ${n}`,
  }));
  return { user, orgId, ctx: (await ctxFor(db, user, orgId)) };
}

export async function ctxFor(db: DB, user: UserRow, orgId: string): Promise<Ctx>{
  const m = (await db.get<{ role: OrgRole }>(
    "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?",
    orgId, user.id
  ));
  return {
    db,
    actor: { user, orgId, orgRole: m?.role ?? "member", isPlatformAdmin: user.is_platform_admin === 1 },
    ip: "test",
  };
}

export async function setup() {
  const db = (await createTestDb());
  const a = (await makeUser(db, "a"));
  const b = (await makeUser(db, "b"));
  return { db, a, b };
}

/** ترقية باقة منظمة داخل الاختبار (تجاوز حدود المجانية عند الحاجة) */
export async function upgradePlan(db: DB, orgId: string, planId: string) {
  (await db.run("UPDATE organizations SET plan_id = ? WHERE id = ?", planId, orgId));
  (await db.run("UPDATE subscriptions SET plan_id = ? WHERE organization_id = ?", planId, orgId));
}

export async function publishedEvent(ctx: Ctx, overrides: Record<string, any> = {}) {
  const starts = new Date(Date.now() + 7 * 864e5).toISOString();
  const ends = new Date(Date.now() + 7 * 864e5 + 4 * 3600e3).toISOString();
  const ev = (await createEvent(ctx, {
    title: "حفل تجريبي",
    type: "wedding",
    host_name: "آل تجريبي",
    starts_at: starts,
    ends_at: ends,
    capacity: 100,
    quota_unit: "card",
    ...overrides,
  }));
  (await transitionEvent(ctx, ev.id, "ready"));
  (await transitionEvent(ctx, ev.id, "published"));
  return ev;
}

let guestPhoneCounter = 0;

export async function addGuests(ctx: Ctx, eventId: string, n: number, prefix = "ضيف") {
  const out = [];
  for (let i = 1; i <= n; i++) {
    guestPhoneCounter++;
    out.push((await createGuest(ctx, eventId, {
      name: `${prefix} ${i}`,
      phone: `+9665${String(10000000 + guestPhoneCounter)}`,
    })));
  }
  return out;
}

export async function makeDelegate(
  db: DB, ownerCtx: Ctx, eventId: string,
  opts: { quota: number; name?: string; permissions?: Record<string, any>; role?: "delegate" | "supervisor" }
) {
  const d = (await makeUser(db, "delegate"));
  const delegation = (await createDelegation(ownerCtx, eventId, {
    invitee_name: opts.name ?? "مفوّض تجريبي",
    user_id: d.user.id,
    quota: opts.quota,
    permissions: opts.permissions,
    role: opts.role,
  })) as DelegationRow;
  return { ...d, delegation, ctx: (await ctxFor(db, d.user, ownerCtx.actor.orgId)) };
}

export async function makeReceptionist(db: DB, ownerCtx: Ctx, eventId: string, gates: string[] = []) {
  const r = (await makeUser(db, "reception"));
  (await db.run(
    "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')",
    ownerCtx.actor.orgId, r.user.id
  ));
  (await db.run(
    "INSERT INTO event_members (id, event_id, organization_id, user_id, role, permissions) VALUES (?,?,?,?,'receptionist',?)",
    newId(), eventId, ownerCtx.actor.orgId, r.user.id, JSON.stringify({ gates })
  ));
  return { ...r, ctx: (await ctxFor(db, r.user, ownerCtx.actor.orgId)) };
}

export function expectAppError(fn: () => any, code: string) {
  try {
    fn();
  } catch (e: any) {
    expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected AppError ${code} but nothing thrown`);
}

export async function expectAppErrorAsync(fn: () => Promise<any>, code: string) {
  try {
    await fn();
  } catch (e: any) {
    expect(e.code).toBe(code);
    return e;
  }
  throw new Error(`expected AppError ${code} but nothing thrown`);
}
