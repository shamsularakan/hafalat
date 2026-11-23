import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { saveMyProduct, deleteMyProduct } from "@/server/services/vendor-portal";

type P = { params: Promise<{ productId: string }> };

export const PATCH = route(async (req: Request, { params }: P) => {
  const { productId } = await params;
  return ok(await saveMyProduct(await buildCtx(clientIp(req)), await readJson(req), productId));
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { productId } = await params;
  return ok(await deleteMyProduct(await buildCtx(clientIp(req)), productId));
});
