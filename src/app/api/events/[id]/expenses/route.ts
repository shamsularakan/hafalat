import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { listExpenses, saveExpense } from "@/server/services/finance";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(listExpenses(await buildCtx(clientIp(req)), id));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok(saveExpense(await buildCtx(clientIp(req)), id, await readJson(req)), 201);
});
