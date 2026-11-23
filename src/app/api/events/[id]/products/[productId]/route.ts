import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { saveProduct, deleteProduct } from "@/server/services/operations";

type P = { params: Promise<{ id: string; productId: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id, productId } = await params;
  return ok(await saveProduct(await buildCtx(clientIp(req)), id, await readJson(req), productId));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id, productId } = await params;
  return ok(await deleteProduct(await buildCtx(clientIp(req)), id, productId));
});
