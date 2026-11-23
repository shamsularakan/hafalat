import { route, ok, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { getSessionUser, ORG_COOKIE } from "@/server/context";
import { getOrgMembership } from "@/lib/permissions";

export const POST = route(async (req: Request) => {
  const user = await getSessionUser();
  if (!user) err("UNAUTHORIZED");
  const { org_id } = await readJson(req);
  const m = getOrgMembership(getDb(), org_id, user.id);
  if (!m) err("FORBIDDEN", "لست عضوًا في مساحة العمل هذه");
  const res = ok({ org_id });
  res.headers.append("Set-Cookie", `${ORG_COOKIE}=${org_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}`);
  return res;
});
