import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { eventAlerts } from "@/server/services/operations";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await eventAlerts(await buildCtx(clientIp(req)), id));
});
