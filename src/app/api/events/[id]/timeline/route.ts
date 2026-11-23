import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listTimeline, saveTimelineItem } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(listTimeline(await buildCtx(clientIp(req)), id));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const b = await readJson(req);
  return ok(saveTimelineItem(await buildCtx(clientIp(req)), id, b, b.id), 201);
});
