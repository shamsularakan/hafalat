/** AC-02 / AC-03 / AC-11: الحصص الذرّية، سياسة الإلغاء، ومنع تكرار الحرق عند إعادة المحاولة */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeDelegate, expectAppError, upgradePlan } from "./helpers";
import { issueInvitation, cancelInvitation } from "@/server/services/invitations";
import { createDelegation, reallocateQuota, updateDelegation, getLedger } from "@/server/services/delegations";
import { updateEvent } from "@/server/services/events";

describe("AC-02 منع تجاوز الحصة حتى مع طلبين متوازيين", () => {
  it("مفوّض بحد 50 لا يصدر الدعوة 51", async () => {
    const { db, a } = setup();
    upgradePlan(db, a.orgId, "pro");
    const ev = publishedEvent(a.ctx, { capacity: 200 });
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 50 });
    const guests = addGuests(a.ctx, ev.id, 52);
    for (let i = 0; i < 49; i++) {
      issueInvitation(d.ctx, ev.id, { guest_id: guests[i].id });
    }
    // طلبان متوازيان على الحافة: المتبقي وحدة واحدة فقط
    const results = await Promise.allSettled([
      (async () => { await new Promise((r) => setImmediate(r)); return issueInvitation(d.ctx, ev.id, { guest_id: guests[49].id }); })(),
      (async () => { await new Promise((r) => setImmediate(r)); return issueInvitation(d.ctx, ev.id, { guest_id: guests[50].id }); })(),
    ]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(okCount).toBe(1);
    expect(failed.reason.code).toBe("QUOTA_EXCEEDED");
    const fresh = db.get<any>("SELECT * FROM delegations WHERE id = ?", d.delegation.id);
    expect(fresh.quota_used).toBe(50);
    const invCount = db.get<any>("SELECT COUNT(*) n FROM invitations WHERE event_id = ? AND status != 'draft'", ev.id).n;
    expect(invCount).toBe(50); // 49 + واحد فقط من الطلبين
  });

  it("وحدة الأشخاص: الحصة تُحجز بعدد المرافقين المسموح", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { quota_unit: "person", capacity: 100 });
    const group = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id);
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 10 });
    const guests = addGuests(a.ctx, ev.id, 3);
    db.run("UPDATE guests SET group_id = ? WHERE event_id = ?", group.id, ev.id);
    issueInvitation(d.ctx, ev.id, { guest_id: guests[0].id }); // 1 + 5 مرافقين = 6
    expect(db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id).quota_used).toBe(6);
    expectAppError(() => issueInvitation(d.ctx, ev.id, { guest_id: guests[1].id }), "QUOTA_EXCEEDED"); // 6 > 4 متبقي
  });

  it("سعة المناسبة سقف عام فوق الحصص", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { capacity: 2 });
    const guests = addGuests(a.ctx, ev.id, 3);
    issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id });
    issueInvitation(a.ctx, ev.id, { guest_id: guests[1].id });
    expectAppError(() => issueInvitation(a.ctx, ev.id, { guest_id: guests[2].id }), "CAPACITY_EXCEEDED");
  });

  it("الحصة لا تُوزع فوق غير الموزع من السعة", () => {
    const { db, a } = setup();
    upgradePlan(db, a.orgId, "basic");
    const ev = publishedEvent(a.ctx, { capacity: 10 });
    makeDelegate(db, a.ctx, ev.id, { quota: 8 });
    expectAppError(() => makeDelegate(db, a.ctx, ev.id, { quota: 5 }), "QUOTA_EXCEEDED");
  });
});

describe("AC-03 سياسة إلغاء الدعوة", () => {
  it("الإلغاء يعيد الحصة عندما السياسة = إرجاع، ويوثق في السجل", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { cancel_returns_quota: true });
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(d.ctx, ev.id, { guest_id: g.id });
    expect(db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id).quota_used).toBe(1);
    const res = cancelInvitation(a.ctx, issued.invitation_id, "اعتذار");
    expect(res.quota_returned).toBe(true);
    expect(db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id).quota_used).toBe(0);
    const ledger = getLedger(a.ctx, ev.id, d.delegation.id);
    expect(ledger.some((l: any) => l.reason === "cancel_return" && l.delta === 1)).toBe(true);
  });

  it("الإلغاء يبقي الحصة مستهلكة عندما السياسة = عدم إرجاع", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { cancel_returns_quota: false });
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(d.ctx, ev.id, { guest_id: g.id });
    cancelInvitation(a.ctx, issued.invitation_id, "تجربة");
    expect(db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id).quota_used).toBe(1);
    const ledger = getLedger(a.ctx, ev.id, d.delegation.id);
    expect(ledger.some((l: any) => l.reason === "cancel_burn" && l.delta === 0)).toBe(true);
  });

  it("وحدة الحصة تُقفل بعد أول إصدار", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    expectAppError(() => updateEvent(a.ctx, ev.id, { quota_unit: "person" }), "UNIT_LOCKED");
  });
});

describe("AC-11 إعادة المحاولة لا تحرق الحصة مرتين", () => {
  it("نفس idempotency key يعيد نفس الدعوة", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const r1 = issueInvitation(d.ctx, ev.id, { guest_id: g.id, idempotency_key: "key-1" });
    const r2 = issueInvitation(d.ctx, ev.id, { guest_id: g.id, idempotency_key: "key-1" });
    expect(r2.invitation_id).toBe(r1.invitation_id);
    expect(db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id).quota_used).toBe(1);
    const issues = db.get<any>("SELECT COUNT(*) n FROM quota_ledger WHERE delegation_id = ? AND reason = 'issue'", d.delegation.id).n;
    expect(issues).toBe(1);
  });
});

describe("إعادة التخصيص والإيقاف", () => {
  it("نقل رصيد غير مستخدم بسبب موثق", () => {
    const { db, a } = setup();
    upgradePlan(db, a.orgId, "basic");
    const ev = publishedEvent(a.ctx, { capacity: 50 });
    const d1 = makeDelegate(db, a.ctx, ev.id, { quota: 20 });
    const d2 = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    issueInvitation(d1.ctx, ev.id, { guest_id: g.id });
    reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 10, "دعم فريق البوابة");
    expect(db.get<any>("SELECT quota_allocated FROM delegations WHERE id = ?", d1.delegation.id).quota_allocated).toBe(10);
    expect(db.get<any>("SELECT quota_allocated FROM delegations WHERE id = ?", d2.delegation.id).quota_allocated).toBe(15);
    expectAppError(() => reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 10, "x"), "QUOTA_EXCEEDED"); // used=1, remaining=9
    expectAppError(() => reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 1, ""), "VALIDATION");
  });

  it("إيقاف المفوّض يمنع الإصدار الجديد ويبقي الدعوات الصادرة", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    const guests = addGuests(a.ctx, ev.id, 2);
    const issued = issueInvitation(d.ctx, ev.id, { guest_id: guests[0].id });
    updateDelegation(a.ctx, d.delegation.id, { status: "suspended", suspended_policy: "keep" });
    expectAppError(() => issueInvitation(d.ctx, ev.id, { guest_id: guests[1].id }), "FORBIDDEN");
    const inv = db.get<any>("SELECT status FROM invitations WHERE id = ?", issued.invitation_id);
    expect(["issued", "delivered", "seen"]).toContain(inv.status);
  });

  it("المفوّض لا يستطيع تعديل حصته بنفسه", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const d = makeDelegate(db, a.ctx, ev.id, { quota: 5 });
    expectAppError(() => updateDelegation(d.ctx, d.delegation.id, { quota: 500 }), "FORBIDDEN");
  });
});
