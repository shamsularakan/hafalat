import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { issueThanksAsOwner } from "@/server/services/helpers";

type P = { params: Promise<{ id: string }> };

/** { message?: string } — حفظ نص بطاقة الشكر وإصدارها */
export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { message } = await readJson(req);
  return ok(await issueThanksAsOwner(await buildCtx(clientIp(req)), id, message));
});
