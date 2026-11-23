import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { getSupplies, addSupplies, addCustomSupply } from "@/server/services/supplies";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await getSupplies(await buildCtx(clientIp(req)), id));
});

/** { item_keys: string[] } أو { preset: "wedding_full" } أو { custom: {...} } */
export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req);
  if (body.custom) return ok(await addCustomSupply(ctx, id, body.custom), 201);
  return ok(await addSupplies(ctx, id, body), 201);
});
