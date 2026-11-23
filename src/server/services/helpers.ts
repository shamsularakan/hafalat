/**
 * الفزعة وبطاقات الشكر، و«دعواتي/فزعاتي» لصاحب الحساب.
 * لا يُعرض شيء مرتبط برقم جوال إلا بعد إثبات ملكيته: فتح رابط شخصي وصل على واتساب (دعوة أو فزعة)
 * والحساب مسجّل الدخول بالرقم نفسه.
 */
import { newId, nowIso, type DB } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx, UserRow } from "@/lib/types";
import { writeAudit } from "@/lib/audit";
import { normalizePhone, phoneHash } from "@/lib/auth";
import { deriveToken, newShortCode, publicUrl, isShortCode } from "@/lib/tokens";
import { loadEventScoped } from "@/lib/permissions";
import { requirePlanningAccess, getOrCreatePlan } from "./planning";
import { ensureShortCode } from "./invitations";
import { shortInvitationUrl } from "@/lib/tokens";

export const DEFAULT_THANKS =
  "شكرًا من القلب يا {الاسم} على فزعتك في «{المناسبة}».\nكانت وقفتك معنا جزءًا من فرحتنا، جزاك الله خيرًا وجعلها في ميزان حسناتك.";

export const helperUrl = (code: string) => `${publicUrl()}/f/${code}`;

const fill = (tpl: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), tpl);

/* ===== صاحب المناسبة ===== */

export async function listHelpers(ctx: Ctx, eventId: string) {
  await requirePlanningAccess(ctx, eventId, "view");
  const plan = await getOrCreatePlan(ctx, eventId);
  const rows = await ctx.db.all<any>("SELECT * FROM event_helpers WHERE event_id = ? ORDER BY created_at", eventId);
  return {
    thanks_message: plan.thanks_message || DEFAULT_THANKS,
    helpers: rows.map((h) => ({ ...h, phone_hash: undefined, link: helperUrl(h.link_code), linked_account: !!h.user_id })),
  };
}

async function newHelperCode(db: DB) {
  for (let i = 0; i < 5; i++) {
    const c = newShortCode();
    if (!(await db.get("SELECT id FROM event_helpers WHERE link_code = ?", c))) return c;
  }
  throw new Error("تعذر توليد رابط الفزعة");
}

export async function saveHelper(ctx: Ctx, eventId: string, input: any, id?: string) {
  await requirePlanningAccess(ctx, eventId, "plan");
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (name.length < 2) err("VALIDATION", "اسم الفزعة مطلوب");
  const phone = normalizePhone(String(input.phone ?? ""));
  if (!phone) err("VALIDATION", "رقم الجوال بصيغة دولية مطلوب (مثال: +9665…)");
  const ph = phoneHash(phone)!;
  const dup = await ctx.db.get<{ id: string; name: string }>("SELECT id, name FROM event_helpers WHERE event_id = ? AND phone_hash = ?", eventId, ph);
  if (dup && dup.id !== id) err("DUPLICATE_ENTRY", `الرقم مضاف مسبقًا باسم «${dup.name}»`);
  const task = String(input.task ?? "").trim().slice(0, 120) || null;
  const notes = String(input.notes ?? "").trim().slice(0, 500) || null;
  if (id) {
    const old = await ctx.db.get("SELECT id FROM event_helpers WHERE id = ? AND event_id = ?", id, eventId);
    if (!old) err("NOT_FOUND", "الفزعة غير موجودة");
    // تغيير الرقم يفك الربط بالحساب السابق
    await ctx.db.run(
      `UPDATE event_helpers SET name=?, phone=?, task=?, notes=?,
         user_id = CASE WHEN phone_hash = ? THEN user_id ELSE NULL END, phone_hash=? WHERE id=?`,
      name, phone, task, notes, ph, ph, id
    );
  } else {
    id = newId();
    await ctx.db.run(
      `INSERT INTO event_helpers (id, event_id, organization_id, name, phone, phone_hash, task, notes, link_code) VALUES (?,?,?,?,?,?,?,?,?)`,
      id, eventId, ctx.actor.orgId, name, phone, ph, task, notes, await newHelperCode(ctx.db)
    );
    // من أثبت ملكية رقمه سابقًا يرى الفزعة مباشرة في حسابه
    const owner = await ctx.db.get<{ id: string }>("SELECT id FROM users WHERE phone = ? AND phone_verified = 1", phone);
    if (owner) await ctx.db.run("UPDATE event_helpers SET user_id = ? WHERE id = ?", owner.id, id);
  }
  return ctx.db.get("SELECT * FROM event_helpers WHERE id = ?", id);
}

