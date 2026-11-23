import { route, ok } from "@/lib/api";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { destroySession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/server/context";

export const POST = route(async () => {
  const jar = await cookies();
  destroySession(getDb(), jar.get(SESSION_COOKIE)?.value);
  const res = ok({ ok: true });
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
  return res;
});
