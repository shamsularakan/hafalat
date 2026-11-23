import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { manualCheckin } from "@/server/services/checkins";

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req, 64 * 1024);
  return ok(manualCheckin(ctx, {
    token: body.token, invitation_id: body.invitation_id,
    gate_id: body.gate_id ?? null, persons: body.persons,
    reason: body.reason, override: body.override === true,
  }));
});
