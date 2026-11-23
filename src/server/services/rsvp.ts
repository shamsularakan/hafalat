/**
 * صفحة الضيف وRSVP (القسم 04-E) — عامة بلا حساب، برمز غير قابل للتخمين.
 * لا تُعرض قائمة الضيوف أو أي بيانات غير مرتبطة بالدعوة (AC-07).
 */
import { DB, newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import { safeImageUrl, type TemplateVars } from "@/lib/invitation-engine";
import { hashToken } from "@/lib/tokens";
import { formatDualDate } from "@/lib/dates";
import type { InvitationRow } from "./invitations";

export interface GuestPagePayload {
  invitation_id: string;
  guest_name: string;
  status: string;
  companions_allowed: number;
  persons_reserved: number;
  rsvp: { answer: string; persons_confirmed: number; message: string | null } | null;
  event: {
    title: string; type: string; host_name: string | null; description: string | null;
    starts_at: string | null; ends_at: string | null; timezone: string;
    venue_name: string | null; venue_address: string | null; map_url: string | null;
    is_virtual: number; virtual_url: string | null;
  };
  design: any | null;
  audio_url: string | null;
  logo_url: string | null;
  background_url: string | null;
  qr_url: string;
  calendar_url: string;
  accepts_rsvp: boolean;
  guest_title: string | null;
  /** تهنئة الضيف إن كتبها، وهل صندوق التهنئة مفتوح (من يوم المناسبة) */
  wish: string | null;
  wishes_open: boolean;
  vars: TemplateVars;
  scenes: any[] | null;
}

export async function findInvitationByToken(db: DB, rawToken: string): Promise<InvitationRow>{
  if (!rawToken || rawToken.length < 20 || rawToken.length > 100)
    err("INVALID_TOKEN", "رابط الدعوة غير صالح");
  const inv = (await db.get<InvitationRow>(
    "SELECT * FROM invitations WHERE token_hash = ?", hashToken(rawToken)
  ));
  if (!inv) err("INVALID_TOKEN", "رابط الدعوة غير صالح");
  if (inv.status === "cancelled") err("EXPIRED", "هذه الدعوة ملغاة");
  if (inv.status === "expired" || (inv.expires_at && inv.expires_at < nowIso()))
    err("EXPIRED", "انتهت صلاحية هذه الدعوة");
  if (inv.status === "draft") err("INVALID_TOKEN", "رابط الدعوة غير صالح");
  return inv;
}

/** تحميل صفحة الضيف + تسجيل «شوهدت» عند أول فتح (إشارة موثوقة) */
export async function getGuestPage(db: DB, rawToken: string): Promise<GuestPagePayload>{
  const inv = (await findInvitationByToken(db, rawToken));
  const event = (await db.get<any>("SELECT * FROM events WHERE id = ?", inv.event_id))!;
  if (["cancelled", "archived"].includes(event.status))
    err("EVENT_CLOSED", "المناسبة لم تعد متاحة");
  const guest = (await db.get<{ name: string; group_id: string | null; title: string | null }>("SELECT name, group_id, title FROM guests WHERE id = ?", inv.guest_id))!;
  const groupName = guest.group_id
    ? ((await db.get<{ name: string }>("SELECT name FROM guest_groups WHERE id = ?", guest.group_id))?.name ?? "")
    : "";
  const dual = formatDualDate(event.starts_at, event.timezone);
  const design = (await db.get<any>(
    "SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'published'", inv.event_id
  )) ?? (await db.get<any>(
    "SELECT * FROM invitation_designs WHERE event_id = ? AND state = 'draft'", inv.event_id
  ));
  const designSchema = design ? JSON.parse(design.scenes_json) : null;
  const d = designSchema?.details ?? {};
  const publishedSteps = (await db.all<{ starts_at: string | null; title: string; sort_order: number }>(
    "SELECT starts_at, title, sort_order FROM timeline_items WHERE event_id = ? AND phase = 'event_day' AND show_to_guests = 1 ORDER BY starts_at, sort_order", inv.event_id
  ));
  const program = publishedSteps
    .map((x) => {
      const t = x.starts_at
        ? new Date(x.starts_at).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: event.timezone || "Asia/Riyadh" })
        : "";
      return `${t}|${x.title}`;
    }).join("\n");
  const photoRaw = String(d.photo_url ?? "").trim();
  const photo = safeImageUrl(photoRaw)
    ? photoRaw
    : photoRaw ? `/api/i/${rawToken}/asset/${photoRaw}` : "";

  const venuePhotoRaw = String(d.venue_photo_url ?? "").trim();
  const venuePhoto = safeImageUrl(venuePhotoRaw)
    ? venuePhotoRaw
    : venuePhotoRaw ? `/api/i/${rawToken}/asset/${venuePhotoRaw}` : "";

  const vars: TemplateVars = {
    "guest.name": guest.name,
    "guest.title": guest.title ?? "",
    "event.venue_photo": venuePhoto,
    "event.guest_notes": d.guest_notes ?? "",
    "event.closing_line": d.closing_line ?? "",
    "event.name": event.title,
    "event.date": dual ? (dual.hijri || dual.gregorian) : "",
    "event.time": dual?.time ?? "",
    "event.venue": [event.venue_name, event.venue_address].filter(Boolean).join(" — ") || (event.is_virtual ? "افتراضية" : ""),
    "guest.allowed_companions": inv.companions_allowed,
    "invitation.category": groupName,
    "host.names": event.host_name ?? "",
    "event.program": program,
    "event.dress_code": d.dress_code ?? "",
    "event.transport": d.transport ?? "",
    "event.accommodation": d.accommodation ?? "",
    "event.quote": d.quote ?? "",
    "event.photo": photo,
    "event.rsvp_deadline": event.rsvp_deadline
      ? new Date(event.rsvp_deadline).toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: event.timezone || "Asia/Riyadh" })
      : "",
    "event.rsvp_phone": d.rsvp_phone ?? "",
    "event.monogram": d.monogram ?? "",
    "event.groom": d.groom ?? "",
    "event.bride": d.bride ?? "",
    "event.invitation_line": d.invitation_line ?? "",
  };

  if (["issued", "delivered"].includes(inv.status)) {
    (await db.run("UPDATE invitations SET status = 'seen', seen_at = ? WHERE id = ?", nowIso(), inv.id));
    inv.status = "seen";
  }

  const latestRsvp = (await db.get<any>(
    "SELECT answer, persons_confirmed, message FROM rsvps WHERE invitation_id = ? ORDER BY occurred_at DESC LIMIT 1",
    inv.id
  ));
  const acceptsRsvp =
    ["published", "ongoing"].includes(event.status) &&
    (!event.rsvp_deadline || event.rsvp_deadline > nowIso()) &&
    !["checked_in"].includes(inv.status);

  const wish = (await db.get<{ message: string }>("SELECT message FROM guest_wishes WHERE invitation_id = ?", inv.id));

  return {
    invitation_id: inv.id,
    guest_name: guest.name,
    guest_title: guest.title ?? null,
    wish: wish?.message ?? null,
    wishes_open: wishesOpen(event),
    status: inv.status,
    companions_allowed: inv.companions_allowed,
    persons_reserved: inv.persons_reserved,
    rsvp: latestRsvp
      ? { answer: latestRsvp.answer, persons_confirmed: latestRsvp.persons_confirmed, message: latestRsvp.message }
      : null,
    event: {
      title: event.title, type: event.type, host_name: event.host_name,
      description: event.description, starts_at: event.starts_at, ends_at: event.ends_at,
      timezone: event.timezone, venue_name: event.venue_name, venue_address: event.venue_address,
      map_url: event.map_url, is_virtual: event.is_virtual, virtual_url: event.virtual_url,
    },
    design: designSchema,
    audio_url: design?.audio_asset_id ? `/api/i/${rawToken}/audio` : null,
    logo_url: designSchema?.logo_asset_id ? `/api/i/${rawToken}/asset/${designSchema.logo_asset_id}` : null,
    background_url: designSchema?.background_asset_id ? `/api/i/${rawToken}/asset/${designSchema.background_asset_id}` : null,
    qr_url: `/api/i/${rawToken}/qr.svg`,
    calendar_url: `/api/i/${rawToken}/calendar.ics`,
    accepts_rsvp: acceptsRsvp,
    vars,
    scenes: designSchema?.scenes ?? null,
  };
}

