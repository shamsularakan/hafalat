import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { saveBudgetCategory, deleteBudgetCategory } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const c = getDb().get<{ event_id: string }>("SELECT event_id FROM budget_categories WHERE id = ?", id);
  if (!c) err("NOT_FOUND");
  const b = await readJson(req);
  return ok(saveBudgetCategory(ctx, c.event_id, b, id));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const c = getDb().get<{ event_id: string }>("SELECT event_id FROM budget_categories WHERE id = ?", id);
  if (!c) err("NOT_FOUND");
  return ok(deleteBudgetCategory(ctx, c.event_id, id));
});
