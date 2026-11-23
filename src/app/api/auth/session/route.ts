import { route, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser, getActiveOrg } from "@/server/context";

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return ok({ authenticated: false });
  const { orgId, orgRole } = await getActiveOrg(user);
  const db = getDb();
  const org = db.get("SELECT id, name, kind, plan_id FROM organizations WHERE id = ?", orgId);
  const memberships = db.all(
    `SELECT o.id, o.name, o.kind, m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ?`,
    user.id
  );
  return ok({
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, is_platform_admin: user.is_platform_admin },
    active_org: { ...org, role: orgRole },
    memberships,
  });
});
