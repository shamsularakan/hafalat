import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listWishes } from "@/server/services/operations";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await listWishes(await buildCtx(clientIp(req)), id));
});
