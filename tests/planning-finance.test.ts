/** اختبارات وحدات التخطيط والميزانية الجديدة (ليلتنا) */
import { describe, it, expect } from "vitest";
import { setup, makeUser, ctxFor, publishedEvent, expectAppError } from "./helpers";
import { createEvent } from "@/server/services/events";
import { applyTemplate, planningDashboard, updatePlan, saveTask, listTasks, listPlanningTeam, addPlanningMember } from "@/server/services/planning";
import {
  financeSummary, saveExpense, savePayment, saveBudgetCategory,
} from "@/server/services/finance";
import { createGuest } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import { submitRsvp } from "@/server/services/rsvp";

describe("قوالب التخطيط", () => {
  it("تنشئ المناسبة خطة تلقائية حسب النوع", () => {
    const { a } = setup();
    const ev = createEvent(a.ctx, { title: "زفاف اختبار", type: "wedding", starts_at: new Date(Date.now() + 30 * 864e5).toISOString(), capacity: 100 });
    const dash = planningDashboard(a.ctx, ev.id);
    expect(dash.progress.tasks_total).toBeGreaterThan(0);
    expect(dash.progress.checklist_total).toBeGreaterThan(0);
    expect(dash.progress.timeline_total).toBeGreaterThan(0);
    expect(dash.team.length).toBe(0);
  });

  it("تطبيق قالب صريح يعيد بناء القوائم", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx, { type: "conference" });
    applyTemplate(a.ctx, ev.id, "tpl-plan-conference");
    const d = planningDashboard(a.ctx, ev.id);
    expect(d.progress.tasks_total).toBeGreaterThan(3);
    const tasks = listTasks(a.ctx, ev.id);
    expect(tasks.some((t: any) => t.title.includes("المتحدثين"))).toBe(true);
  });
});

describe("الميزانية والمدفوعات — منع العد المزدوج", () => {
  it("يفصل المصروف الفعلي عن المدفوع نقدًا عن الالتزامات", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    updatePlan(a.ctx, ev.id, { budget_total: 100000, hospitality_cost_per_person: 250 });
    saveExpense(a.ctx, ev.id, { title: "قاعة", amount: 62000, status: "paid" });
    saveExpense(a.ctx, ev.id, { title: "ضيافة", amount: 18000, status: "planned" });
    savePayment(a.ctx, ev.id, { amount: 50000, kind: "deposit", status: "paid" });
    savePayment(a.ctx, ev.id, { amount: 12000, kind: "installment", status: "pending" });
    const s = financeSummary(a.ctx, ev.id);
    expect(s.budget).toBe(100000);
    expect(s.spent_actual).toBe(62000);
    expect(s.committed).toBe(80000);
    expect(s.paid_cash).toBe(50000);
    expect(s.obligations).toBe(12000);
    expect(s.remaining_actual).toBe(38000);
    expect(s.usage_percent).toBe(62);
  });

  it("تقدير الضيافة يستخدم آخر رد مؤكد فقط", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    updatePlan(a.ctx, ev.id, { budget_total: 50000, hospitality_cost_per_person: 100 });
    const fam = a.ctx.db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id)!;
    const g1 = createGuest(a.ctx, ev.id, { name: "ضيف أ", phone: "+966511110001", group_id: fam.id });
    const g2 = createGuest(a.ctx, ev.id, { name: "ضيف ب", phone: "+966511110002", group_id: fam.id });
    const i1 = issueInvitation(a.ctx, ev.id, { guest_id: g1.id });
    const i2 = issueInvitation(a.ctx, ev.id, { guest_id: g2.id });
    submitRsvp(a.ctx.db, i1.token, { answer: "confirmed", persons: 3 });
    submitRsvp(a.ctx.db, i2.token, { answer: "confirmed", persons: 2 });
    submitRsvp(a.ctx.db, i2.token, { answer: "declined" }); // آخر رد يلغي تأكيده
    const s = financeSummary(a.ctx, ev.id);
    expect(s.hospitality.confirmed_persons).toBe(3);
    expect(s.hospitality.estimate).toBe(300);
  });

  it("فئات الميزانية تُدار ضمن نطاق المناسبة", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    const c = saveBudgetCategory(a.ctx, ev.id, { name: "ديكور", planned_amount: 15000 });
    expect(c!.name).toBe("ديكور");
    const s = financeSummary(a.ctx, ev.id);
    expect(s.categories.some((x: any) => x.name === "ديكور" && x.planned_amount === 15000)).toBe(true);
  });
});

describe("صلاحيات التخطيط", () => {
  it("مستخدم من مؤسسة أخرى لا يصل لخطة المناسبة ولا لماليتها", () => {
    const { a, b } = setup();
    const ev = publishedEvent(a.ctx);
    expectAppError(() => planningDashboard(b.ctx, ev.id), "NOT_FOUND");
    expectAppError(() => financeSummary(b.ctx, ev.id), "NOT_FOUND");
  });

  it("عضو الفريق المالي يدير الميزانية دون إدارة المهام", () => {
    const { db, a } = setup();
    const other = makeUser(db, "fin");
    const ev = publishedEvent(a.ctx);
    addPlanningMember(a.ctx, ev.id, { email: other.user.email!, role: "finance" });
    const otherCtx = ctxFor(db, other.user, a.orgId);
    expect(financeSummary(otherCtx, ev.id).budget).toBe(0);
    expectAppError(() => saveTask(otherCtx, ev.id, { title: "مهمة" }), "FORBIDDEN");
    expect(listPlanningTeam(a.ctx, ev.id).length).toBe(1);
  });
});
