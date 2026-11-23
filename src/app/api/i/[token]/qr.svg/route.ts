import { route, ok } from "@/lib/api";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { findInvitationByToken } from "@/server/services/rsvp";
import { getSessionUser } from "@/server/context";
import { invitationUrl } from "@/lib/tokens";

type P = { params: Promise<{ token: string }> };

/** QR صالح بعد تأكيد الحضور فقط — preview=1 متاح للموظفين المصادقين */
export const GET = route(async (req: Request, { params }: P) => {
  const { token } = await params;
  const inv = (await findInvitationByToken((await getDb()), token));
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const confirmed = ["confirmed", "checked_in"].includes(inv.status);
  if (!confirmed) {
    if (!preview || !(await getSessionUser()))
      err("FORBIDDEN", "أكد حضورك أولًا للحصول على تذكرة الدخول");
  }
  const svg = await QRCode.toString(invitationUrl(token), {
    type: "svg", margin: 1, width: 240,
    color: { dark: "#4A3B36", light: "#FFFFFF" },
  });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
});
