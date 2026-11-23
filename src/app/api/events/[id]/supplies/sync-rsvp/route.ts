import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { syncHeadcountFromRsvp } from "@/server/services/supplies";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(await syncHeadcountFromRsvp(await buildCtx(clientIp(req)), id));
});
