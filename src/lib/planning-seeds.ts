/** قوالب التخطيط التلقائية حسب نوع المناسبة — تُبذّر في planning_templates */
import type { DB } from "./db";
import { SUPPLY_CATEGORIES, WEDDING_TASKS, WEDDING_RUN, RESERVE_CATEGORY_NAME } from "./supplies-catalog";

export interface PlanningTemplate {
  event_type: string;
  name_ar: string;
  tasks: { title: string; category: string; priority?: "low" | "medium" | "high"; offset?: number }[];
  categories: { name: string; percent: number }[];
  checklist: string[];
  timeline: TimelineTpl[];
  version?: number;
}

/** offset بالأيام من تاريخ المناسبة؛ minutes (اختياري) بالدقائق من بداية الاستقبال يوم المناسبة */
export interface TimelineTpl {
  phase: "preparation" | "event_day" | "after";
  title: string;
  offset: number;
  minutes?: number;
  owner?: string;
  guests?: boolean;
}

const T = (
  event_type: string, name_ar: string,
  cats: [string, number][],
  tasks: [string, string, number?, ("low" | "medium" | "high")?][],
  checklist: string[],
  timeline: ["preparation" | "event_day" | "after", string, number][]
): PlanningTemplate => ({
  event_type, name_ar,
  categories: cats.map(([name, percent]) => ({ name, percent })),
  tasks: tasks.map(([title, category, offset, priority]) => ({ title, category, offset, priority })),
  checklist,
  timeline: timeline.map(([phase, title, offset]) => ({ phase, title, offset })),
});

/** خطوات يوم الزفاف التي تظهر للضيوف في برنامج الدعوة */
const GUEST_FACING_MINUTES = new Set([0, 60, 135, 195, 225]);
const HIGH_PRIORITY_DAYS = new Set([300, 240, 210, 60, 42, 7]);

/** قالب الزواج الكامل: 15 فئة (90%) + احتياطي 10%، 22 مهمة، 15 خطوة ليوم المناسبة */
const WEDDING_TEMPLATE: PlanningTemplate = {
  event_type: "wedding",
  name_ar: "الزواج والزفاف",
  version: 2,
  categories: [
    ...SUPPLY_CATEGORIES.map((c) => ({ name: c.name, percent: Math.round(c.pct * 0.9 * 10) / 10 })),
    { name: RESERVE_CATEGORY_NAME, percent: 10 },
  ],
  tasks: WEDDING_TASKS.map(([days, title, owner]) => ({
    title, category: owner, offset: -days, priority: HIGH_PRIORITY_DAYS.has(days) ? "high" as const : "medium" as const,
  })),
  checklist: ["القاعة", "الكوشة", "الملابس", "الضيافة", "المصور", "الدعوات", "الهدايا", "أكياس العبايات والترقيم", "الإكراميات والمستلزمات الاحتياطية"],
  timeline: [
    { phase: "preparation", title: "بدء التجهيز وحجز القاعة", offset: -300 },
    { phase: "preparation", title: "إرسال الدعوات", offset: -85 },
    { phase: "preparation", title: "تأكيد العدد النهائي", offset: -42 },
    { phase: "preparation", title: "تسليم جدول اليوم للموردين", offset: -7 },
    ...WEDDING_RUN.map(([minutes, title, owner]): TimelineTpl => ({
      phase: "event_day", title, offset: 0, minutes, owner, guests: GUEST_FACING_MINUTES.has(minutes),
    })),
    { phase: "after", title: "تسوية الحسابات وتقييم الموردين", offset: 3 },
    { phase: "after", title: "أرشفة العقود والصور", offset: 14 },
  ],
};

