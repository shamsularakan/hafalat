import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { login, rateLimit } from "@/lib/auth";
import { claimPendingDelegations } from "@/server/services/delegations";
import { SESSION_COOKIE, ORG_COOKIE, defaultOrgFor } from "@/server/context";

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`login:${ip}`, 10, 60e3);
  const body = await readJson(req);
  if (!body.identifier || !body.password) {
    const { AppError } = await import("@/lib/errors");
    throw new AppError("VALIDATION", "المعرّف وكلمة المرور مطلوبان");
  }
  rateLimit(`login-id:${String(body.identifier).toLowerCase()}`, 10, 60e3);
  const db = getDb();
  const session = login(db, body.identifier, body.password, req.headers.get("user-agent") ?? undefined);
  claimPendingDelegations(db, session.user.id, session.user.phone, session.user.email);
  const org = defaultOrgFor(db, session.user.id);
  const res = ok({ user: { id: session.user.id, name: session.user.name, email: session.user.email, is_platform_admin: session.user.is_platform_admin } });
  const maxAge = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000);
  const secure = req.headers.get("x-forwarded-proto") === "https" || process.env.DAWAT_COOKIE_SECURE === "true" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${session.raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  if (org) res.headers.append("Set-Cookie", `${ORG_COOKIE}=${org.orgId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
});
