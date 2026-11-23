import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { transferGuest } from "@/server/services/guests";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const { to_delegation_id } = await readJson(req);
  return ok(transferGuest(ctx, id, to_delegation_id ?? null));
});
