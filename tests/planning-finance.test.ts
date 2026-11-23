/** اختبارات وحدات التخطيط والميزانية الجديدة (ليلتنا) */
import { describe, it, expect } from "vitest";
import { setup, makeUser, ctxFor, publishedEvent, expectAppErrorAsync } from "./helpers";
import { createEvent } from "@/server/services/events";
import { applyTemplate, planningDashboard, updatePlan, saveTask, listTasks, listPlanningTeam, addPlanningMember } from "@/server/services/planning";
import {
  financeSummary, saveExpense, savePayment, saveBudgetCategory,
} from "@/server/services/finance";
import { createGuest } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import { submitRsvp } from "@/server/services/rsvp";

describe("قوالب التخطيط", async () => {
  it("تنشئ المناسبة خطة تلقائية حسب النوع", async () => {
    const { a } = (await setup());
    const ev = (await createEvent(a.ctx, { title: "زفاف اختبار", type: "wedding", starts_at: new Date(Date.now() + 30 * 864e5).toISOString(), capacity: 100 }));
    const dash = (await planningDashboard(a.ctx, ev.id));
    expect(dash.progress.tasks_total).toBeGreaterThan(0);
    expect(dash.progress.checklist_total).toBeGreaterThan(0);
    expect(dash.progress.timeline_total).toBeGreaterThan(0);
    expect(dash.team.length).toBe(0);
  });

  it("تطبيق قالب صريح يعيد بناء القوائم", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx, { type: "conference" }));
    (await applyTemplate(a.ctx, ev.id, "tpl-plan-conference"));
    const d = (await planningDashboard(a.ctx, ev.id));
    expect(d.progress.tasks_total).toBeGreaterThan(3);
    const tasks = (await listTasks(a.ctx, ev.id));
    expect(tasks.some((t: any) => t.title.includes("المتحدثين"))).toBe(true);
  });
});

describe("الميزانية والمدفوعات — منع العد المزدوج", async () => {
  it("يفصل المصروف الفعلي عن المدفوع نقدًا عن الالتزامات", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    (await updatePlan(a.ctx, ev.id, { budget_total: 100000, hospitality_cost_per_person: 250 }));
    (await saveExpense(a.ctx, ev.id, { title: "قاعة", amount: 62000, status: "paid" }));
    (await saveExpense(a.ctx, ev.id, { title: "ضيافة", amount: 18000, status: "planned" }));
    (await savePayment(a.ctx, ev.id, { amount: 50000, kind: "deposit", status: "paid" }));
    (await savePayment(a.ctx, ev.id, { amount: 12000, kind: "installment", status: "pending" }));
    const s = (await financeSummary(a.ctx, ev.id));
    expect(s.budget).toBe(100000);
    expect(s.spent_actual).toBe(62000);
    expect(s.committed).toBe(80000);
    expect(s.paid_cash).toBe(50000);
    expect(s.obligations).toBe(12000);
    expect(s.remaining_actual).toBe(38000);
    expect(s.usage_percent).toBe(62);
  });

  it("تقدير الضيافة يستخدم آخر رد مؤكد فقط", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    (await updatePlan(a.ctx, ev.id, { budget_total: 50000, hospitality_cost_per_person: 100 }));
    const fam = (await a.ctx.db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id))!;
    const g1 = (await createGuest(a.ctx, ev.id, { name: "ضيف أ", phone: "+966511110001", group_id: fam.id }));
    const g2 = (await createGuest(a.ctx, ev.id, { name: "ضيف ب", phone: "+966511110002", group_id: fam.id }));
    const i1 = (await issueInvitation(a.ctx, ev.id, { guest_id: g1.id }));
    const i2 = (await issueInvitation(a.ctx, ev.id, { guest_id: g2.id }));
    (await submitRsvp(a.ctx.db, i1.token, { answer: "confirmed", persons: 3 }));
    (await submitRsvp(a.ctx.db, i2.token, { answer: "confirmed", persons: 2 }));
    (await submitRsvp(a.ctx.db, i2.token, { answer: "declined" })); // آخر رد يلغي تأكيده
    const s = (await financeSummary(a.ctx, ev.id));
    expect(s.hospitality.confirmed_persons).toBe(3);
    expect(s.hospitality.estimate).toBe(300);
  });

  it("فئات الميزانية تُدار ضمن نطاق المناسبة", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const c = (await saveBudgetCategory(a.ctx, ev.id, { name: "ديكور", planned_amount: 15000 }));
    expect(c!.name).toBe("ديكور");
    const s = (await financeSummary(a.ctx, ev.id));
    expect(s.categories.some((x: any) => x.name === "ديكور" && x.planned_amount === 15000)).toBe(true);
  });
});

describe("صلاحيات التخطيط", async () => {
  it("مستخدم من مؤسسة أخرى لا يصل لخطة المناسبة ولا لماليتها", async () => {
    const { a, b } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    await expectAppErrorAsync(async () => (await planningDashboard(b.ctx, ev.id)), "NOT_FOUND");
    await expectAppErrorAsync(async () => (await financeSummary(b.ctx, ev.id)), "NOT_FOUND");
  });

  it("عضو الفريق المالي يدير الميزانية دون إدارة المهام", async () => {
    const { db, a } = (await setup());
    const other = (await makeUser(db, "fin"));
    const ev = (await publishedEvent(a.ctx));
    (await addPlanningMember(a.ctx, ev.id, { email: other.user.email!, role: "finance" }));
    const otherCtx = (await ctxFor(db, other.user, a.orgId));
    expect((await financeSummary(otherCtx, ev.id)).budget).toBe(0);
    await expectAppErrorAsync(async () => (await saveTask(otherCtx, ev.id, { title: "مهمة" })), "FORBIDDEN");
    expect((await listPlanningTeam(a.ctx, ev.id)).length).toBe(1);
  });
});
