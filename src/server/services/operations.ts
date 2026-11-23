/** تشغيل المناسبة: كتالوج منتجات الموردين، تقييم الموردين، التنبيهات والمراجعة الأسبوعية، وجدول اليوم المعتمد للموردين */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { writeAudit } from "@/lib/audit";
import { loadEventScoped } from "@/lib/permissions";
import { requirePlanningAccess, getOrCreatePlan } from "./planning";
import { getSupplies } from "./supplies";
import { syncLinkedProducts, assertVendorAvailable } from "./vendor-portal";

export const PRICING_AR = {
  fixed: "سعر ثابت",
  per_person: "للفرد",
  per_qty: "حسب الكمية",
  per_time: "بالساعة أو اليوم",
} as const;
export type PricingType = keyof typeof PRICING_AR;

/** ما يُكتب في الباقة حتى لا يبقى «مسكوتًا عنه» (أكثر بنود الخلاف في الضيافة) */
export const PACKAGE_INCLUDES = [
  "التقديم وعمال الخدمة", "الأدوات (صحون وأكواب وملاعق)", "النقل والتجهيز", "الطباخون والمشرف",
  "الضيوف الزائدون عن العدد", "وجبات الأطفال", "القهوة والتمر والشاي", "التنظيف بعد الحفل",
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** الكمية الفعلية: المدخلة، أو تلقائيًا (للفرد = عدد الضيوف المخطط، غيره = 1) */
export function productQty(p: { pricing_type: string; quantity: number | null }, guests: number) {
  if (p.pricing_type === "fixed") return 1;
  if (p.quantity !== null && p.quantity !== undefined) return Number(p.quantity);
  return p.pricing_type === "per_person" ? guests : 1;
}

/** إجمالي البند شاملًا الضريبة — السعر يُوضَّح لكل منتج هل يشمل الضريبة أم لا */
export function productTotals(p: { pricing_type: string; unit_price: number; quantity: number | null; vat_included: number | boolean }, guests: number, vatRate: number) {
  const qty = productQty(p, guests);
  const base = Number(p.unit_price) * qty;
  const total = p.vat_included ? base : base * (1 + vatRate / 100);
  const vat = p.vat_included ? base - base / (1 + vatRate / 100) : total - base;
  return { qty, base: round2(base), vat: round2(vat), total: round2(total) };
}

async function catalogContext(ctx: Ctx, eventId: string) {
  const plan = await getOrCreatePlan(ctx, eventId);
  const supplies = await getSupplies(ctx, eventId);
  return { vatRate: Number(plan.vat_rate ?? 15), guests: supplies.headcount.guests };
}

/** كتالوج الموردين: كل مورد ومنتجاته وباقاته، مع ما اختاره صاحب المناسبة وإجماليه */
export async function listCatalog(ctx: Ctx, eventId: string) {
  await requirePlanningAccess(ctx, eventId, "view");
  await syncLinkedProducts(ctx.db, eventId);
  const { vatRate, guests } = await catalogContext(ctx, eventId);
  const vendors = await ctx.db.all<any>(
    "SELECT id, name, category, phone, contact_name, status, rating, selection_expense_id, profile_id FROM vendors WHERE event_id = ? ORDER BY category, name", eventId
  );
  const products = await ctx.db.all<any>("SELECT * FROM vendor_products WHERE event_id = ? ORDER BY CASE kind WHEN 'package' THEN 0 ELSE 1 END, created_at", eventId);
  const out = vendors.map((v) => {
    const list = products.filter((p) => p.vendor_id === v.id).map((p) => ({
      ...p, includes: JSON.parse(p.includes || "[]"), quantity: p.quantity === null ? null : Number(p.quantity),
      ...productTotals(p, guests, vatRate),
    }));
    const chosen = list.filter((p) => p.selected);
    return {
      ...v, products: list, managed_by_vendor: !!v.profile_id,
      selected_count: chosen.length,
      selected_total: round2(chosen.reduce((a, p) => a + p.total, 0)),
      confirmed: !!v.selection_expense_id,
    };
  });
  return {
    vat_rate: vatRate, guests, package_includes: PACKAGE_INCLUDES,
    vendors: out,
    grand_total: round2(out.reduce((a, v) => a + v.selected_total, 0)),
  };
}

/** المورد (أو فريق الخدمات) يضيف منتجاته وباقاته */
export async function saveProduct(ctx: Ctx, eventId: string, input: any, id?: string) {
  await requirePlanningAccess(ctx, eventId, "services");
  const name = String(input.name ?? "").trim();
  if (!name) err("VALIDATION", "اسم المنتج أو الباقة مطلوب");
  const owner = input.vendor_id ? await ctx.db.get<{ profile_id: string | null }>("SELECT profile_id FROM vendors WHERE id = ? AND event_id = ?", input.vendor_id, eventId) : undefined;
  if (!owner) err("VALIDATION", "المورد غير موجود في هذه المناسبة");
  if (owner.profile_id) err("CONFLICT", "منتجات هذا المورد يديرها المورد من بوابته — تظهر هنا محدّثة تلقائيًا");
  if (id && (await ctx.db.get<any>("SELECT catalog_product_id FROM vendor_products WHERE id = ?", id))?.catalog_product_id)
    err("CONFLICT", "منتجات هذا المورد يديرها المورد من بوابته");
  if (!["product", "package"].includes(input.kind ?? "product")) err("VALIDATION", "النوع غير صالح");
  if (!Object.keys(PRICING_AR).includes(input.pricing_type ?? "fixed")) err("VALIDATION", "نوع التسعير غير صالح");
  const price = Number(input.unit_price ?? 0);
  if (!Number.isFinite(price) || price < 0) err("VALIDATION", "السعر غير صالح");
  const includes = JSON.stringify(Array.isArray(input.includes) ? input.includes.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 40) : []);
  if (id) {
    const old = await ctx.db.get("SELECT id FROM vendor_products WHERE id = ? AND event_id = ?", id, eventId);
    if (!old) err("NOT_FOUND", "المنتج غير موجود");
    await ctx.db.run(
      `UPDATE vendor_products SET vendor_id=?, kind=?, name=?, description=?, pricing_type=?, unit_price=?, unit=?, vat_included=?, includes=? WHERE id=?`,
      input.vendor_id, input.kind ?? "product", name, input.description || null, input.pricing_type ?? "fixed", price,
      input.unit || null, input.vat_included ? 1 : 0, includes, id
    );
  } else {
    id = newId();
    await ctx.db.run(
      `INSERT INTO vendor_products (id, event_id, organization_id, vendor_id, kind, name, description, pricing_type, unit_price, unit, vat_included, includes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, input.vendor_id, input.kind ?? "product", name, input.description || null,
      input.pricing_type ?? "fixed", price, input.unit || null, input.vat_included ? 1 : 0, includes
    );
  }
  return ctx.db.get("SELECT * FROM vendor_products WHERE id = ?", id);
}

export async function deleteProduct(ctx: Ctx, eventId: string, id: string) {
  await requirePlanningAccess(ctx, eventId, "services");
  if ((await ctx.db.get<any>("SELECT catalog_product_id FROM vendor_products WHERE id = ? AND event_id = ?", id, eventId))?.catalog_product_id)
    err("CONFLICT", "منتجات هذا المورد يديرها المورد من بوابته");
  await ctx.db.run("DELETE FROM vendor_products WHERE id = ? AND event_id = ?", id, eventId);
  return { ok: true };
}

/** صاحب المناسبة يختار المنتج ويحدد الكمية (فارغة = تلقائية) */
export async function selectProduct(ctx: Ctx, eventId: string, id: string, input: { selected?: boolean; quantity?: number | null }) {
  await requirePlanningAccess(ctx, eventId, "plan");
  const p = await ctx.db.get<any>("SELECT * FROM vendor_products WHERE id = ? AND event_id = ?", id, eventId);
  if (!p) err("NOT_FOUND", "المنتج غير موجود");
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  let qty = p.quantity;
  if (has("quantity")) {
    qty = input.quantity === null || (input.quantity as any) === "" ? null : Number(input.quantity);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0)) err("VALIDATION", "الكمية غير صالحة");
  }
  await ctx.db.run(
    "UPDATE vendor_products SET selected = ?, quantity = ? WHERE id = ?",
    has("selected") ? (input.selected ? 1 : 0) : p.selected, qty, id
  );
  return ctx.db.get("SELECT * FROM vendor_products WHERE id = ?", id);
}

/** اعتماد اختيارات مورد: مصروف مخطط واحد شامل الضريبة (يُحدَّث إن اعتُمد سابقًا)، والمورد يصبح «متعاقد» */
export async function confirmVendorSelection(ctx: Ctx, eventId: string, vendorId: string, input: { category_id?: string | null } = {}) {
  await requirePlanningAccess(ctx, eventId, "finance");
  const v = await ctx.db.get<any>("SELECT * FROM vendors WHERE id = ? AND event_id = ?", vendorId, eventId);
  if (!v) err("NOT_FOUND", "المورد غير موجود");
  if (input.category_id && !(await ctx.db.get("SELECT id FROM budget_categories WHERE id = ? AND event_id = ?", input.category_id, eventId)))
    err("VALIDATION", "فئة الميزانية غير موجودة");
  await assertVendorAvailable(ctx.db, eventId, v);
  const { vatRate, guests } = await catalogContext(ctx, eventId);
  if (await ctx.db.get("SELECT id FROM vendor_products WHERE vendor_id = ? AND selected = 1 AND unavailable = 1", vendorId))
    err("CONFLICT", "بعض اختياراتك أوقفها المورد — ألغِ اختيارها أولًا");
  const chosen = (await ctx.db.all<any>("SELECT * FROM vendor_products WHERE vendor_id = ? AND event_id = ? AND selected = 1", vendorId, eventId))
    .map((p) => ({ ...p, ...productTotals(p, guests, vatRate) }));
  if (chosen.length === 0) err("VALIDATION", "لم تختر أي منتج من هذا المورد");
  const total = round2(chosen.reduce((a, p) => a + p.total, 0));
  const vat = round2(chosen.reduce((a, p) => a + p.vat, 0));
  const notes = chosen.map((p) => `${p.name} × ${p.qty}`).join("، ");
  let expenseId: string = v.selection_expense_id;
  await ctx.db.tx(async () => {
    const existing = expenseId ? await ctx.db.get<any>("SELECT id, status FROM expenses WHERE id = ? AND event_id = ?", expenseId, eventId) : null;
    if (existing && existing.status !== "cancelled") {
      await ctx.db.run(
        "UPDATE expenses SET amount = ?, vat_amount = ?, notes = ?, category_id = COALESCE(?, category_id) WHERE id = ?",
        total, vat, notes, input.category_id || null, expenseId
      );
    } else {
      expenseId = newId();
      await ctx.db.run(
        `INSERT INTO expenses (id, event_id, organization_id, category_id, vendor_id, title, amount, vat_amount, status, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,'planned',?,?)`,
        expenseId, eventId, ctx.actor.orgId, input.category_id || null, vendorId, `اختيارات ${v.name}`, total, vat, notes, ctx.actor.user.id
      );
    }
    await ctx.db.run(
      "UPDATE vendors SET selection_expense_id = ?, status = CASE WHEN status IN ('potential','contacted') THEN 'contracted' ELSE status END WHERE id = ?",
      expenseId, vendorId
    );
  });
  await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "vendor.selection.confirm", objectType: "vendor", objectId: vendorId, detail: { total, items: chosen.length }, ip: ctx.ip,
  });
  return { expense_id: expenseId, total, items: chosen.length };
}


/** تقييم المورد بعد المناسبة */
export async function rateVendor(ctx: Ctx, eventId: string, vendorId: string, input: { rating?: number | null; review?: string }) {
  await requirePlanningAccess(ctx, eventId, "services");
  const v = await ctx.db.get("SELECT id FROM vendors WHERE id = ? AND event_id = ?", vendorId, eventId);
  if (!v) err("NOT_FOUND", "المورد غير موجود");
  const r = input.rating === null || input.rating === undefined ? null : Number(input.rating);
  if (r !== null && (!Number.isInteger(r) || r < 1 || r > 5)) err("VALIDATION", "التقييم من 1 إلى 5");
  await ctx.db.run("UPDATE vendors SET rating = ?, review = ? WHERE id = ?", r, input.review?.trim() || null, vendorId);
  return ctx.db.get("SELECT * FROM vendors WHERE id = ?", vendorId);
}

/* ===== التنبيهات والمراجعة الأسبوعية ===== */
export interface Alert { level: "danger" | "warning" | "info"; key: string; title: string; detail: string; seg: string }

export async function eventAlerts(ctx: Ctx, eventId: string, now = Date.now()): Promise<{ alerts: Alert[]; counts: Record<string, number> }> {
  await requirePlanningAccess(ctx, eventId, "view");
  const db = ctx.db;
  const event = await loadEventScoped(db, ctx.actor.orgId, eventId);
  const nowIsoStr = new Date(now).toISOString();
  const weekIso = new Date(now + 7 * 864e5).toISOString();
  await markOverduePayments(ctx, eventId, nowIsoStr);
  const n = async (sql: string, ...a: any[]) => Number((await db.get<{ n: number }>(sql, ...a))?.n ?? 0);
  const alerts: Alert[] = [];

  const overdueTasks = await db.all<{ title: string }>(
    "SELECT title FROM tasks WHERE event_id = ? AND status != 'done' AND due_date IS NOT NULL AND due_date < ? ORDER BY due_date LIMIT 5", eventId, nowIsoStr
  );
  const overdueTaskCount = await n("SELECT COUNT(*) n FROM tasks WHERE event_id = ? AND status != 'done' AND due_date IS NOT NULL AND due_date < ?", eventId, nowIsoStr);
  if (overdueTaskCount > 0) alerts.push({
    level: "danger", key: "tasks_overdue", seg: "tasks",
    title: `${overdueTaskCount} مهمة متأخرة`, detail: overdueTasks.map((t) => t.title).join("، ") + (overdueTaskCount > 5 ? "…" : ""),
  });
  const weekTasks = await n("SELECT COUNT(*) n FROM tasks WHERE event_id = ? AND status != 'done' AND due_date >= ? AND due_date <= ?", eventId, nowIsoStr, weekIso);
  if (weekTasks > 0) alerts.push({ level: "warning", key: "tasks_week", seg: "tasks", title: `${weekTasks} مهمة موعدها هذا الأسبوع`, detail: "راجعها مع المسؤولين عنها" });

  const overduePay = await db.get<{ n: number; s: number }>(
    "SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM payments WHERE event_id = ? AND status = 'overdue'", eventId
  );
  if (Number(overduePay?.n) > 0) alerts.push({
    level: "danger", key: "payments_overdue", seg: "payments",
    title: `${Number(overduePay!.n)} دفعة متأخرة`, detail: `بإجمالي ${Math.round(Number(overduePay!.s)).toLocaleString("en-US")} ر.س`,
  });
  const weekPay = await db.get<{ n: number; s: number }>(
    "SELECT COUNT(*) n, COALESCE(SUM(amount),0) s FROM payments WHERE event_id = ? AND status = 'pending' AND due_date >= ? AND due_date <= ?", eventId, nowIsoStr, weekIso
  );
  if (Number(weekPay?.n) > 0) alerts.push({
    level: "warning", key: "payments_week", seg: "payments",
    title: `${Number(weekPay!.n)} دفعة مستحقة خلال 7 أيام`, detail: `بإجمالي ${Math.round(Number(weekPay!.s)).toLocaleString("en-US")} ر.س`,
  });

  const overCats = await db.all<{ name: string }>(
    `SELECT bc.name FROM budget_categories bc WHERE bc.event_id = ? AND bc.planned_amount > 0
       AND COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.category_id = bc.id AND e.status != 'cancelled'),0) > bc.planned_amount`, eventId
  );
  if (overCats.length > 0) alerts.push({
    level: "danger", key: "budget_over", seg: "budget", title: `تجاوز في ${overCats.length} من فئات الميزانية`, detail: overCats.map((c) => c.name).join("، "),
  });

  const supplies = await getSupplies(ctx, eventId);
  if (supplies.totals.over_budget) alerts.push({
    level: "warning", key: "supplies_over", seg: "supplies",
    title: "تقدير المستلزمات أعلى من الميزانية", detail: `الفرق ${Math.round(-supplies.totals.diff).toLocaleString("en-US")} ر.س`,
  });
  const daysLeft = event.starts_at ? (Date.parse(event.starts_at) - now) / 864e5 : Infinity;
  const pendingItems = supplies.items.filter((i: any) => i.status === "req").length;
  if (daysLeft <= 30 && daysLeft > -1 && pendingItems > 0) alerts.push({
    level: "warning", key: "supplies_pending", seg: "supplies",
    title: `${pendingItems} بند في قائمتي لم يُختر مورده بعد`, detail: `باقي ${Math.max(0, Math.ceil(daysLeft))} يوم على المناسبة`,
  });

  if (event.rsvp_deadline && Date.parse(event.rsvp_deadline) - now <= 3 * 864e5 && Date.parse(event.rsvp_deadline) > now) {
    const waiting = await n(
      `SELECT COUNT(*) n FROM invitations i WHERE i.event_id = ? AND i.status IN ('issued','delivered','seen')
         AND NOT EXISTS (SELECT 1 FROM rsvps r WHERE r.invitation_id = i.id)`, eventId
    );
    if (waiting > 0) alerts.push({ level: "info", key: "rsvp_waiting", seg: "guests", title: `${waiting} ضيف لم يرد بعد`, detail: "آخر موعد للرد خلال 3 أيام — ذكّرهم" });
  }

  const dayNoOwner = await n(
    "SELECT COUNT(*) n FROM timeline_items WHERE event_id = ? AND phase = 'event_day' AND owner_id IS NULL AND vendor_id IS NULL AND (owner_label IS NULL OR owner_label = '')", eventId
  );
  if (dayNoOwner > 0) alerts.push({
    level: "info", key: "day_no_owner", seg: "timeline", title: `${dayNoOwner} خطوة في جدول اليوم بلا مسؤول`, detail: "كل خطوة بلا مسؤول لن تُنجز",
  });

  if (["ended", "archived"].includes(event.status) || daysLeft < -1) {
    const unrated = await n("SELECT COUNT(*) n FROM vendors WHERE event_id = ? AND status IN ('contracted','done') AND rating IS NULL", eventId);
    if (unrated > 0) alerts.push({ level: "info", key: "vendors_unrated", seg: "closing", title: `قيّم ${unrated} مورد`, detail: "التقييم يفيدك في مناسباتك القادمة" });
  }

  const order = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return {
    alerts,
    counts: { danger: alerts.filter((a) => a.level === "danger").length, warning: alerts.filter((a) => a.level === "warning").length, info: alerts.filter((a) => a.level === "info").length },
  };
}

/** الدفعة المعلقة التي تجاوز موعدها تصبح «متأخرة» */
export async function markOverduePayments(ctx: Ctx, eventId: string, at = nowIso()) {
  await ctx.db.run(
    "UPDATE payments SET status = 'overdue' WHERE event_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?", eventId, at
  );
}

/* ===== جدول اليوم المعتمد ===== */

/** إزاحة خطوات يوم المناسبة بعدد دقائق (عند تغيير وقت بداية الاستقبال) */
export async function shiftDaySchedule(ctx: Ctx, eventId: string, minutes: number) {
  await requirePlanningAccess(ctx, eventId, "plan");
  if (!Number.isFinite(minutes) || Math.abs(minutes) > 7 * 24 * 60) err("VALIDATION", "مقدار الإزاحة غير صالح");
  const rows = await ctx.db.all<{ id: string; starts_at: string }>(
    "SELECT id, starts_at FROM timeline_items WHERE event_id = ? AND phase = 'event_day' AND starts_at IS NOT NULL", eventId
  );
  await ctx.db.tx(async () => {
    for (const r of rows) {
      await ctx.db.run("UPDATE timeline_items SET starts_at = ? WHERE id = ?", new Date(Date.parse(r.starts_at) + minutes * 60e3).toISOString(), r.id);
    }
  });
  return { shifted: rows.length };
}

/** عند تغيير موعد المناسبة: تُزاح المهام غير المنجزة ومراحل الجدول بالفرق نفسه (كل محطة مرتبطة بالموعد) */
export async function shiftPlanForNewDate(ctx: Ctx, eventId: string, oldStart: string | null, newStart: string | null) {
  if (!oldStart || !newStart) return { shifted: 0 };
  const delta = Date.parse(newStart) - Date.parse(oldStart);
  if (!Number.isFinite(delta) || delta === 0) return { shifted: 0 };
  const shift = (iso: string) => new Date(Date.parse(iso) + delta).toISOString();
  let shifted = 0;
  await ctx.db.tx(async () => {
    const tasks = await ctx.db.all<{ id: string; due_date: string }>(
      "SELECT id, due_date FROM tasks WHERE event_id = ? AND status != 'done' AND due_date IS NOT NULL", eventId
    );
    for (const t of tasks) { await ctx.db.run("UPDATE tasks SET due_date = ? WHERE id = ?", shift(t.due_date), t.id); shifted++; }
    const tl = await ctx.db.all<{ id: string; starts_at: string }>(
      "SELECT id, starts_at FROM timeline_items WHERE event_id = ? AND done = 0 AND starts_at IS NOT NULL", eventId
    );
    for (const t of tl) { await ctx.db.run("UPDATE timeline_items SET starts_at = ? WHERE id = ?", shift(t.starts_at), t.id); shifted++; }
  });
  return { shifted };
}

/** الجدول الواحد المعتمد ليوم المناسبة مع رقم تواصل كل مورد — للطباعة والإرسال للموردين */
export async function daySheet(ctx: Ctx, eventId: string) {
  await requirePlanningAccess(ctx, eventId, "view");
  const event = await loadEventScoped(ctx.db, ctx.actor.orgId, eventId);
  const steps = await ctx.db.all<any>(
    `SELECT tl.id, tl.title, tl.starts_at, tl.owner_label, tl.show_to_guests, tl.done, v.name vendor_name, v.phone vendor_phone, v.contact_name vendor_contact
     FROM timeline_items tl LEFT JOIN vendors v ON v.id = tl.vendor_id
     WHERE tl.event_id = ? AND tl.phase = 'event_day' ORDER BY tl.starts_at, tl.sort_order`, eventId
  );
  const contacts = await ctx.db.all<any>(
    "SELECT name, category, contact_name, phone FROM vendors WHERE event_id = ? AND status IN ('contracted','done') ORDER BY category, name", eventId
  );
  return {
    event: { title: event.title, starts_at: event.starts_at, timezone: event.timezone, venue_name: event.venue_name, venue_address: event.venue_address, map_url: event.map_url },
    steps, contacts,
  };
}

/* ===== التهاني من الضيوف (اترك بصمتك الجميلة) ===== */
export async function listWishes(ctx: Ctx, eventId: string) {
  await requirePlanningAccess(ctx, eventId, "view");
  return ctx.db.all<any>(
    `SELECT w.id, w.message, w.hidden, w.created_at, w.updated_at, g.name guest_name, g.title guest_title,
       (SELECT r.answer FROM rsvps r WHERE r.invitation_id = w.invitation_id ORDER BY r.occurred_at DESC LIMIT 1) answer
     FROM guest_wishes w JOIN invitations i ON i.id = w.invitation_id JOIN guests g ON g.id = i.guest_id
     WHERE w.event_id = ? ORDER BY w.created_at DESC`, eventId
  );
}

export async function setWishHidden(ctx: Ctx, eventId: string, wishId: string, hidden: boolean) {
  await requirePlanningAccess(ctx, eventId, "plan");
  const w = await ctx.db.get("SELECT id FROM guest_wishes WHERE id = ? AND event_id = ?", wishId, eventId);
  if (!w) err("NOT_FOUND", "التهنئة غير موجودة");
  await ctx.db.run("UPDATE guest_wishes SET hidden = ? WHERE id = ?", hidden ? 1 : 0, wishId);
  return { ok: true };
}
