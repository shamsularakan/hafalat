import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listCatalog, saveProduct } from "@/server/services/operations";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await listCatalog(await buildCtx(clientIp(req)), id));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await saveProduct(await buildCtx(clientIp(req)), id, await readJson(req)), 201);
});
