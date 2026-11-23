/** الموردون والعقود والمرفقات — ملفات محلية محكومة بصلاحية المناسبة */
import fs from "node:fs";
import path from "node:path";
import { newId } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { loadEventScoped } from "@/lib/permissions";
import { uploadDir } from "./media";
import { requirePlanningAccess } from "./planning";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"];

export async function listVendors(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  return (await ctx.db.all(
    `SELECT v.*, (SELECT COUNT(*) FROM expenses e WHERE e.vendor_id = v.id) expenses,
      (SELECT COUNT(*) FROM attachments a WHERE a.vendor_id = v.id AND a.status = 'active') docs
     FROM vendors v WHERE v.event_id = ? ORDER BY v.category, v.name`, eventId
  ));
}

export async function saveVendor(ctx: Ctx, eventId: string, input: any, id?: string) {
  (await requirePlanningAccess(ctx, eventId, "services"));
  if (!input.name?.trim() || !input.category?.trim()) err("VALIDATION", "اسم المورد والفئة مطلوبان");
  if (id) {
    (await ctx.db.run(
      `UPDATE vendors SET name=?, category=?, contact_name=?, phone=?, email=?, address=?, notes=?, status=? WHERE id=? AND event_id=?`,
      input.name.trim(), input.category.trim(), input.contact_name ?? null, input.phone ?? null,
      input.email ?? null, input.address ?? null, input.notes ?? null, input.status ?? "potential", id, eventId
    ));
  } else {
    id = newId();
    (await ctx.db.run(
      `INSERT INTO vendors (id, event_id, organization_id, name, category, contact_name, phone, email, address, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, input.name.trim(), input.category.trim(), input.contact_name ?? null,
      input.phone ?? null, input.email ?? null, input.address ?? null, input.notes ?? null, input.status ?? "potential"
    ));
  }
  return (await ctx.db.get("SELECT * FROM vendors WHERE id = ?", id));
}

export async function deleteVendor(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "services"));
  (await ctx.db.run("DELETE FROM vendors WHERE id = ? AND event_id = ?", id, eventId));
  return { ok: true };
}

export async function listAttachments(ctx: Ctx, eventId: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  return (await ctx.db.all(
    `SELECT a.*, v.name vendor_name, u.name uploader_name FROM attachments a
     LEFT JOIN vendors v ON v.id = a.vendor_id LEFT JOIN users u ON u.id = a.uploader_id
     WHERE a.event_id = ? AND a.status = 'active' ORDER BY a.created_at DESC`, eventId
  ));
}

export async function uploadAttachment(ctx: Ctx, eventId: string, file: { bytes: Uint8Array; mime: string; name: string }, input: { kind: string; title: string; vendorId?: string }) {
  const event = (await loadEventScoped(ctx.db, ctx.actor.orgId, eventId));
  (await requirePlanningAccess(ctx, eventId, "services"));
  if (!ALLOWED.includes(file.mime)) err("VALIDATION", `نوع الملف غير مسموح: ${file.mime}`);
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > 20 * 1024 * 1024)
    err("VALIDATION", "الملف فارغ أو أكبر من 20MB");
  if (!["contract", "quote", "invoice", "photo", "other"].includes(input.kind))
    err("VALIDATION", "نوع المرفق غير صالح");
  if (input.vendorId && !(await ctx.db.get("SELECT id FROM vendors WHERE id = ? AND event_id = ?", input.vendorId, event.id)))
    err("NOT_FOUND", "المورد غير موجود");
  const id = newId();
  const ext = file.mime.includes("pdf") ? "pdf" : file.mime.includes("word") ? "docx" : file.mime.includes("sheet") ? "xlsx" : file.mime.includes("png") ? "png" : file.mime.includes("webp") ? "webp" : file.mime.includes("jpeg") ? "jpg" : "bin";
  const key = path.join(ctx.actor.orgId, `event-${eventId}`, `${id}.${ext}`);
  const full = path.join(uploadDir(), key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.bytes);
  (await ctx.db.run(
    `INSERT INTO attachments (id, event_id, organization_id, uploader_id, vendor_id, kind, title, mime, bytes, storage_key)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    id, eventId, ctx.actor.orgId, ctx.actor.user.id, input.vendorId || null,
    input.kind, (input.title || file.name).slice(0, 200), file.mime, file.bytes.byteLength, key
  ));
  return (await ctx.db.get("SELECT * FROM attachments WHERE id = ?", id));
}

export async function getAttachment(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "view"));
  const a = (await ctx.db.get<any>("SELECT * FROM attachments WHERE id = ? AND event_id = ? AND status = 'active'", id, eventId));
  if (!a) err("NOT_FOUND", "المرفق غير موجود");
  const full = path.join(uploadDir(), a.storage_key);
  if (!fs.existsSync(full)) err("NOT_FOUND", "الملف غير موجود على التخزين");
  return { asset: a, full };
}

export async function deleteAttachment(ctx: Ctx, eventId: string, id: string) {
  (await requirePlanningAccess(ctx, eventId, "services"));
  const a = (await ctx.db.get<any>("SELECT * FROM attachments WHERE id = ? AND event_id = ?", id, eventId));
  if (!a) err("NOT_FOUND");
  (await ctx.db.run("UPDATE attachments SET status = 'deleted' WHERE id = ?", id));
  try { fs.unlinkSync(path.join(uploadDir(), a.storage_key)); } catch { /* تم الحذف مسبقًا */ }
  return { ok: true };
}
