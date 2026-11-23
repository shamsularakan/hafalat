/** الدعوة الكاملة: لقب المدعو، بيانات القالب في صفحة الضيف، والتهاني يوم المناسبة */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, expectAppErrorAsync } from "./helpers";
import { createGuest, updateGuest, importGuests, exportGuestsCsv } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import { getGuestPage, submitWish, wishesOpen } from "@/server/services/rsvp";
import { saveDraft } from "@/server/services/designs";
import { listWishes, setWishHidden } from "@/server/services/operations";
import { BUILTIN_TEMPLATES } from "@/lib/seeds";

describe("الدعوة الكاملة لكل مدعو", async () => {
  it("قالب «الدعوة الكاملة» موجود في المعرض", async () => {
    const { db } = await setup();
    expect(BUILTIN_TEMPLATES.some((t) => t.id === "tpl-laylatna-full" && t.schema.template_style === "scroll")).toBe(true);
    expect(await db.get("SELECT id FROM templates WHERE id = 'tpl-laylatna-full'")).toBeTruthy();
  });

  it("صفحة الضيف تحمل لقبه واسمه وكل بيانات القالب", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx, { venue_name: "قاعة المعالي", venue_address: "الحسينية - مكة المكرمة", map_url: "https://maps.example/x" });
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === "tpl-laylatna-full")!;
    await saveDraft(a.ctx, ev.id, {
      template_id: tpl.id,
      schema: { ...tpl.schema, details: { ...tpl.schema.details, venue_photo_url: "https://img.example/hall.jpg", guest_notes: "يُمنع إحضار الجوال في صالة النساء\nالمواقف خلف القاعة" } },
    } as any);
    const g = await createGuest(a.ctx, ev.id, { name: "شمس الدين إلياس موسى", phone: "+966512340099", title: "سعادة الأستاذ" });
    expect(g.title).toBe("سعادة الأستاذ");
    const inv: any = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const page: any = await getGuestPage(a.ctx.db, inv.token);
    expect(page.guest_name).toBe("شمس الدين إلياس موسى");
    expect(page.guest_title).toBe("سعادة الأستاذ");
    expect(page.vars["guest.title"]).toBe("سعادة الأستاذ");
    expect(page.vars["event.venue_photo"]).toBe("https://img.example/hall.jpg");
    expect(String(page.vars["event.guest_notes"])).toContain("صالة النساء");
    expect(page.design.template_style).toBe("scroll");
    expect(page.event.map_url).toBe("https://maps.example/x");
    expect(page.wish).toBeNull();

    // تعديل اللقب ومسحه
    await updateGuest(a.ctx, g.id, { title: "الشيخ" });
    expect((await getGuestPage(a.ctx.db, inv.token) as any).guest_title).toBe("الشيخ");
    await updateGuest(a.ctx, g.id, { title: "" });
    expect((await getGuestPage(a.ctx.db, inv.token) as any).guest_title).toBeNull();
  });

  it("استيراد وتصدير CSV بعمود «اللقب»", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await importGuests(a.ctx, ev.id, { csv: "اللقب,الاسم,الهاتف\nالدكتورة,سارة العتيبي,+966512349111\n", dryRun: false });
    const csv = await exportGuestsCsv(a.ctx, ev.id);
    expect(csv).toContain("الدكتورة");
  });
});

describe("«اترك بصمتك الجميلة»", async () => {
  it("مغلقة قبل يوم المناسبة، تُفتح يومها للحاضر وغير الحاضر، وتُعدَّل ولا تتكرر", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const g = await createGuest(a.ctx, ev.id, { name: "ضيف التهنئة", phone: "+966512340088" });
    const inv: any = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const before = Date.parse(ev.starts_at!) - 3 * 864e5;
    const onDay = Date.parse(ev.starts_at!) + 3600e3;

    expect(wishesOpen({ starts_at: ev.starts_at!, timezone: "Asia/Riyadh", status: "published" }, before)).toBe(false);
    expect(wishesOpen({ starts_at: ev.starts_at!, timezone: "Asia/Riyadh", status: "published" }, onDay)).toBe(true);
    expect(wishesOpen({ starts_at: ev.starts_at!, timezone: "Asia/Riyadh", status: "cancelled" }, onDay)).toBe(false);

    await expectAppErrorAsync(() => submitWish(a.ctx.db, inv.token, { message: "مبروك" }, before), "CONFLICT");
    await submitWish(a.ctx.db, inv.token, { message: "ألف مبروك <b>وبالرفاه</b> والبنين" }, onDay);
    await submitWish(a.ctx.db, inv.token, { message: "ألف مبروك وبالرفاه والبنين، وجمع الله بينكما في خير" }, onDay);
    await expectAppErrorAsync(() => submitWish(a.ctx.db, inv.token, { message: " " }, onDay), "VALIDATION");

    const list = await listWishes(a.ctx, ev.id);
    expect(list.length).toBe(1);
    expect(list[0].message).toBe("ألف مبروك وبالرفاه والبنين، وجمع الله بينكما في خير");
    expect(list[0].message).not.toContain("<b>");
    expect(list[0].guest_name).toBe("ضيف التهنئة");

    await setWishHidden(a.ctx, ev.id, list[0].id, true);
    expect((await listWishes(a.ctx, ev.id))[0].hidden).toBe(1);
  });

  it("رابط غير صالح لا يكتب تهنئة، ومنظمة أخرى لا ترى التهاني", async () => {
    const { a, b } = await setup();
    const ev = await publishedEvent(a.ctx);
    await expectAppErrorAsync(() => submitWish(a.ctx.db, "x".repeat(43), { message: "مبروك" }, Date.now() + 30 * 864e5), "INVALID_TOKEN");
    await expectAppErrorAsync(() => listWishes(b.ctx, ev.id), "NOT_FOUND");
  });
});
