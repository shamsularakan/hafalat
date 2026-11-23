/**
 * القوالب ومحرر الدعوة MVP (القسم 05) — Schema بإصدارات؛ مسودة ثم نشر.
 * تغيير التصميم بعد الإرسال لا يمس البيانات التشغيلية (دعوات/حصص/ردود).
 * المستوى الزمني الكامل (Timeline) مرحلة لاحقة 2.0 حسب الوثيقة.
 */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { requireEventAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { BUILTIN_TEMPLATES } from "@/lib/seeds";

export { BUILTIN_TEMPLATES };
export { seedTemplates } from "@/lib/seeds";

export interface DesignSchema {
  template_style: string;
  palette: { bg: string; card: string; primary: string; accent: string; text: string; muted: string };
  motion: "envelope" | "fade" | "slide" | "scale" | "reveal" | "flip";
  cover: { title: string; subtitle: string; hosts: string; ornament: string };
  details: {
    message: string; venue_label: string; date_label: string; rsvp_note: string;
    program?: string; dress_code?: string; transport?: string; accommodation?: string;
    quote?: string; photo_url?: string; rsvp_phone?: string; monogram?: string;
    groom?: string; bride?: string; invitation_line?: string;
    /** قالب الصفحة الكاملة: صورة القاعة، معلومات الضيوف (سطر لكل معلومة)، والعبارة الختامية */
    venue_photo_url?: string; guest_notes?: string; closing_line?: string; wishes_enabled?: boolean;
  };
  logo_asset_id?: string | null;
  background_asset_id?: string | null;
  show_countdown: boolean;
  show_qr: boolean;
  scenes?: any[];
}

export async function listTemplates(ctx: Ctx) {
  return (await ctx.db.all(
    "SELECT * FROM templates WHERE visibility = 'public' OR organization_id = ? ORDER BY style",
    ctx.actor.orgId
  ));
}

export async function getDesign(ctx: Ctx, eventId: string) {
  (await requireEventAccess(ctx, eventId, ["owner", "manager", "designer", "supervisor", "delegate"]));
  const published = (await ctx.db.get("SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'published'", eventId));
  const draft = (await ctx.db.get("SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'draft'", eventId));
  return { published: published ?? null, draft: draft ?? null };
}

function validateSchema(schema: DesignSchema) {
  if (!schema || typeof schema !== "object") err("VALIDATION", "تصميم غير صالح");
  if (!schema.cover?.title?.trim()) err("VALIDATION", "عنوان الدعوة مطلوب");
  const hex = /^#[0-9a-fA-F]{6}$/;
  for (const [k, v] of Object.entries(schema.palette ?? {})) {
    if (!hex.test(String(v))) err("VALIDATION", `لون غير صالح: ${k}`);
  }
  const motions = ["envelope", "fade", "slide", "scale", "reveal", "flip"];
  if (!motions.includes(schema.motion)) err("VALIDATION", "حركة غير معروفة");
  if ((schema.cover.title?.length ?? 0) > 120) err("VALIDATION", "العنوان طويل جدًا");
  if ((schema.details.message?.length ?? 0) > 1000) err("VALIDATION", "النص طويل جدًا");
}

export async function saveDraft(ctx: Ctx, eventId: string, input: { template_id?: string | null; schema: DesignSchema; audio_asset_id?: string | null }) {
  (await requireEventAccess(ctx, eventId, ["owner", "manager", "designer"]));
  validateSchema(input.schema);
  if (input.audio_asset_id) {
    const asset = (await ctx.db.get<{ id: string; kind: string; rights_attested: number }>(
      "SELECT id, kind, rights_attested FROM media_assets WHERE id = ? AND organization_id = ? AND status = 'active'",
      input.audio_asset_id, ctx.actor.orgId
    ));
    if (!asset) err("NOT_FOUND", "الملف الصوتي غير موجود");
    if (asset.kind !== "audio") err("VALIDATION", "الملف ليس صوتيًا");
    if (!asset.rights_attested) err("VALIDATION", "يلزم تأكيد حق استخدام الملف الصوتي");
  }
  const existing = (await ctx.db.get<{ id: string; version: number }>(
    "SELECT id, version FROM invitation_designs WHERE event_id = ? AND state = 'draft'", eventId
  ));
  if (existing) {
    (await ctx.db.run(
      "UPDATE invitation_designs SET template_id = ?, scenes_json = ?, audio_asset_id = ?, version = version + 1, updated_at = ? WHERE id = ?",
      input.template_id ?? null, JSON.stringify(input.schema), input.audio_asset_id ?? null, nowIso(), existing.id
    ));
    return (await ctx.db.get("SELECT * FROM invitation_designs WHERE id = ?", existing.id));
  }
  const id = newId();
  (await ctx.db.run(
    "INSERT INTO invitation_designs (id, event_id, organization_id, template_id, scenes_json, version, state, audio_asset_id) VALUES (?,?,?,?,?,1,'draft',?)",
    id, eventId, ctx.actor.orgId, input.template_id ?? null, JSON.stringify(input.schema), input.audio_asset_id ?? null
  ));
  return (await ctx.db.get("SELECT * FROM invitation_designs WHERE id = ?", id));
}

export async function publishDesign(ctx: Ctx, eventId: string) {
  (await requireEventAccess(ctx, eventId, ["owner", "manager", "designer"]));
  const draft = (await ctx.db.get<any>("SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'draft'", eventId));
  if (!draft) err("NOT_FOUND", "لا توجد مسودة تصميم — احفظ المسودة أولًا");
  validateSchema(JSON.parse(draft.scenes_json));
  return (await ctx.db.tx(async () => {
    (await ctx.db.run("DELETE FROM invitation_designs WHERE event_id = ? AND state = 'published'", eventId));
    (await ctx.db.run(
      "UPDATE invitation_designs SET state = 'published', published_at = ?, updated_at = ? WHERE id = ?",
      nowIso(), nowIso(), draft.id
    ));
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
      action: "design.publish", objectType: "invitation_design", objectId: draft.id,
      detail: { version: draft.version }, ip: ctx.ip,
    }));
    return (await ctx.db.get("SELECT * FROM invitation_designs WHERE id = ?", draft.id));
  }));
}
