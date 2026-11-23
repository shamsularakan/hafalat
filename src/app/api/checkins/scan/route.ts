import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { scanCheckin } from "@/server/services/checkins";
import { rateLimit } from "@/lib/auth";

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  rateLimit(`scan:${ctx.actor.user.id}`, 240, 60e3);
  const body = await readJson(req, 64 * 1024);
  return ok(scanCheckin(ctx, {
    token: body.token, invitation_id: body.invitation_id,
    gate_id: body.gate_id ?? null, persons: body.persons,
    idempotency_key: body.idempotency_key ?? req.headers.get("idempotency-key") ?? undefined,
  }));
});
