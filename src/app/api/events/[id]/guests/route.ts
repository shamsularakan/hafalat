import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { createGuest, listGuests } from "@/server/services/guests";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const url = new URL(req.url);
  return ok((await listGuests(ctx, id, {
    q: url.searchParams.get("q") ?? undefined,
    group_id: url.searchParams.get("group_id") ?? undefined,
    section: url.searchParams.get("section") ?? undefined,
    inviter_id: url.searchParams.get("inviter_id") ?? undefined,
  })));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req);
  return ok((await createGuest(ctx, id, body)), 201);
});
