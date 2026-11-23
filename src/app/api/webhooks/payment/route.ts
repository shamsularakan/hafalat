import { route, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { handlePaymentWebhook } from "@/server/services/billing";

/** webhook الدفع — توقيع إلزامي عبر مزود قابل للاستبدال */
export const POST = route(async (req: Request) => {
  const payload = await req.text();
  const signature = req.headers.get("x-webhook-signature") ?? "";
  return ok((await handlePaymentWebhook((await getDb()), payload, signature)));
});
