import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { createEvent, listEvents } from "@/server/services/events";

export const GET = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  return ok((await listEvents(ctx)));
});

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req);
  return ok((await createEvent(ctx, body)), 201);
});