export async function removeHelper(ctx: Ctx, eventId: string, id: string) {
  await requirePlanningAccess(ctx, eventId, "plan");
  await ctx.db.run("DELETE FROM event_helpers WHERE id = ? AND event_id = ?", id, eventId);
  return { ok: true };
}

/** تسجيل إرسال طلب الفزعة أو بطاقة الشكر عبر واتساب (إرسال يدوي بضغطة) */
export async function markHelperSent(ctx: Ctx, eventId: string, id: string, kind: "request" | "thanks") {
  await requirePlanningAccess(ctx, eventId, "plan");
  if (!["request", "thanks"].includes(kind)) err("VALIDATION", "نوع غير صالح");
  const col = kind === "request" ? "request_sent_at" : "thanks_sent_at";
  await ctx.db.run(`UPDATE event_helpers SET ${col} = ? WHERE id = ? AND event_id = ?`, nowIso(), id, eventId);
  return { ok: true };
}

/** إصدار بطاقات الشكر لكل من لم يعتذر — تلقائيًا عند انتهاء المناسبة، أو يدويًا بعد بدايتها */
export async function issueThanks(db: DB, eventId: string, message?: string) {
  if (message !== undefined) {
    const m = String(message).replace(/<[^>]*>/g, "").trim().slice(0, 600);
    if (m.length < 5) err("VALIDATION", "نص بطاقة الشكر قصير");
    await db.run("UPDATE event_plans SET thanks_message = ? WHERE event_id = ?", m, eventId);
  }
  const r = await db.run(
    "UPDATE event_helpers SET thanked_at = ? WHERE event_id = ? AND status != 'declined' AND thanked_at IS NULL", nowIso(), eventId
  );
  return { issued: r.changes };
}

export async function issueThanksAsOwner(ctx: Ctx, eventId: string, message?: string) {
  await requirePlanningAccess(ctx, eventId, "plan");
  const event = await loadEventScoped(ctx.db, ctx.actor.orgId, eventId);
  if (!event.starts_at || Date.parse(event.starts_at) > Date.now()) err("CONFLICT", "تُصدر بطاقات الشكر بعد بداية المناسبة");
  await getOrCreatePlan(ctx, eventId);
  const r = await issueThanks(ctx.db, eventId, message);
  await writeAudit(ctx.db, { orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id, action: "helpers.thanks", objectType: "event", objectId: eventId, detail: r, ip: ctx.ip });
  return r;
}

/* ===== رابط الفزعة العام /f/<رمز> ===== */

async function helperByCode(db: DB, code: string) {
  if (!isShortCode(code)) err("INVALID_TOKEN", "رابط الفزعة غير صالح");
  const h = await db.get<any>("SELECT * FROM event_helpers WHERE link_code = ?", code);
  if (!h) err("INVALID_TOKEN", "رابط الفزعة غير صالح");
  return h;
}

function thanksCard(h: any, ev: any, plan: any) {
  if (!h.thanked_at) return null;
  return {
    message: fill(plan?.thanks_message || DEFAULT_THANKS, { "الاسم": h.name, "المناسبة": ev.title }),
    from: ev.host_name || ev.organizer || "",
    issued_at: h.thanked_at,
  };
}

