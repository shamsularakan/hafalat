import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/** حارس صفحات لوحة التحكم: جلسة موثقة وإلا تحويل لتسجيل الدخول */
export function middleware(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
