import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { saveHelper, removeHelper } from "@/server/services/helpers";

type P = { params: Promise<{ id: string; helperId: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id, helperId } = await params;
  return ok(await saveHelper(await buildCtx(clientIp(req)), id, await readJson(req), helperId));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id, helperId } = await params;
  return ok(await removeHelper(await buildCtx(clientIp(req)), id, helperId));
});
