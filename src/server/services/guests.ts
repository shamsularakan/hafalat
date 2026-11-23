/** الضيوف والفئات والاستيراد (القسم 04-C) — عزل كامل ضمن المناسبة والتفويض */
import { DB, newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { delegationPerms, requireEventAccess, type DelegationRow } from "@/lib/permissions";
import { normalizePhone, phoneHash } from "@/lib/auth";
import { parseCsv, toCsv } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";
import { assertPlanGuestLimit } from "@/lib/plans";

export interface GuestRow {
  id: string;
  event_id: string;
  organization_id: string;
  inviter_id: string | null;
  original_inviter_id: string | null;
  group_id: string | null;
  name: string;
  phone: string | null;
  phone_hash: string | null;
  email: string | null;
  locale: string;
  notes: string | null;
  conflict: number;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getGuestScoped(db: DB, orgId: string, eventId: string, guestId: string): Promise<GuestRow>{
  const g = (await db.get<GuestRow>(
    "SELECT * FROM guests WHERE id = ? AND event_id = ? AND organization_id = ?",
    guestId, eventId, orgId
  ));
  if (!g) err("NOT_FOUND", "الضيف غير موجود");
  return g;
}

export interface GuestInput {
  name: string;
  phone?: string;
  email?: string;
  group_id?: string | null;
  notes?: string;
  locale?: string;
}

export async function createGuest(ctx: Ctx, eventId: string, input: GuestInput) {
  const { role, delegation } = (await requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate"]));
  if (!input.name?.trim()) err("VALIDATION", "اسم الضيف مطلوب");
  (await assertPlanGuestLimit(ctx.db, ctx.actor.orgId, eventId));

  let inviterId: string | null = null;
  if (role === "delegate" || role === "supervisor") {
    if (!delegation || delegation.status !== "active") err("FORBIDDEN", "تفويضك غير نشط");
    if (delegation.expires_at && delegation.expires_at < nowIso()) err("EXPIRED", "انتهت مدة التفويض");
    inviterId = delegation.id;
    const perms = delegationPerms(delegation);
    if (input.group_id) {
      const grp = (await ctx.db.get<{ is_vip: number }>("SELECT is_vip FROM guest_groups WHERE id = ? AND event_id = ?", input.group_id, eventId));
      if (!grp) err("NOT_FOUND", "الفئة غير موجودة");
      if (grp.is_vip && !perms.allow_vip) err("FORBIDDEN", "فئة VIP غير مسموحة لك");
      if (perms.allowed_group_ids && !perms.allowed_group_ids.includes(input.group_id))
        err("FORBIDDEN", "هذه الفئة غير مسموحة ضمن تفويضك");
    }
  }
  return (await insertGuest(ctx.db, ctx.actor.orgId, eventId, input, inviterId, null, ctx.actor.user.id));
}

async function insertGuest(db: DB, orgId: string, eventId: string, input: GuestInput, inviterId: string | null, batchId: string | null, actorId: string) {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) err("VALIDATION", `رقم هاتف غير صالح: ${input.phone}`);
  const ph = phone ? phoneHash(phone) : null;
  if (ph) {
    const dup = (await db.get<{ id: string; name: string }>(
      "SELECT id, name FROM guests WHERE event_id = ? AND phone_hash = ?", eventId, ph
    ));
    if (dup) err("DUPLICATE_ENTRY", `الرقم مسجل مسبقًا للضيف «${dup.name}»`, { existing_id: dup.id });
  }
  if (input.group_id) {
    const grp = (await db.get("SELECT id FROM guest_groups WHERE id = ? AND event_id = ?", input.group_id, eventId));
    if (!grp) err("NOT_FOUND", "الفئة غير موجودة");
  }
  const id = newId();
  (await db.run(
    `INSERT INTO guests (id, event_id, organization_id, inviter_id, original_inviter_id, group_id, name, phone, phone_hash, email, locale, notes, import_batch_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, eventId, orgId, inviterId, inviterId, input.group_id ?? null,
    input.name.trim(), phone, ph, input.email?.trim().toLowerCase() ?? null,
    input.locale ?? "ar", input.notes ?? null, batchId
  ));
  return (await db.get<GuestRow>("SELECT * FROM guests WHERE id = ?", id))!;
}

export async function listGuests(ctx: Ctx, eventId: string, filters?: { q?: string; group_id?: string; inviter_id?: string }) {
  const { role, delegation } = (await requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate", "receptionist"]));
  const where: string[] = ["g.event_id = ?", "g.organization_id = ?"];
  const params: any[] = [eventId, ctx.actor.orgId];
  if ((role === "delegate" || role === "supervisor") && delegation && !delegationPerms(delegation).can_view_all) {
    where.push("g.inviter_id = ?");
    params.push(delegation.id);
  }
  if (filters?.q) { where.push("(g.name LIKE ? OR g.phone LIKE ?)"); params.push(`%${filters.q}%`, `%${filters.q}%`); }
  if (filters?.group_id) { where.push("g.group_id = ?"); params.push(filters.group_id); }
  if (filters?.inviter_id) { where.push("g.inviter_id = ?"); params.push(filters.inviter_id); }
  return (await ctx.db.all(
    `SELECT g.*, gr.name group_name, d.invitee_name inviter_name,
      (SELECT status FROM invitations i WHERE i.guest_id = g.id ORDER BY i.created_at DESC LIMIT 1) invitation_status
     FROM guests g LEFT JOIN guest_groups gr ON gr.id = g.group_id
     LEFT JOIN delegations d ON d.id = g.inviter_id
     WHERE ${where.join(" AND ")} ORDER BY g.created_at DESC`,
    ...params
  ));
}

export async function updateGuest(ctx: Ctx, guestId: string, input: Partial<GuestInput>) {
  const g = (await ctx.db.get<GuestRow>("SELECT * FROM guests WHERE id = ?", guestId));
  if (!g || g.organization_id !== ctx.actor.orgId) err("NOT_FOUND");
  const { role, delegation } = (await requireEventAccess(ctx, g.event_id, ["owner", "manager", "supervisor", "delegate"]));
  if (role === "delegate" || role === "supervisor") {
    if (!delegation || delegation.status !== "active") err("FORBIDDEN");
    const perms = delegationPerms(delegation);
    if (g.inviter_id !== delegation.id && !perms.can_view_all) err("FORBIDDEN", "هذا الضيف ليس ضمن ضيوفك");
    if (!perms.can_edit && g.inviter_id !== delegation.id) err("FORBIDDEN", "التعديل غير مسموح ضمن تفويضك");
  }
  const phone = input.phone === undefined ? undefined : input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) err("VALIDATION", "رقم هاتف غير صالح");
  const ph = phone ? phoneHash(phone) : null;
  if (ph) {
    const dup = (await ctx.db.get("SELECT id FROM guests WHERE event_id = ? AND phone_hash = ? AND id != ?", g.event_id, ph, guestId));
    if (dup) err("DUPLICATE_ENTRY", "الرقم مسجل لضيف آخر");
  }
  (await ctx.db.run(
    `UPDATE guests SET name = COALESCE(?, name), phone = ?, phone_hash = ?, email = COALESCE(?, email),
     group_id = COALESCE(?, group_id), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`,
    input.name?.trim() ?? null,
    phone === undefined ? g.phone : phone,
    ph === undefined ? g.phone_hash : ph,
    input.email ?? null, input.group_id ?? null, input.notes ?? null, nowIso(), guestId
  ));
  return (await ctx.db.get<GuestRow>("SELECT * FROM guests WHERE id = ?", guestId))!;
}

/** نقل ملكية ضيف بين مفوّضين بإذن — يبقى الداعي الأصلي محفوظًا (AC-05) */
export async function transferGuest(ctx: Ctx, guestId: string, toDelegationId: string | null) {
  const g = (await ctx.db.get<GuestRow>("SELECT * FROM guests WHERE id = ?", guestId));
  if (!g || g.organization_id !== ctx.actor.orgId) err("NOT_FOUND");
  (await requireEventAccess(ctx, g.event_id, ["owner", "manager"]));
  if (toDelegationId) {
    const d = (await ctx.db.get<DelegationRow>("SELECT * FROM delegations WHERE id = ? AND event_id = ?", toDelegationId, g.event_id));
    if (!d) err("NOT_FOUND", "التفويض المستلم غير موجود");
    if (d.status !== "active") err("CONFLICT", "التفويض المستلم غير نشط");
  }
  (await ctx.db.run(
    "UPDATE guests SET inviter_id = ?, original_inviter_id = COALESCE(original_inviter_id, ?), updated_at = ? WHERE id = ?",
    toDelegationId, g.inviter_id, nowIso(), guestId
  ));
  (await writeAudit(ctx.db, {
    orgId: ctx.actor.orgId, eventId: g.event_id, actorId: ctx.actor.user.id,
    action: "guest.transfer", objectType: "guest", objectId: guestId,
    detail: { from: g.inviter_id, to: toDelegationId }, ip: ctx.ip,
  }));
  return (await ctx.db.get<GuestRow>("SELECT * FROM guests WHERE id = ?", guestId))!;
}

export interface ImportRowResult {
  row: number;
  name: string;
  phone: string;
  email: string;
  group: string;
  status: "ok" | "duplicate_existing" | "duplicate_file" | "error";
  reason?: string;
}

/** استيراد CSV: معاينة (dryRun) ثم تأكيد — أخطاء صفوف وتكرارات دون إدخال ناقص (AC-06) */
export async function importGuests(
  ctx: Ctx, eventId: string,
  opts: { csv: string; mapping?: Record<string, string>; dryRun: boolean; filename?: string }
) {
  const { role, delegation } = (await requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate"]));
  let inviterId: string | null = null;
  if (role === "delegate" || role === "supervisor") {
    if (!delegation || delegation.status !== "active") err("FORBIDDEN", "تفويضك غير نشط");
    inviterId = delegation.id;
  }
  const rows = parseCsv(opts.csv);
  if (rows.length < 2) err("VALIDATION", "الملف فارغ أو بلا صفوف بيانات");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const defaultMap: Record<string, string> = {
    name: "الاسم", phone: "الهاتف", email: "البريد", group: "الفئة", notes: "ملاحظات",
  };
  const mapping = opts.mapping ?? {};
  const colIndex = (field: string): number => {
    const wanted = (mapping[field] ?? defaultMap[field] ?? field).toLowerCase();
    const aliases: Record<string, string[]> = {
      name: ["الاسم", "اسم", "name", "الضيف", "guest"],
      phone: ["الهاتف", "هاتف", "phone", "الجوال", "رقم", "mobile"],
      email: ["البريد", "بريد", "email", "الايميل"],
      group: ["الفئة", "فئة", "group", "category", "التصنيف"],
      notes: ["ملاحظات", "notes", "ملاحظة"],
    };
    return header.findIndex((h) => h === wanted || (aliases[field] ?? []).includes(h));
  };
  const idx = { name: colIndex("name"), phone: colIndex("phone"), email: colIndex("email"), group: colIndex("group"), notes: colIndex("notes") };
  if (idx.name < 0) err("VALIDATION", "عمود الاسم غير موجود في الملف");

  const groups = (await ctx.db.all<{ id: string; name: string }>("SELECT id, name FROM guest_groups WHERE event_id = ?", eventId));
  const existingPhones = new Set(
    (await ctx.db.all<{ phone_hash: string }>("SELECT phone_hash FROM guests WHERE event_id = ? AND phone_hash IS NOT NULL", eventId)).map((r) => r.phone_hash)
  );
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();
  const results: ImportRowResult[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[idx.name] ?? "").trim();
    const phoneRaw = idx.phone >= 0 ? (r[idx.phone] ?? "").trim() : "";
    const email = idx.email >= 0 ? (r[idx.email] ?? "").trim() : "";
    const groupName = idx.group >= 0 ? (r[idx.group] ?? "").trim() : "";
    const base = { row: i + 1, name, phone: phoneRaw, email, group: groupName };
    if (!name) { results.push({ ...base, status: "error", reason: "الاسم مفقود" }); continue; }
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) { results.push({ ...base, status: "error", reason: "رقم هاتف غير صالح (صيغة دولية مطلوبة)" }); continue; }
    const ph = phone ? phoneHash(phone) : null;
    if (ph && existingPhones.has(ph)) { results.push({ ...base, status: "duplicate_existing", reason: "الرقم مسجل مسبقًا في المناسبة" }); continue; }
    if (ph && seenPhones.has(ph)) { results.push({ ...base, status: "duplicate_file", reason: "مكرر داخل الملف" }); continue; }
    const nameKey = name.toLowerCase();
    if (!ph && seenNames.has(nameKey)) { results.push({ ...base, status: "duplicate_file", reason: "اسم مكرر داخل الملف (بلا رقم)" }); continue; }
    if (ph) seenPhones.add(ph);
    seenNames.add(nameKey);
    results.push({ ...base, status: "ok" });
  }

  const okRows = results.filter((r) => r.status === "ok");
  if (opts.dryRun) {
    return {
      dryRun: true, total: results.length, ok: okRows.length,
      duplicates: results.filter((r) => r.status.startsWith("duplicate")).length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };
  }

  (await assertPlanGuestLimit(ctx.db, ctx.actor.orgId, eventId, okRows.length));
  const batchId = newId();
  return (await ctx.db.tx(async () => {
    let inserted = 0;
    const insertErrors: any[] = [];
    for (const r of okRows) {
      const grp = groups.find((g) => g.name === r.group);
      try {
        (await insertGuest(ctx.db, ctx.actor.orgId, eventId, {
          name: r.name, phone: r.phone || undefined, email: r.email || undefined,
          group_id: grp?.id ?? null,
          notes: idx.notes >= 0 ? (rows[r.row - 1][idx.notes] ?? "") : undefined,
        }, inviterId, batchId, ctx.actor.user.id));
        inserted++;
      } catch (e: any) {
        insertErrors.push({ row: r.row, name: r.name, reason: e.message });
      }
    }
    (await ctx.db.run(
      `INSERT INTO import_batches (id, event_id, organization_id, actor_id, filename, total_rows, inserted, skipped_duplicates, errors_json)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      batchId, eventId, ctx.actor.orgId, ctx.actor.user.id, opts.filename ?? null,
      results.length, inserted,
      results.filter((r) => r.status.startsWith("duplicate")).length,
      JSON.stringify([...results.filter((r) => r.status === "error"), ...insertErrors])
    ));
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, eventId, actorId: ctx.actor.user.id,
      action: "guest.import", objectType: "import_batch", objectId: batchId,
      detail: { total: results.length, inserted }, ip: ctx.ip,
    }));
    return { dryRun: false, batch_id: batchId, total: results.length, inserted, results };
  }));
}