/** رد الضيف: موافق/معتذر + مرافقون ضمن المسموح فقط (AC-04) */
export async function submitRsvp(
  db: DB, rawToken: string,
  input: { answer: "confirmed" | "declined"; persons?: number; message?: string }
) {
  const inv = (await findInvitationByToken(db, rawToken));
  const event = (await db.get<any>("SELECT * FROM events WHERE id = ?", inv.event_id))!;
  if (!["published", "ongoing"].includes(event.status))
    err("EVENT_CLOSED", "المناسبة لا تقبل الردود حاليًا");
  if (event.rsvp_deadline && event.rsvp_deadline < nowIso())
    err("EVENT_CLOSED", "انتهت فترة الردود");
  if (inv.status === "checked_in") err("CONFLICT", "تم تسجيل دخولك بالفعل");
  if (!["confirmed", "declined"].includes(input.answer))
    err("VALIDATION", "رد غير صالح");

  let persons = 0;
  if (input.answer === "confirmed") {
    const max = 1 + inv.companions_allowed;
    persons = input.persons ?? 1;
    if (!Number.isInteger(persons) || persons < 1 || persons > max)
      err("VALIDATION", `عدد الحضور بين 1 و${max} (أنت + ${inv.companions_allowed} مرافق كحد أقصى)`);
  }
  const message = input.message?.slice(0, 500) ?? null;

  return (await db.tx(async () => {
    (await db.run(
      "INSERT INTO rsvps (id, invitation_id, organization_id, answer, persons_confirmed, message) VALUES (?,?,?,?,?,?)",
      newId(), inv.id, inv.organization_id, input.answer, persons, message
    ));
    (await db.run("UPDATE invitations SET status = ? WHERE id = ?", input.answer, inv.id));
    return { ok: true, answer: input.answer, persons_confirmed: persons };
  }));
}

