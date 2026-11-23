/** بوابة المورد ودليل الموردين — المورد يدير ملفه ومنتجاته وتوفره، وصاحب المناسبة يتصفح ويضيف */
import { newId, nowIso, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { writeAudit } from "@/lib/audit";
import { loadEventScoped } from "@/lib/permissions";
import { requirePlanningAccess } from "./planning";
const PRICING_TYPES = ["fixed", "per_person", "per_qty", "per_time"];

/* ===== أدوات مشتركة ===== */

/** اليوم (YYYY-MM-DD) بتوقيت المناسبة — التوفر يُحسب باليوم المحلي لا بتوقيت غرينتش */
export function localDay(iso: string, tz = "Asia/Riyadh"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** حجوزات مؤكدة للمورد في يوم معيّن (اعتماد اختيار من مناسبة غير ملغاة) */
async function bookingsOn(db: DB, profileId: string, day: string, excludeEventId?: string) {
  const rows = await db.all<{ event_id: string; starts_at: string; timezone: string }>(
    `SELECT e.id event_id, e.starts_at, e.timezone FROM vendors v JOIN events e ON e.id = v.event_id
     WHERE v.profile_id = ? AND v.selection_expense_id IS NOT NULL AND e.status NOT IN ('cancelled','archived') AND e.starts_at IS NOT NULL`,
    profileId
  );
  return rows.filter((r) => r.event_id !== excludeEventId && localDay(r.starts_at, r.timezone) === day).length;
}

/** توفر المورد في يوم: محجوب يدويًا، أو اكتملت سعته اليومية */
export async function availabilityOn(db: DB, profile: { id: string; daily_capacity: number }, day: string, excludeEventId?: string) {
  const blocked = await db.get<{ note: string | null }>("SELECT note FROM vendor_blocked_dates WHERE profile_id = ? AND day = ?", profile.id, day);
  if (blocked) return { available: false, reason: blocked.note || "غير متاح في هذا اليوم" };
  const booked = await bookingsOn(db, profile.id, day, excludeEventId);
  if (booked >= Number(profile.daily_capacity || 1)) return { available: false, reason: "محجوز بالكامل في هذا اليوم" };
  return { available: true, reason: null as string | null };
}

/* ===== جهة المورد ===== */

async function myProfile(ctx: Ctx) {
  return ctx.db.get<any>("SELECT * FROM vendor_profiles WHERE organization_id = ?", ctx.actor.orgId);
}

function requireOrgAdmin(ctx: Ctx) {
  if (!["owner", "admin"].includes(ctx.actor.orgRole)) err("FORBIDDEN", "إدارة ملف المورد لمالك مساحة العمل أو مشرفها");
}

async function requireMyProfile(ctx: Ctx) {
  const p = await myProfile(ctx);
  if (!p) err("NOT_FOUND", "أنشئ ملفك كمورد أولًا");
  return p;
}

export async function getMyVendor(ctx: Ctx) {
  const profile = await myProfile(ctx);
  if (!profile) return { profile: null, products: [], stats: null };
  const products = (await ctx.db.all<any>("SELECT * FROM catalog_products WHERE profile_id = ? ORDER BY active DESC, CASE kind WHEN 'package' THEN 0 ELSE 1 END, created_at", profile.id))
    .map((p) => ({ ...p, includes: JSON.parse(p.includes || "[]") }));
  const linked = Number((await ctx.db.get<{ n: number }>("SELECT COUNT(*) n FROM vendors WHERE profile_id = ?", profile.id))?.n ?? 0);
  const confirmed = Number((await ctx.db.get<{ n: number }>("SELECT COUNT(*) n FROM vendors WHERE profile_id = ? AND selection_expense_id IS NOT NULL", profile.id))?.n ?? 0);
  const rating = await ctx.db.get<{ avg: number | null; n: number }>("SELECT AVG(rating) avg, COUNT(rating) n FROM vendors WHERE profile_id = ? AND rating IS NOT NULL", profile.id);
  return {
    profile, products,
    stats: { linked, confirmed, rating: rating?.avg ? Math.round(Number(rating.avg) * 10) / 10 : null, ratings: Number(rating?.n ?? 0) },
  };
}

export async function saveMyProfile(ctx: Ctx, input: any) {
  requireOrgAdmin(ctx);
  const name = String(input.name ?? "").trim();
  const category = String(input.category ?? "").trim();
  if (!name || !category) err("VALIDATION", "اسم النشاط وفئته مطلوبان");
  const cap = Number(input.daily_capacity ?? 1);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) err("VALIDATION", "السعة اليومية من 1 إلى 100");
  const cur = await myProfile(ctx);
  const vals = [name, category, input.city?.trim() || null, input.phone?.trim() || null, input.description?.trim() || null, cap, input.is_public === false ? 0 : 1];
  if (cur) {
    await ctx.db.run(
      "UPDATE vendor_profiles SET name=?, category=?, city=?, phone=?, description=?, daily_capacity=?, is_public=?, updated_at=? WHERE id=?",
      ...vals, nowIso(), cur.id
    );
    // يبقى اسم المورد ورقمه محدّثين في المناسبات المرتبطة
    await ctx.db.run("UPDATE vendors SET name = ?, phone = COALESCE(?, phone) WHERE profile_id = ?", name, vals[3], cur.id);
  } else {
    await ctx.db.run(
      "INSERT INTO vendor_profiles (id, organization_id, name, category, city, phone, description, daily_capacity, is_public) VALUES (?,?,?,?,?,?,?,?,?)",
      newId(), ctx.actor.orgId, ...vals
    );
    await writeAudit(ctx.db, { orgId: ctx.actor.orgId, actorId: ctx.actor.user.id, action: "vendor.profile.create", objectType: "organization", objectId: ctx.actor.orgId, ip: ctx.ip });
  }
  return myProfile(ctx);
}

export async function saveMyProduct(ctx: Ctx, input: any, id?: string) {
  requireOrgAdmin(ctx);
  const profile = await requireMyProfile(ctx);
  const name = String(input.name ?? "").trim();
  if (!name) err("VALIDATION", "اسم المنتج أو الباقة مطلوب");
  if (!["product", "package"].includes(input.kind ?? "product")) err("VALIDATION", "النوع غير صالح");
  if (!PRICING_TYPES.includes(input.pricing_type ?? "fixed")) err("VALIDATION", "نوع التسعير غير صالح");
  const price = Number(input.unit_price ?? 0);
  if (!Number.isFinite(price) || price < 0) err("VALIDATION", "السعر غير صالح");
  const includes = JSON.stringify(Array.isArray(input.includes) ? input.includes.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 40) : []);
  const vals = [input.kind ?? "product", name, input.description?.trim() || null, input.pricing_type ?? "fixed", price, input.unit?.trim() || null, input.vat_included ? 1 : 0, includes, input.active === false ? 0 : 1];
  if (id) {
    const old = await ctx.db.get("SELECT id FROM catalog_products WHERE id = ? AND profile_id = ?", id, profile.id);
    if (!old) err("NOT_FOUND", "المنتج غير موجود");
    await ctx.db.run(
      "UPDATE catalog_products SET kind=?, name=?, description=?, pricing_type=?, unit_price=?, unit=?, vat_included=?, includes=?, active=? WHERE id=?",
      ...vals, id
    );
  } else {
    id = newId();
    await ctx.db.run(
      `INSERT INTO catalog_products (id, profile_id, organization_id, kind, name, description, pricing_type, unit_price, unit, vat_included, includes, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, profile.id, ctx.actor.orgId, ...vals
    );
  }
  return ctx.db.get("SELECT * FROM catalog_products WHERE id = ?", id);
}

export async function deleteMyProduct(ctx: Ctx, id: string) {
  requireOrgAdmin(ctx);
  const profile = await requireMyProfile(ctx);
  await ctx.db.run("DELETE FROM catalog_products WHERE id = ? AND profile_id = ?", id, profile.id);
  return { ok: true };
}

/** تقويم المورد: الأيام المحجوبة + الحجوزات المؤكدة + المناسبات المهتمة (مضاف ولم يُعتمد) */
export async function myCalendar(ctx: Ctx) {
  const profile = await requireMyProfile(ctx);
  const blocked = await ctx.db.all<any>("SELECT id, day, note FROM vendor_blocked_dates WHERE profile_id = ? ORDER BY day", profile.id);
  const rows = await ctx.db.all<any>(
    `SELECT v.id vendor_row_id, v.selection_expense_id, e.id event_id, e.title, e.starts_at, e.timezone, e.venue_name, e.status,
       o.name organizer, o.contact_phone organizer_phone, x.amount total
     FROM vendors v JOIN events e ON e.id = v.event_id JOIN organizations o ON o.id = e.organization_id
     LEFT JOIN expenses x ON x.id = v.selection_expense_id
     WHERE v.profile_id = ? AND e.status NOT IN ('cancelled','archived') ORDER BY e.starts_at`, profile.id
  );
  const bookings = [];
  for (const r of rows) {
    const items = await ctx.db.all<{ name: string; quantity: number | null; pricing_type: string }>(
      "SELECT name, quantity, pricing_type FROM vendor_products WHERE vendor_id = ? AND selected = 1", r.vendor_row_id
    );
    bookings.push({
      event_title: r.title, starts_at: r.starts_at, timezone: r.timezone, day: r.starts_at ? localDay(r.starts_at, r.timezone) : null,
      venue: r.venue_name, organizer: r.organizer, organizer_phone: r.organizer_phone,
      state: r.selection_expense_id ? "confirmed" : "interested",
      total: r.selection_expense_id ? Number(r.total ?? 0) : null,
      items: items.map((i) => i.name),
    });
  }
  return { daily_capacity: profile.daily_capacity, blocked, bookings };
}

export async function setBlockedDay(ctx: Ctx, input: { day: string; blocked: boolean; note?: string }) {
  requireOrgAdmin(ctx);
  const profile = await requireMyProfile(ctx);
  if (!isDay(input.day)) err("VALIDATION", "التاريخ غير صالح");
  if (input.blocked) {
    await ctx.db.run(
      `INSERT INTO vendor_blocked_dates (id, profile_id, day, note) VALUES (?,?,?,?)
       ON CONFLICT(profile_id, day) DO UPDATE SET note = excluded.note`,
      newId(), profile.id, input.day, input.note?.trim() || null
    );
  } else {
    await ctx.db.run("DELETE FROM vendor_blocked_dates WHERE profile_id = ? AND day = ?", profile.id, input.day);
  }
  return { ok: true };
}

/* ===== جهة صاحب المناسبة ===== */

/** دليل الموردين: الملفات العامة مع توفرها في يوم المناسبة وأقل سعر وتقييم المناسبات السابقة */
export async function vendorDirectory(ctx: Ctx, eventId: string, filters: { q?: string; category?: string; city?: string } = {}) {
  await requirePlanningAccess(ctx, eventId, "view");
  const event = await loadEventScoped(ctx.db, ctx.actor.orgId, eventId);
  const day = event.starts_at ? localDay(event.starts_at, event.timezone) : null;
  const where = ["p.is_public = 1"]; const args: any[] = [];
  if (filters.q?.trim()) { where.push("(p.name LIKE ? OR p.description LIKE ?)"); args.push(`%${filters.q.trim()}%`, `%${filters.q.trim()}%`); }
  if (filters.category) { where.push("p.category = ?"); args.push(filters.category); }
  if (filters.city) { where.push("p.city = ?"); args.push(filters.city); }
  const profiles = await ctx.db.all<any>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM catalog_products c WHERE c.profile_id = p.id AND c.active = 1) products,
       (SELECT MIN(c.unit_price) FROM catalog_products c WHERE c.profile_id = p.id AND c.active = 1) price_from,
       (SELECT AVG(v.rating) FROM vendors v WHERE v.profile_id = p.id AND v.rating IS NOT NULL) rating,
       (SELECT COUNT(v.rating) FROM vendors v WHERE v.profile_id = p.id AND v.rating IS NOT NULL) ratings,
       (SELECT v.id FROM vendors v WHERE v.profile_id = p.id AND v.event_id = ?) linked_vendor_id
     FROM vendor_profiles p WHERE ${where.join(" AND ")} ORDER BY p.name LIMIT 100`,
    eventId, ...args
  );
  const out = [];
  for (const p of profiles) {
    const av = day ? await availabilityOn(ctx.db, p, day, eventId) : { available: true, reason: null };
    out.push({
      id: p.id, name: p.name, category: p.category, city: p.city, phone: p.phone, description: p.description,
      products: Number(p.products), price_from: p.price_from === null ? null : Number(p.price_from),
      rating: p.rating === null ? null : Math.round(Number(p.rating) * 10) / 10, ratings: Number(p.ratings),
      linked: !!p.linked_vendor_id, available: av.available, unavailable_reason: av.reason,
    });
  }
  const categories = (await ctx.db.all<{ category: string }>("SELECT DISTINCT category FROM vendor_profiles WHERE is_public = 1 ORDER BY category")).map((r) => r.category);
  return { day, vendors: out, categories };
}

/** إضافة مورد من الدليل إلى المناسبة — تظهر منتجاته في «منتجات الموردين» */
export async function linkVendorProfile(ctx: Ctx, eventId: string, profileId: string) {
  await requirePlanningAccess(ctx, eventId, "services");
  const p = await ctx.db.get<any>("SELECT * FROM vendor_profiles WHERE id = ? AND is_public = 1", profileId);
  if (!p) err("NOT_FOUND", "المورد غير موجود في الدليل");
  const existing = await ctx.db.get<{ id: string }>("SELECT id FROM vendors WHERE event_id = ? AND profile_id = ?", eventId, profileId);
  if (existing) return { vendor_id: existing.id, already: true };
  const id = newId();
  await ctx.db.run(
    `INSERT INTO vendors (id, event_id, organization_id, name, category, phone, status, profile_id) VALUES (?,?,?,?,?,?, 'contacted', ?)`,
    id, eventId, ctx.actor.orgId, p.name, p.category, p.phone, profileId
  );
  await syncLinkedProducts(ctx.db, eventId);
  return { vendor_id: id, already: false };
}

/**
 * مزامنة منتجات الموردين المرتبطين بالدليل: المورد هو مصدر الحقيقة للاسم والسعر والوصف،
 * والاختيار والكمية يبقيان لصاحب المناسبة. المنتج الموقوف يُحذف إن لم يُختر، ويُعلَّم «غير متاح» إن كان مختارًا.
 */
export async function syncLinkedProducts(db: DB, eventId: string) {
  const linked = await db.all<{ id: string; profile_id: string; organization_id: string }>(
    "SELECT id, profile_id, organization_id FROM vendors WHERE event_id = ? AND profile_id IS NOT NULL", eventId
  );
  for (const v of linked) {
    const catalog = await db.all<any>("SELECT * FROM catalog_products WHERE profile_id = ?", v.profile_id);
    const current = await db.all<any>("SELECT id, catalog_product_id, selected FROM vendor_products WHERE vendor_id = ?", v.id);
    for (const c of catalog) {
      const row = current.find((r) => r.catalog_product_id === c.id);
      if (row) {
        await db.run(
          `UPDATE vendor_products SET kind=?, name=?, description=?, pricing_type=?, unit_price=?, unit=?, vat_included=?, includes=?, unavailable=? WHERE id=?`,
          c.kind, c.name, c.description, c.pricing_type, c.unit_price, c.unit, c.vat_included, c.includes, c.active ? 0 : 1, row.id
        );
        if (!c.active && !row.selected) await db.run("DELETE FROM vendor_products WHERE id = ?", row.id);
      } else if (c.active) {
        await db.run(
          `INSERT INTO vendor_products (id, event_id, organization_id, vendor_id, kind, name, description, pricing_type, unit_price, unit, vat_included, includes, catalog_product_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          newId(), eventId, v.organization_id, v.id, c.kind, c.name, c.description, c.pricing_type, c.unit_price, c.unit, c.vat_included, c.includes, c.id
        );
      }
    }
    // منتج حذفه المورد نهائيًا
    for (const r of current) {
      if (r.catalog_product_id && !catalog.some((c) => c.id === r.catalog_product_id)) {
        if (r.selected) await db.run("UPDATE vendor_products SET unavailable = 1 WHERE id = ?", r.id);
        else await db.run("DELETE FROM vendor_products WHERE id = ?", r.id);
      }
    }
  }
}

/** قبل اعتماد اختيار مورد من الدليل: التحقق من توفره في يوم المناسبة */
export async function assertVendorAvailable(db: DB, eventId: string, vendorRow: { profile_id: string | null }) {
  if (!vendorRow.profile_id) return;
  const event = await db.get<any>("SELECT starts_at, timezone FROM events WHERE id = ?", eventId);
  if (!event?.starts_at) return;
  const p = await db.get<any>("SELECT id, daily_capacity FROM vendor_profiles WHERE id = ?", vendorRow.profile_id);
  if (!p) return;
  const av = await availabilityOn(db, p, localDay(event.starts_at, event.timezone), eventId);
  if (!av.available) err("CONFLICT", `المورد غير متاح في يوم المناسبة: ${av.reason}`);
}
