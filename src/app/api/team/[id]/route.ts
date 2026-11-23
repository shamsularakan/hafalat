import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { removePlanningMember } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const m = getDb().get<{ event_id: string }>("SELECT event_id FROM planning_team WHERE id = ?", id);
  if (!m) err("NOT_FOUND");
  return ok(removePlanningMember(ctx, m.event_id, id));
});
