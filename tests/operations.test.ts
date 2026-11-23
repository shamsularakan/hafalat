/** كتالوج منتجات الموردين، الروابط المختصرة، تقييم الموردين، التنبيهات، ضريبة المصروفات، وإزاحة الخطة عند تغيير الموعد */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, expectAppErrorAsync, upgradePlan } from "./helpers";
import { updateEvent } from "@/server/services/events";
import { updatePlan, listTasks, listTimeline, saveTask, saveTimelineItem } from "@/server/services/planning";
import { financeSummary, saveExpense, savePayment, listPayments, listExpenses } from "@/server/services/finance";
import { saveVendor } from "@/server/services/resources";
import {
  listCatalog, saveProduct, selectProduct, confirmVendorSelection, deleteProduct, productTotals,
  rateVendor, eventAlerts, shiftDaySchedule, daySheet,
} from "@/server/services/operations";
import { addSupplies, updateSupply, getSupplies } from "@/server/services/supplies";
import { createGuest } from "@/server/services/guests";
import { issueInvitation, listInvitations } from "@/server/services/invitations";
import { GET as shortLink } from "@/app/d/[code]/route";
import { isShortCode } from "@/lib/tokens";

describe("كتالوج منتجات الموردين", async () => {
  it("الأنواع الأربعة للتسعير، والضريبة تُضاف لغير الشامل", () => {
    expect(productTotals({ pricing_type: "per_person", unit_price: 100, quantity: null, vat_included: 0 }, 300, 15)).toMatchObject({ qty: 300, total: 34500 });
    expect(productTotals({ pricing_type: "fixed", unit_price: 33000, quantity: 99, vat_included: 1 }, 300, 15)).toEqual({ qty: 1, base: 33000, vat: 4304.35, total: 33000 });
    expect(productTotals({ pricing_type: "per_time", unit_price: 600, quantity: 3, vat_included: 0 }, 300, 15).total).toBe(2070);
    expect(productTotals({ pricing_type: "per_qty", unit_price: 15, quantity: null, vat_included: 1 }, 300, 15).qty).toBe(1);
  });

  it("المورد يعرض منتجاته، وصاحب المناسبة يختار، والاعتماد ينشئ مصروفًا ويُحدَّثه", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { men_count: 100, women_count: 100 });
    const v: any = await saveVendor(a.ctx, ev.id, { name: "مطبخ الأصالة", category: "ضيافة", phone: "0551112222" });
    const pkg: any = await saveProduct(a.ctx, ev.id, { vendor_id: v.id, kind: "package", name: "عشاء كامل", pricing_type: "per_person", unit_price: 100, includes: ["التقديم وعمال الخدمة"] });
    const chair: any = await saveProduct(a.ctx, ev.id, { vendor_id: v.id, name: "كرسي كريستال", pricing_type: "per_qty", unit_price: 15, unit: "قطعة", vat_included: true });
    let c = await listCatalog(a.ctx, ev.id);
    expect(c.vendors[0].products.length).toBe(2);
    expect(c.grand_total).toBe(0);

    await selectProduct(a.ctx, ev.id, pkg.id, { selected: true }); // تلقائيًا 200 ضيف
    await selectProduct(a.ctx, ev.id, chair.id, { selected: true, quantity: 220 });
    c = await listCatalog(a.ctx, ev.id);
    const vv = c.vendors[0];
    expect(vv.products.find((p: any) => p.id === pkg.id)!.total).toBe(23000); // 200×100 + 15%
    expect(vv.products.find((p: any) => p.id === chair.id)!.total).toBe(3300); // شامل
    expect(vv.selected_total).toBe(26300);
    expect(c.grand_total).toBe(26300);

    const r = await confirmVendorSelection(a.ctx, ev.id, v.id);
    expect(r.total).toBe(26300);
    let exps = await listExpenses(a.ctx, ev.id);
    expect(exps.length).toBe(1);
    expect(Number(exps[0].amount)).toBe(26300);
    expect(exps[0].vendor_id).toBe(v.id);
    expect((await a.ctx.db.get<any>("SELECT status FROM vendors WHERE id = ?", v.id)).status).toBe("contracted");

    // تعديل الاختيار ثم إعادة الاعتماد يحدّث المصروف نفسه ولا يكرره
    await selectProduct(a.ctx, ev.id, chair.id, { selected: false });
    await confirmVendorSelection(a.ctx, ev.id, v.id);
    exps = await listExpenses(a.ctx, ev.id);
    expect(exps.length).toBe(1);
    expect(Number(exps[0].amount)).toBe(23000);

    await deleteProduct(a.ctx, ev.id, chair.id);
    await expectAppErrorAsync(() => saveProduct(a.ctx, ev.id, { vendor_id: v.id, name: "x", pricing_type: "weird" }), "VALIDATION");
    await expectAppErrorAsync(() => selectProduct(a.ctx, ev.id, pkg.id, { quantity: -1 }), "VALIDATION");
  });

  it("لا اعتماد بلا اختيار، ولا ربط بمورد من مناسبة أخرى", async () => {
    const { a } = await setup();
    await upgradePlan(a.ctx.db, a.orgId, "pro");
    const ev1 = await publishedEvent(a.ctx);
    const ev2 = await publishedEvent(a.ctx);
    const v: any = await saveVendor(a.ctx, ev1.id, { name: "مورد", category: "قاعة" });
    await expectAppErrorAsync(() => confirmVendorSelection(a.ctx, ev1.id, v.id), "VALIDATION");
    await expectAppErrorAsync(() => saveProduct(a.ctx, ev2.id, { vendor_id: v.id, name: "القاعة", unit_price: 1 }), "VALIDATION");
    await expectAppErrorAsync(() => saveTimelineItem(a.ctx, ev2.id, { title: "خطوة", phase: "event_day", vendor_id: v.id }), "VALIDATION");
  });
});

