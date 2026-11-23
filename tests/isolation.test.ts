/** AC-01: عزل بيانات المؤسسات — لا يرى مستخدم من مؤسسة أية مناسبة لمؤسسة أخرى حتى بتغيير معرّف الرابط */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeDelegate, expectAppError, upgradePlan } from "./helpers";
import { getEvent, listEvents, updateEvent } from "@/server/services/events";
import { listGuests, updateGuest } from "@/server/services/guests";
import { issueInvitation, getInvitation, listInvitations } from "@/server/services/invitations";
import { eventAnalytics } from "@/server/services/reports";
import { scanCheckin } from "@/server/services/checkins";
import { loadEventScoped } from "@/lib/permissions";

describe("AC-01 عزل المستأجرين", () => {
  it("لا يرى مستخدم مؤسسة B مناسبة مؤسسة A بأي مسار", () => {
    const { db, a, b } = setup();
    const ev = publishedEvent(a.ctx);
    const guests = addGuests(a.ctx, ev.id, 2);
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id });

    // تغيير معرّف الرابط مباشرة
    expectAppError(() => getEvent(b.ctx, ev.id), "NOT_FOUND");
    expectAppError(() => updateEvent(b.ctx, ev.id, { title: "اختراق" }), "NOT_FOUND");
    expectAppError(() => loadEventScoped(db, b.orgId, ev.id), "NOT_FOUND");
    expectAppError(() => listGuests(b.ctx, ev.id), "NOT_FOUND");
    expectAppError(() => listInvitations(b.ctx, ev.id), "NOT_FOUND");
    expectAppError(() => eventAnalytics(b.ctx, ev.id), "NOT_FOUND");
    expectAppError(() => getInvitation(b.ctx, issued.invitation_id), "NOT_FOUND");
    expectAppError(() => updateGuest(b.ctx, guests[0].id, { name: "اختراق" }), "NOT_FOUND");

    // القوائم لا تسرب
    expect(listEvents(b.ctx).map((e: any) => e.id)).not.toContain(ev.id);

    // مسح رمز دعوة مؤسسة أخرى مرفوض
    const res = scanCheckin(b.ctx, { token: issued.token });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("المفوّض لا يرى ضيوف مفوّض آخر افتراضيًا", () => {
    const { db, a } = setup();
    upgradePlan(db, a.orgId, "basic");
    const ev = publishedEvent(a.ctx);
    const d1 = makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "مفوّض 1" });
    const d2 = makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "مفوّض 2" });
    const g1 = addGuests(d1.ctx, ev.id, 1, "ضيف الأول")[0];
    addGuests(d2.ctx, ev.id, 1, "ضيف الثاني");
    const visible = listGuests(d1.ctx, ev.id);
    expect(visible.map((g: any) => g.id)).toContain(g1.id);
    expect(visible.length).toBe(1);
    expectAppError(() => updateGuest(d1.ctx, listGuests(d2.ctx, ev.id)[0].id, { name: "x" }), "FORBIDDEN");
  });
});
