import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listHelpers, saveHelper } from "@/server/services/helpers";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await listHelpers(await buildCtx(clientIp(req)), id));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await saveHelper(await buildCtx(clientIp(req)), id, await readJson(req)), 201);
});
