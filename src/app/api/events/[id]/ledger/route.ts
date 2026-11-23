import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { getLedger } from "@/server/services/delegations";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const url = new URL(req.url);
  return ok(getLedger(ctx, id, url.searchParams.get("delegation_id") ?? undefined));
});
