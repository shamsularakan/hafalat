/** بوابة المورد ودليل الموردين: الملف، المنتجات، التوفر حسب التاريخ، المزامنة، ومنع الحجز المزدوج */
import { describe, it, expect } from "vitest";
import { setup, makeUser, publishedEvent, expectAppErrorAsync, upgradePlan } from "./helpers";
import { updatePlan } from "@/server/services/planning";
import {
  getMyVendor, saveMyProfile, saveMyProduct, deleteMyProduct, myCalendar, setBlockedDay,
  vendorDirectory, linkVendorProfile, localDay,
} from "@/server/services/vendor-portal";
import { listCatalog, selectProduct, confirmVendorSelection, saveProduct, deleteProduct } from "@/server/services/operations";
import { saveVendor } from "@/server/services/resources";

async function vendorWithProducts(db: any) {
  const v = await makeUser(db, "vendor");
  const profile: any = await saveMyProfile(v.ctx, { name: "قاعة الياسمين", category: "قاعات", city: "الرياض", phone: "0553334444", daily_capacity: 1 });
  const hall: any = await saveMyProduct(v.ctx, { kind: "package", name: "القاعة الكبرى", pricing_type: "fixed", unit_price: 18000, vat_included: true, includes: ["التنظيف بعد الحفل"] });
  const hour: any = await saveMyProduct(v.ctx, { name: "ساعة إضافية", pricing_type: "per_time", unit_price: 600, unit: "ساعة" });
  return { v, profile, hall, hour };
}

describe("بوابة المورد", async () => {
  it("المورد ينشئ ملفه ويضيف منتجاته، والعضو العادي لا يستطيع", async () => {
    const { db } = await setup();
    const { v, profile } = await vendorWithProducts(db);
    const me = await getMyVendor(v.ctx);
    expect(me.profile.id).toBe(profile.id);
    expect(me.products.length).toBe(2);
    await expectAppErrorAsync(() => saveMyProfile(v.ctx, { name: "", category: "قاعات" }), "VALIDATION");
    await expectAppErrorAsync(() => saveMyProduct(v.ctx, { name: "x", pricing_type: "weird" }), "VALIDATION");
    const member = { ...v.ctx, actor: { ...v.ctx.actor, orgRole: "member" as const } };
    await expectAppErrorAsync(() => saveMyProduct(member, { name: "منتج" }), "FORBIDDEN");
    // من لا يملك ملف مورد لا يرى شيئًا ولا يضيف منتجات
    const other = await makeUser(db, "plain");
    expect((await getMyVendor(other.ctx)).profile).toBeNull();
    await expectAppErrorAsync(() => saveMyProduct(other.ctx, { name: "منتج" }), "NOT_FOUND");
  });

  it("اليوم المحلي يُحسب بتوقيت المناسبة لا غرينتش", () => {
    expect(localDay("2026-12-03T22:30:00.000Z", "Asia/Riyadh")).toBe("2026-12-04");
    expect(localDay("2026-12-03T20:00:00.000Z", "Asia/Riyadh")).toBe("2026-12-03");
  });
});

