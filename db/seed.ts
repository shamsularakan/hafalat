/**
 * بذر تجريبي غير حقيقي (القسم 17-1): npm run seed
 * حسابات تجريبية:
 *   المالك:    demo@dawat.local / Demo1234!
 *   المفوّض:   delegate@dawat.local / Demo1234!
 *   الاستقبال: gate@dawat.local / Demo1234!
 */
import path from "node:path";
import { createDb, newId } from "../src/lib/db";
import { registerUser } from "../src/lib/auth";
import type { Ctx } from "../src/lib/types";
import { createEvent, transitionEvent } from "../src/server/services/events";
import { createGuest } from "../src/server/services/guests";
import { createDelegation } from "../src/server/services/delegations";
import { issueInvitation } from "../src/server/services/invitations";
import { submitRsvp } from "../src/server/services/rsvp";
import { scanCheckin } from "../src/server/services/checkins";
import { saveDraft, publishDesign, BUILTIN_TEMPLATES } from "../src/server/services/designs";
import { publicUrl } from "../src/lib/tokens";

const dbPath = path.resolve(process.env.DAWAT_DB_PATH ?? "./data/dawat.db");
const db = createDb(dbPath);

function ctxFor(user: any, orgId: string, orgRole: any = "owner"): Ctx {
  return { db, actor: { user, orgId, orgRole, isPlatformAdmin: false }, ip: "seed" };
}

const existing = db.get("SELECT id FROM users WHERE email = 'demo@dawat.local'");
if (existing) {
  console.log("ℹ البذر التجريبي موجود مسبقًا — تخطي. (احذف data/dawat.db لإعادة البذر)");
  process.exit(0);
}

// المالك + منظمة تجريبية بباقة احترافية
const { user: owner, orgId } = registerUser(db, {
  name: "سعد التجريبي", email: "demo@dawat.local", password: "Demo1234!",
  orgName: "مناسبات تجريبية", orgKind: "individual",
});
db.run("UPDATE organizations SET plan_id = 'pro' WHERE id = ?", orgId);
db.run("UPDATE subscriptions SET plan_id = 'pro' WHERE id = (SELECT id FROM subscriptions WHERE organization_id = ?)", orgId);
const ownerCtx = ctxFor(owner, orgId);

// المناسبة الأولى: زفاف تجريبي منشور
const starts = new Date(Date.now() + 10 * 864e5);
starts.setHours(20, 0, 0, 0);
const ends = new Date(starts.getTime() + 5 * 3600e3);
const ev = createEvent(ownerCtx, {
  title: "حفل زفاف تجريبي — آل نموذج", type: "wedding", host_name: "عبدالله ونورة",
  description: "مناسبة تجريبية غير حقيقية كليًا لأغراض العرض والاختبار.",
  starts_at: starts.toISOString(), ends_at: ends.toISOString(),
  venue_name: "قاعة الياسمين", venue_address: "حي النموذج، الرياض",
  map_url: "https://maps.google.com/?q=Riyadh", capacity: 150, quota_unit: "card",
});
transitionEvent(ownerCtx, ev.id, "ready");
transitionEvent(ownerCtx, ev.id, "published");

// تصميم منشور
const schema = {
  ...BUILTIN_TEMPLATES[0].schema,
  cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: "حفل زفاف عبدالله ونورة", hosts: "آل نموذج — آل مثال" },
};
saveDraft(ownerCtx, ev.id, { template_id: "tpl-royal", schema });
publishDesign(ownerCtx, ev.id);

// المفوّض
const { user: delegateUser } = registerUser(db, {
  name: "فهد المفوّض", email: "delegate@dawat.local", password: "Demo1234!", orgName: "مساحة فهد",
});
const delegation = createDelegation(ownerCtx, ev.id, {
  invitee_name: "فهد المفوّض", invitee_email: "delegate@dawat.local",
  user_id: delegateUser.id, quota: 30,
  permissions: { can_issue: true, can_send: true, can_cancel: true, allow_vip: false, allow_companions: true },
});
const delegateCtx = ctxFor(delegateUser, orgId, "member");

