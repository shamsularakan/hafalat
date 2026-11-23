import { getDb, newId } from "../src/lib/db";
import { registerUser, createSession } from "../src/lib/auth";
import { claimPendingDelegations } from "../src/server/services/delegations";
import { defaultOrgFor } from "../src/server/context";

async function main() {
  const db = await getDb();
  const email = `routecheck-${newId().slice(0, 8)}@example.com`;
  console.log("registerUser...");
  const { user, orgId } = await registerUser(db, { name: "Route Check", email, password: "Password123!", orgName: "Route Org" });
  console.log("claim...");
  await claimPendingDelegations(db, user.id, user.phone, user.email);
  console.log("createSession...");
  const s = await createSession(db, user, "test");
  console.log("defaultOrgFor...");
  const active = await defaultOrgFor(db, user.id);
  console.log("OK", { orgId, active, session: !!s.raw });
  await db.run("DELETE FROM organizations WHERE id = ?", orgId);
  await db.run("DELETE FROM users WHERE id = ?", user.id);
  db.close();
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
