import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getGuestPage } from "@/server/services/rsvp";
import { rateLimit } from "@/lib/auth";

type P = { params: Promise<{ token: string }> };

/** صفحة الضيف العامة — بلا حساب، رمز غير قابل للتخمين، بلا كشف بيانات آخرين (AC-07) */
export const GET = route(async (req: Request, { params }: P) => {
  const { token } = await params;
  rateLimit(`guest-page:${clientIp(req)}`, 60, 60e3);
  return ok((await getGuestPage((await getDb()), token)));
});
