import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { setWishHidden } from "@/server/services/operations";

type P = { params: Promise<{ id: string; wishId: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id, wishId } = await params;
  const { hidden } = await readJson(req);
  return ok(await setWishHidden(await buildCtx(clientIp(req)), id, wishId, !!hidden));
});
