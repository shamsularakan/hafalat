import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/context";

/** نظرة عامة عابرة للمؤسسات — مدير المنصة فقط */
export const GET = route(async (req: Request) => {
  await requirePlatformAdmin();
  const db = getDb();
  const one = (sql: string) => db.get<{ n: number }>(sql)!.n;
  return ok({
    counts: {
      users: one("SELECT COUNT(*) n FROM users"),
      admins: one("SELECT COUNT(*) n FROM users WHERE is_platform_admin = 1"),
      organizations: one("SELECT COUNT(*) n FROM organizations"),
      events: one("SELECT COUNT(*) n FROM events"),
      active_events: one("SELECT COUNT(*) n FROM events WHERE status IN ('draft','ready','published','ongoing')"),
      guests: one("SELECT COUNT(*) n FROM guests"),
      invitations: one("SELECT COUNT(*) n FROM invitations"),
      checkins: one("SELECT COUNT(*) n FROM checkins"),
      templates: one("SELECT COUNT(*) n FROM templates"),
      audit_logs: one("SELECT COUNT(*) n FROM audit_logs"),
    },
    plan_usage: db.all(
      "SELECT p.id, p.name_ar, COUNT(o.id) orgs FROM plans p LEFT JOIN organizations o ON o.plan_id = p.id GROUP BY p.id ORDER BY p.sort_order"
    ),
    recent_events: db.all(
      `SELECT e.id, e.title, e.status, e.created_at, o.name org_name, o.id org_id,
        (SELECT COUNT(*) FROM invitations i WHERE i.event_id = e.id) invitations
       FROM events e JOIN organizations o ON o.id = e.organization_id
       ORDER BY e.created_at DESC LIMIT 10`
    ),
    recent_audit: db.all(
      `SELECT a.id, a.action, a.created_at, a.organization_id, a.object_type, a.object_id, u.name actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT 10`
    ),
  });
});
