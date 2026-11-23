import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { logDelivery } from "@/server/services/invitations";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req);
  return ok(logDelivery(ctx, id, body.channel ?? "whatsapp_manual", body.idempotency_key));
});
