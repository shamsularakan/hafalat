import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { myInvitations } from "@/server/services/helpers";

export const GET = route(async (req: Request) => ok(await myInvitations(await buildCtx(clientIp(req)))));
