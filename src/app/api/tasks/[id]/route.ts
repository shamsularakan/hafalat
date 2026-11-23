import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { saveTask, deleteTask } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const t = getDb().get<{ event_id: string }>("SELECT event_id FROM tasks WHERE id = ?", id);
  if (!t) err("NOT_FOUND");
  return ok(saveTask(ctx, t.event_id, await readJson(req), id));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const t = getDb().get<{ event_id: string }>("SELECT event_id FROM tasks WHERE id = ?", id);
  if (!t) err("NOT_FOUND");
  return ok(deleteTask(ctx, t.event_id, id));
});
