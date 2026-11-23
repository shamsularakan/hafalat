/** AC-02 / AC-03 / AC-11: الحصص الذرّية، سياسة الإلغاء، ومنع تكرار الحرق عند إعادة المحاولة */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeDelegate, expectAppErrorAsync, upgradePlan } from "./helpers";
import { issueInvitation, cancelInvitation } from "@/server/services/invitations";
import { createDelegation, reallocateQuota, updateDelegation, getLedger } from "@/server/services/delegations";
import { updateEvent } from "@/server/services/events";

describe("AC-02 منع تجاوز الحصة حتى مع طلبين متوازيين", async () => {
  it("مفوّض بحد 50 لا يصدر الدعوة 51", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "pro"));
    const ev = (await publishedEvent(a.ctx, { capacity: 200 }));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 50 }));
    const guests = (await addGuests(a.ctx, ev.id, 52));
    for (let i = 0; i < 49; i++) {
      (await issueInvitation(d.ctx, ev.id, { guest_id: guests[i].id }));
    }
    // طلبان متوازيان على الحافة: المتبقي وحدة واحدة فقط
    const results = await Promise.allSettled([
      (async () => { await new Promise((r) => setImmediate(r)); return (await issueInvitation(d.ctx, ev.id, { guest_id: guests[49].id })); })(),
      (async () => { await new Promise((r) => setImmediate(r)); return (await issueInvitation(d.ctx, ev.id, { guest_id: guests[50].id })); })(),
    ]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(okCount).toBe(1);
    expect(failed.reason.code).toBe("QUOTA_EXCEEDED");
    const fresh = (await db.get<any>("SELECT * FROM delegations WHERE id = ?", d.delegation.id));
    expect(fresh.quota_used).toBe(50);
    const invCount = (await db.get<any>("SELECT COUNT(*) n FROM invitations WHERE event_id = ? AND status != 'draft'", ev.id)).n;
    expect(invCount).toBe(50); // 49 + واحد فقط من الطلبين
  });

  it("وحدة الأشخاص: الحصة تُحجز بعدد المرافقين المسموح", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { quota_unit: "person", capacity: 100 }));
    const group = (await db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 10 }));
    const guests = (await addGuests(a.ctx, ev.id, 3));
    (await db.run("UPDATE guests SET group_id = ? WHERE event_id = ?", group.id, ev.id));
    (await issueInvitation(d.ctx, ev.id, { guest_id: guests[0].id })); // 1 + 5 مرافقين = 6
    expect((await db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id)).quota_used).toBe(6);
    await expectAppErrorAsync(async () => (await issueInvitation(d.ctx, ev.id, { guest_id: guests[1].id })), "QUOTA_EXCEEDED"); // 6 > 4 متبقي
  });

  it("سعة المناسبة سقف عام فوق الحصص", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { capacity: 2 }));
    const guests = (await addGuests(a.ctx, ev.id, 3));
    (await issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id }));
    (await issueInvitation(a.ctx, ev.id, { guest_id: guests[1].id }));
    await expectAppErrorAsync(async () => (await issueInvitation(a.ctx, ev.id, { guest_id: guests[2].id })), "CAPACITY_EXCEEDED");
  });

  it("الحصة لا تُوزع فوق غير الموزع من السعة", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "basic"));
    const ev = (await publishedEvent(a.ctx, { capacity: 10 }));
    (await makeDelegate(db, a.ctx, ev.id, { quota: 8 }));
    await expectAppErrorAsync(async () => (await makeDelegate(db, a.ctx, ev.id, { quota: 5 })), "QUOTA_EXCEEDED");
  });
});

