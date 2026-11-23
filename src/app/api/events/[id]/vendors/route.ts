import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listVendors, saveVendor } from "@/server/services/resources";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await listVendors(await buildCtx(clientIp(req)), id)));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await saveVendor(await buildCtx(clientIp(req)), id, await readJson(req))), 201);
});
