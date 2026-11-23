/** AC-05 / AC-12: إسناد الداعي الأصلي، ومطابقة الأرقام للسجلات الفعلية */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeDelegate, upgradePlan } from "./helpers";
import { issueInvitation } from "@/server/services/invitations";
import { transferGuest } from "@/server/services/guests";
import { eventAnalytics, exportReport } from "@/server/services/reports";
import { submitRsvp } from "@/server/services/rsvp";
import { scanCheckin } from "@/server/services/checkins";

describe("AC-05 الداعي الأصلي محفوظ ويظهر في التقرير", async () => {
  it("نقل الضيف بين مفوّضين يبقي الإسناد الأصلي", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "basic"));
    const ev = (await publishedEvent(a.ctx, { capacity: 50 }));
    const d1 = (await makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "المفوّض الأول" }));
    const d2 = (await makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "المفوّض الثاني" }));
    const g = (await addGuests(d1.ctx, ev.id, 1))[0];
    (await issueInvitation(d1.ctx, ev.id, { guest_id: g.id }));
    (await transferGuest(a.ctx, g.id, d2.delegation.id));
    const guest = (await db.get<any>("SELECT * FROM guests WHERE id = ?", g.id));
    expect(guest.inviter_id).toBe(d2.delegation.id);
    expect(guest.original_inviter_id).toBe(d1.delegation.id);
    // الدعوة تبقى مسندة لمصدرها الأصلي
    const inv = (await db.get<any>("SELECT delegation_id FROM invitations WHERE guest_id = ?", g.id));
    expect(inv.delegation_id).toBe(d1.delegation.id);
    const csv = (await exportReport(a.ctx, ev.id, "guests"));
    expect(csv).toContain("المفوّض الأول");
    expect(csv).toContain("المفوّض الثاني");
    const analytics = (await eventAnalytics(a.ctx, ev.id));
    const row = analytics.per_delegate.find((r: any) => r.id === d1.delegation.id);
    expect(row!.issued).toBe(1);
  });
});

describe("AC-12 مجموع الحالات يطابق سجلات RSVP", async () => {
  it("مؤكد + معتذر + منتظر + داخل + لم يحضر = الصادر", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { capacity: 50 }));
    const guests = (await addGuests(a.ctx, ev.id, 5));
    const tokens = await Promise.all(guests.map(async (g) => (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }))));
    (await submitRsvp(db, tokens[0].token, { answer: "confirmed", persons: 1 }));
    (await submitRsvp(db, tokens[1].token, { answer: "confirmed", persons: 1 }));
    (await submitRsvp(db, tokens[2].token, { answer: "declined" }));
    (await scanCheckin(a.ctx, { token: tokens[0].token })); // مؤكد → تم الدخول
    // tokens[3], tokens[4] بانتظار الرد
    const an = (await eventAnalytics(a.ctx, ev.id));
    expect(an.totals.issued).toBe(5);
    expect(an.totals.confirmed).toBe(1); // واحد مؤكد لم يدخل بعد
    expect(an.totals.declined).toBe(1);
    expect(an.totals.checked_in_cards).toBe(1);
    expect(an.totals.pending).toBe(2);
    expect(an.consistency.ok).toBe(true);
    expect(an.totals.actual_persons).toBe(1);
    // مطابقة مباشرة مع جدول rsvps (آخر رد لكل دعوة)
    const latest = (await db.all<any>(
      `SELECT invitation_id, answer FROM rsvps r WHERE occurred_at = (SELECT MAX(occurred_at) FROM rsvps r2 WHERE r2.invitation_id = r.invitation_id)`
    ));
    expect(latest.filter((r) => r.answer === "confirmed").length).toBe(2);
    expect(latest.filter((r) => r.answer === "declined").length).toBe(1);
  });

  it("تصدير الملخص يحتوي الأرقام المطابقة", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const t = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    (await submitRsvp(db, t.token, { answer: "confirmed", persons: 1 }));
    const csv = (await exportReport(a.ctx, ev.id, "summary"));
    expect(csv).toContain("مؤكد");
    expect(csv).toContain("حفل تجريبي");
  });
});
