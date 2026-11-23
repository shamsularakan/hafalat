import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { checkout } from "@/server/services/billing";

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const { plan_id, cycle } = await readJson(req);
  return ok(await checkout(ctx, plan_id, cycle ?? "monthly"));
});
