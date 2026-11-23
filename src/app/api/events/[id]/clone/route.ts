import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { cloneEvent } from "@/server/services/events";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  return ok(cloneEvent(ctx, id), 201);
});
