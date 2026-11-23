import { DB, newId, nowIso } from "./db";

export interface AuditInput {
  orgId: string;
  eventId?: string | null;
  actorId?: string | null;
  action: string;
  objectType?: string | null;
  objectId?: string | null;
  detail?: unknown;
  ip?: string | null;
}

/** سجل تدقيق للعمليات الحساسة (القسم 02/11) — لا تُسجل رموز خام أو بيانات حساسة */
export async function writeAudit(db: DB, input: AuditInput) {
  (await db.run(
    `INSERT INTO audit_logs (id, organization_id, event_id, actor_id, action, object_type, object_id, detail_json, ip, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    newId(),
    input.orgId,
    input.eventId ?? null,
    input.actorId ?? null,
    input.action,
    input.objectType ?? null,
    input.objectId ?? null,
    input.detail ? JSON.stringify(input.detail) : null,
    input.ip ?? null,
    nowIso()
  ));
}
