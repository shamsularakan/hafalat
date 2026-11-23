import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/context";

/** الإشراف: كل المناسبات عبر كل المؤسسات + بحث/تصفية */
export const GET = route(async (req: Request) => {
  await requirePlatformAdmin();
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim() ?? "";
  const status = p.get("status") ?? "";
  const limit = Math.min(Number(p.get("limit") ?? 50), 200);
  const offset = Number(p.get("offset") ?? 0);
  const where: string[] = ["1=1"];
  const args: any[] = [];
  if (q) { where.push("(e.title LIKE ? OR o.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (status) { where.push("e.status = ?"); args.push(status); }
  const rows = getDb().all(
    `SELECT e.*, o.name org_name, u.name owner_name,
      (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id) guests,
      (SELECT COUNT(*) FROM invitations i WHERE i.event_id = e.id) invitations,
      (SELECT COUNT(*) FROM checkins c WHERE c.event_id = e.id) checkins
     FROM events e JOIN organizations o ON o.id = e.organization_id JOIN users u ON u.id = e.owner_id
     WHERE ${where.join(" AND ")} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
    ...args, limit, offset
  );
  return ok(rows);
});
