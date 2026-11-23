import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/auth";
import { submitWish } from "@/server/services/rsvp";

type P = { params: Promise<{ token: string }> };

/** تهنئة الضيف — عامة برابط الدعوة، محدودة المعدل */
export const POST = route(async (req: Request, { params }: P) => {
  const { token } = await params;
  rateLimit(`wish:${clientIp(req)}`, 20, 60e3);
  return ok(await submitWish(await getDb(), token, await readJson(req, 8 * 1024)));
});
