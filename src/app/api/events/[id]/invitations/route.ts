import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { issueInvitation, listInvitations } from "@/server/services/invitations";
import { rateLimit } from "@/lib/auth";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const url = new URL(req.url);
  return ok((await listInvitations(ctx, id, {
    status: url.searchParams.get("status") ?? undefined,
    delegation_id: url.searchParams.get("delegation_id") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  })));
});

/** إصدار دعوة — ذرّي، مع idempotency key اختياري (AC-02 / AC-11) */
export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  rateLimit(`issue:${ctx.actor.user.id}`, 120, 60e3);
  const body = await readJson(req);
  return ok((await issueInvitation(ctx, id, {
    guest_id: body.guest_id,
    delegation_id: body.delegation_id ?? null,
    idempotency_key: body.idempotency_key ?? req.headers.get("idempotency-key") ?? null,
  })), 201);
});
