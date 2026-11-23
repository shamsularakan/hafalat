import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { upsertGroup } from "@/server/services/guests";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const g = getDb().get<{ event_id: string }>("SELECT event_id FROM guest_groups WHERE id = ? AND organization_id = ?", id, ctx.actor.orgId);
  if (!g) err("NOT_FOUND");
  return ok(upsertGroup(ctx, g.event_id, { ...(await readJson(req)), id }));
});
