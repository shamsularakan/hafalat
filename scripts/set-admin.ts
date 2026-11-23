/**
 * منح/سحب صلاحية «مدير المنصة / المدير العام».
 * الاستخدام:
 *   npx tsx scripts/set-admin.ts <email>              منح
 *   npx tsx scripts/set-admin.ts --revoke <email>      سحب
 * تُسجَّل العملية في سجل التدقيق (organization_id = "platform").
 */
import { getDb } from "../src/lib/db";
import { writeAudit } from "../src/lib/audit";

const revoke = process.argv.includes("--revoke");
const email = (process.argv.find((a) => a.includes("@")) ?? "").trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("✘ أدخل بريدًا صالحًا: npx tsx scripts/set-admin.ts [--revoke] <email>");
  process.exit(1);
}

const db = getDb();
const user = db.get<{ id: string; name: string; email: string; is_platform_admin: number }>(
  "SELECT id, name, email, is_platform_admin FROM users WHERE email = ?", email
);
if (!user) {
  console.error(`✘ لا يوجد مستخدم بهذا البريد: ${email} — سجّل عبر /register أولًا.`);
  process.exit(1);
}

const target = revoke ? 0 : 1;
if (user.is_platform_admin === target) {
  console.log(`ℹ «${user.name}» ${revoke ? "ليس مديرًا بالفعل" : "مدير المنصة بالفعل"}.`);
  process.exit(0);
}

db.tx(() => {
  db.run("UPDATE users SET is_platform_admin = ? WHERE id = ?", target, user.id);
  writeAudit(db, {
    orgId: "platform",
    actorId: null,
    action: revoke ? "platform.admin.revoke" : "platform.admin.grant",
    objectType: "user",
    objectId: user.id,
    detail: { email, name: user.name },
  });
});

const check = db.get<{ is_platform_admin: number }>("SELECT is_platform_admin FROM users WHERE id = ?", user.id)!;
console.log(`✔ «${user.name}» (${email}) — ${revoke ? "صُلاحية المدير سُحبت" : "مدير عام للمنصة"} · is_platform_admin=${check.is_platform_admin}`);
db.close();
