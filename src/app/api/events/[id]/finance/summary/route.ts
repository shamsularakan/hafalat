import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { financeSummary } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await financeSummary(await buildCtx(clientIp(req)), id)));
});
