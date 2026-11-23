/** AC-09 / AC-10: منع الدخول المكرر، ونطاق موظف البوابة */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeReceptionist, expectAppErrorAsync, upgradePlan } from "./helpers";
import { issueInvitation, cancelInvitation } from "@/server/services/invitations";
import { scanCheckin, manualCheckin, liveBoard } from "@/server/services/checkins";
import { submitRsvp } from "@/server/services/rsvp";
import { newId } from "@/lib/db";

describe("AC-09 QR الملغى/المستخدم لا يسجل دخولًا مكررًا", async () => {
  it("مسح ناجح ثم إعادة مسح مرفوضة عند منع الإعادة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const gate = (await db.get<any>("SELECT id FROM gates WHERE event_id = ?", ev.id));
    const r = (await makeReceptionist(db, a.ctx, ev.id, [gate.id]));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    const first = (await scanCheckin(r.ctx, { token: issued.token, gate_id: gate.id }));
    expect(first.ok).toBe(true);
    expect(first.result).toBe("checked_in");
    const second = (await scanCheckin(r.ctx, { token: issued.token, gate_id: gate.id }));
    expect(second.ok).toBe(false);
    expect(second.code).toBe("REENTRY_DENIED");
    expect((await db.get<any>("SELECT COUNT(*) n FROM checkins WHERE invitation_id = ?", issued.invitation_id)).n).toBe(1);
  });

  it("السماح بإعادة الدخول عند الإعداد الصريح", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { allow_reentry: true }));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    (await scanCheckin(a.ctx, { token: issued.token }));
    const second = (await scanCheckin(a.ctx, { token: issued.token }));
    expect(second.ok).toBe(true);
    expect(second.result).toBe("reentry");
    expect((await db.get<any>("SELECT MAX(is_reentry) m FROM checkins WHERE invitation_id = ?", issued.invitation_id)).m).toBe(1);
  });

  it("الدعوة الملغاة مرفوضة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    (await cancelInvitation(a.ctx, issued.invitation_id, "تجربة"));
    const res = (await scanCheckin(a.ctx, { token: issued.token }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("INVALID_TOKEN");
  });

  it("رمز غير صالح مرفوض", async () => {
    const { a } = (await setup());
    const res = (await scanCheckin(a.ctx, { token: "y".repeat(43) }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("INVALID_TOKEN");
  });

  it("السعة تمنع إصدار دعوة تتجاوزها", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { capacity: 1 }));
    const guests = (await addGuests(a.ctx, ev.id, 2));
    (await issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id }));
    await expectAppErrorAsync(async () => (await issueInvitation(a.ctx, ev.id, { guest_id: guests[1].id })), "CAPACITY_EXCEEDED");
  });

  it("تجاوز السعة عند المسح مرفوض، والتجاوز اليدوي المبرر موثق", async () => {
    const { db, a } = (await setup());
    // وحدة أشخاص + إعادة دخول: الدخول الثاني يضاعف الأشخاص ويتجاوز السعة
    const ev = (await publishedEvent(a.ctx, { capacity: 10, quota_unit: "person", allow_reentry: true }));
    const group = (await db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id)); // max 5 → حجز 6
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    (await db.run("UPDATE guests SET group_id = ? WHERE id = ?", group.id, g.id));
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    const first = (await scanCheckin(a.ctx, { token: issued.token, persons: 6 }));
    expect(first.ok).toBe(true);
    const second = (await scanCheckin(a.ctx, { token: issued.token, persons: 6 }));
    expect(second.ok).toBe(false);
    expect(second.code).toBe("CAPACITY_EXCEEDED");
    const override = (await manualCheckin(a.ctx, { token: issued.token, persons: 6, reason: "استثناء معتمد من المالك", override: true }));
    expect(override.ok).toBe(true);
    const audit = (await db.get<any>("SELECT * FROM audit_logs WHERE action = 'checkin.manual' ORDER BY created_at DESC LIMIT 1"));
    expect(audit.detail_json).toContain("استثناء");
  });

  it("إجراء يدوي مبرر لدعوة معتذر عنها مع تدقيق", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    (await submitRsvp(db, issued.token, { answer: "declined" }));
    const denied = (await scanCheckin(a.ctx, { token: issued.token }));
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("DECLINED_INVITATION");
    const manual = (await manualCheckin(a.ctx, { token: issued.token, reason: "حضر رغم الاعتذار — موافقة المالك", override: true }));
    expect(manual.ok).toBe(true);
    expect(manual.override).toBe(true);
    const audit = (await db.get<any>("SELECT * FROM audit_logs WHERE action = 'checkin.manual' ORDER BY created_at DESC LIMIT 1"));
    expect(audit).toBeTruthy();
    await expectAppErrorAsync(async () => (await manualCheckin(a.ctx, { token: issued.token, reason: "", override: true })), "VALIDATION");
  });
});

describe("AC-10 موظف البوابة ضمن نطاق تكليفه فقط", async () => {
  it("بوابة خارج التكليف مرفوضة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const gate1 = (await db.get<any>("SELECT id FROM gates WHERE event_id = ?", ev.id));
    const gate2Id = newId();
    (await db.run("INSERT INTO gates (id, event_id, organization_id, name) VALUES (?,?,?,'بوابة ثانية')", gate2Id, ev.id, a.orgId));
    const r = (await makeReceptionist(db, a.ctx, ev.id, [gate1.id]));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    await expectAppErrorAsync(async () => (await scanCheckin(r.ctx, { token: issued.token, gate_id: gate2Id })), "FORBIDDEN");
    const ok = (await scanCheckin(r.ctx, { token: issued.token, gate_id: gate1.id }));
    expect(ok.ok).toBe(true);
  });

  it("موظف استقبال لا يصل لمناسبة أخرى ولا لقوائم الضيوف", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "basic"));
    const ev1 = (await publishedEvent(a.ctx));
    const ev2 = (await publishedEvent(a.ctx, { title: "مناسبة ثانية" }));
    const r = (await makeReceptionist(db, a.ctx, ev1.id));
    const g = (await addGuests(a.ctx, ev2.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev2.id, { guest_id: g.id }));
    await expectAppErrorAsync(async () => (await scanCheckin(r.ctx, { token: issued.token })), "FORBIDDEN");
    await expectAppErrorAsync(async () => (await liveBoard(r.ctx, ev2.id)), "FORBIDDEN");
    // لوحة مناسبته تعمل
    const board = (await liveBoard(r.ctx, ev1.id));
    expect(board.event.id).toBe(ev1.id);
  });
});
