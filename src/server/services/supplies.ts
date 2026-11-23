/** قائمتي: المستلزمات وحساب الكميات من عدد الضيوف، مع الضريبة والاحتياطي والربط بالميزانية */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { writeAudit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import {
  SUPPLY_CATEGORIES, SUPPLY_ITEMS, RESERVE_CATEGORY_NAME, SUPPLY_STATUS_AR,
  autoQty, ruleLabel, tableCount, guestTotal, type Headcount, type RuleType,
} from "@/lib/supplies-catalog";
import { requirePlanningAccess, getOrCreatePlan, vendorOf } from "./planning";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** عدد المؤكدين من آخر رد لكل دعوة، مقسومًا حسب قسم الضيف */
export async function confirmedHeadcount(ctx: Ctx, eventId: string) {
  const rows = await ctx.db.all<{ section: string | null; n: number }>(
    `SELECT g.section section, COALESCE(SUM(r.persons_confirmed),0) n
     FROM rsvps r JOIN invitations i ON i.id = r.invitation_id JOIN guests g ON g.id = i.guest_id
     WHERE i.event_id = ? AND i.status NOT IN ('draft','cancelled','expired') AND r.answer = 'confirmed'
       AND r.rowid = (SELECT r2.rowid FROM rsvps r2 WHERE r2.invitation_id = r.invitation_id
                      ORDER BY r2.occurred_at DESC, r2.rowid DESC LIMIT 1)
     GROUP BY g.section`, eventId
  );
  const by = (s: string | null) => Number(rows.find((r) => (r.section ?? null) === s)?.n ?? 0);
  return { men: by("men"), women: by("women"), unassigned: by(null) };
}

/** العدد المستخدم في الحساب: يدوي، أو المؤكدون (غير المحددين يُوزّعون بنسبة الخطة) */
async function effectiveHeadcount(ctx: Ctx, eventId: string, plan: any) {
  const manual: Headcount = {
    men: Number(plan.men_count || 0), women: Number(plan.women_count || 0),
    seats_per_table: Number(plan.seats_per_table || 8),
  };
  const confirmed = await confirmedHeadcount(ctx, eventId);
  if (plan.headcount_source !== "rsvp") return { headcount: manual, confirmed };
  const planned = manual.men + manual.women;
  const womenShare = planned > 0 ? manual.women / planned : 0.5;
  const extraWomen = Math.round(confirmed.unassigned * womenShare);
  return {
    headcount: {
      men: confirmed.men + (confirmed.unassigned - extraWomen),
      women: confirmed.women + extraWomen,
      seats_per_table: manual.seats_per_table,
    },
    confirmed,
  };
}

export async function getSupplies(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const plan = await getOrCreatePlan(ctx, eventId);
  const { headcount, confirmed } = await effectiveHeadcount(ctx, eventId, plan);
  const rows = await ctx.db.all<any>(
    "SELECT s.*, v.name vendor_name FROM event_supplies s LEFT JOIN vendors v ON v.id = s.vendor_id WHERE s.event_id = ? ORDER BY s.created_at", eventId
  );

  const items = rows.map((r) => {
    const rule = { t: r.rule_type as RuleType, v: Number(r.rule_value) };
    const auto = autoQty(rule, headcount);
    const qty = r.qty_override === null || r.qty_override === undefined ? auto : Number(r.qty_override);
    const price = Number(r.unit_price);
    return {
      ...r, rule_value: Number(r.rule_value), unit_price: price,
      qty_override: r.qty_override === null || r.qty_override === undefined ? null : Number(r.qty_override),
      rule_label: ruleLabel(rule), auto_qty: auto, qty, total: round2(qty * price),
    };
  });

  const subtotal = round2(items.reduce((a, i) => a + i.total, 0));
  const vatRate = Number(plan.vat_rate ?? 15);
  const vat = plan.vat_enabled ? round2((subtotal * vatRate) / 100) : 0;
  const reservePct = Number(plan.reserve_percent ?? 10);
  const reserve = round2(((subtotal + vat) * reservePct) / 100);
  const grand = round2(subtotal + vat + reserve);
  const budget = Number(plan.budget_total || 0);

  // تجميع حسب الفئة: التقدير مقابل نصيب الفئة من الميزانية
  const byCategory = SUPPLY_CATEGORIES.map((c) => {
    const list = items.filter((i) => i.category_key === c.id);
    const total = round2(list.reduce((a, i) => a + i.total, 0));
    const withVat = plan.vat_enabled ? round2(total * (1 + vatRate / 100)) : total;
    const target = round2((budget * c.pct * (1 - reservePct / 100)) / 100);
    return { id: c.id, name: c.name, pct: c.pct, count: list.length, total, total_with_vat: withVat, target, over: budget > 0 && withVat > target };
  });

  return {
    settings: {
      men_count: Number(plan.men_count || 0), women_count: Number(plan.women_count || 0),
      seats_per_table: Number(plan.seats_per_table || 8), reserve_percent: reservePct,
      vat_rate: vatRate, vat_enabled: !!plan.vat_enabled, headcount_source: plan.headcount_source ?? "manual",
      budget_total: budget,
    },
    headcount: { ...headcount, guests: guestTotal(headcount), tables: tableCount(headcount) },
    confirmed,
    items,
    categories: byCategory,
    top: [...items].sort((a, b) => b.total - a.total).slice(0, 10),
    totals: { subtotal, vat, reserve, grand, budget, over_budget: budget > 0 && grand > budget, diff: round2(budget - grand) },
  };
}

/** إضافة بنود من الكتالوج (أو القائمة الكاملة الافتراضية لحفل الزواج) — لا يكرر البنود الموجودة */
export async function addSupplies(ctx: Ctx, eventId: string, input: { item_keys?: string[]; preset?: "wedding_full" }) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const keys = input.preset === "wedding_full"
    ? SUPPLY_ITEMS.filter((i) => i.def).map((i) => i.id)
    : Array.isArray(input.item_keys) ? input.item_keys : [];
  if (keys.length === 0) err("VALIDATION", "اختر بندًا واحدًا على الأقل");
  let added = 0;
  await ctx.db.tx(async () => {
    for (const key of keys) {
      const it = SUPPLY_ITEMS.find((i) => i.id === key);
      if (!it) err("VALIDATION", `بند غير معروف: ${key}`);
      const exists = await ctx.db.get("SELECT id FROM event_supplies WHERE event_id = ? AND item_key = ?", eventId, key);
      if (exists) continue;
      await ctx.db.run(
        `INSERT INTO event_supplies (id, event_id, organization_id, item_key, category_key, name, unit, rule_type, rule_value, unit_price)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        newId(), eventId, ctx.actor.orgId, it.id, it.c, it.n, it.u, it.r.t, it.r.v, it.p
      );
      added++;
    }
  });
  await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "supplies.add", objectType: "event", objectId: eventId, detail: { added, preset: input.preset ?? null }, ip: ctx.ip,
  });
  return { added };
}

/** بند مخصص غير موجود في الكتالوج */
export async function addCustomSupply(ctx: Ctx, eventId: string, input: any) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const name = String(input.name ?? "").trim();
  if (!name) err("VALIDATION", "اسم البند مطلوب");
  if (!SUPPLY_CATEGORIES.some((c) => c.id === input.category_key)) err("VALIDATION", "فئة غير صالحة");
  const t = (input.rule_type ?? "f") as RuleType;
  if (!["g", "w", "m", "t", "gd", "f"].includes(t)) err("VALIDATION", "قاعدة كمية غير صالحة");
  const v = Number(input.rule_value ?? 1), p = Number(input.unit_price ?? 0);
  if (!Number.isFinite(v) || v < 0 || !Number.isFinite(p) || p < 0) err("VALIDATION", "قيم غير صالحة");
  const id = newId();
  await ctx.db.run(
    `INSERT INTO event_supplies (id, event_id, organization_id, item_key, category_key, name, unit, rule_type, rule_value, unit_price)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, eventId, ctx.actor.orgId, `custom-${id}`, input.category_key, name, String(input.unit ?? "قطعة").trim() || "قطعة", t, v, p
  );
  return ctx.db.get("SELECT * FROM event_supplies WHERE id = ?", id);
}

export async function updateSupply(ctx: Ctx, eventId: string, id: string, input: any) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const row = await ctx.db.get<any>("SELECT * FROM event_supplies WHERE id = ? AND event_id = ?", id, eventId);
  if (!row) err("NOT_FOUND", "البند غير موجود");
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const optNum = (v: unknown, label: string) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) err("VALIDATION", `${label} غير صالح`);
    return n;
  };
  if (has("status") && !Object.keys(SUPPLY_STATUS_AR).includes(input.status)) err("VALIDATION", "حالة غير صالحة");
  await ctx.db.run(
    "UPDATE event_supplies SET qty_override = ?, unit_price = ?, status = ?, notes = ?, rule_value = ?, vendor_id = ? WHERE id = ?",
    has("qty_override") ? optNum(input.qty_override, "الكمية") : row.qty_override,
    has("unit_price") ? (optNum(input.unit_price, "السعر") ?? 0) : row.unit_price,
    has("status") ? input.status : row.status,
    has("notes") ? input.notes || null : row.notes,
    has("rule_value") ? (optNum(input.rule_value, "المعامل") ?? row.rule_value) : row.rule_value,
    has("vendor_id") ? await vendorOf(ctx, eventId, input.vendor_id) : row.vendor_id,
    id
  );
  return ctx.db.get("SELECT * FROM event_supplies WHERE id = ?", id);
}

