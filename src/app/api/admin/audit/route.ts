import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/server/context";

/** سجل التدقيق العام عبر كل المؤسسات (بحث/فلترة/صفحات) */
export const GET = route(async (req: Request) => {
  await requirePlatformAdmin();
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim() ?? "";
  const action = p.get("action") ?? "";
  const org = p.get("org_id") ?? "";
  const limit = Math.min(Number(p.get("limit") ?? 100), 500);
  const offset = Number(p.get("offset") ?? 0);
  const where: string[] = ["1=1"];
  const args: any[] = [];
  if (q) { where.push("(a.action LIKE ? OR a.object_id LIKE ? OR u.name LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (action) { where.push("a.action LIKE ?"); args.push(`%${action}%`); }
  if (org) { where.push("a.organization_id = ?"); args.push(org); }
  return ok((await (await getDb()).all(
    `SELECT a.*, u.name actor_name, o.name org_name FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     LEFT JOIN organizations o ON o.id = a.organization_id
     WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ...args, limit, offset
  )));
});
