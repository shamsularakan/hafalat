import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { selectProduct } from "@/server/services/operations";

type P = { params: Promise<{ id: string; productId: string }> };

/** { selected?: boolean, quantity?: number | null } */
export const POST = route(async (req: Request, { params }: P) => {
  const { id, productId } = await params;
  return ok(await selectProduct(await buildCtx(clientIp(req)), id, productId, await readJson(req)));
});
