/** الميزانية والمصروفات والمدفوعات — فصل صارم بين المصروف الفعلي والمدفوع والالتزامات */
import { newId, nowIso, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { writeAudit } from "@/lib/audit";
import { requirePlanningAccess, getOrCreatePlan } from "./planning";
import { markOverduePayments } from "./operations";

const sum = async (db: DB, sql: string, ...a: any[]) => Number((await db.get<{ n: number }>(sql, ...a))?.n ?? 0);

export async function financeSummary(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  const db = ctx.db;
  const plan = (await getOrCreatePlan(ctx, eventId));
  await markOverduePayments(ctx, eventId);
  const budget = Number(plan.budget_total || 0);
  const committed = await sum(db, "SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE event_id = ? AND status != 'cancelled'", eventId);
  const spentActual = await sum(db, "SELECT COALESCE(SUM(amount),0) n FROM expenses WHERE event_id = ? AND status = 'paid'", eventId);
  const paidCash = await sum(db, "SELECT COALESCE(SUM(amount),0) n FROM payments WHERE event_id = ? AND status = 'paid'", eventId);
  const obligations = await sum(db, "SELECT COALESCE(SUM(amount),0) n FROM payments WHERE event_id = ? AND status IN ('pending','overdue')", eventId);
  const confirmedPersons = await sum(db,
    `SELECT COALESCE(SUM(r.persons_confirmed),0) n FROM rsvps r
     WHERE r.answer = 'confirmed' AND r.invitation_id IN (SELECT id FROM invitations WHERE event_id = ? AND status NOT IN ('draft','cancelled','expired'))
       AND r.rowid = (SELECT r2.rowid FROM rsvps r2 WHERE r2.invitation_id = r.invitation_id
                      ORDER BY r2.occurred_at DESC, r2.rowid DESC LIMIT 1)`, eventId);
  const categories = (await db.all(
    `SELECT bc.id, bc.name, bc.planned_amount,
      COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.category_id = bc.id AND e.status != 'cancelled'),0) committed,
      COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.category_id = bc.id AND e.status = 'paid'),0) spent
     FROM budget_categories bc WHERE bc.event_id = ? ORDER BY bc.sort_order, bc.name`, eventId
  ));
  return {
    budget, committed, spent_actual: spentActual, paid_cash: paidCash, obligations,
    remaining_actual: budget - spentActual,
    remaining_committed: budget - committed,
    usage_percent: budget > 0 ? Math.round((spentActual / budget) * 100) : 0,
    hospitality: {
      confirmed_persons: confirmedPersons,
      cost_per_person: Number(plan.hospitality_cost_per_person || 0),
      estimate: confirmedPersons * Number(plan.hospitality_cost_per_person || 0),
    },
    categories,
  };
}

export async function listExpenses(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  return (await ctx.db.all(
    `SELECT e.*, bc.name category_name, v.name vendor_name, u.name creator_name
     FROM expenses e LEFT JOIN budget_categories bc ON bc.id = e.category_id
     LEFT JOIN vendors v ON v.id = e.vendor_id LEFT JOIN users u ON u.id = e.created_by
     WHERE e.event_id = ? ORDER BY COALESCE(e.expense_date, e.created_at) DESC`, eventId
  ));
}

export async function saveExpense(ctx: Ctx, eventId: string, input: any, id?: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  if (!input.title?.trim()) err("VALIDATION", "اسم المصروف مطلوب");
  let amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) err("VALIDATION", "مبلغ غير صالح");
  const db = ctx.db;
  // الضريبة جزء من التكلفة: add_vat يعني أن المبلغ المدخل قبل الضريبة فتُضاف إليه
  let vatAmount = Number(input.vat_amount ?? 0);
  if (input.add_vat) {
    const rate = Number((await getOrCreatePlan(ctx, eventId)).vat_rate ?? 15);
    vatAmount = Math.round(amount * rate) / 100;
    amount = Math.round((amount + vatAmount) * 100) / 100;
  }
  if (!Number.isFinite(vatAmount) || vatAmount < 0 || vatAmount > amount) err("VALIDATION", "مبلغ الضريبة غير صالح");
  if (id) {
    const old = (await db.get("SELECT * FROM expenses WHERE id = ? AND event_id = ?", id, eventId));
    if (!old) err("NOT_FOUND");
    (await db.run(
      `UPDATE expenses SET title=?, amount=?, vat_amount=?, category_id=?, vendor_id=?, expense_date=?, status=?, notes=?, attachment_id=? WHERE id=?`,
      input.title.trim(), amount, vatAmount, input.category_id || null, input.vendor_id || null, input.expense_date || null,
      input.status ?? old.status, input.notes ?? null, input.attachment_id || null, id
    ));
  } else {
    id = newId();
    (await db.run(
      `INSERT INTO expenses (id, event_id, organization_id, category_id, vendor_id, title, amount, vat_amount, expense_date, status, notes, attachment_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, input.category_id || null, input.vendor_id || null,
      input.title.trim(), amount, vatAmount, input.expense_date || null, input.status ?? "planned", input.notes ?? null,
      input.attachment_id || null, ctx.actor.user.id
    ));
  }
  (await writeAudit(db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "finance.expense.save", objectType: "expense", objectId: id,
    detail: { title: input.title, amount }, ip: ctx.ip,
  }));
  return (await db.get("SELECT * FROM expenses WHERE id = ?", id));
}

export async function deleteExpense(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  (await ctx.db.run("DELETE FROM expenses WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}

export async function listPayments(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  await markOverduePayments(ctx, eventId);
  return (await ctx.db.all(
    `SELECT p.*, e.title expense_title, v.name vendor_name FROM payments p
     LEFT JOIN expenses e ON e.id = p.expense_id LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.event_id = ? ORDER BY COALESCE(p.due_date, p.created_at) DESC`, eventId
  ));
}

export async function savePayment(ctx: Ctx, eventId: string, input: any, id?: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) err("VALIDATION", "المبلغ يجب أن يكون أكبر من صفر");
  if (!["deposit", "installment", "full", "refund"].includes(input.kind ?? "installment"))
    err("VALIDATION", "نوع الدفعة غير صالح");
  const db = ctx.db;
  const status = input.status ?? (input.paid_at ? "paid" : "pending");
  if (id) {
    const old = (await db.get("SELECT * FROM payments WHERE id = ? AND event_id = ?", id, eventId));
    if (!old) err("NOT_FOUND");
    (await db.run(
      `UPDATE payments SET amount=?, kind=?, expense_id=?, vendor_id=?, due_date=?, paid_at=?, status=?, notes=? WHERE id=?`,
      amount, input.kind ?? old.kind, input.expense_id || null, input.vendor_id || null,
      input.due_date || null, input.paid_at || null, status, input.notes ?? null, id
    ));
  } else {
    id = newId();
    (await db.run(
      `INSERT INTO payments (id, event_id, organization_id, expense_id, vendor_id, amount, kind, due_date, paid_at, status, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, input.expense_id || null, input.vendor_id || null, amount,
      input.kind ?? "installment", input.due_date || null, input.paid_at || null, status,
      input.notes ?? null, ctx.actor.user.id
    ));
  }
  (await writeAudit(db, {
    orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
    action: "finance.payment.save", objectType: "payment", objectId: id,
    detail: { amount, status }, ip: ctx.ip,
  }));
  return (await db.get("SELECT * FROM payments WHERE id = ?", id));
}

export async function deletePayment(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  (await ctx.db.run("DELETE FROM payments WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}

export async function saveBudgetCategory(ctx: Ctx, eventId: string, input: any, id?: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  if (!input.name?.trim()) err("VALIDATION", "اسم الفئة مطلوب");
  const amount = Number(input.planned_amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) err("VALIDATION", "مبلغ غير صالح");
  if (id) {
    (await ctx.db.run("UPDATE budget_categories SET name = ?, planned_amount = ? WHERE id = ? AND event_id = ?", input.name.trim(), amount, id, eventId));
  } else {
    id = newId();
    (await ctx.db.run(
      "INSERT INTO budget_categories (id, event_id, organization_id, name, planned_amount) VALUES (?,?,?,?,?)",
      id, eventId, ctx.actor.orgId, input.name.trim(), amount
    ));
  }
  return (await ctx.db.get("SELECT * FROM budget_categories WHERE id = ?", id));
}

export async function deleteBudgetCategory(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "finance"));
  (await ctx.db.run("DELETE FROM budget_categories WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}
