import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/context";

/** قائمة المستخدمين/المديرين على مستوى المنصة */
export const GET = route(async (req: Request) => {
  await requirePlatformAdmin();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = getDb();
  const rows = q
    ? db.all(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.is_platform_admin, u.created_at,
          (SELECT COUNT(*) FROM organization_members m WHERE m.user_id = u.id) orgs
         FROM users u WHERE u.name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC`,
        `%${q}%`, `%${q}%`
      )
    : db.all(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.is_platform_admin, u.created_at,
          (SELECT COUNT(*) FROM organization_members m WHERE m.user_id = u.id) orgs
         FROM users u ORDER BY u.created_at DESC`
      );
  return ok(rows);
});
