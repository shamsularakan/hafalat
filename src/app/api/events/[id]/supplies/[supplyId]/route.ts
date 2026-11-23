import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { updateSupply, removeSupply } from "@/server/services/supplies";

type P = { params: Promise<{ id: string; supplyId: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id, supplyId } = await params;
  return ok(await updateSupply(await buildCtx(clientIp(req)), id, supplyId, await readJson(req)));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id, supplyId } = await params;
  return ok(await removeSupply(await buildCtx(clientIp(req)), id, supplyId));
});
