import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

/** تدخل إشرافي على حالة مناسبة (إلغاء/أرشفة/إنهاء) مع سبب موثق */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const { status, reason } = await readJson(req);
  if (!["published", "ongoing", "ended", "archived", "cancelled"].includes(status))
    err("VALIDATION", "حالة غير صالحة");
  if (!reason?.trim()) err("VALIDATION", "سبب التدخل الإشرافي مطلوب");
  const db = (await getDb());
  const before = (await db.get<any>("SELECT id, title, status FROM events WHERE id = ?", id));
  if (!before) err("NOT_FOUND", "المناسبة غير موجودة");
  (await db.run("UPDATE events SET status = ?, updated_at = ? WHERE id = ?", status, new Date().toISOString(), id));
  (await writeAudit(db, {
    orgId: "platform", actorId: admin.id, action: "platform.event.moderate",
    objectType: "event", objectId: id,
    detail: { from: before.status, to: status, title: before.title, reason: reason.trim() }, ip: clientIp(req),
  }));
  return ok({ ok: true });
});
