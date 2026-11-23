/**
 * محرر/عارض الدعوات الموحّد — ليلتنا
 * مخطط المشاهد/الطبقات يُستخدم في معاينة المصمم وفي صفحة المدعو (نفس المحرك).
 * المتغيرات تُحقن من الخادم وتُعامل كنص آمن (لا HTML ولا JavaScript).
 */
export type LayerType = "text" | "ornament" | "image" | "qr" | "button" | "audio" | "program" | "monogram";
export type SceneKind = "cover" | "welcome" | "details" | "rsvp" | "ticket";

export interface Layer {
  id: string;
  type: LayerType;
  content?: string;
  variable?: string;
  style?: {
    fontSize?: number;
    color?: string;
    align?: "right" | "center" | "left";
    opacity?: number;
    x?: number;
    y?: number;
    weight?: "normal" | "bold";
  };
}

export interface Scene {
  id: string;
  kind: SceneKind;
  title?: string;
  motion?: string;
  duration?: number;
  layers: Layer[];
}

export interface EngineSchema {
  template_style?: string;
  palette: { bg: string; card: string; primary: string; accent: string; text: string; muted: string };
  motion?: string;
  cover: { title: string; subtitle: string; hosts: string; ornament: string };
  details: {
    message: string; venue_label: string; date_label: string; rsvp_note: string;
    /** حقول إضافية لقالب الدعوة البصري — كلها اختيارية */
    program?: string; dress_code?: string; transport?: string; accommodation?: string;
    quote?: string; photo_url?: string; rsvp_phone?: string; monogram?: string;
    groom?: string; bride?: string; invitation_line?: string;
    /** قالب الصفحة الكاملة: صورة القاعة، معلومات الضيوف (سطر لكل معلومة)، والعبارة الختامية */
    venue_photo_url?: string; guest_notes?: string; closing_line?: string; wishes_enabled?: boolean;
  };
  logo_asset_id?: string | null;
  background_asset_id?: string | null;
  show_countdown?: boolean;
  show_qr?: boolean;
  scenes?: Scene[];
}

export type TemplateVars = Record<string, string | number>;

/** قائمة المتغيرات المسموح بها فقط */
export const ALLOWED_VARS = [
  "guest.name", "event.name", "event.date", "event.time", "event.venue",
  "guest.allowed_companions", "invitation.category", "host.names",
  "event.program", "event.dress_code", "event.transport", "event.accommodation",
  "event.quote", "event.photo", "event.rsvp_deadline", "event.rsvp_phone",
  "event.monogram", "event.groom", "event.bride", "event.invitation_line",
  "guest.title", "event.venue_photo", "event.guest_notes", "event.closing_line",
] as const;

function clean(v: string | number): string {
  return String(v)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

/** استبدال {{variable}} بقيم آمنة؛ أي متغير غير مسموح يُترك فارغًا. React يعرض النص كنص لا HTML. */
export function substitute(input: string, vars: TemplateVars): string {
  return input
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      if (!(ALLOWED_VARS as readonly string[]).includes(key)) return "";
      const value = vars[key];
      return value === undefined || value === null ? "" : clean(value);
    })
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "");
}

/** رابط صورة آمن: مساراتنا المحلية أو https أو data:image base64 فقط */
export function safeImageUrl(input: string): string | null {
  const v = String(input ?? "").trim();
  if (!v) return null;
  if (/^\/api\//.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(v)) return v;
  return null;
}

export function layerText(layer: Layer, vars: TemplateVars): string {
  const raw = layer.variable ? `{{${layer.variable}}}` : (layer.content ?? "");
  return substitute(raw, vars);
}

/** بناء مشاهد افتراضية من التصميم القديم لتوافق المحرك */
export function defaultScenes(schema: EngineSchema): Scene[] {
  if (schema.scenes?.length) return schema.scenes;
  const s = (kind: SceneKind, title: string, layers: Layer[]): Scene => ({
    id: `scene-${kind}`, kind, title, motion: schema.motion ?? "fade", duration: 5, layers,
  });
  return [
    s("cover", "الغلاف", [
      { id: "l-cover-ornament", type: "ornament", content: schema.cover?.ornament ?? "✦" },
      { id: "l-cover-title", type: "text", content: schema.cover?.title ?? "دعوة خاصة لك", variable: undefined },
      { id: "l-cover-sub", type: "text", content: schema.cover?.subtitle ?? "نتشرف بحضوركم" },
    ]),
    s("welcome", "الترحيب", [
      { id: "l-welcome", type: "text", content: "نتشرف بدعوتكم", variable: "guest.name" },
    ]),
    s("details", "التفاصيل", [
      { id: "l-details", type: "text", content: schema.details?.message ?? "" },
      { id: "l-hosts", type: "text", content: schema.cover?.hosts ?? "" },
    ]),
    s("rsvp", "تأكيد الحضور", [{ id: "l-rsvp", type: "button", content: "سأحضر / أعتذر" }]),
    s("ticket", "تذكرة الدخول", [{ id: "l-ticket", type: "qr", content: "رمز الدخول" }]),
  ];
}
