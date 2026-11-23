/** الفزعة وبطاقات الشكر، و«دعواتي/فزعاتي» مع إثبات ملكية الرقم */
import { describe, it, expect } from "vitest";
import { setup, ctxFor, publishedEvent, expectAppErrorAsync } from "./helpers";
import { registerUser } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { transitionEvent } from "@/server/services/events";
import { createGuest } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import {
  saveHelper, listHelpers, removeHelper, markHelperSent, getHelperPage, respondHelper,
  issueThanksAsOwner, myHelping, myInvitations, verifyByInvitationToken,
} from "@/server/services/helpers";

async function phoneUser(db: any, phone: string, name = "صاحب الرقم") {
  const { user, orgId } = await registerUser(db, { name, phone, password: "Password123!", orgName: `مساحة ${name}` });
  return { user, ctx: await ctxFor(db, user, orgId) };
}

describe("الفزعة", async () => {
  it("يضيف صاحب المناسبة الفزعة بالاسم والجوال والمهمة، ويمنع التكرار والرقم غير الصالح", async () => {
    const { a, b } = await setup();
    const ev = await publishedEvent(a.ctx);
    const h: any = await saveHelper(a.ctx, ev.id, { name: "محمد العتيبي", phone: "0501234567".replace(/^0/, "+966"), task: "الاستقبال" });
    expect(h.link_code).toMatch(/^[0-9A-Za-z]{8}$/);
    await expectAppErrorAsync(() => saveHelper(a.ctx, ev.id, { name: "مكرر", phone: "+966501234567" }), "DUPLICATE_ENTRY");
    await expectAppErrorAsync(() => saveHelper(a.ctx, ev.id, { name: "خطأ", phone: "123" }), "VALIDATION");
    const l = await listHelpers(a.ctx, ev.id);
    expect(l.helpers[0]).toMatchObject({ name: "محمد العتيبي", task: "الاستقبال", status: "invited" });
    expect(l.helpers[0].link).toContain(`/f/${h.link_code}`);
    expect((l.helpers[0] as any).phone_hash).toBeUndefined();
    await markHelperSent(a.ctx, ev.id, h.id, "request");
    expect((await listHelpers(a.ctx, ev.id)).helpers[0].request_sent_at).toBeTruthy();
    await expectAppErrorAsync(() => listHelpers(b.ctx, ev.id), "NOT_FOUND");
    await removeHelper(a.ctx, ev.id, h.id);
    expect((await listHelpers(a.ctx, ev.id)).helpers.length).toBe(0);
  });

  it("الرابط العام يعرض الطلب ويقبل الرد بلا حساب", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx, { venue_name: "قاعة المعالي" });
    const h: any = await saveHelper(a.ctx, ev.id, { name: "سعد", phone: "+966501112233", task: "القهوة والضيافة" });
    const page: any = await getHelperPage(a.ctx.db, h.link_code);
    expect(page).toMatchObject({ name: "سعد", task: "القهوة والضيافة", status: "invited", thanks: null });
    expect(page.event.venue_name).toBe("قاعة المعالي");
    expect(await respondHelper(a.ctx.db, h.link_code, true)).toEqual({ status: "accepted" });
    await expectAppErrorAsync(() => getHelperPage(a.ctx.db, "ZZZZZZZZ"), "INVALID_TOKEN");
    await expectAppErrorAsync(() => getHelperPage(a.ctx.db, "../etc"), "INVALID_TOKEN");
  });
});

describe("بطاقات الشكر", async () => {
  it("تُصدر تلقائيًا عند انتهاء المناسبة لكل من لم يعتذر، وتظهر على رابطه", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx, { host_name: "آل العتيبي" });
    const yes: any = await saveHelper(a.ctx, ev.id, { name: "فهد", phone: "+966501000001" });
    const silent: any = await saveHelper(a.ctx, ev.id, { name: "نايف", phone: "+966501000002" });
    const no: any = await saveHelper(a.ctx, ev.id, { name: "خالد", phone: "+966501000003" });
    await respondHelper(a.ctx.db, yes.link_code, true);
    await respondHelper(a.ctx.db, no.link_code, false);
    await expectAppErrorAsync(() => issueThanksAsOwner(a.ctx, ev.id), "CONFLICT"); // قبل بداية المناسبة

    await transitionEvent(a.ctx, ev.id, "ongoing");
    await transitionEvent(a.ctx, ev.id, "ended");
    const l = await listHelpers(a.ctx, ev.id);
    const by = (id: string) => l.helpers.find((h: any) => h.id === id)!;
    expect(by(yes.id).thanked_at).toBeTruthy();
    expect(by(silent.id).thanked_at).toBeTruthy();
    expect(by(no.id).thanked_at).toBeNull();

    const page: any = await getHelperPage(a.ctx.db, yes.link_code);
    expect(page.thanks.message).toContain("فهد");
    expect(page.thanks.message).toContain("حفل تجريبي");
    expect(page.thanks.from).toBe("آل العتيبي");
    await expectAppErrorAsync(() => respondHelper(a.ctx.db, yes.link_code, false), "CONFLICT");
  });
});