/** بيانات صفحة الفزعة العامة — شخصية لصاحب الرابط فقط */
export async function getHelperPage(db: DB, code: string, viewer?: UserRow | null) {
  const h = await helperByCode(db, code);
  const ev = await db.get<any>(
    `SELECT e.id, e.title, e.host_name, e.starts_at, e.timezone, e.venue_name, e.venue_address, e.map_url, e.status,
       o.name organizer, o.contact_phone organizer_phone
     FROM events e JOIN organizations o ON o.id = e.organization_id WHERE e.id = ?`, h.event_id
  );
  if (!ev || ev.status === "cancelled") err("EVENT_CLOSED", "المناسبة لم تعد متاحة");
  if (viewer) await verifyPhoneOwnership(db, viewer, h.phone_hash);
  const plan = await db.get<any>("SELECT thanks_message FROM event_plans WHERE event_id = ?", h.event_id);
  return {
    name: h.name, task: h.task, notes: h.notes, status: h.status,
    event: { title: ev.title, host_name: ev.host_name, starts_at: ev.starts_at, timezone: ev.timezone, venue_name: ev.venue_name, venue_address: ev.venue_address, map_url: ev.map_url, organizer: ev.organizer, organizer_phone: ev.organizer_phone },
    thanks: thanksCard(h, ev, plan),
  };
}

export async function respondHelper(db: DB, code: string, accept: boolean) {
  const h = await helperByCode(db, code);
  if (h.thanked_at) err("CONFLICT", "انتهت المناسبة — شكرًا لك");
  await db.run("UPDATE event_helpers SET status = ?, responded_at = ? WHERE id = ?", accept ? "accepted" : "declined", nowIso(), h.id);
  return { status: accept ? "accepted" : "declined" };
}

/* ===== إثبات ملكية الرقم و«دعواتي/فزعاتي» ===== */

/**
 * صاحب الحساب فتح رابطًا شخصيًا مرسلًا إلى رقم معيّن وهو مسجّل الدخول بالرقم نفسه ← الرقم له.
 * تُربط فزعاته بحسابه، ويُعتبر رقمه موثّقًا فتظهر كل دعواته وفزعاته.
 */
export async function verifyPhoneOwnership(db: DB, user: UserRow, targetPhoneHash: string | null) {
  if (!user.phone || !targetPhoneHash) return false;
  if (phoneHash(user.phone) !== targetPhoneHash) return false;
  if (!user.phone_verified) {
    await db.run("UPDATE users SET phone_verified = 1, phone_verified_at = ? WHERE id = ?", nowIso(), user.id);
    (user as any).phone_verified = 1;
  }
  await db.run("UPDATE event_helpers SET user_id = ? WHERE phone_hash = ? AND user_id IS NULL", user.id, targetPhoneHash);
  return true;
}

/** عند فتح رابط دعوة: إن كان الضيف هو صاحب الحساب نفسه */
export async function verifyByInvitationToken(db: DB, user: UserRow, rawTokenHash: string) {
  const g = await db.get<{ phone_hash: string | null }>(
    "SELECT g.phone_hash FROM invitations i JOIN guests g ON g.id = i.guest_id WHERE i.token_hash = ?", rawTokenHash
  );
  return verifyPhoneOwnership(db, user, g?.phone_hash ?? null);
}

async function freshUser(db: DB, id: string) {
  return (await db.get<UserRow>("SELECT * FROM users WHERE id = ?", id))!;
}

