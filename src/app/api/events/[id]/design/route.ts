import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { getDesign, saveDraft } from "@/server/services/designs";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  return ok(getDesign(ctx, id));
});

export const PUT = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req, 2 * 1024 * 1024);
  return ok(saveDraft(ctx, id, body));
});