describe("دعواتي وفزعاتي — بعد إثبات ملكية الرقم فقط", async () => {
  it("من سجّل برقم غيره لا يرى شيئًا، وصاحب الرقم يرى كل شيء بعد فتح رابطه", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const phone = "+966507770001";
    const g = await createGuest(a.ctx, ev.id, { name: "ضيف الرقم", phone, title: "سعادة الأستاذ" });
    const inv: any = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const h: any = await saveHelper(a.ctx, ev.id, { name: "ضيف الرقم", phone, task: "المواقف" });

    // حساب بالرقم نفسه: قبل الإثبات يرى العدد فقط
    const owner = await phoneUser(a.ctx.db, phone);
    let mi = await myInvitations(owner.ctx);
    expect(mi).toMatchObject({ verified: false, has_phone: true, pending_count: 1, invitations: [] });
    let mh = await myHelping(owner.ctx);
    expect(mh).toMatchObject({ verified: false, pending_count: 1, helping: [] });

    // شخص آخر يفتح رابط الدعوة وهو مسجّل برقم مختلف ← لا يوثّق شيئًا
    const stranger = await phoneUser(a.ctx.db, "+966507770002", "غريب");
    expect(await verifyByInvitationToken(a.ctx.db, stranger.user, hashToken(inv.token))).toBe(false);

    // صاحب الرقم يفتح دعوته ← يتوثّق رقمه وتظهر دعوته وفزعته
    expect(await verifyByInvitationToken(a.ctx.db, owner.user, hashToken(inv.token))).toBe(true);
    mi = await myInvitations(owner.ctx);
    expect(mi.verified).toBe(true);
    expect(mi.invitations.length).toBe(1);
    expect(mi.invitations[0]).toMatchObject({ guest_title: "سعادة الأستاذ", event: { title: "حفل تجريبي" } });
    expect(mi.invitations[0].url).toMatch(/\/d\/[0-9A-Za-z]{8}$/);
    mh = await myHelping(owner.ctx);
    expect(mh.helping.length).toBe(1);
    expect(mh.helping[0]).toMatchObject({ task: "المواقف", code: h.link_code });

    // فزعة جديدة لاحقًا تُربط مباشرة بالحساب الموثّق
    const ev2 = await publishedEvent(a.ctx).catch(() => null);
    if (ev2) {
      const h2: any = await saveHelper(a.ctx, ev2.id, { name: "ضيف الرقم", phone });
      expect(h2.user_id).toBe(owner.user.id);
    }
  });

  it("فتح رابط الفزعة وهو مسجّل الدخول بالرقم نفسه يوثّق الرقم أيضًا", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const phone = "+966507770003";
    const h: any = await saveHelper(a.ctx, ev.id, { name: "عبدالله", phone });
    const owner = await phoneUser(a.ctx.db, phone, "عبدالله");
    await getHelperPage(a.ctx.db, h.link_code, owner.user);
    const mh = await myHelping(owner.ctx);
    expect(mh.verified).toBe(true);
    expect(mh.helping.length).toBe(1);
    const row = await a.ctx.db.get<any>("SELECT user_id FROM event_helpers WHERE id = ?", h.id);
    expect(row.user_id).toBe(owner.user.id);
  });

  it("حساب بلا رقم جوال يطلب إضافة الرقم", async () => {
    const { a } = await setup();
    expect((await myInvitations(a.ctx)).has_phone).toBe(false);
    expect((await myHelping(a.ctx)).has_phone).toBe(false);
  });
});
