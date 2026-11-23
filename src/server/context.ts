/** بناء سياق التنفيذ من الجلسة (cookies) — الخدمات نفسها لا تعرف شيئًا عن HTTP */
import { cookies } from "next/headers";
import { getDb, type DB } from "@/lib/db";
import { validateSession } from "@/lib/auth";
import { err } from "@/lib/errors";
import type { Actor, Ctx, OrgRole, UserRow } from "@/lib/types";
import { getOrgMembership } from "@/lib/permissions";
import { SESSION_COOKIE, ORG_COOKIE } from "@/lib/constants";

export { SESSION_COOKIE, ORG_COOKIE };

export async function getSessionUser(): Promise<UserRow | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  return (await validateSession((await getDb()), raw));
}

/** اختيار المنظمة الافتراضية: أحدث نشاط مناسبات للمستخدم، ثم دور owner أولًا */
export async function defaultOrgFor(db: DB, userId: string): Promise<{ orgId: string; orgRole: OrgRole } | null> {
  const first = (await db.get<{ organization_id: string; role: OrgRole }>(
    `SELECT m.organization_id, m.role,
       COALESCE((SELECT MAX(e.updated_at) FROM events e
         WHERE e.organization_id = m.organization_id AND (
           e.owner_id = m.user_id
           OR EXISTS (SELECT 1 FROM event_members em WHERE em.event_id = e.id AND em.user_id = m.user_id)
           OR EXISTS (SELECT 1 FROM delegations d WHERE d.event_id = e.id AND d.user_id = m.user_id)
         )), '') AS activity
     FROM organization_members m WHERE m.user_id = ?
     ORDER BY activity DESC, CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
     LIMIT 1`,
    userId
  ));
  return first ? { orgId: first.organization_id, orgRole: first.role } : null;
}

export async function getActiveOrg(user: UserRow): Promise<{ orgId: string; orgRole: OrgRole }> {
  const db = (await getDb());
  const jar = await cookies();
  const preferred = jar.get(ORG_COOKIE)?.value;
  if (preferred) {
    const m = (await getOrgMembership(db, preferred, user.id));
    if (m) return { orgId: preferred, orgRole: m.role };
  }
  const picked = (await defaultOrgFor(db, user.id));
  if (!picked) err("FORBIDDEN", "لا تنتمي إلى أي مساحة عمل");
  return picked;
}

export async function buildCtx(ip?: string): Promise<Ctx> {
  const user = await getSessionUser();
  if (!user) err("UNAUTHORIZED");
  const { orgId, orgRole } = await getActiveOrg(user);
  const actor: Actor = { user, orgId, orgRole, isPlatformAdmin: user.is_platform_admin === 1 };
  return { db: (await getDb()), actor, ip };
}

export async function requirePlatformAdmin(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) err("UNAUTHORIZED");
  if (user.is_platform_admin !== 1) err("FORBIDDEN");
  return user;
}
