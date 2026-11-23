import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { registerUser, createSession, rateLimit } from "@/lib/auth";
import { claimPendingDelegations } from "@/server/services/delegations";
import { SESSION_COOKIE, ORG_COOKIE, defaultOrgFor } from "@/server/context";

export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`register:${ip}`, 5, 3600e3);
  const body = await readJson(req);
  const db = (await getDb());
  const { user, orgId } = (await registerUser(db, body));
  (await claimPendingDelegations(db, user.id, user.phone, user.email));
  const session = (await createSession(db, user, req.headers.get("user-agent") ?? undefined));
  const active = (await defaultOrgFor(db, user.id)) ?? { orgId, orgRole: "owner" as const };
  const res = ok({ user: { id: user.id, name: user.name, email: user.email }, org_id: active.orgId });
  const maxAge = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000);
  const secure = req.headers.get("x-forwarded-proto") === "https" || process.env.DAWAT_COOKIE_SECURE === "true" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${session.raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
  res.headers.append("Set-Cookie", `${ORG_COOKIE}=${active.orgId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
  return res;
});
