/** AC-09 / AC-10: منع الدخول المكرر، ونطاق موظف البوابة */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeReceptionist, expectAppError, upgradePlan } from "./helpers";
import { issueInvitation, cancelInvitation } from "@/server/services/invitations";
import { scanCheckin, manualCheckin, liveBoard } from "@/server/services/checkins";
import { submitRsvp } from "@/server/services/rsvp";
import { newId } from "@/lib/db";

describe("AC-09 QR الملغى/المستخدم لا يسجل دخولًا مكررًا", () => {
  it("مسح ناجح ثم إعادة مسح مرفوضة عند منع الإعادة", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const gate = db.get<any>("SELECT id FROM gates WHERE event_id = ?", ev.id);
    const r = makeReceptionist(db, a.ctx, ev.id, [gate.id]);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const first = scanCheckin(r.ctx, { token: issued.token, gate_id: gate.id });
    expect(first.ok).toBe(true);
    expect(first.result).toBe("checked_in");
    const second = scanCheckin(r.ctx, { token: issued.token, gate_id: gate.id });
    expect(second.ok).toBe(false);
    expect(second.code).toBe("REENTRY_DENIED");
    expect(db.get<any>("SELECT COUNT(*) n FROM checkins WHERE invitation_id = ?", issued.invitation_id).n).toBe(1);
  });

  it("السماح بإعادة الدخول عند الإعداد الصريح", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { allow_reentry: true });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    scanCheckin(a.ctx, { token: issued.token });
    const second = scanCheckin(a.ctx, { token: issued.token });
    expect(second.ok).toBe(true);
    expect(second.result).toBe("reentry");
    expect(db.get<any>("SELECT MAX(is_reentry) m FROM checkins WHERE invitation_id = ?", issued.invitation_id).m).toBe(1);
  });

  it("الدعوة الملغاة مرفوضة", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    cancelInvitation(a.ctx, issued.invitation_id, "تجربة");
    const res = scanCheckin(a.ctx, { token: issued.token });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("INVALID_TOKEN");
  });

  it("رمز غير صالح مرفوض", () => {
    const { a } = setup();
    const res = scanCheckin(a.ctx, { token: "y".repeat(43) });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("INVALID_TOKEN");
  });

  it("السعة تمنع إصدار دعوة تتجاوزها", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { capacity: 1 });
    const guests = addGuests(a.ctx, ev.id, 2);
    issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id });
    expectAppError(() => issueInvitation(a.ctx, ev.id, { guest_id: guests[1].id }), "CAPACITY_EXCEEDED");
  });

  it("تجاوز السعة عند المسح مرفوض، والتجاوز اليدوي المبرر موثق", () => {
    const { db, a } = setup();
    // وحدة أشخاص + إعادة دخول: الدخول الثاني يضاعف الأشخاص ويتجاوز السعة
    const ev = publishedEvent(a.ctx, { capacity: 10, quota_unit: "person", allow_reentry: true });
    const group = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id); // max 5 → حجز 6
    const g = addGuests(a.ctx, ev.id, 1)[0];
    db.run("UPDATE guests SET group_id = ? WHERE id = ?", group.id, g.id);
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const first = scanCheckin(a.ctx, { token: issued.token, persons: 6 });
    expect(first.ok).toBe(true);
    const second = scanCheckin(a.ctx, { token: issued.token, persons: 6 });
    expect(second.ok).toBe(false);
    expect(second.code).toBe("CAPACITY_EXCEEDED");
    const override = manualCheckin(a.ctx, { token: issued.token, persons: 6, reason: "استثناء معتمد من المالك", override: true });
    expect(override.ok).toBe(true);
    const audit = db.get<any>("SELECT * FROM audit_logs WHERE action = 'checkin.manual' ORDER BY created_at DESC LIMIT 1");
    expect(audit.detail_json).toContain("استثناء");
  });

  it("إجراء يدوي مبرر لدعوة معتذر عنها مع تدقيق", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    submitRsvp(db, issued.token, { answer: "declined" });
    const denied = scanCheckin(a.ctx, { token: issued.token });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("DECLINED_INVITATION");
    const manual = manualCheckin(a.ctx, { token: issued.token, reason: "حضر رغم الاعتذار — موافقة المالك", override: true });
    expect(manual.ok).toBe(true);
    expect(manual.override).toBe(true);
    const audit = db.get<any>("SELECT * FROM audit_logs WHERE action = 'checkin.manual' ORDER BY created_at DESC LIMIT 1");
    expect(audit).toBeTruthy();
    expectAppError(() => manualCheckin(a.ctx, { token: issued.token, reason: "", override: true }), "VALIDATION");
  });
});

describe("AC-10 موظف البوابة ضمن نطاق تكليفه فقط", () => {
  it("بوابة خارج التكليف مرفوضة", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const gate1 = db.get<any>("SELECT id FROM gates WHERE event_id = ?", ev.id);
    const gate2Id = newId();
    db.run("INSERT INTO gates (id, event_id, organization_id, name) VALUES (?,?,?,'بوابة ثانية')", gate2Id, ev.id, a.orgId);
    const r = makeReceptionist(db, a.ctx, ev.id, [gate1.id]);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    expectAppError(() => scanCheckin(r.ctx, { token: issued.token, gate_id: gate2Id }), "FORBIDDEN");
    const ok = scanCheckin(r.ctx, { token: issued.token, gate_id: gate1.id });
    expect(ok.ok).toBe(true);
  });

  it("موظف استقبال لا يصل لمناسبة أخرى ولا لقوائم الضيوف", () => {
    const { db, a } = setup();
    upgradePlan(db, a.orgId, "basic");
    const ev1 = publishedEvent(a.ctx);
    const ev2 = publishedEvent(a.ctx, { title: "مناسبة ثانية" });
    const r = makeReceptionist(db, a.ctx, ev1.id);
    const g = addGuests(a.ctx, ev2.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev2.id, { guest_id: g.id });
    expectAppError(() => scanCheckin(r.ctx, { token: issued.token }), "FORBIDDEN");
    expectAppError(() => liveBoard(r.ctx, ev2.id), "FORBIDDEN");
    // لوحة مناسبته تعمل
    const board = liveBoard(r.ctx, ev1.id);
    expect(board.event.id).toBe(ev1.id);
  });
});
