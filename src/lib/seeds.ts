/** بيانات البذر: الباقات والقوالب العامة — بلا اعتماديات دائرية */
import type { DB } from "./db";
import type { PlanRow } from "./types";
import type { DesignSchema } from "@/server/services/designs";

export const PLANS_SEED: Omit<PlanRow, "sort_order">[] = [
  { id: "free", name_ar: "مجانية", price_monthly_sar: 0, max_active_events: 1, max_guests_per_event: 30, max_delegates_per_event: 1, storage_mb: 50, advanced_templates: 0, custom_branding: 0, multi_seat: 0 },
  { id: "basic", name_ar: "أساسية", price_monthly_sar: 49, max_active_events: 3, max_guests_per_event: 300, max_delegates_per_event: 5, storage_mb: 500, advanced_templates: 0, custom_branding: 0, multi_seat: 0 },
  { id: "pro", name_ar: "احترافية", price_monthly_sar: 149, max_active_events: 15, max_guests_per_event: 3000, max_delegates_per_event: 25, storage_mb: 5120, advanced_templates: 1, custom_branding: 0, multi_seat: 0 },
  { id: "enterprise", name_ar: "شركات", price_monthly_sar: 399, max_active_events: 100, max_guests_per_event: 20000, max_delegates_per_event: 200, storage_mb: 51200, advanced_templates: 1, custom_branding: 1, multi_seat: 1 },
];

