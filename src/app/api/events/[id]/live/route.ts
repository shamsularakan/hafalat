import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { liveBoard } from "@/server/services/checkins";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  return ok((await liveBoard(ctx, id)));
});
