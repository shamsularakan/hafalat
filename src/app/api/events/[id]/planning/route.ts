import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { planningDashboard, updatePlan, applyTemplate } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(planningDashboard(await buildCtx(clientIp(req)), id));
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(updatePlan(await buildCtx(clientIp(req)), id, await readJson(req)));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { template_id } = await readJson(req);
  return ok(applyTemplate(await buildCtx(clientIp(req)), id, template_id || undefined));
});
