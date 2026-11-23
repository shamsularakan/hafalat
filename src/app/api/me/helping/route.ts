import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { myHelping } from "@/server/services/helpers";

export const GET = route(async (req: Request) => ok(await myHelping(await buildCtx(clientIp(req)))));
