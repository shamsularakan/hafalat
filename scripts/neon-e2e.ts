/** End-to-end smoke test against a real Neon database. */
import { DB, getDb, newId } from "../src/lib/db";
import { registerUser } from "../src/lib/auth";
import type { Ctx, OrgRole } from "../src/lib/types";
import { createEvent, transitionEvent } from "../src/server/services/events";
import { createGuest } from "../src/server/services/guests";
import { issueInvitation } from "../src/server/services/invitations";
import { submitRsvp } from "../src/server/services/rsvp";
import type { UserRow } from "../src/lib/types";

async function main() {
  const db = await getDb();
  if (db.mode !== "neon") throw new Error("DATABASE_URL not active — got " + db.mode);

  const uniq = newId().slice(0, 8);
  const email = `neon-e2e-${uniq}@example.com`;
  const { user, orgId } = await registerUser(db, {
    name: "نيون تجريبي", email, password: "Password123!", orgName: `منظمة نيون ${uniq}`,
  });
  const m = await db.get<{ role: OrgRole }>(
    "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?", orgId, user.id
  );
  const ctx: Ctx = { db, actor: { user: user as UserRow, orgId, orgRole: m?.role ?? "owner", isPlatformAdmin: false }, ip: "e2e" };

  const ev = await createEvent(ctx, {
    title: `حفل نيون ${uniq}`, type: "wedding", capacity: 50, quota_unit: "card",
    starts_at: new Date(Date.now() + 864e5).toISOString(),
    ends_at: new Date(Date.now() + 2 * 864e5).toISOString(),
  });
  await transitionEvent(ctx, ev.id, "ready");
  await transitionEvent(ctx, ev.id, "published");
  const guest = await createGuest(ctx, ev.id, { name: "ضيف نيون", phone: "+966550000001" });
  const inv = await issueInvitation(ctx, ev.id, { guest_id: guest.id });
  const rsvp = await submitRsvp(db, inv.token, { answer: "confirmed", persons: 1 });

  console.log("E2E user:", email);
  console.log("E2E event:", ev.id, ev.status);
  console.log("E2E invitation:", inv.invitation_id, inv.token.length);
  console.log("E2E rsvp:", rsvp.answer, rsvp.persons_confirmed);

  // Persistence check from a brand-new connection (different HTTP requests / lambdas).
  const fresh = new DB(process.env.DATABASE_URL!);
  const check = await fresh.get<{ n: number }>(
    "SELECT COUNT(*) n FROM invitations WHERE organization_id = ? AND event_id = ?", orgId, ev.id
  );
  const rsvpCheck = await fresh.get<{ n: number }>("SELECT COUNT(*) n FROM rsvps WHERE invitation_id = ?", inv.invitation_id);
  console.log("PERSISTED invitations:", check!.n, "rsvps:", rsvpCheck!.n);
  if (Number(check!.n) !== 1 || Number(rsvpCheck!.n) !== 1) throw new Error("persistence check failed");

  // cleanup (best effort)
  try {
    await db.run("DELETE FROM events WHERE id = ?", ev.id);
    await db.run("DELETE FROM organizations WHERE id = ?", orgId);
    await db.run("DELETE FROM users WHERE id = ?", user.id);
  } catch { /* test data may remain; harmless */ }
  fresh.close();
  db.close();
  console.log("E2E OK");
}
main().catch((e) => { console.error("E2E FAIL", e.message); process.exit(1); });
