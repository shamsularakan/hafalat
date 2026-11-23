/** الرابط المختصر المرسل عبر واتساب: /d/<رمز> ← صفحة الدعوة الكاملة */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/auth";
import { deriveToken, isShortCode } from "@/lib/tokens";

type P = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: P) {
  const { code } = await params;
  try { rateLimit(`short:${clientIp(req)}`, 120, 60e3); } catch {
    return new NextResponse("محاولات كثيرة — حاول بعد دقيقة", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const db = await getDb();
  const inv = isShortCode(code)
    ? await db.get<{ id: string; token_nonce: string }>("SELECT id, token_nonce FROM invitations WHERE short_code = ?", code)
    : undefined;
  // رمز غير معروف ← صفحة الدعوة تعرض رسالة «رابط غير صالح» بالهوية نفسها
  const target = inv ? `/i/${deriveToken(inv.id, inv.token_nonce)}` : "/i/invalid-link";
  return NextResponse.redirect(new URL(target, req.url), { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
