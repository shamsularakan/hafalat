/**
 * الوسائط (القسم 05-3/05-4): رفع مضبوط بالنوع/الحجم، تأكيد حق الاستخدام للصوت،
 * تخزين كائني محليًا (الإنتاج S3/R2 + CDN بروابط موقعة)، حذف غير المستخدم.
 */
import fs from "node:fs";
import path from "node:path";
import { newId, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { requireOrgRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { assertPlanStorage } from "@/lib/plans";
import { findInvitationByToken } from "./rsvp";

const AUDIO_MIMES = ["audio/mpeg", "audio/mp3", "audio/aac", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "application/octet-stream"];
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_AUDIO = 15 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

export function uploadDir(): string {
  return path.resolve(process.env.DAWAT_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));
}

export interface UploadInput {
  bytes: Uint8Array;
  mime: string;
  originalName: string;
  kind: "audio" | "image" | "logo";
  eventId?: string | null;
  rightsAttested: boolean;
  rightsNote?: string;
}

export async function uploadMedia(ctx: Ctx, input: UploadInput) {
  const isAudio = input.kind === "audio";
  const allowed = isAudio ? AUDIO_MIMES : IMAGE_MIMES;
  // منع SVG (XSS) والصيغ غير المصرح بها
  if (!allowed.includes(input.mime))
    err("VALIDATION", `نوع ملف غير مسموح: ${input.mime}`);
  const max = isAudio ? MAX_AUDIO : MAX_IMAGE;
  if (input.bytes.byteLength === 0) err("VALIDATION", "الملف فارغ");
  if (input.bytes.byteLength > max)
    err("VALIDATION", `حجم الملف يتجاوز ${Math.round(max / 1024 / 1024)}MB`);
  if (isAudio && !input.rightsAttested)
    err("VALIDATION", "يلزم تأكيد ملكية الملف أو ترخيصه قبل الرفع");
  (await assertPlanStorage(ctx.db, ctx.actor.orgId, input.bytes.byteLength));
  if (input.eventId) {
    const ev = (await ctx.db.get("SELECT id FROM events WHERE id = ? AND organization_id = ?", input.eventId, ctx.actor.orgId));
    if (!ev) err("NOT_FOUND", "المناسبة غير موجودة");
  }

  const id = newId();
  const ext = isAudio ? (input.mime.includes("wav") ? "wav" : input.mime.includes("ogg") ? "ogg" : input.mime.includes("mp4") || input.mime.includes("aac") ? "m4a" : "mp3")
    : input.mime === "image/png" ? "png" : input.mime === "image/webp" ? "webp" : input.mime === "image/gif" ? "gif" : "jpg";
  const key = path.join(ctx.actor.orgId, `${id}.${ext}`);
  const full = path.join(uploadDir(), key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, input.bytes);

  (await ctx.db.run(
    `INSERT INTO media_assets (id, organization_id, owner_id, event_id, kind, mime, bytes, original_name, storage_key, rights_attested, rights_note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    id, ctx.actor.orgId, ctx.actor.user.id, input.eventId ?? null, input.kind,
    input.mime, input.bytes.byteLength, input.originalName.slice(0, 200), key,
    input.rightsAttested ? 1 : 0, input.rightsNote ?? null
  ));
  (await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId: input.eventId, actorId: ctx.actor.user.id,
    action: "media.upload", objectType: "media_asset", objectId: id,
    detail: { kind: input.kind, bytes: input.bytes.byteLength, rights: input.rightsAttested }, ip: ctx.ip,
  }));
  return (await ctx.db.get("SELECT id, kind, mime, bytes, original_name, rights_attested, created_at FROM media_assets WHERE id = ?", id));
}

export async function listMedia(ctx: Ctx, eventId?: string) {
  return (await ctx.db.all(
    `SELECT id, kind, mime, bytes, original_name, rights_attested, status, created_at FROM media_assets
     WHERE organization_id = ? AND status = 'active' ${eventId ? "AND (event_id = ? OR event_id IS NULL)" : ""} ORDER BY created_at DESC`,
    ...(eventId ? [ctx.actor.orgId, eventId] : [ctx.actor.orgId])
  ));
}

/** وصول موثق: ملكية المنظمة فقط */
export async function getAssetForOwner(ctx: Ctx, assetId: string) {
  const asset = (await ctx.db.get<any>(
    "SELECT * FROM media_assets WHERE id = ? AND organization_id = ? AND status = 'active'",
    assetId, ctx.actor.orgId
  ));
  if (!asset) err("NOT_FOUND", "الملف غير موجود");
  const full = path.join(uploadDir(), asset.storage_key);
  if (!fs.existsSync(full)) err("NOT_FOUND", "الملف غير موجود على التخزين");
  return { asset, full };
}

/** وصول الضيف للصوت: مربوط بدعوة صالحة فقط — بلا كشف أي بيانات أخرى */
export async function getAudioForGuestToken(db: DB, rawToken: string) {
  const inv = (await findInvitationByToken(db, rawToken));
  const design = (await db.get<any>(
    "SELECT audio_asset_id FROM invitation_designs WHERE event_id = ? AND state = 'published'", inv.event_id
  )) ?? (await db.get<any>("SELECT audio_asset_id FROM invitation_designs WHERE event_id = ? AND state = 'draft'", inv.event_id));
  if (!design?.audio_asset_id) err("NOT_FOUND", "لا يوجد مقطع صوتي لهذه الدعوة");
  const asset = (await db.get<any>(
    "SELECT * FROM media_assets WHERE id = ? AND status = 'active' AND kind = 'audio'", design.audio_asset_id
  ));
  if (!asset) err("NOT_FOUND");
  const full = path.join(uploadDir(), asset.storage_key);
  if (!fs.existsSync(full)) err("NOT_FOUND");
  return { asset, full };
}

export async function deleteMedia(ctx: Ctx, assetId: string) {
  requireOrgRole(ctx, ["owner", "admin", "member"]);
  const asset = (await ctx.db.get<any>(
    "SELECT * FROM media_assets WHERE id = ? AND organization_id = ?", assetId, ctx.actor.orgId
  ));
  if (!asset) err("NOT_FOUND");
  if (asset.owner_id !== ctx.actor.user.id && ctx.actor.orgRole === "member")
    err("FORBIDDEN", "يمكن للمالك أو المشرف حذف ملفات الآخرين");
  const inUse = (await ctx.db.get(
    "SELECT id FROM invitation_designs WHERE audio_asset_id = ? AND organization_id = ?", assetId, ctx.actor.orgId
  ));
  (await ctx.db.run("UPDATE media_assets SET status = 'deleted' WHERE id = ?", assetId));
  try { fs.unlinkSync(path.join(uploadDir(), asset.storage_key)); } catch { /* قد يكون محذوفًا */ }
  (await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, actorId: ctx.actor.user.id,
    action: "media.delete", objectType: "media_asset", objectId: assetId,
    detail: { was_in_use: !!inUse }, ip: ctx.ip,
  }));
  return { ok: true };
}
