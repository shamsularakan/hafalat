import { redirect } from "next/navigation";
import { getSessionUser, getActiveOrg } from "@/server/context";
import { getDb } from "@/lib/db";
import { AppShell, type SessionInfo } from "@/components/app-shell";

export const metadata = { title: "لوحة التحكم" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let org;
  try {
    org = await getActiveOrg(user);
  } catch {
    redirect("/login");
  }
  const db = getDb();
  const orgRow = db.get<any>("SELECT id, name, kind, plan_id FROM organizations WHERE id = ?", org.orgId);
  const memberships = db.all<any>(
    `SELECT o.id, o.name, o.kind, m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ?`,
    user.id
  );
  const session: SessionInfo = {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, is_platform_admin: user.is_platform_admin },
    active_org: { ...orgRow, role: org.orgRole },
    memberships: memberships.map((m: any) => ({ ...m })),
  };
  return <AppShell session={session}>{children}</AppShell>;
}
