import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/auth";
import { respondHelper } from "@/server/services/helpers";

type P = { params: Promise<{ code: string }> };

/** { accept: boolean } — رد الفزعة برابطه الشخصي، بلا حساب */
export const POST = route(async (req: Request, { params }: P) => {
  const { code } = await params;
  rateLimit(`helper:${clientIp(req)}`, 30, 60e3);
  const { accept } = await readJson(req);
  return ok(await respondHelper(await getDb(), code, !!accept));
});
