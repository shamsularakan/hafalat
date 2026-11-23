import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { transitionEvent } from "@/server/services/events";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const { status } = await readJson(req);
  return ok(transitionEvent(ctx, id, status));
});
