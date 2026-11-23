import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { getSubscription } from "@/server/services/billing";

export const GET = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  return ok((await getSubscription(ctx)));
});