describe("AC-03 سياسة إلغاء الدعوة", async () => {
  it("الإلغاء يعيد الحصة عندما السياسة = إرجاع، ويوثق في السجل", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { cancel_returns_quota: true }));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(d.ctx, ev.id, { guest_id: g.id }));
    expect((await db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id)).quota_used).toBe(1);
    const res = (await cancelInvitation(a.ctx, issued.invitation_id, "اعتذار"));
    expect(res.quota_returned).toBe(true);
    expect((await db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id)).quota_used).toBe(0);
    const ledger = (await getLedger(a.ctx, ev.id, d.delegation.id));
    expect(ledger.some((l: any) => l.reason === "cancel_return" && l.delta === 1)).toBe(true);
  });

  it("الإلغاء يبقي الحصة مستهلكة عندما السياسة = عدم إرجاع", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { cancel_returns_quota: false }));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(d.ctx, ev.id, { guest_id: g.id }));
    (await cancelInvitation(a.ctx, issued.invitation_id, "تجربة"));
    expect((await db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id)).quota_used).toBe(1);
    const ledger = (await getLedger(a.ctx, ev.id, d.delegation.id));
    expect(ledger.some((l: any) => l.reason === "cancel_burn" && l.delta === 0)).toBe(true);
  });

  it("وحدة الحصة تُقفل بعد أول إصدار", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    await expectAppErrorAsync(async () => (await updateEvent(a.ctx, ev.id, { quota_unit: "person" })), "UNIT_LOCKED");
  });
});

describe("AC-11 إعادة المحاولة لا تحرق الحصة مرتين", async () => {
  it("نفس idempotency key يعيد نفس الدعوة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const r1 = (await issueInvitation(d.ctx, ev.id, { guest_id: g.id, idempotency_key: "key-1" }));
    const r2 = (await issueInvitation(d.ctx, ev.id, { guest_id: g.id, idempotency_key: "key-1" }));
    expect(r2.invitation_id).toBe(r1.invitation_id);
    expect((await db.get<any>("SELECT quota_used FROM delegations WHERE id = ?", d.delegation.id)).quota_used).toBe(1);
    const issues = (await db.get<any>("SELECT COUNT(*) n FROM quota_ledger WHERE delegation_id = ? AND reason = 'issue'", d.delegation.id)).n;
    expect(issues).toBe(1);
  });
});

describe("إعادة التخصيص والإيقاف", async () => {
  it("نقل رصيد غير مستخدم بسبب موثق", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "basic"));
    const ev = (await publishedEvent(a.ctx, { capacity: 50 }));
    const d1 = (await makeDelegate(db, a.ctx, ev.id, { quota: 20 }));
    const d2 = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    (await issueInvitation(d1.ctx, ev.id, { guest_id: g.id }));
    (await reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 10, "دعم فريق البوابة"));
    expect((await db.get<any>("SELECT quota_allocated FROM delegations WHERE id = ?", d1.delegation.id)).quota_allocated).toBe(10);
    expect((await db.get<any>("SELECT quota_allocated FROM delegations WHERE id = ?", d2.delegation.id)).quota_allocated).toBe(15);
    await expectAppErrorAsync(async () => (await reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 10, "x")), "QUOTA_EXCEEDED"); // used=1, remaining=9
    await expectAppErrorAsync(async () => (await reallocateQuota(a.ctx, d1.delegation.id, d2.delegation.id, 1, "")), "VALIDATION");
  });

  it("إيقاف المفوّض يمنع الإصدار الجديد ويبقي الدعوات الصادرة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    const guests = (await addGuests(a.ctx, ev.id, 2));
    const issued = (await issueInvitation(d.ctx, ev.id, { guest_id: guests[0].id }));
    (await updateDelegation(a.ctx, d.delegation.id, { status: "suspended", suspended_policy: "keep" }));
    await expectAppErrorAsync(async () => (await issueInvitation(d.ctx, ev.id, { guest_id: guests[1].id })), "FORBIDDEN");
    const inv = (await db.get<any>("SELECT status FROM invitations WHERE id = ?", issued.invitation_id));
    expect(["issued", "delivered", "seen"]).toContain(inv.status);
  });

  it("المفوّض لا يستطيع تعديل حصته بنفسه", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const d = (await makeDelegate(db, a.ctx, ev.id, { quota: 5 }));
    await expectAppErrorAsync(async () => (await updateDelegation(d.ctx, d.delegation.id, { quota: 500 })), "FORBIDDEN");
  });
});
