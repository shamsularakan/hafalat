/** المصادقة والجلسات وقبول التفويض المعلق */
import { describe, it, expect } from "vitest";
import { setup, makeUser, ctxFor, publishedEvent, expectAppError } from "./helpers";
import { hashPassword, verifyPassword, login, createSession, validateSession, destroySession, registerUser, normalizePhone } from "@/lib/auth";
import { createDelegation, claimPendingDelegations } from "@/server/services/delegations";
import { createTestDb } from "@/lib/db";

describe("المصادقة", () => {
  it("تجزئة كلمة المرور والتحقق منها", () => {
    const h = hashPassword("Password123!");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("Password123!", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("تسجيل مكرر مرفوض", () => {
    const db = createTestDb();
    registerUser(db, { name: "أحمد", email: "dup@test.local", password: "Password123!", orgName: "مساحة" });
    expectAppError(() => registerUser(db, { name: "بدر", email: "dup@test.local", password: "Password123!", orgName: "مساحة" }), "DUPLICATE_ENTRY");
  });

  it("كلمة مرور قصيرة مرفوضة", () => {
    const db = createTestDb();
    expectAppError(() => registerUser(db, { name: "أحمد", email: "short@test.local", password: "123", orgName: "مساحة" }), "VALIDATION");
  });

  it("الجلسة تنتهي وتُبطل", () => {
    const { db, a } = setup();
    const s = createSession(db, a.user);
    expect(validateSession(db, s.raw)?.id).toBe(a.user.id);
    db.run("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z' WHERE user_id = ?", a.user.id);
    expect(validateSession(db, s.raw)).toBeNull();
    const s2 = createSession(db, a.user);
    destroySession(db, s2.raw);
    expect(validateSession(db, s2.raw)).toBeNull();
    expect(validateSession(db, undefined)).toBeNull();
  });

  it("دخول خاطئ مرفوض", () => {
    const { db, a } = setup();
    expectAppError(() => login(db, a.user.email!, "wrong-password"), "UNAUTHORIZED");
    const s = login(db, a.user.email!, "Password123!");
    expect(s.user.id).toBe(a.user.id);
  });

  it("تطبيع الأرقام الدولية", () => {
    expect(normalizePhone("+966 50 123 4567")).toBe("+966501234567");
    expect(normalizePhone("00966501234567")).toBe("+966501234567");
    expect(normalizePhone("0501234567")).toBeNull(); // صيغة محلية بلا مفتاح دولة مرفوضة
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("قبول التفويض المعلق", () => {
  it("مفوّض بالهاتف يُربط عند تسجيله", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    createDelegation(a.ctx, ev.id, { invitee_name: "مفوّض لاحق", invitee_phone: "+966555555555", quota: 5 });
    const d = makeUser(db, "late");
    db.run("UPDATE users SET phone = '+966555555555' WHERE id = ?", d.user.id);
    const claimed = claimPendingDelegations(db, d.user.id, "+966555555555", d.user.email);
    expect(claimed).toBe(1);
    const del = db.get<any>("SELECT * FROM delegations WHERE invitee_phone = '+966555555555'");
    expect(del.user_id).toBe(d.user.id);
    expect(del.status).toBe("active");
    const member = db.get("SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ?", a.orgId, d.user.id);
    expect(member).toBeTruthy();
  });
});
