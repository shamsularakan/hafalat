/** المستلزمات وحساب الكميات وقالب الزواج الكامل (وثيقة ليلتنا — إدارة المناسبات) */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, expectAppErrorAsync } from "./helpers";
import { createEvent } from "@/server/services/events";
import { updatePlan, listTasks, listTimeline, listChecklists, planningDashboard, saveTimelineItem, currentPhaseIndex } from "@/server/services/planning";
import { financeSummary } from "@/server/services/finance";
import {
  getSupplies, addSupplies, updateSupply, addCustomSupply, pushSuppliesToBudget, syncHeadcountFromRsvp, exportSuppliesCsv,
} from "@/server/services/supplies";
import { autoQty, tableCount, SUPPLY_ITEMS, SUPPLY_CATEGORIES } from "@/lib/supplies-catalog";
import { createGuest, updateGuest, listGuests, importGuests } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import { submitRsvp, getGuestPage } from "@/server/services/rsvp";

const h = (men: number, women: number, seats = 8) => ({ men, women, seats_per_table: seats });

describe("كتالوج المستلزمات وقواعد الكميات", () => {
  it("يضم 115 بندًا في 15 فئة ونسب الفئات مجموعها 100%", () => {
    expect(SUPPLY_ITEMS.length).toBe(115);
    expect(SUPPLY_CATEGORIES.length).toBe(15);
    expect(SUPPLY_CATEGORIES.reduce((a, c) => a + c.pct, 0)).toBe(100);
    expect(SUPPLY_ITEMS.every((i) => SUPPLY_CATEGORIES.some((c) => c.id === i.c))).toBe(true);
  });

  it("الطاولات = الضيوف ÷ الكراسي مقربًا لأعلى، والقواعد تطابق الوثيقة", () => {
    const hc = h(150, 150, 8);
    expect(tableCount(hc)).toBe(38); // 300 / 8 = 37.5
    expect(autoQty({ t: "g", v: 1.1 }, hc)).toBe(330); // صحون كبيرة
    expect(autoQty({ t: "g", v: 2 }, hc)).toBe(600); // صحون صغيرة
    expect(autoQty({ t: "t", v: 2 }, hc)).toBe(76); // صحون مخللات
    expect(autoQty({ t: "gd", v: 50 }, hc)).toBe(6); // مناديل مبللة
    expect(autoQty({ t: "gd", v: 30 }, hc)).toBe(10); // عمال تقديم
    expect(autoQty({ t: "w", v: 1 }, hc)).toBe(150); // أكياس العبايات
    expect(autoQty({ t: "f", v: 1 }, hc)).toBe(1);
    expect(autoQty({ t: "gd", v: 30 }, h(0, 0))).toBe(0);
  });
});