export const BUILTIN_TEMPLATES: { id: string; name_ar: string; style: string; category?: string; schema: DesignSchema }[] = [
  {
    id: "tpl-royal", name_ar: "ملكي", style: "royal",
    schema: {
      template_style: "royal",
      palette: { bg: "#4A3B36", card: "#5A4A44", primary: "#C99A6B", accent: "#C99A6B", text: "#FBF8F5", muted: "#C9B7A6" },
      motion: "envelope",
      cover: { title: "دعوة خاصة", subtitle: "نتشرف بحضوركم", hosts: "", ornament: "✦" },
      details: { message: "يسعدنا دعوتكم لمشاركتنا فرحتنا، حضوركم يكمل بهجتنا.", venue_label: "الموقع", date_label: "الموعد", rsvp_note: "نرجو تأكيد الحضور لتجهيز الاستقبال" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    id: "tpl-modern", name_ar: "عصري", style: "modern",
    schema: {
      template_style: "modern",
      palette: { bg: "#EDE9E6", card: "#FFFFFF", primary: "#4A3B36", accent: "#C99A6B", text: "#4A3B36", muted: "#8A7A70" },
      motion: "slide",
      cover: { title: "دعوتكم تصلنا", subtitle: "بكل بساطة ومحبة", hosts: "", ornament: "◆" },
      details: { message: "ننتظركم لنصنع ذكرى جميلة معًا.", venue_label: "المكان", date_label: "الزمان", rsvp_note: "أكد حضورك بضغطة واحدة" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    id: "tpl-heritage", name_ar: "تراثي", style: "heritage",
    schema: {
      template_style: "heritage",
      palette: { bg: "#5A4A44", card: "#4A3B36", primary: "#C99A6B", accent: "#E2D3C3", text: "#FBF8F5", muted: "#C9B7A6" },
      motion: "reveal",
      cover: { title: "حيّاكم الله", subtitle: "دعوة من القلب", hosts: "", ornament: "۞" },
      details: { message: "الدار داركم، والفرحة ما تكمل إلا بشوفتكم.", venue_label: "الديرة", date_label: "الميعاد", rsvp_note: "علّمونا بحضوركم عشان نستعد" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    id: "tpl-romantic", name_ar: "رومانسي", style: "romantic",
    schema: {
      template_style: "romantic",
      palette: { bg: "#6B574F", card: "#5A4A44", primary: "#E2D3C3", accent: "#C99A6B", text: "#FBF8F5", muted: "#D6C4B4" },
      motion: "fade",
      cover: { title: "فرحتنا تكتمل بكم", subtitle: "دعوة بكل حب", hosts: "", ornament: "❦" },
      details: { message: "لأنكم جزء من حكايتنا، نتمنى حضوركم ومشاركتنا أجمل اللحظات.", venue_label: "المكان", date_label: "الموعد", rsvp_note: "ردكم يسعدنا" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    id: "tpl-formal", name_ar: "رسمي", style: "formal",
    schema: {
      template_style: "formal",
      palette: { bg: "#4F6B5F", card: "#3F574C", primary: "#F6F1EC", accent: "#C99A6B", text: "#FBF8F5", muted: "#CFDAD2" },
      motion: "scale",
      cover: { title: "دعوة رسمية", subtitle: "يتشرف المدعوون بدعوتكم", hosts: "", ornament: "❖" },
      details: { message: "نتشرف بدعوتكم لحضور هذه المناسبة، شاكرين لكم تلبية الدعوة.", venue_label: "مكان الانعقاد", date_label: "التاريخ والوقت", rsvp_note: "يرجى تأكيد الحضور قبل الموعد" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    id: "tpl-corporate", name_ar: "شركات", style: "corporate",
    schema: {
      template_style: "corporate",
      palette: { bg: "#EDE9E6", card: "#FFFFFF", primary: "#4A3B36", accent: "#C99A6B", text: "#4A3B36", muted: "#8A7A70" },
      motion: "flip",
      cover: { title: "دعوة حضور", subtitle: "نتشرف بمشاركتكم", hosts: "", ornament: "▣" },
      details: { message: "يسرنا دعوتكم لحضور فعالياتنا، ونثمن حضوركم ومشاركتكم.", venue_label: "المقر", date_label: "الموعد", rsvp_note: "سجّل حضورك لتسهيل الاستقبال" },
      show_countdown: true, show_qr: true,
    },
  },
  {
    // قالب بصري كامل بهوية ليلتنا: كريمي/زيتوني/ذهبي + صورة عريس اختيارية
    id: "tpl-laylatna-editorial", name_ar: "ليلتنا — دعوة بصرية", style: "editorial", category: "wedding",
    schema: {
      template_style: "editorial",
      palette: { bg: "#FBF8F5", card: "#F4EFE4", primary: "#4F6B5F", accent: "#B3975F", text: "#4A3B36", muted: "#8A7A70" },
      motion: "fade",
      cover: { title: "ليلتنا", subtitle: "بسم الله الرحمن الرحيم", hosts: "", ornament: "✦" },
      details: {
        message: "يسعدنا دعوتكم لمشاركتنا فرحتنا، حضوركم يكمل بهجتنا.",
        venue_label: "المكان", date_label: "الموعد", rsvp_note: "نرجو تأكيد الحضور لتجهيز الاستقبال",
        program: "", dress_code: "رسمي", transport: "", accommodation: "", quote: "",
        photo_url: "", rsvp_phone: "", monogram: "ل | ن", groom: "", bride: "",
        invitation_line: "يتشرفان بدعوتكم لحضور حفل زفافهما",
      },
      show_countdown: false, show_qr: true,
      scenes: [
        { id: "ed-cover", kind: "cover", title: "الغلاف", motion: "fade", layers: [{ id: "ed-c1", type: "text", content: "ليلتنا" }] },
        { id: "ed-welcome", kind: "welcome", title: "الترحيب", motion: "fade", layers: [{ id: "ed-w1", type: "text", variable: "guest.name" }] },
        { id: "ed-details", kind: "details", title: "البرنامج", motion: "fade", layers: [{ id: "ed-d1", type: "program", variable: "event.program" }] },
        { id: "ed-rsvp", kind: "rsvp", title: "تأكيد الحضور", motion: "fade", layers: [{ id: "ed-r1", type: "text", content: "نسعد بحضوركم" }] },
        { id: "ed-ticket", kind: "ticket", title: "التذكرة", motion: "fade", layers: [{ id: "ed-t1", type: "qr", content: "رمز الدخول" }] },
      ],
    },
  },
];

// قوالب إضافية لتغطية كل أنواع المناسبات في معرض المعاينة
const BASE = BUILTIN_TEMPLATES[0].schema;
const extra = (
  id: string, name_ar: string, style: string, category: string,
  opts: { bg: string; card: string; primary: string; text: string; muted: string; ornament: string; title: string; subtitle: string; message: string }
): (typeof BUILTIN_TEMPLATES)[number] => ({
  id, name_ar, style, category,
  schema: {
    ...BASE,
    template_style: style,
    palette: { bg: opts.bg, card: opts.card, primary: opts.primary, accent: opts.primary, text: opts.text, muted: opts.muted },
    cover: { title: opts.title, subtitle: opts.subtitle, hosts: "", ornament: opts.ornament },
    details: { ...BASE.details, message: opts.message },
  },
});

BUILTIN_TEMPLATES.push(
  extra("tpl-graduation", "تخرج أنيق", "graduation", "graduation", { bg: "#4F6B5F", card: "#3F574C", primary: "#C99A70", text: "#FBF8F5", muted: "#CFDAD2", ornament: "❖", title: "حفل التخرج", subtitle: "تهنئة لصاحب المناسبة", message: "نحتفل معكم بهذه المحطة الجميلة في مسيرتكم الدراسية." }),
  extra("tpl-engagement", "خطوبة وردية", "engagement", "engagement", { bg: "#6B574F", card: "#5A4A44", primary: "#E2D3C3", text: "#FBF8F5", muted: "#D6C4B4", ornament: "❦", title: "حفل الخطوبة", subtitle: "فرحة تجمعنا", message: "يسعدنا مشاركتكم فرحتنا في هذه الليلة الجميلة." }),
  extra("tpl-family", "لم شمل عائلي", "family", "family", { bg: "#EDE9E6", card: "#FFFFFF", primary: "#62534F", text: "#4A3B36", muted: "#8A7A70", ornament: "✿", title: "لم شمل العائلة", subtitle: "أهلًا بكم في بيتنا", message: "اجتماعنا هو ما يكمل بهجة الأيام." }),
  extra("tpl-opening", "افتتاح رسمي", "opening", "opening", { bg: "#5E796F", card: "#4A6359", primary: "#C99A70", text: "#FBF8F5", muted: "#CFDAD2", ornament: "◆", title: "حفل الافتتاح", subtitle: "نتشرف بحضوركم", message: "ندعوكم لحضور حفل الافتتاح ومشاركتنا هذه الخطوة." }),
  extra("tpl-festival", "مهرجان نابض", "festival", "festival", { bg: "#4A3B36", card: "#62534F", primary: "#C99A70", text: "#FBF8F5", muted: "#C9B7A6", ornament: "✦", title: "المهرجان", subtitle: "أهلًا وسهلًا بكم", message: "استمتعوا ببرنامج المهرجان وفعالياته المتنوعة." })
);

export async function seedPlans(db: DB) {
  PLANS_SEED.forEach(async (p, i) => {
    (await db.run(
      `INSERT INTO plans (id, name_ar, price_monthly_sar, max_active_events, max_guests_per_event, max_delegates_per_event, storage_mb, advanced_templates, custom_branding, multi_seat, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      p.id, p.name_ar, p.price_monthly_sar, p.max_active_events, p.max_guests_per_event,
      p.max_delegates_per_event, p.storage_mb, p.advanced_templates, p.custom_branding, p.multi_seat, i
    ));
  });
}

export async function seedTemplates(db: DB) {
  const categories: Record<string, string> = {
    "tpl-royal": "wedding", "tpl-modern": "wedding", "tpl-heritage": "wedding",
    "tpl-romantic": "engagement", "tpl-formal": "conference", "tpl-corporate": "meeting",
  };
  for (const t of BUILTIN_TEMPLATES) {
    const category = t.category ?? categories[t.id] ?? "wedding";
    (await db.run(
      `INSERT INTO templates (id, organization_id, name_ar, style, category, visibility, version, schema_json)
       VALUES (?, NULL, ?, ?, ?, 'public', 1, ?)
       ON CONFLICT(id) DO UPDATE SET category = excluded.category`,
      t.id, t.name_ar, t.style, category, JSON.stringify(t.schema)
    ));
  }
}