// موظف الاستقبال
const { user: gateUser } = registerUser(db, {
  name: "ماجد الاستقبال", email: "gate@dawat.local", password: "Demo1234!", orgName: "مساحة ماجد",
});
db.run("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')", orgId, gateUser.id);
db.run("INSERT INTO event_members (id, event_id, organization_id, user_id, role, permissions) VALUES (?,?,?,?,'receptionist','{}')", newId(), ev.id, orgId, gateUser.id);
const gateCtx = ctxFor(gateUser, orgId, "member");
const gate = db.get<any>("SELECT id FROM gates WHERE event_id = ?", ev.id);

// الفئات
const vip = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name='VIP'", ev.id);
const families = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name='عائلات'", ev.id);
const individuals = db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name='أفراد'", ev.id);

// ضيوف تجريبيون (أسماء غير حقيقية)
const names = ["ضيف نموذج ١", "ضيف نموذج ٢", "ضيف نموذج ٣", "ضيف نموذج ٤", "ضيف نموذج ٥", "ضيف نموذج ٦", "ضيف نموذج ٧", "ضيف نموذج ٨", "ضيف نموذج ٩", "ضيف نموذج ١٠", "ضيف نموذج ١١", "ضيف نموذج ١٢"];
const guests = names.map((name, i) =>
  createGuest(i < 6 ? ownerCtx : delegateCtx, ev.id, {
    name, phone: `+9665${String(30000000 + i)}`,
    group_id: i === 0 ? vip.id : i % 3 === 0 ? families.id : individuals.id,
  })
);

// إصدار دعوات + ردود + دخول
const issued: any[] = [];
for (let i = 0; i < 10; i++) {
  const ctx = i < 6 ? ownerCtx : delegateCtx;
  issued.push(issueInvitation(ctx, ev.id, { guest_id: guests[i].id, idempotency_key: `seed-${guests[i].id}` }));
}
submitRsvp(db, issued[0].token, { answer: "confirmed", persons: 2, message: "مبروك! سنحضر بإذن الله" });
submitRsvp(db, issued[1].token, { answer: "confirmed", persons: 1 });
submitRsvp(db, issued[6].token, { answer: "confirmed", persons: 4 }); // فئة عائلات (مرافقون ≤ 5)
submitRsvp(db, issued[3].token, { answer: "declined", message: "نعتذر لظرف سفر" });
scanCheckin(gateCtx, { token: issued[0].token, gate_id: gate.id });
scanCheckin(gateCtx, { token: issued[1].token, gate_id: gate.id });

// المناسبة الثانية: مسودة تخرج
const ev2 = createEvent(ownerCtx, {
  title: "حفل تخرج تجريبي", type: "graduation", host_name: "دفعة النموذج",
  starts_at: new Date(Date.now() + 30 * 864e5).toISOString(),
  venue_name: "مسرح الجامعة", capacity: 80, quota_unit: "person",
});

// قالب رسالة
db.run(
  "INSERT INTO message_templates (id, organization_id, name, channel, body) VALUES (?,?,?,'whatsapp_manual',?)",
  newId(), orgId, "دعوة زفاف افتراضية",
  "السلام عليكم {اسم_الضيف} 🌿\nنتشرف بدعوتكم لحضور «{اسم_المناسبة}».\nدعوتكم الخاصة وتأكيد الحضور:\n{رابط_الدعوة}\nحضوركم يكمل فرحتنا!"
);

console.log("✔ تم البذر التجريبي (بيانات غير حقيقية):");
console.log(`  المالك:    demo@dawat.local / Demo1234!`);
console.log(`  المفوّض:   delegate@dawat.local / Demo1234!`);
console.log(`  الاستقبال: gate@dawat.local / Demo1234!`);
console.log(`  مناسبة منشورة: ${ev.title} (${ev.id})`);
console.log(`  مناسبة مسودة: ${ev2.title}`);
console.log(`  ضيوف: ${guests.length} · دعوات: ${issued.length} · ردود: 4 · دخول: 2`);
console.log(`  مثال رابط دعوة: ${publicUrl()}/i/${issued[5].token}`);
db.close();
