import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { markHelperSent } from "@/server/services/helpers";

type P = { params: Promise<{ id: string; helperId: string }> };

/** { kind: "request" | "thanks" } */
export const POST = route(async (req: Request, { params }: P) => {
  const { id, helperId } = await params;
  const { kind } = await readJson(req);
  return ok(await markHelperSent(await buildCtx(clientIp(req)), id, helperId, kind));
});
