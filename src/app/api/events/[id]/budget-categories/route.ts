import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { financeSummary, saveBudgetCategory, deleteBudgetCategory } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await financeSummary(await buildCtx(clientIp(req)), id)).categories);
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const b = await readJson(req);
  return ok(saveBudgetCategory(await buildCtx(clientIp(req)), id, b, b.id), 201);
});
