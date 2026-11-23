import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { myCalendar, setBlockedDay } from "@/server/services/vendor-portal";

export const GET = route(async (req: Request) => ok(await myCalendar(await buildCtx(clientIp(req)))));

/** { day: "YYYY-MM-DD", blocked: boolean, note?: string } */
export const POST = route(async (req: Request) => ok(await setBlockedDay(await buildCtx(clientIp(req)), await readJson(req))));