describe("قائمتي: الإضافة والتسعير والضريبة والاحتياطي", async () => {
  it("يحسب الإجمالي مع الضريبة والاحتياطي ويحترم الكمية اليدوية", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { budget_total: 100000, men_count: 100, women_count: 100, seats_per_table: 10, reserve_percent: 10, vat_enabled: true, vat_rate: 15 });
    await addSupplies(a.ctx, ev.id, { item_keys: ["tw-plate-l", "ab-bag", "venue-hall"] });
    // إضافة مكررة لا تنشئ بندًا ثانيًا
    expect((await addSupplies(a.ctx, ev.id, { item_keys: ["tw-plate-l"] })).added).toBe(0);
    let s = await getSupplies(a.ctx, ev.id);
    const plate = s.items.find((i: any) => i.item_key === "tw-plate-l")!;
    expect(plate.qty).toBe(220);
    expect(s.items.find((i: any) => i.item_key === "ab-bag")!.qty).toBe(100);
    expect(s.headcount.tables).toBe(20);
    // 220×3 + 100×3.5 + 12000 = 13010
    expect(s.totals.subtotal).toBe(13010);
    expect(s.totals.vat).toBe(1951.5);
    expect(s.totals.reserve).toBe(1496.15);
    expect(s.totals.grand).toBe(16457.65);
    expect(s.totals.over_budget).toBe(false);

    await updateSupply(a.ctx, ev.id, plate.id, { qty_override: 250, unit_price: 4, status: "ok" });
    s = await getSupplies(a.ctx, ev.id);
    const p2 = s.items.find((i: any) => i.item_key === "tw-plate-l")!;
    expect(p2.qty).toBe(250);
    expect(p2.auto_qty).toBe(220);
    expect(p2.total).toBe(1000);
    expect(s.top[0].item_key).toBe("venue-hall");
    // إلغاء التجاوز يعيد الحساب التلقائي
    await updateSupply(a.ctx, ev.id, plate.id, { qty_override: null });
    expect((await getSupplies(a.ctx, ev.id)).items.find((i: any) => i.id === plate.id)!.qty).toBe(220);
  });

  it("القائمة الكاملة لحفل الزواج تضيف البنود الافتراضية فقط، وتنبه عند تجاوز الميزانية", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { budget_total: 20000, men_count: 150, women_count: 150 });
    const r = await addSupplies(a.ctx, ev.id, { preset: "wedding_full" });
    expect(r.added).toBe(SUPPLY_ITEMS.filter((i) => i.def).length);
    const s = await getSupplies(a.ctx, ev.id);
    expect(s.totals.over_budget).toBe(true);
    expect(s.categories.some((c: any) => c.over)).toBe(true);
    expect(s.top.length).toBe(10);
    const csv = await exportSuppliesCsv(a.ctx, ev.id);
    expect(csv).toContain("الإجمالي التقديري");
  });

  it("بند مخصص + رفض المدخلات غير الصالحة", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { men_count: 40, women_count: 0 });
    await addCustomSupply(a.ctx, ev.id, { name: "مباخر", category_key: "decor", unit: "قطعة", rule_type: "gd", rule_value: 20, unit_price: 50 });
    const s = await getSupplies(a.ctx, ev.id);
    expect(s.items[0].qty).toBe(2);
    await expectAppErrorAsync(() => addSupplies(a.ctx, ev.id, { item_keys: ["nope"] }), "VALIDATION");
    await expectAppErrorAsync(() => updateSupply(a.ctx, ev.id, s.items[0].id, { unit_price: -1 }), "VALIDATION");
    await expectAppErrorAsync(() => updatePlan(a.ctx, ev.id, { seats_per_table: 1 }), "VALIDATION");
  });

  it("اعتماد التقدير يضبط مخطط فئات الميزانية والاحتياطي", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { budget_total: 100000, men_count: 50, women_count: 50, reserve_percent: 10 });
    await addSupplies(a.ctx, ev.id, { item_keys: ["venue-hall", "food-main"] });
    await pushSuppliesToBudget(a.ctx, ev.id);
    const f = await financeSummary(a.ctx, ev.id);
    const venue = f.categories.find((c: any) => c.name === "القاعة والمكان")!;
    const food = f.categories.find((c: any) => c.name === "الطعام والمشروبات")!;
    const reserve = f.categories.find((c: any) => c.name === "الاحتياطي الطارئ")!;
    expect(Number(venue.planned_amount)).toBe(12000);
    expect(Number(food.planned_amount)).toBe(8500);
    expect(Number(reserve.planned_amount)).toBe(2050);
  });

  it("المسؤول عن العزل: مناسبة منظمة أخرى غير متاحة", async () => {
    const { a, b } = await setup();
    const ev = await publishedEvent(a.ctx);
    await expectAppErrorAsync(() => getSupplies(b.ctx, ev.id), "NOT_FOUND");
  });
});

describe("الضيوف رجال/نساء وربط الردود بالكميات", async () => {
  it("يقسم المؤكدين حسب القسم ويعيد حساب الكميات تلقائيًا في وضع الردود", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { men_count: 10, women_count: 10 });
    await addSupplies(a.ctx, ev.id, { item_keys: ["ab-bag", "fu-chair"] });
    const fam = (await a.ctx.db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id))!;
    const m = await createGuest(a.ctx, ev.id, { name: "رجل", phone: "+966512340001", group_id: fam.id, section: "men" });
    const w = await createGuest(a.ctx, ev.id, { name: "امرأة", phone: "+966512340002", group_id: fam.id, section: "نساء" as any });
    expect(w.section).toBe("women");
    const im = await issueInvitation(a.ctx, ev.id, { guest_id: m.id });
    const iw = await issueInvitation(a.ctx, ev.id, { guest_id: w.id });
    await submitRsvp(a.ctx.db, im.token, { answer: "confirmed", persons: 3 });
    await submitRsvp(a.ctx.db, iw.token, { answer: "confirmed", persons: 4 });

    let s = await getSupplies(a.ctx, ev.id);
    expect(s.confirmed).toEqual({ men: 3, women: 4, unassigned: 0 });
    expect(s.items.find((i: any) => i.item_key === "ab-bag")!.qty).toBe(10); // ما زال يدويًا

    await updatePlan(a.ctx, ev.id, { headcount_source: "rsvp" });
    s = await getSupplies(a.ctx, ev.id);
    expect(s.items.find((i: any) => i.item_key === "ab-bag")!.qty).toBe(4);
    expect(s.items.find((i: any) => i.item_key === "fu-chair")!.qty).toBe(Math.ceil(7 * 1.1));

    const r = await syncHeadcountFromRsvp(a.ctx, ev.id);
    expect(r).toMatchObject({ men: 3, women: 4 });

    expect((await listGuests(a.ctx, ev.id, { section: "women" })).length).toBe(1);
    await updateGuest(a.ctx, m.id, { section: null });
    expect((await listGuests(a.ctx, ev.id, { section: "none" })).length).toBe(1);
    await expectAppErrorAsync(() => updateGuest(a.ctx, m.id, { section: "kids" as any }), "VALIDATION");
  });

  it("استيراد CSV يقرأ عمود القسم ويرفض القيم الخاطئة", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const csv = "الاسم,الهاتف,القسم\nأحمد,+966512349001,رجال\nسارة,+966512349002,نساء\nخطأ,+966512349003,أطفال\n";
    const dry: any = await importGuests(a.ctx, ev.id, { csv, dryRun: true });
    expect(dry.ok).toBe(2);
    expect(dry.errors).toBe(1);
    await importGuests(a.ctx, ev.id, { csv, dryRun: false });
    const list = await listGuests(a.ctx, ev.id);
    expect(list.find((g: any) => g.name === "سارة")!.section).toBe("women");
  });
});

