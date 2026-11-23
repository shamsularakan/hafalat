import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { reallocateQuota } from "@/server/services/delegations";

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const { from_delegation_id, to_delegation_id, amount, reason } = await readJson(req);
  return ok((await reallocateQuota(ctx, from_delegation_id, to_delegation_id, amount, reason)));
});
