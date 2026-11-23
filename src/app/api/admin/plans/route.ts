import { route, ok, readJson, clientIp } from "@/lib/api";
import { newId } from "@/lib/db";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { requirePlatformAdmin } from "@/server/context";
import { writeAudit } from "@/lib/audit";

export const GET = route(async () => {
  await requirePlatformAdmin();
  return ok(getDb().all("SELECT * FROM plans ORDER BY sort_order, id"));
});

const NUMBERS = [
  "price_monthly_sar", "max_active_events", "max_guests_per_event",
  "max_delegates_per_event", "storage_mb", "sort_order",
];
const BOOLS = ["advanced_templates", "custom_branding", "multi_seat"];

export const POST = route(async (req: Request) => {
  const admin = await requirePlatformAdmin();
  const b = await readJson(req);
  if (!b.name_ar?.trim()) err("VALIDATION", "اسم الباقة مطلوب");
  for (const k of NUMBERS) {
    if (b[k] !== undefined && (!Number.isInteger(Number(b[k])) || Number(b[k]) < 0))
      err("VALIDATION", `قيمة غير صالحة: ${k}`);
  }
  const db = getDb();
  const id = b.id || newId();
  const exists = db.get("SELECT id FROM plans WHERE id = ?", id);
  const values = [
    b.name_ar.trim(), ...NUMBERS.map((k) => Number(b[k] ?? 0)),
    ...BOOLS.map((k) => (b[k] ? 1 : 0)),
  ];
  if (exists) {
    db.run(
      `UPDATE plans SET name_ar = ?, price_monthly_sar = ?, max_active_events = ?, max_guests_per_event = ?,
       max_delegates_per_event = ?, storage_mb = ?, sort_order = ?, advanced_templates = ?, custom_branding = ?,
       multi_seat = ? WHERE id = ?`,
      ...values, id
    );
  } else {
    db.run(
      `INSERT INTO plans (id, name_ar, price_monthly_sar, max_active_events, max_guests_per_event,
       max_delegates_per_event, storage_mb, sort_order, advanced_templates, custom_branding, multi_seat)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id, ...values
    );
  }
  writeAudit(db, {
    orgId: "platform", actorId: admin.id, action: "platform.plan.save",
    objectType: "plan", objectId: id, detail: { name: b.name_ar }, ip: clientIp(req),
  });
  return ok({ id }, 201);
});
