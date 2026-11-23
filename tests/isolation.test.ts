/** AC-01: عزل بيانات المؤسسات — لا يرى مستخدم من مؤسسة أية مناسبة لمؤسسة أخرى حتى بتغيير معرّف الرابط */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, makeDelegate, expectAppErrorAsync, upgradePlan } from "./helpers";
import { getEvent, listEvents, updateEvent } from "@/server/services/events";
import { listGuests, updateGuest } from "@/server/services/guests";
import { issueInvitation, getInvitation, listInvitations } from "@/server/services/invitations";
import { eventAnalytics } from "@/server/services/reports";
import { scanCheckin } from "@/server/services/checkins";
import { loadEventScoped } from "@/lib/permissions";

describe("AC-01 عزل المستأجرين", async () => {
  it("لا يرى مستخدم مؤسسة B مناسبة مؤسسة A بأي مسار", async () => {
    const { db, a, b } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const guests = (await addGuests(a.ctx, ev.id, 2));
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: guests[0].id }));

    // تغيير معرّف الرابط مباشرة
    await expectAppErrorAsync(async () => (await getEvent(b.ctx, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await updateEvent(b.ctx, ev.id, { title: "اختراق" })), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await loadEventScoped(db, b.orgId, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await listGuests(b.ctx, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await listInvitations(b.ctx, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await eventAnalytics(b.ctx, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await getInvitation(b.ctx, issued.invitation_id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await updateGuest(b.ctx, guests[0].id, { name: "اختراق" })), "NOT_FOUND");

    // القوائم لا تسرب
    expect((await listEvents(b.ctx)).map((e: any) => e.id)).not.toContain(ev.id);

    // مسح رمز دعوة مؤسسة أخرى مرفوض
    const res = (await scanCheckin(b.ctx, { token: issued.token }));
    expect(res.ok).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("المفوّض لا يرى ضيوف مفوّض آخر افتراضيًا", async () => {
    const { db, a } = (await setup());
    (await upgradePlan(db, a.orgId, "basic"));
    const ev = (await publishedEvent(a.ctx));
    const d1 = (await makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "مفوّض 1" }));
    const d2 = (await makeDelegate(db, a.ctx, ev.id, { quota: 10, name: "مفوّض 2" }));
    const g1 = (await addGuests(d1.ctx, ev.id, 1, "ضيف الأول"))[0];
    (await addGuests(d2.ctx, ev.id, 1, "ضيف الثاني"));
    const visible = (await listGuests(d1.ctx, ev.id));
    expect(visible.map((g: any) => g.id)).toContain(g1.id);
    expect(visible.length).toBe(1);
    await expectAppErrorAsync(async () => (await updateGuest(d1.ctx, (await listGuests(d2.ctx, ev.id))[0].id, { name: "x" })), "FORBIDDEN");
  });
});
