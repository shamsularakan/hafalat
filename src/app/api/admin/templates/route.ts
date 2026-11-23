import { route, ok, readJson, clientIp } from "@/lib/api";
import { newId } from "@/lib/db";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

export const GET = route(async () => {
  await requirePlatformAdmin();
  return ok(getDb().all(
    `SELECT t.*, o.name org_name FROM templates t LEFT JOIN organizations o ON o.id = t.organization_id
     ORDER BY t.visibility, t.style`
  ));
});

export const POST = route(async (req: Request) => {
  const admin = await requirePlatformAdmin();
  const b = await readJson(req);
  if (!b.name_ar?.trim() || !b.style?.trim()) err("VALIDATION", "الاسم والطراز مطلوبان");
  if (!["public", "organization", "event"].includes(b.visibility))
    err("VALIDATION", "نوع الظهور غير صالح");
  if (b.visibility === "organization" && !b.organization_id)
    err("VALIDATION", "حدد المؤسسة للقالب الخاص");
  let schema: any;
  try { schema = typeof b.schema_json === "string" ? JSON.parse(b.schema_json) : b.schema_json; }
  catch { err("VALIDATION", "مخطط القالب JSON غير صالح"); }
  if (!schema || typeof schema !== "object") err("VALIDATION", "مخطط القالب غير صالح");
  const db = getDb();
  const id = b.id || newId();
  const exists = db.get("SELECT id FROM templates WHERE id = ?", id);
  const values = [
    b.name_ar.trim(), b.style.trim(), b.visibility,
    b.organization_id || null, JSON.stringify(schema), Number(b.version || 1), b.locked_identity ? 1 : 0,
  ];
  if (exists) {
    db.run(
      `UPDATE templates SET name_ar = ?, style = ?, visibility = ?, organization_id = ?, schema_json = ?,
       version = ?, locked_identity = ? WHERE id = ?`, ...values, id
    );
  } else {
    db.run(
      `INSERT INTO templates (id, organization_id, name_ar, style, visibility, version, schema_json, locked_identity)
       VALUES (?,?,?,?,?,?,?,?)`, id, values[3], values[0], values[1], values[2], values[5], values[4], values[6]
    );
  }
  writeAudit(db, {
    orgId: "platform", actorId: admin.id, action: "platform.template.save",
    objectType: "template", objectId: id, detail: { name: b.name_ar, visibility: b.visibility }, ip: clientIp(req),
  });
  return ok({ id }, 201);
});
