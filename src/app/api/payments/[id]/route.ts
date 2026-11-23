import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { savePayment, deletePayment } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const p = getDb().get<{ event_id: string }>("SELECT event_id FROM payments WHERE id = ?", id);
  if (!p) err("NOT_FOUND");
  return ok(savePayment(ctx, p.event_id, await readJson(req), id));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const p = getDb().get<{ event_id: string }>("SELECT event_id FROM payments WHERE id = ?", id);
  if (!p) err("NOT_FOUND");
  return ok(deletePayment(ctx, p.event_id, id));
});