describe("رابط الدعوة المختصر لواتساب", async () => {
  it("كل دعوة لها رابط مختصر يوجّه لصفحتها، وإعادة الإصدار تبطل القديم", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const g = await createGuest(a.ctx, ev.id, { name: "ضيف الرابط", phone: "+966512347777" });
    const inv: any = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    expect(inv.short_url).toMatch(/\/d\/[0-9A-Za-z]{8}$/);
    expect(inv.short_url.length).toBeLessThan(inv.url.length);
    const code = inv.short_url.split("/d/")[1];
    expect(isShortCode(code)).toBe(true);

    const listed: any = (await listInvitations(a.ctx, ev.id))[0];
    expect(listed.short_url).toBe(inv.short_url);
  });

  it("المسار /d يوجّه للرابط الكامل، والرمز المجهول لصفحة «غير صالح»", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const g = await createGuest(a.ctx, ev.id, { name: "ضيف", phone: "+966512346666" });
    const inv: any = await issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const code = inv.short_url.split("/d/")[1];
    // المسار يستخدم قاعدة التطبيق؛ نوجّهها لقاعدة الاختبار
    const dbmod = await import("@/lib/db");
    const spy = (await import("vitest")).vi.spyOn(dbmod, "getDb").mockResolvedValue(a.ctx.db);
    const res = await shortLink(new Request(`http://x.test/d/${code}`), { params: Promise.resolve({ code }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`http://x.test/i/${inv.token}`);
    const bad = await shortLink(new Request("http://x.test/d/ZZZZZZZZ"), { params: Promise.resolve({ code: "ZZZZZZZZ" }) });
    expect(bad.headers.get("location")).toBe("http://x.test/i/invalid-link");
    spy.mockRestore();
  });
});

describe("تقييم الموردين وضريبة المصروفات", async () => {
  it("يقيّم المورد من 1 إلى 5 فقط", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const v: any = await saveVendor(a.ctx, ev.id, { name: "مصور", category: "تصوير" });
    const r: any = await rateVendor(a.ctx, ev.id, v.id, { rating: 5, review: "التزام بالوقت" });
    expect(r.rating).toBe(5);
    await expectAppErrorAsync(() => rateVendor(a.ctx, ev.id, v.id, { rating: 6 }), "VALIDATION");
    // تعديل بيانات المورد لا يمسح تقييمه
    await saveVendor(a.ctx, ev.id, { name: "مصور محترف", category: "تصوير" }, v.id);
    expect((await a.ctx.db.get<any>("SELECT rating FROM vendors WHERE id = ?", v.id)).rating).toBe(5);
  });

  it("إضافة الضريبة تجعلها جزءًا من مبلغ المصروف", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const e: any = await saveExpense(a.ctx, ev.id, { title: "قاعة", amount: 10000, add_vat: true });
    expect(Number(e.amount)).toBe(11500);
    expect(Number(e.vat_amount)).toBe(1500);
    await expectAppErrorAsync(() => saveExpense(a.ctx, ev.id, { title: "خطأ", amount: 100, vat_amount: 200 }), "VALIDATION");
  });
});