export const PLANNING_TEMPLATES: PlanningTemplate[] = [
  WEDDING_TEMPLATE,

  T("engagement", "الخطوبة والملكة",
    [["المكان", 25], ["الضيافة", 30], ["الزينة", 15], ["الهدايا", 15], ["الدعوات", 5], ["احتياطي", 10]],
    [["حجز المكان", "المكان", -60, "high"], ["اختيار الدعوة", "الدعوات", -30], ["تجهيز الهدايا", "الهدايا", -20], ["تأكيد الضيوف", "الدعوات", -5, "high"], ["ترتيب الجلسة", "اليوم", -1]],
    ["المكان", "الزينة", "الهدايا", "الضيافة", "الدعوات", "الكوشة"],
    [["preparation", "التجهيز", -60], ["event_day", "الجلسة", 0], ["after", "التقرير", 2]]),

  T("graduation", "حفل التخرج",
    [["الموقع", 30], ["الضيافة", 25], ["التصوير", 15], ["الهدايا والشهادات", 15], ["الدعوات", 5], ["احتياطي", 10]],
    [["حجز المسرح/القاعة", "الموقع", -90, "high"], ["إرسال دعوات الأهالي", "الدعوات", -30, "high"], ["تجهيز الشهادات والهدايا", "الهدايا", -14], ["تنسيق التصوير", "التصوير", -7], ["تأكيد الحضور", "الدعوات", -3]],
    ["الموقع", "الشهادات", "الهدايا", "التصوير", "الضيافة", "الدعوات"],
    [["preparation", "التخطيط", -90], ["event_day", "الحفل", 0], ["after", "التقرير", 1]]),

  T("conference", "المؤتمر",
    [["القاعة والتقنيات", 35], ["المتحدثون", 20], ["التسجيل والضيوف", 15], ["الضيافة", 15], ["التسويق", 5], ["احتياطي", 10]],
    [["تأكيد agenda والمتحدثين", "المتحدثون", -60, "high"], ["حجز القاعة والأجهزة", "القاعة", -45, "high"], ["فتح التسجيل", "التسجيل", -30, "high"], ["إرسال الدعوات", "الدعوات", -14], ["اختبار الصوت والعرض", "التقنيات", -1, "high"], ["إصدار البطاقات", "التسجيل", -1]],
    ["القاعة", "المتحدثون", "الأجهزة", "التسجيل", "الضيافة", "الدعوات", "التصاريح"],
    [["preparation", "التخطيط", -60], ["preparation", "التسجيل", -30], ["event_day", "الفعالية", 0], ["after", "التقرير", 3]]),

  T("opening", "الافتتاح",
    [["التجهيزات", 35], ["الإعلام", 15], ["الضيوف الرسميون", 20], ["الاستقبال", 15], ["الضيافة", 5], ["احتياطي", 10]],
    [["تأكيد التجهيزات", "التجهيزات", -30, "high"], ["قائمة الضيوف الرسميين", "الضيوف", -20, "high"], ["تنسيق الإعلام", "الإعلام", -14], ["تجهيز الاستقبال", "الاستقبال", -3]],
    ["التجهيزات", "الإعلام", "الضيوف الرسميون", "الاستقبال", "الضيافة"],
    [["preparation", "التجهيز", -30], ["event_day", "الافتتاح", 0], ["after", "التقرير", 2]]),

  T("meeting", "الاجتماع",
    [["المكان", 30], ["الضيافة", 20], ["المحاضر والتوثيق", 15], ["المشاركون", 20], ["احتياطي", 15]],
    [["إعداد جدول الأعمال", "التنظيم", -14, "high"], ["تأكيد المشاركين", "المشاركون", -7, "high"], ["حجز المكان", "المكان", -7], ["تجهيز المحاضر", "التوثيق", -1]],
    ["جدول الأعمال", "المشاركون", "المكان", "المحاضر", "الضيافة"],
    [["preparation", "التحضير", -14], ["event_day", "الاجتماع", 0], ["after", "المحضر", 1]]),

  T("family", "المناسبة العائلية",
    [["الموقع", 30], ["الضيافة", 35], ["الزينة", 10], ["الدعوات", 5], ["احتياطي", 20]],
    [["تحديد المكان", "الموقع", -30, "high"], ["دعوة الأقارب", "الدعوات", -14], ["شراء الضيافة", "الضيافة", -5], ["ترتيب الجلسة", "اليوم", -1]],
    ["المكان", "الضيافة", "الدعوات", "الزينة", "الجلوس"],
    [["preparation", "التجهيز", -30], ["event_day", "المناسبة", 0], ["after", "التقرير", 1]]),

  T("festival", "الفعالية والمهرجان",
    [["الموردون والتشغيل", 35], ["التصاريح", 10], ["الفرق والفنانون", 20], ["الحضور والدخول", 15], ["الضيافة", 10], ["احتياطي", 10]],
    [["استخراج التصاريح", "التصاريح", -90, "high"], ["حجز الفرق", "الفرق", -60], ["تأكيد الموردين", "الموردون", -30, "high"], ["تجهيز بوابات الدخول", "الدخول", -7, "high"], ["خطة الطوارئ", "التشغيل", -3]],
    ["التصاريح", "الموردون", "الفرق", "البوابات", "الضيافة", "السلامة"],
    [["preparation", "التخطيط", -90], ["preparation", "التجهيز", -30], ["event_day", "الفعالية", 0], ["after", "التقرير", 5]]),
];

export async function seedPlanningTemplates(db: DB) {
  for (const t of PLANNING_TEMPLATES) {
    (await db.run(
      `INSERT INTO planning_templates (id, event_type, name_ar, tasks_json, categories_json, checklist_json, timeline_json, version)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(event_type) DO UPDATE SET name_ar = excluded.name_ar, tasks_json = excluded.tasks_json,
         categories_json = excluded.categories_json, checklist_json = excluded.checklist_json,
         timeline_json = excluded.timeline_json, version = excluded.version
       WHERE planning_templates.version < excluded.version`,
      `tpl-plan-${t.event_type}`, t.event_type, t.name_ar,
      JSON.stringify(t.tasks), JSON.stringify(t.categories), JSON.stringify(t.checklist), JSON.stringify(t.timeline), t.version ?? 1
    ));
  }
}