describe("قالب الزواج الكامل والجدول والمراحل", async () => {
  it("يولّد 22 مهمة و15 خطوة ليوم المناسبة بالساعة و16 فئة ميزانية", async () => {
    const { a } = await setup();
    const starts = new Date(Date.now() + 400 * 864e5);
    starts.setUTCHours(16, 30, 0, 0);
    const ev = await createEvent(a.ctx, { title: "زفاف كامل", type: "wedding", starts_at: starts.toISOString(), capacity: 300 });
    const tasks = await listTasks(a.ctx, ev.id);
    expect(tasks.length).toBe(22);
    const hall = tasks.find((t: any) => t.title === "حجز القاعة وتأكيد التاريخ")!;
    expect(Date.parse(hall.due_date)).toBe(starts.getTime() - 300 * 864e5);
    const settle = tasks.find((t: any) => t.title.startsWith("تسوية الحسابات"))!;
    expect(Date.parse(settle.due_date)).toBe(starts.getTime() + 3 * 864e5);

    const tl = await listTimeline(a.ctx, ev.id);
    const day = tl.filter((t: any) => t.phase === "event_day");
    expect(day.length).toBe(15);
    const doors = day.find((t: any) => t.title === "فتح الأبواب واستقبال الضيوف")!;
    expect(doors.starts_at).toBe(starts.toISOString());
    expect(doors.show_to_guests).toBe(1);
    const setupStep = day.find((t: any) => t.title.startsWith("وصول فريق التجهيز"))!;
    expect(Date.parse(setupStep.starts_at)).toBe(starts.getTime() - 270 * 60e3);
    expect(setupStep.show_to_guests).toBe(0);
    expect(setupStep.owner_label).toBe("المشرف الميداني");

    const f = await financeSummary(a.ctx, ev.id);
    expect(f.categories.length).toBe(16);

    // قوائم التجهيز تُعاد كمصفوفة كائنات فعلية (كانت وعودًا غير منتظرة)
    const lists = await listChecklists(a.ctx, ev.id);
    expect(Array.isArray(lists[0].items)).toBe(true);
    expect(lists[0].items.length).toBeGreaterThan(5);
  });

  it("زر الإكمال يحدّث done فقط، والبرنامج في الدعوة يعرض الخطوات الظاهرة للضيوف", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const tl = await listTimeline(a.ctx, ev.id);
    const item = tl[0];
    await saveTimelineItem(a.ctx, ev.id, { done: true }, item.id);
    const after = (await listTimeline(a.ctx, ev.id)).find((t: any) => t.id === item.id)!;
    expect(after.done).toBe(1);
    expect(after.title).toBe(item.title);

    const g = await createGuest(a.ctx, ev.id, { name: "ضيف البرنامج", phone: "+966512348888" });
    const inv = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const page: any = await getGuestPage(a.ctx.db, inv.token);
    const program = String(page.vars?.["event.program"] ?? page.template_vars?.["event.program"] ?? "");
    expect(program).toContain("فتح الأبواب");
    expect(program).not.toContain("وصول فريق التجهيز");
  });

  it("المراحل الست تُستنتج من حالة المناسبة", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const at = (days: number) => new Date(now + days * 864e5).toISOString();
    const base = { status: "draft", vendors_engaged: 0, invitations_issued: 0, now };
    expect(currentPhaseIndex({ ...base, starts_at: at(200) })).toBe(0);
    expect(currentPhaseIndex({ ...base, starts_at: at(200), vendors_engaged: 1 })).toBe(1);
    expect(currentPhaseIndex({ ...base, starts_at: at(200), invitations_issued: 3 })).toBe(2);
    expect(currentPhaseIndex({ ...base, starts_at: at(10) })).toBe(3);
    expect(currentPhaseIndex({ ...base, starts_at: at(0.1) })).toBe(4);
    expect(currentPhaseIndex({ ...base, status: "ended", starts_at: at(-2) })).toBe(5);
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const d: any = await planningDashboard(a.ctx, ev.id);
    expect(d.phases.length).toBe(6);
    expect(d.phases.filter((p: any) => p.state === "current").length).toBe(1);
  });
});
