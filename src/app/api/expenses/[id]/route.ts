import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { saveExpense, deleteExpense } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const e = (await (await getDb()).get<{ event_id: string }>("SELECT event_id FROM expenses WHERE id = ?", id));
  if (!e) err("NOT_FOUND");
  return ok((await saveExpense(ctx, e.event_id, await readJson(req), id)));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const e = (await (await getDb()).get<{ event_id: string }>("SELECT event_id FROM expenses WHERE id = ?", id));
  if (!e) err("NOT_FOUND");
  return ok((await deleteExpense(ctx, e.event_id, id)));
});