/* ===== «اترك بصمتك الجميلة»: التهاني ===== */

/** اليوم المحلي بتوقيت المناسبة */
function dayIn(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** صندوق التهنئة يُفتح يوم المناسبة (بتوقيتها) للحاضرين وغير الحاضرين، ويبقى مفتوحًا بعدها */
export function wishesOpen(event: { starts_at: string | null; timezone: string; status: string }, now = Date.now()) {
  if (["cancelled", "archived"].includes(event.status)) return false;
  if (!event.starts_at) return false;
  return dayIn(new Date(now).toISOString(), event.timezone) >= dayIn(event.starts_at, event.timezone);
}

export async function submitWish(db: DB, rawToken: string, input: { message?: string }, now = Date.now()) {
  const inv = (await findInvitationByToken(db, rawToken));
  const event = (await db.get<any>("SELECT id, organization_id, starts_at, timezone, status FROM events WHERE id = ?", inv.event_id))!;
  if (!wishesOpen(event, now)) err("CONFLICT", "تُفتح التهنئة يوم المناسبة بمشيئة الله");
  const message = String(input.message ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 500);
  if (message.length < 2) err("VALIDATION", "اكتب تهنئتك أولًا");
  const existing = (await db.get<{ id: string }>("SELECT id FROM guest_wishes WHERE invitation_id = ?", inv.id));
  if (existing) {
    (await db.run("UPDATE guest_wishes SET message = ?, updated_at = ? WHERE id = ?", message, nowIso(), existing.id));
  } else {
    (await db.run(
      "INSERT INTO guest_wishes (id, event_id, organization_id, invitation_id, message) VALUES (?,?,?,?,?)",
      newId(), event.id, event.organization_id, inv.id, message
    ));
  }
  return { ok: true, message };
}