describe("دليل الموردين والمناسبة", async () => {
  it("يضيف صاحب المناسبة المورد من الدليل فتظهر منتجاته وتتحدث تلقائيًا ولا يعدّلها", async () => {
    const { db, a } = await setup();
    const { v, hall, hour } = await vendorWithProducts(db);
    const ev = await publishedEvent(a.ctx);
    await updatePlan(a.ctx, ev.id, { men_count: 100, women_count: 100 });

    const dir = await vendorDirectory(a.ctx, ev.id, { category: "قاعات" });
    expect(dir.vendors.length).toBe(1);
    expect(dir.vendors[0]).toMatchObject({ name: "قاعة الياسمين", products: 2, price_from: 600, available: true, linked: false });

    const link = await linkVendorProfile(a.ctx, ev.id, dir.vendors[0].id);
    expect((await linkVendorProfile(a.ctx, ev.id, dir.vendors[0].id)).already).toBe(true);
    let cat = await listCatalog(a.ctx, ev.id);
    const vendorRow = cat.vendors.find((x: any) => x.id === link.vendor_id)!;
    expect(vendorRow.managed_by_vendor).toBe(true);
    expect(vendorRow.products.map((p: any) => p.name).sort()).toEqual(["القاعة الكبرى", "ساعة إضافية"]);

    // المورد يعدّل سعره ← يظهر محدّثًا، والاختيار يبقى
    const hallRow = vendorRow.products.find((p: any) => p.catalog_product_id === hall.id)!;
    await selectProduct(a.ctx, ev.id, hallRow.id, { selected: true });
    await saveMyProduct(v.ctx, { kind: "package", name: "القاعة الكبرى", pricing_type: "fixed", unit_price: 20000, vat_included: true }, hall.id);
    cat = await listCatalog(a.ctx, ev.id);
    const updated = cat.vendors[0].products.find((p: any) => p.catalog_product_id === hall.id)!;
    expect(updated.unit_price).toBe(20000);
    expect(updated.selected).toBe(1);

    // صاحب المناسبة لا يعدّل منتجات مورد الدليل
    await expectAppErrorAsync(() => saveProduct(a.ctx, ev.id, { vendor_id: link.vendor_id, name: "x" }), "CONFLICT");
    await expectAppErrorAsync(() => deleteProduct(a.ctx, ev.id, updated.id), "CONFLICT");

    // المورد يحذف منتجًا غير مختار ← يختفي؛ ويوقف المختار ← يُعلَّم ويمنع الاعتماد
    await deleteMyProduct(v.ctx, hour.id);
    await saveMyProduct(v.ctx, { kind: "package", name: "القاعة الكبرى", pricing_type: "fixed", unit_price: 20000, vat_included: true, active: false }, hall.id);
    cat = await listCatalog(a.ctx, ev.id);
    expect(cat.vendors[0].products.length).toBe(1);
    expect(cat.vendors[0].products[0].unavailable).toBe(1);
    await expectAppErrorAsync(() => confirmVendorSelection(a.ctx, ev.id, link.vendor_id), "CONFLICT");
  });

  it("التوفر حسب التاريخ يمنع الحجز المزدوج ويظهر في تقويم المورد", async () => {
    const { db, a, b } = await setup();
    const { v, profile, hall } = await vendorWithProducts(db);
    const sameDay = new Date(Date.now() + 20 * 864e5).toISOString();
    const evA = await publishedEvent(a.ctx, { starts_at: sameDay, ends_at: new Date(Date.parse(sameDay) + 4 * 3600e3).toISOString() });
    const evB = await publishedEvent(b.ctx, { starts_at: sameDay, ends_at: new Date(Date.parse(sameDay) + 4 * 3600e3).toISOString() });

    const pick = async (ctx: any, evId: string) => {
      const l = await linkVendorProfile(ctx, evId, profile.id);
      const c = await listCatalog(ctx, evId);
      const row = c.vendors.find((x: any) => x.id === l.vendor_id)!.products.find((p: any) => p.catalog_product_id === hall.id)!;
      await selectProduct(ctx, evId, row.id, { selected: true });
      return l.vendor_id;
    };
    const va = await pick(a.ctx, evA.id);
    const vb = await pick(b.ctx, evB.id);
    await confirmVendorSelection(a.ctx, evA.id, va);
    // إعادة اعتماد المناسبة نفسها مسموحة (لا تُحسب ضد نفسها)
    await confirmVendorSelection(a.ctx, evA.id, va);
    // مناسبة ثانية في اليوم نفسه ← المورد سعته 1
    await expectAppErrorAsync(() => confirmVendorSelection(b.ctx, evB.id, vb), "CONFLICT");
    const dirB = await vendorDirectory(b.ctx, evB.id);
    expect(dirB.vendors[0].available).toBe(false);

    // رفع السعة يسمح بالحجز الثاني
    await saveMyProfile(v.ctx, { name: "قاعة الياسمين", category: "قاعات", daily_capacity: 2 });
    await confirmVendorSelection(b.ctx, evB.id, vb);

    const cal = await myCalendar(v.ctx);
    expect(cal.bookings.filter((x: any) => x.state === "confirmed").length).toBe(2);
    expect(cal.bookings[0].items).toEqual(["القاعة الكبرى"]);
    expect(cal.bookings[0].total).toBe(18000);
  });

  it("اليوم المغلق يدويًا يظهر غير متاح ويمنع الاعتماد", async () => {
    const { db, a } = await setup();
    const { v, profile, hall } = await vendorWithProducts(db);
    const ev = await publishedEvent(a.ctx);
    await setBlockedDay(v.ctx, { day: localDay(ev.starts_at!, "Asia/Riyadh"), blocked: true, note: "صيانة" });
    const dir = await vendorDirectory(a.ctx, ev.id);
    expect(dir.vendors[0]).toMatchObject({ available: false, unavailable_reason: "صيانة" });
    const l = await linkVendorProfile(a.ctx, ev.id, profile.id);
    const c = await listCatalog(a.ctx, ev.id);
    const row = c.vendors[0].products.find((p: any) => p.catalog_product_id === hall.id)!;
    await selectProduct(a.ctx, ev.id, row.id, { selected: true });
    await expectAppErrorAsync(() => confirmVendorSelection(a.ctx, ev.id, l.vendor_id), "CONFLICT");
    await setBlockedDay(v.ctx, { day: localDay(ev.starts_at!, "Asia/Riyadh"), blocked: false });
    await confirmVendorSelection(a.ctx, ev.id, l.vendor_id);
    await expectAppErrorAsync(() => setBlockedDay(v.ctx, { day: "غدًا", blocked: true }), "VALIDATION");
  });

  it("الملف المخفي لا يظهر في الدليل ولا يمكن ربطه، والمورد اليدوي يبقى كما هو", async () => {
    const { db, a } = await setup();
    const { v, profile } = await vendorWithProducts(db);
    await saveMyProfile(v.ctx, { name: "قاعة الياسمين", category: "قاعات", is_public: false });
    const ev = await publishedEvent(a.ctx);
    expect((await vendorDirectory(a.ctx, ev.id)).vendors.length).toBe(0);
    await expectAppErrorAsync(() => linkVendorProfile(a.ctx, ev.id, profile.id), "NOT_FOUND");
    const manual: any = await saveVendor(a.ctx, ev.id, { name: "مورد يدوي", category: "زهور" });
    await saveProduct(a.ctx, ev.id, { vendor_id: manual.id, name: "باقة ورد", unit_price: 300 });
    const cat = await listCatalog(a.ctx, ev.id);
    expect(cat.vendors.find((x: any) => x.id === manual.id)!.managed_by_vendor).toBe(false);
  });
});
