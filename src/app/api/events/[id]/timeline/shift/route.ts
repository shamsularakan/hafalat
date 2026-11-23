import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { shiftDaySchedule } from "@/server/services/operations";

type P = { params: Promise<{ id: string }> };

/** { minutes: number } — إزاحة جدول يوم المناسبة */
export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const body = await readJson(req);
  return ok(await shiftDaySchedule(await buildCtx(clientIp(req)), id, Number(body.minutes)));
});
