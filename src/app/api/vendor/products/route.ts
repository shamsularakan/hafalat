import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { saveMyProduct } from "@/server/services/vendor-portal";

export const POST = route(async (req: Request) => ok(await saveMyProduct(await buildCtx(clientIp(req)), await readJson(req)), 201));