export async function removeSupply(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  await ctx.db.run("DELETE FROM event_supplies WHERE id = ? AND event_id = ?", id, eventId);
  return { ok: true };
}

/** نقل عدد المؤكدين (رجال/نساء) إلى الخطة كعدد يدوي ثابت */
export async function syncHeadcountFromRsvp(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const plan = await getOrCreatePlan(ctx, eventId);
  const c = await confirmedHeadcount(ctx, eventId);
  if (c.men + c.women + c.unassigned === 0) err("VALIDATION", "لا توجد ردود مؤكدة بعد");
  const planned = Number(plan.men_count || 0) + Number(plan.women_count || 0);
  const womenShare = planned > 0 ? Number(plan.women_count || 0) / planned : 0.5;
  const extraWomen = Math.round(c.unassigned * womenShare);
  const men = c.men + (c.unassigned - extraWomen), women = c.women + extraWomen;
  await ctx.db.run(
    "UPDATE event_plans SET men_count = ?, women_count = ?, updated_at = ? WHERE id = ?", men, women, nowIso(), plan.id
  );
  return { men, women, confirmed: c };
}

/** اعتماد التقدير في الميزانية: يضبط المبلغ المخطط لكل فئة من تقدير المستلزمات + بند الاحتياطي */
export async function pushSuppliesToBudget(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  const s = await getSupplies(ctx, eventId);
  if (s.items.length === 0) err("VALIDATION", "قائمتك فارغة — أضف بنودًا أولًا");
  let updated = 0;
  await ctx.db.tx(async () => {
    const upsert = async (name: string, amount: number, order: number) => {
      const cur = await ctx.db.get<{ id: string }>("SELECT id FROM budget_categories WHERE event_id = ? AND name = ?", eventId, name);
      if (cur) await ctx.db.run("UPDATE budget_categories SET planned_amount = ?, sort_order = ? WHERE id = ?", amount, order, cur.id);
      else await ctx.db.run(
        "INSERT INTO budget_categories (id, event_id, organization_id, name, planned_amount, sort_order) VALUES (?,?,?,?,?,?)",
        newId(), eventId, ctx.actor.orgId, name, amount, order
      );
      updated++;
    };
    for (const [i, c] of s.categories.entries()) {
      if (c.count > 0) await upsert(c.name, Math.round(c.total_with_vat), i);
    }
    if (s.totals.reserve > 0) await upsert(RESERVE_CATEGORY_NAME, Math.round(s.totals.reserve), 99);
  });
  await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "supplies.push_budget", objectType: "event", objectId: eventId, detail: { updated, grand: s.totals.grand }, ip: ctx.ip,
  });
  return { updated, grand: s.totals.grand };
}

export async function exportSuppliesCsv(ctx: Ctx, eventId: string): Promise<string> {
  const s = await getSupplies(ctx, eventId);
  const cat = (id: string) => SUPPLY_CATEGORIES.find((c) => c.id === id)?.name ?? "";
  return toCsv(
    ["الفئة", "البند", "الوحدة", "قاعدة الكمية", "الكمية", "سعر الوحدة", "الإجمالي", "الحالة"],
    [
      ...s.items.map((i: any) => [cat(i.category_key), i.name, i.unit, i.rule_label, i.qty, i.unit_price, i.total, SUPPLY_STATUS_AR[i.status as keyof typeof SUPPLY_STATUS_AR]]),
      ["", "المجموع قبل الضريبة", "", "", "", "", s.totals.subtotal, ""],
      ["", "الضريبة", "", "", "", "", s.totals.vat, ""],
      ["", "الاحتياطي", "", "", "", "", s.totals.reserve, ""],
      ["", "الإجمالي التقديري", "", "", "", "", s.totals.grand, ""],
    ]
  );
}
