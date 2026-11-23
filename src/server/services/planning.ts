/** تخطيط المناسبة: قوالب، مهام، قوائم تجهيز، جدول زمني، وفريق تخطيط */
import { newId, nowIso, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { effectiveEventRole, loadEventScoped } from "@/lib/permissions";
import { PLANNING_TEMPLATES } from "@/lib/planning-seeds";
import { writeAudit } from "@/lib/audit";

type Area = "view" | "plan" | "finance" | "services";
const ROLE_FOR: Record<string, string> = { plan: "planner", finance: "finance", services: "services" };

/** صلاحية وحدة التخطيط: مالك/مدير المناسبة أو عضو الفريق بالدور المطلوب */
export async function requirePlanningAccess(ctx: Ctx, eventId: string, area: Area = "view") {
  const event = (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
  const role = (await effectiveEventRole(ctx.db, ctx, event));
  if (role === "owner" || role === "manager") return event;
  // عضو فريق التخطيط يصل للوحدات بدوره حتى لو لم يكن في event_members
  const member = (await ctx.db.get(
    "SELECT role FROM planning_team WHERE event_id = ? AND user_id = ?", eventId, ctx.actor.user.id
  )) as { role: string } | undefined;
  if (area === "view") {
    if (member || role) return event;
    err("FORBIDDEN", "لا تملك صلاحية على هذه المناسبة");
  }
  if (member?.role === ROLE_FOR[area]) return event;
  err("FORBIDDEN", "لا تملك صلاحية على هذه الوحدة ضمن فريق التخطيط");
}

export async function getOrCreatePlan(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const db = ctx.db;
  let plan = (await db.get<any>("SELECT * FROM event_plans WHERE event_id = ?", eventId));
  if (!plan) {
    (await db.run(
      "INSERT INTO event_plans (id, event_id, organization_id) VALUES (?,?,?)",
      newId(), eventId, ctx.actor.orgId
    ));
    plan = (await db.get<any>("SELECT * FROM event_plans WHERE event_id = ?", eventId));
  }
  return plan;
}

/** إنشاء الخطة المبدئية من قالب نوع المناسبة */
export async function applyTemplate(ctx: Ctx, eventId: string, templateId?: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const db = ctx.db;
  const event = (await loadEventScoped(db, ctx.actor.orgId, eventId));
  const tpl = templateId
    ? (await db.get<any>("SELECT * FROM planning_templates WHERE id = ?", templateId))
    : (await db.get<any>("SELECT * FROM planning_templates WHERE event_type = ?", event.type));
  if (!tpl) err("NOT_FOUND", "قالب التخطيط غير موجود لهذا النوع");
  const plan = (await getOrCreatePlan(ctx, eventId));
  const day = (offset?: number) => {
    if (!offset || !event.starts_at) return null;
    return new Date(Date.parse(event.starts_at) + offset * 864e5).toISOString();
  };
  (await db.tx(async () => {
    // إعادة التهيئة: تطبيق قالب جديد يعيد بناء المهام/الفئات/الجدول/القوائم (يُظهر تحذيرًا بالواجهة)
    (await db.run("DELETE FROM tasks WHERE event_id = ?", eventId));
    (await db.run("DELETE FROM budget_categories WHERE event_id = ?", eventId));
    (await db.run("DELETE FROM timeline_items WHERE event_id = ?", eventId));
    (await db.run("DELETE FROM checklist_items WHERE checklist_id IN (SELECT id FROM checklists WHERE event_id = ?)", eventId));
    (await db.run("DELETE FROM checklists WHERE event_id = ?", eventId));

    const cats = JSON.parse(tpl.categories_json) as { name: string; percent: number }[];
    for (const c of cats) {
      (await db.run(
        "INSERT INTO budget_categories (id, event_id, organization_id, name, planned_amount, sort_order) VALUES (?,?,?,?,?,?)",
        newId(), eventId, ctx.actor.orgId, c.name,
        Math.round((Number(plan.budget_total || 0) * c.percent) / 100), 0
      ));
    }
    const tasks = JSON.parse(tpl.tasks_json) as { title: string; category: string; offset?: number; priority?: string }[];
    for (const t of tasks) {
      (await db.run(
        `INSERT INTO tasks (id, event_id, organization_id, title, category, priority, due_date, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        newId(), eventId, ctx.actor.orgId, t.title, t.category, t.priority ?? "medium", day(t.offset), ctx.actor.user.id
      ));
    }
    const items = JSON.parse(tpl.checklist_json) as string[];
    const clId = newId();
    (await db.run(
      "INSERT INTO checklists (id, event_id, organization_id, name, event_type) VALUES (?,?,?,?,?)",
      clId, eventId, ctx.actor.orgId, tpl.name_ar, event.type
    ));
    items.forEach(async (text, i) =>
      (await db.run("INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES (?,?,?,?)", newId(), clId, text, i))
    );
    const timeline = JSON.parse(tpl.timeline_json) as { phase: string; title: string; offset: number }[];
    timeline.forEach(async (t, i) =>
      (await db.run(
        "INSERT INTO timeline_items (id, event_id, organization_id, phase, title, starts_at, sort_order) VALUES (?,?,?,?,?,?,?)",
        newId(), eventId, ctx.actor.orgId, t.phase, t.title, day(t.offset), i
      ))
    );
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
      action: "planning.template.apply", objectType: "event", objectId: eventId,
      detail: { template: tpl.name_ar }, ip: ctx.ip,
    }));
  }));
  return { applied: tpl.name_ar };
}

export async function planningDashboard(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const db = ctx.db;
  const event = (await loadEventScoped(db, ctx.actor.orgId, eventId));
  const plan = (await getOrCreatePlan(ctx, eventId));
  const count = async (sql: string, ...a: any[]) => (await db.get<{ n: number }>(sql, ...a))!.n;
  return {
    event: { id: event.id, title: event.title, type: event.type, starts_at: event.starts_at, status: event.status },
    plan,
    progress: {
      tasks_total: await count("SELECT COUNT(*) n FROM tasks WHERE event_id = ?", eventId),
      tasks_done: await count("SELECT COUNT(*) n FROM tasks WHERE event_id = ? AND status = 'done'", eventId),
      checklist_total: await count("SELECT COUNT(*) n FROM checklist_items ci JOIN checklists c ON c.id = ci.checklist_id WHERE c.event_id = ?", eventId),
      checklist_done: await count("SELECT COUNT(*) n FROM checklist_items ci JOIN checklists c ON c.id = ci.checklist_id WHERE c.event_id = ? AND ci.done = 1", eventId),
      timeline_total: await count("SELECT COUNT(*) n FROM timeline_items WHERE event_id = ?", eventId),
      timeline_done: await count("SELECT COUNT(*) n FROM timeline_items WHERE event_id = ? AND done = 1", eventId),
    },
    upcoming_tasks: (await db.all(
      "SELECT * FROM tasks WHERE event_id = ? AND status != 'done' ORDER BY COALESCE(due_date, '9999') LIMIT 8", eventId
    )),
    team: (await db.all(
      `SELECT pt.role, u.id user_id, u.name, u.email FROM planning_team pt JOIN users u ON u.id = pt.user_id WHERE pt.event_id = ?`, eventId
    )),
  };
}

export async function updatePlan(ctx: Ctx, eventId: string, input: { budget_total?: number; hospitality_cost_per_person?: number; notes?: string }) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  const p = (await getOrCreatePlan(ctx, eventId));
  (await ctx.db.run(
    `UPDATE event_plans SET budget_total = ?, hospitality_cost_per_person = ?, notes = ?, updated_at = ? WHERE id = ?`,
    input.budget_total === undefined ? p.budget_total : Number(input.budget_total),
    input.hospitality_cost_per_person === undefined ? p.hospitality_cost_per_person : Number(input.hospitality_cost_per_person),
    input.notes ?? p.notes, nowIso(), p.id
  ));
  return (await ctx.db.get("SELECT * FROM event_plans WHERE id = ?", p.id));
}

/* ===== المهام ===== */
export async function listTasks(ctx: Ctx, eventId: string, filters?: { status?: string; category?: string }) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const w: string[] = ["event_id = ?"];
  const a: any[] = [eventId];
  if (filters?.status) { w.push("t.status = ?"); a.push(filters.status); }
  if (filters?.category) { w.push("t.category = ?"); a.push(filters.category); }
  return (await ctx.db.all(
    `SELECT t.*, u.name assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
     WHERE ${w.join(" AND ")} ORDER BY CASE t.status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, COALESCE(t.due_date,'9999')`, ...a
  ));
}

export async function saveTask(ctx: Ctx, eventId: string, input: any, taskId?: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  if (!input.title?.trim()) err("VALIDATION", "عنوان المهمة مطلوب");
  const db = ctx.db;
  if (taskId) {
    const t = (await db.get("SELECT * FROM tasks WHERE id = ? AND event_id = ?", taskId, eventId));
    if (!t) err("NOT_FOUND");
    const done = input.status === "done" && t.status !== "done" ? nowIso() : input.status === "done" ? t.completed_at : null;
    (await db.run(
      `UPDATE tasks SET title=?, description=?, category=?, status=?, priority=?, due_date=?, assignee_id=?, completed_at=? WHERE id=?`,
      input.title.trim(), input.description ?? null, input.category ?? null, input.status ?? t.status,
      input.priority ?? t.priority, input.due_date || null, input.assignee_id || null, done, taskId
    ));
    return (await db.get("SELECT * FROM tasks WHERE id = ?", taskId));
  }
  const id = newId();
  (await db.run(
    `INSERT INTO tasks (id, event_id, organization_id, title, description, category, status, priority, due_date, assignee_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, eventId, ctx.actor.orgId, input.title.trim(), input.description ?? null, input.category ?? null,
    input.status ?? "todo", input.priority ?? "medium", input.due_date || null, input.assignee_id || null, ctx.actor.user.id
  ));
  return (await db.get("SELECT * FROM tasks WHERE id = ?", id));
}

export async function deleteTask(ctx: Ctx, eventId: string, taskId: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  (await ctx.db.run("DELETE FROM tasks WHERE id = ? AND event_id = ?", taskId, eventId));
  return { ok: true };
}

/* ===== قوائم التجهيز ===== */
export async function listChecklists(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const lists = (await ctx.db.all("SELECT * FROM checklists WHERE event_id = ? ORDER BY created_at", eventId));
  return lists.map(async (c: any) => ({
    ...c,
    items: (await ctx.db.all("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order", c.id)),
  }));
}

export async function saveChecklist(ctx: Ctx, eventId: string, input: { id?: string; name: string }) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  if (!input.name?.trim()) err("VALIDATION", "اسم القائمة مطلوب");
  if (input.id) {
    (await ctx.db.run("UPDATE checklists SET name = ? WHERE id = ? AND event_id = ?", input.name.trim(), input.id, eventId));
    return (await ctx.db.get("SELECT * FROM checklists WHERE id = ?", input.id));
  }
  const id = newId();
  (await ctx.db.run(
    "INSERT INTO checklists (id, event_id, organization_id, name, event_type) VALUES (?,?,?,?, 'custom')",
    id, eventId, ctx.actor.orgId, input.name.trim()
  ));
  return (await ctx.db.get("SELECT * FROM checklists WHERE id = ?", id));
}

export async function saveChecklistItem(ctx: Ctx, eventId: string, listId: string, input: { id?: string; text?: string; done?: boolean }) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  if (!(await ctx.db.get("SELECT id FROM checklists WHERE id = ? AND event_id = ?", listId, eventId))) err("NOT_FOUND");
  if (input.id) {
    const it = (await ctx.db.get<any>("SELECT * FROM checklist_items WHERE id = ? AND checklist_id = ?", input.id, listId));
    if (!it) err("NOT_FOUND");
    (await ctx.db.run("UPDATE checklist_items SET text = ?, done = ? WHERE id = ?", input.text ?? it.text, input.done ? 1 : 0, input.id));
    return (await ctx.db.get("SELECT * FROM checklist_items WHERE id = ?", input.id));
  }
  if (!input.text?.trim()) err("VALIDATION", "نص العنصر مطلوب");
  const id = newId();
  const n = (await ctx.db.get<{ n: number }>("SELECT COUNT(*) n FROM checklist_items WHERE checklist_id = ?", listId))!.n;
  (await ctx.db.run("INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES (?,?,?,?)", id, listId, input.text.trim(), n));
  return (await ctx.db.get("SELECT * FROM checklist_items WHERE id = ?", id));
}

export async function deleteChecklistItem(ctx: Ctx, eventId: string, itemId: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  (await ctx.db.run(
    "DELETE FROM checklist_items WHERE id = ? AND checklist_id IN (SELECT id FROM checklists WHERE event_id = ?)",
    itemId, eventId
  ));
  return { ok: true };
}

/* ===== الجدول الزمني ===== */
export async function listTimeline(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  return (await ctx.db.all(
    `SELECT tl.*, u.name owner_name FROM timeline_items tl LEFT JOIN users u ON u.id = tl.owner_id
     WHERE tl.event_id = ? ORDER BY CASE phase WHEN 'preparation' THEN 0 WHEN 'event_day' THEN 1 ELSE 2 END, sort_order`, eventId
  ));
}

export async function saveTimelineItem(ctx: Ctx, eventId: string, input: any, id?: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  if (!input.title?.trim()) err("VALIDATION", "عنوان المرحلة مطلوب");
  if (id) {
    (await ctx.db.run(
      "UPDATE timeline_items SET phase=?, title=?, description=?, starts_at=?, owner_id=?, done=? WHERE id=? AND event_id=?",
      input.phase ?? "preparation", input.title.trim(), input.description ?? null, input.starts_at || null,
      input.owner_id || null, input.done ? 1 : 0, id, eventId
    ));
  } else {
    id = newId();
    const n = (await ctx.db.get<{ n: number }>("SELECT COUNT(*) n FROM timeline_items WHERE event_id = ?", eventId))!.n;
    (await ctx.db.run(
      `INSERT INTO timeline_items (id, event_id, organization_id, phase, title, description, starts_at, sort_order, owner_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, input.phase ?? "preparation", input.title.trim(), input.description ?? null,
      input.starts_at || null, n, input.owner_id || null
    ));
  }
  return (await ctx.db.get("SELECT * FROM timeline_items WHERE id = ?", id));
}

export async function deleteTimelineItem(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  (await ctx.db.run("DELETE FROM timeline_items WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}

/* ===== فريق التخطيط ===== */
export async function listPlanningTeam(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  return (await ctx.db.all(
    `SELECT pt.*, u.name, u.email FROM planning_team pt JOIN users u ON u.id = pt.user_id
     WHERE pt.event_id = ? ORDER BY pt.role`, eventId
  ));
}

export async function addPlanningMember(ctx: Ctx, eventId: string, input: { email: string; role: "planner" | "finance" | "services" }) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  if (!["planner", "finance", "services"].includes(input.role)) err("VALIDATION", "دور غير صالح");
  const user = (await ctx.db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", String(input.email).toLowerCase().trim()));
  if (!user) err("NOT_FOUND", "لا يوجد حساب بهذا البريد");
  (await ctx.db.run(
    "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member') ON CONFLICT DO NOTHING",
    ctx.actor.orgId, user.id
  ));
  const id = newId();
  try {
    (await ctx.db.run(
      "INSERT INTO planning_team (id, event_id, organization_id, user_id, role) VALUES (?,?,?,?,?)",
      id, eventId, ctx.actor.orgId, user.id, input.role
    ));
  } catch { err("DUPLICATE_ENTRY", "المستخدم مكلف بهذا الدور بالفعل"); }
  return (await ctx.db.get("SELECT * FROM planning_team WHERE id = ?", id));
}

export async function removePlanningMember(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "plan"));
  (await ctx.db.run("DELETE FROM planning_team WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}
