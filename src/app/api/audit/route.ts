import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireOrgRole } from "@/lib/permissions";

export const GET = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  requireOrgRole(ctx, ["owner", "admin"]);
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const rows = eventId
    ? (await ctx.db.all(
        `SELECT a.*, u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.organization_id = ? AND a.event_id = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        ctx.actor.orgId, eventId, limit, offset
      ))
    : (await ctx.db.all(
        `SELECT a.*, u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.organization_id = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        ctx.actor.orgId, limit, offset
      ));
  return ok(rows);
});