describe("التنبيهات والمراجعة الأسبوعية", async () => {
  it("يرصد المهام المتأخرة والدفعات المتأخرة والمستحقة والتجاوز", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { budget_total: 1000, men_count: 50, women_count: 50 });
    await saveTask(a.ctx, ev.id, { title: "مهمة فاتت", due_date: new Date(Date.now() - 2 * 864e5).toISOString() });
    await savePayment(a.ctx, ev.id, { amount: 500, kind: "deposit", due_date: new Date(Date.now() - 864e5).toISOString() });
    await savePayment(a.ctx, ev.id, { amount: 700, kind: "installment", due_date: new Date(Date.now() + 3 * 864e5).toISOString() });
    await addSupplies(a.ctx, ev.id, { item_keys: ["venue-hall"] });
    const { alerts, counts } = await eventAlerts(a.ctx, ev.id);
    const keys = alerts.map((x) => x.key);
    expect(keys).toContain("tasks_overdue");
    expect(keys).toContain("payments_overdue");
    expect(keys).toContain("payments_week");
    expect(keys).toContain("supplies_over");
    expect(keys).toContain("supplies_pending"); // المناسبة بعد 7 أيام
    expect(counts.danger).toBeGreaterThan(0);
    expect(alerts[0].level).toBe("danger");
    // الدفعة المتأخرة صارت «overdue» في السجل وتُحسب ضمن الالتزامات
    const pays = await listPayments(a.ctx, ev.id);
    expect(pays.some((p: any) => p.status === "overdue")).toBe(true);
    expect((await financeSummary(a.ctx, ev.id)).obligations).toBe(1200);
  });
});

describe("جدول اليوم والموعد", async () => {
  it("تغيير موعد المناسبة يزيح المهام غير المنجزة وجدول اليوم بالفرق نفسه", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const before = await listTasks(a.ctx, ev.id);
    const tlBefore = await listTimeline(a.ctx, ev.id);
    const newStart = new Date(Date.parse(ev.starts_at!) + 2 * 864e5 + 3600e3).toISOString();
    await updateEvent(a.ctx, ev.id, { starts_at: newStart, ends_at: new Date(Date.parse(newStart) + 4 * 3600e3).toISOString() });
    const after = await listTasks(a.ctx, ev.id);
    const t0 = before.find((t: any) => t.due_date)!;
    const t1 = after.find((t: any) => t.id === t0.id)!;
    expect(Date.parse(t1.due_date) - Date.parse(t0.due_date)).toBe(2 * 864e5 + 3600e3);
    const step0 = tlBefore.find((t: any) => t.phase === "event_day" && t.starts_at)!;
    const step1 = (await listTimeline(a.ctx, ev.id)).find((t: any) => t.id === step0.id)!;
    expect(Date.parse(step1.starts_at) - Date.parse(step0.starts_at)).toBe(2 * 864e5 + 3600e3);
  });

  it("إزاحة جدول اليوم وحده، والجدول المعتمد يعرض رقم المورد", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const v: any = await saveVendor(a.ctx, ev.id, { name: "مورد الديكور", category: "ديكور", phone: "0550001111", status: "contracted" });
    const steps = (await listTimeline(a.ctx, ev.id)).filter((t: any) => t.phase === "event_day");
    await saveTimelineItem(a.ctx, ev.id, { vendor_id: v.id }, steps[1].id);
    const r = await shiftDaySchedule(a.ctx, ev.id, 30);
    expect(r.shifted).toBe(steps.length);
    const sheet = await daySheet(a.ctx, ev.id);
    expect(sheet.steps.length).toBe(15);
    expect(sheet.steps.find((s: any) => s.id === steps[1].id)!.vendor_phone).toBe("0550001111");
    expect(sheet.contacts.map((c: any) => c.name)).toContain("مورد الديكور");
    expect(Date.parse(sheet.steps[0].starts_at)).toBe(Date.parse(steps[0].starts_at) + 30 * 60e3);
    await expectAppErrorAsync(() => shiftDaySchedule(a.ctx, ev.id, Number.NaN), "VALIDATION");
  });

  it("ربط بند قائمتي بمورد", async () => {
    const { a } = await setup();
    const ev = await publishedEvent(a.ctx);
    const v: any = await saveVendor(a.ctx, ev.id, { name: "قاعة الياسمين", category: "قاعة" });
    await addSupplies(a.ctx, ev.id, { item_keys: ["venue-hall"] });
    const s = await getSupplies(a.ctx, ev.id);
    await updateSupply(a.ctx, ev.id, s.items[0].id, { vendor_id: v.id, status: "sel" });
    expect((await getSupplies(a.ctx, ev.id)).items[0].vendor_name).toBe("قاعة الياسمين");
  });
});