/** «دعواتي»: كل الدعوات المرسلة إلى رقم صاحب الحساب — بعد إثبات ملكيته فقط */
export async function myInvitations(ctx: Ctx) {
  const user = await freshUser(ctx.db, ctx.actor.user.id);
  const ph = user.phone ? phoneHash(user.phone) : null;
  if (!ph) return { verified: false, has_phone: false, pending_count: 0, invitations: [] as any[] };
  if (!user.phone_verified) {
    const n = await ctx.db.get<{ n: number }>(
      `SELECT COUNT(*) n FROM invitations i JOIN guests g ON g.id = i.guest_id
       WHERE g.phone_hash = ? AND i.status NOT IN ('draft','cancelled','expired')`, ph
    );
    return { verified: false, has_phone: true, pending_count: Number(n?.n ?? 0), invitations: [] as any[] };
  }
  const rows = await ctx.db.all<any>(
    `SELECT i.id, i.status, i.token_nonce, i.short_code, g.name guest_name, g.title guest_title,
       e.title, e.host_name, e.starts_at, e.timezone, e.venue_name, e.status event_status,
       (SELECT r.answer FROM rsvps r WHERE r.invitation_id = i.id ORDER BY r.occurred_at DESC LIMIT 1) answer
     FROM invitations i JOIN guests g ON g.id = i.guest_id JOIN events e ON e.id = i.event_id
     WHERE g.phone_hash = ? AND i.status NOT IN ('draft','cancelled','expired') AND e.status NOT IN ('cancelled','archived')
     ORDER BY e.starts_at DESC`, ph
  );
  const out = [];
  for (const r of rows) {
    const code = r.short_code ?? await ensureShortCode(ctx.db, r.id);
    out.push({
      id: r.id, status: r.status, answer: r.answer, guest_name: r.guest_name, guest_title: r.guest_title,
      event: { title: r.title, host_name: r.host_name, starts_at: r.starts_at, timezone: r.timezone, venue_name: r.venue_name, status: r.event_status },
      url: shortInvitationUrl(code),
      upcoming: r.starts_at ? Date.parse(r.starts_at) > Date.now() - 12 * 3600e3 : true,
    });
  }
  return { verified: true, has_phone: true, pending_count: 0, invitations: out };
}

/** «فزعاتي»: المناسبات التي طُلبت فيها فزعة صاحب الحساب، مع بطاقات الشكر */
export async function myHelping(ctx: Ctx) {
  const user = await freshUser(ctx.db, ctx.actor.user.id);
  const ph = user.phone ? phoneHash(user.phone) : null;
  if (!ph) return { verified: false, has_phone: false, pending_count: 0, helping: [] as any[] };
  if (!user.phone_verified) {
    const n = await ctx.db.get<{ n: number }>("SELECT COUNT(*) n FROM event_helpers WHERE phone_hash = ?", ph);
    return { verified: false, has_phone: true, pending_count: Number(n?.n ?? 0), helping: [] as any[] };
  }
  const rows = await ctx.db.all<any>(
    `SELECT h.*, e.title, e.host_name, e.starts_at, e.timezone, e.venue_name, e.map_url, e.status event_status,
       o.name organizer, o.contact_phone organizer_phone, p.thanks_message
     FROM event_helpers h JOIN events e ON e.id = h.event_id JOIN organizations o ON o.id = e.organization_id
     LEFT JOIN event_plans p ON p.event_id = e.id
     WHERE (h.phone_hash = ? OR h.user_id = ?) AND e.status != 'cancelled' ORDER BY e.starts_at DESC`, ph, user.id
  );
  return {
    verified: true, has_phone: true, pending_count: 0,
    helping: rows.map((h) => ({
      id: h.id, name: h.name, task: h.task, notes: h.notes, status: h.status, link: helperUrl(h.link_code), code: h.link_code,
      event: { title: h.title, host_name: h.host_name, starts_at: h.starts_at, timezone: h.timezone, venue_name: h.venue_name, map_url: h.map_url, organizer: h.organizer, organizer_phone: h.organizer_phone },
      thanks: thanksCard(h, { title: h.title, host_name: h.host_name, organizer: h.organizer }, { thanks_message: h.thanks_message }),
    })),
  };
}
