/** AC-06: الاستيراد يعرض أخطاء الصفوف والتكرارات دون إدخال ناقص */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests } from "./helpers";
import { importGuests, listGuests, createGuest } from "@/server/services/guests";

const CSV = [
  "الاسم,الهاتف,البريد,الفئة",
  "سالم أحمد,+966501111111,salem@test.local,أفراد",
  "نورة علي,+966502222222,,عائلات",
  ",+966503333333,,أفراد",            // اسم مفقود
  "فهد خالد,05abc,,أفراد",             // رقم غير صالح
  "سالم مكرر,+966501111111,,أفراد",    // مكرر داخل الملف
  "ضيف موجود,+966509999999,,أفراد",    // مكرر مع موجود (يضاف مسبقًا)
].join("\n");

describe("AC-06 استيراد CSV", async () => {
  it("المعاينة تكشف الأخطاء والتكرارات دون إدخال", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    // ضيف موجود بنفس الرقم
    (await createGuest(a.ctx, ev.id, { name: "ضيف موجود", phone: "+966509999999" }));

    const preview: any = (await importGuests(a.ctx, ev.id, { csv: CSV, dryRun: true }));
    expect(preview.dryRun).toBe(true);
    expect(preview.total).toBe(6);
    expect(preview.ok).toBe(2);
    expect(preview.errors).toBe(2);
    expect(preview.duplicates).toBe(2);
    expect((await listGuests(a.ctx, ev.id)).length).toBe(1); // لم يُدخل شيء
    const reasons = preview.results.filter((r: any) => r.status !== "ok").map((r: any) => r.reason);
    expect(reasons.some((x: string) => x.includes("الاسم مفقود"))).toBe(true);
    expect(reasons.some((x: string) => x.includes("غير صالح"))).toBe(true);
    expect(reasons.some((x: string) => x.includes("مسجل مسبقًا"))).toBe(true);
    expect(reasons.some((x: string) => x.includes("مكرر داخل الملف"))).toBe(true);
  });

  it("التأكيد يدخل الصفوف السليمة فقط ويسجل دفعة بأخطاء", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const res: any = (await importGuests(a.ctx, ev.id, { csv: CSV, dryRun: false, filename: "guests.csv" }));
    expect(res.inserted).toBe(3);
    const guests = (await listGuests(a.ctx, ev.id));
    expect(guests.length).toBe(3);
    const batch = (await db.get<any>("SELECT * FROM import_batches WHERE id = ?", res.batch_id));
    expect(batch.inserted).toBe(3);
    expect(batch.skipped_duplicates).toBe(1);
    const errors = JSON.parse(batch.errors_json);
    expect(errors.length).toBe(2);
  });

  it("يرفض ملفًا بلا عمود اسم", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    try {
      (await importGuests(a.ctx, ev.id, { csv: "الهاتف,البريد\n+966501111111,x@y.z", dryRun: true }));
      throw new Error("should fail");
    } catch (e: any) {
      expect(e.code).toBe("VALIDATION");
    }
  });
});
