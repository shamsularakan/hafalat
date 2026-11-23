import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { saveVendor, deleteVendor } from "@/server/services/resources";

type P = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const v = (await (await getDb()).get<{ event_id: string }>("SELECT event_id FROM vendors WHERE id = ?", id));
  if (!v) err("NOT_FOUND");
  const b = await readJson(req);
  return ok((await saveVendor(ctx, v.event_id, b, id)));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const v = (await (await getDb()).get<{ event_id: string }>("SELECT event_id FROM vendors WHERE id = ?", id));
  if (!v) err("NOT_FOUND");
  return ok((await deleteVendor(ctx, v.event_id, id)));
});
