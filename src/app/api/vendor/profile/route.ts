import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { getMyVendor, saveMyProfile } from "@/server/services/vendor-portal";

export const GET = route(async (req: Request) => ok(await getMyVendor(await buildCtx(clientIp(req)))));

export const PUT = route(async (req: Request) => ok(await saveMyProfile(await buildCtx(clientIp(req)), await readJson(req))));
