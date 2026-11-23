import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { planningDashboard, updatePlan, applyTemplate } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await planningDashboard(await buildCtx(clientIp(req)), id)));
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await updatePlan(await buildCtx(clientIp(req)), id, await readJson(req))));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { template_id } = await readJson(req);
  return ok((await applyTemplate(await buildCtx(clientIp(req)), id, template_id || undefined)));
});
