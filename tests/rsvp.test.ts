/** AC-04 / AC-07: حدود المرافقين، وسلامة الروابط المجهولة/المنتهية */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, expectAppError } from "./helpers";
import { issueInvitation, cancelInvitation } from "@/server/services/invitations";
import { getGuestPage, submitRsvp } from "@/server/services/rsvp";
import { nowIso } from "@/lib/db";

describe("AC-04 الضيف لا يتجاوز المرافقين ولا يعدل دعوة غيره", () => {
  it("عدد الحضور محكوم بـ 1 + المسموح", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const group = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id); // companion_max=5
    const g = addGuests(a.ctx, ev.id, 1)[0];
    db.run("UPDATE guests SET group_id = ? WHERE id = ?", group.id, g.id);
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    expectAppError(() => submitRsvp(db, issued.token, { answer: "confirmed", persons: 7 }), "VALIDATION");
    const res = submitRsvp(db, issued.token, { answer: "confirmed", persons: 6 });
    expect(res.persons_confirmed).toBe(6);
    expect(db.get<any>("SELECT status FROM invitations WHERE id = ?", issued.invitation_id).status).toBe("confirmed");
  });

  it("الاعتذار يسجل صفر أشخاص", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    submitRsvp(db, issued.token, { answer: "declined" });
    const r = db.get<any>("SELECT * FROM rsvps WHERE invitation_id = ? ORDER BY occurred_at DESC LIMIT 1", issued.invitation_id);
    expect(r.answer).toBe("declined");
    expect(r.persons_confirmed).toBe(0);
  });

  it("رمز دعوة لا يعدل دعوة أخرى — النطاق بالرمز فقط", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const guests = addGuests(a.ctx, ev.id, 2);
    const i1 = issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id });
    const i2 = issueInvitation(a.ctx, ev.id, { guest_id: guests[1].id });
    submitRsvp(db, i1.token, { answer: "confirmed", persons: 1 });
    expect(db.get<any>("SELECT status FROM invitations WHERE id = ?", i2.invitation_id).status).not.toBe("confirmed");
    const page = getGuestPage(db, i2.token);
    expect(page.guest_name).toBe(guests[1].name);
    expect((page as any).guests).toBeUndefined();
    expect((page as any).guest_phone).toBeUndefined();
  });

  it("أول فتح يسجل «شوهدت»", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    getGuestPage(db, issued.token);
    expect(db.get<any>("SELECT status, seen_at FROM invitations WHERE id = ?", issued.invitation_id).status).toBe("seen");
  });
});

describe("AC-07 الرابط المجهول/المنتهي لا يعرض بيانات حساسة", () => {
  it("رمز مجهول → INVALID_TOKEN بلا بيانات", () => {
    const { db } = setup();
    const e = expectAppError(() => getGuestPage(db, "x".repeat(43)), "INVALID_TOKEN");
    expect(e.details ?? null).toBeNull();
  });

  it("دعوة ملغاة → EXPIRED", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    cancelInvitation(a.ctx, issued.invitation_id, "تجربة");
    expectAppError(() => getGuestPage(db, issued.token), "EXPIRED");
    expectAppError(() => submitRsvp(db, issued.token, { answer: "confirmed" }), "EXPIRED");
  });

  it("دعوة منتهية الصلاحية → EXPIRED", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    db.run("UPDATE invitations SET expires_at = ? WHERE id = ?", new Date(Date.now() - 1000).toISOString(), issued.invitation_id);
    expectAppError(() => getGuestPage(db, issued.token), "EXPIRED");
  });

  it("انتهاء فترة RSVP يمنع الرد", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx, { rsvp_deadline: new Date(Date.now() - 1000).toISOString() });
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    expectAppError(() => submitRsvp(db, issued.token, { answer: "confirmed" }), "EVENT_CLOSED");
  });
});