export async function exportGuestsCsv(ctx: Ctx, eventId: string): Promise<string> {
  const guests = (await listGuests(ctx, eventId));
  return toCsv(
    ["الاسم", "الهاتف", "البريد", "الفئة", "الداعي", "حالة الدعوة", "تاريخ الإضافة"],
    guests.map((g: any) => [g.name, g.phone, g.email, g.group_name, g.inviter_name ?? "المالك", g.invitation_status ?? "", g.created_at])
  );
}

/* ===== الفئات ===== */
export async function listGroups(ctx: Ctx, eventId: string) {
  (await requireEventAccess(ctx, eventId, ["owner", "manager", "supervisor", "delegate", "designer", "receptionist"]));
  return (await ctx.db.all("SELECT * FROM guest_groups WHERE event_id = ? ORDER BY sort_order", eventId));
}

export async function upsertGroup(ctx: Ctx, eventId: string, input: { id?: string; name: string; kind?: string; companion_max?: number; is_vip?: boolean }) {
  (await requireEventAccess(ctx, eventId, ["owner", "manager"]));
  if (!input.name?.trim()) err("VALIDATION", "اسم الفئة مطلوب");
  const companionMax = input.companion_max ?? 0;
  if (!Number.isInteger(companionMax) || companionMax < 0 || companionMax > 20)
    err("VALIDATION", "حد المرافقين بين 0 و20");
  if (input.id) {
    const g = (await ctx.db.get("SELECT id FROM guest_groups WHERE id = ? AND event_id = ?", input.id, eventId));
    if (!g) err("NOT_FOUND");
    (await ctx.db.run(
      "UPDATE guest_groups SET name = ?, kind = ?, companion_max = ?, is_vip = ? WHERE id = ?",
      input.name.trim(), input.kind ?? "custom", companionMax, input.is_vip ? 1 : 0, input.id
    ));
    return (await ctx.db.get("SELECT * FROM guest_groups WHERE id = ?", input.id));
  }
  const id = newId();
  try {
    (await ctx.db.run(
      "INSERT INTO guest_groups (id, event_id, organization_id, name, kind, companion_max, is_vip, sort_order) VALUES (?,?,?,?,?,?,?,99)",
      id, eventId, ctx.actor.orgId, input.name.trim(), input.kind ?? "custom", companionMax, input.is_vip ? 1 : 0
    ));
  } catch {
    err("DUPLICATE_ENTRY", "اسم الفئة موجود مسبقًا");
  }
  return (await ctx.db.get("SELECT * FROM guest_groups WHERE id = ?", id));
}
