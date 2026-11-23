import crypto from "node:crypto";
import { DB, newId, nowIso } from "./db";
import { err } from "./errors";
import { hashSessionToken, newSessionToken } from "./tokens";
import type { UserRow } from "./types";
import { writeAudit } from "./audit";

const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: SCRYPT_N }).toString("hex");
  return `scrypt$${SCRYPT_N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, nStr, salt, hash] = stored.split("$");
  if (scheme !== "scrypt") return false;
  const candidate = crypto.scryptSync(password, salt, 64, { N: Number(nStr) });
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** تطبيع رقم دولي: + ثم أرقام فقط */
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  const withPlus = cleaned.startsWith("+") ? cleaned : cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : `+${cleaned}`;
  if (!/^\+[1-9]\d{7,14}$/.test(withPlus)) return null;
  return withPlus;
}

export function phoneHash(phone: string): string | null {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  return crypto.createHash("sha256").update(norm).digest("hex");
}

export interface RegisterInput {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  orgName: string;
  orgKind?: "individual" | "company";
}

export function registerUser(db: DB, input: RegisterInput) {
  const name = input.name?.trim();
  const orgName = input.orgName?.trim();
  if (!name || name.length < 2) err("VALIDATION", "الاسم مطلوب (حرفان على الأقل)");
  if (!orgName) err("VALIDATION", "اسم مساحة العمل مطلوب");
  if (!input.password || input.password.length < 8)
    err("VALIDATION", "كلمة المرور 8 أحرف على الأقل");
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (!email && !phone) err("VALIDATION", "البريد أو رقم الهاتف مطلوب");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    err("VALIDATION", "البريد الإلكتروني غير صالح");
  if (input.phone && !phone) err("VALIDATION", "رقم الهاتف بصيغة دولية غير صالح");

  return db.tx(() => {
    if (email && db.get("SELECT id FROM users WHERE email = ?", email))
      err("DUPLICATE_ENTRY", "البريد مسجل مسبقًا");
    if (phone && db.get("SELECT id FROM users WHERE phone = ?", phone))
      err("DUPLICATE_ENTRY", "رقم الهاتف مسجل مسبقًا");

    const userId = newId();
    db.run(
      `INSERT INTO users (id, email, phone, name, password_hash, status) VALUES (?,?,?,?,?,'active')`,
      userId, email, phone, name, hashPassword(input.password)
    );
    const orgId = newId();
    db.run(
      `INSERT INTO organizations (id, name, kind, plan_id, owner_id, contact_email, contact_phone) VALUES (?,?,?,'free',?,?,?)`,
      orgId, orgName, input.orgKind ?? "individual", userId, email, phone
    );
    db.run(
      `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'owner')`,
      orgId, userId
    );
    db.run(
      `INSERT INTO subscriptions (id, organization_id, plan_id, state, renewal_at) VALUES (?,?, 'free','active',?)`,
      newId(), orgId, new Date(Date.now() + 30 * 864e5).toISOString()
    );
    writeAudit(db, {
      orgId, actorId: userId, action: "org.create",
      objectType: "organization", objectId: orgId,
    });
    const user = db.get<UserRow>("SELECT * FROM users WHERE id = ?", userId)!;
    return { user, orgId };
  });
}

export function login(db: DB, identifier: string, password: string, userAgent?: string) {
  const id = identifier.trim();
  const email = normalizeEmail(id);
  const phone = normalizePhone(id);
  const user = db.get<UserRow>(
    "SELECT * FROM users WHERE email = ? OR phone = ?",
    email, phone ?? ""
  );
  if (!user || !verifyPassword(password, user.password_hash))
    err("UNAUTHORIZED", "بيانات الدخول غير صحيحة");
  if (user.status !== "active") err("FORBIDDEN", "الحساب موقوف");
  return createSession(db, user, userAgent);
}

export function createSession(db: DB, user: UserRow, userAgent?: string) {
  const raw = newSessionToken();
  const days = Number(process.env.DAWAT_SESSION_DAYS ?? 14);
  const expires = new Date(Date.now() + days * 864e5).toISOString();
  db.run(
    "INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?,?,?,?)",
    hashSessionToken(raw), user.id, expires, userAgent ?? null
  );
  return { raw, expiresAt: expires, user };
}

export function validateSession(db: DB, rawToken: string | undefined): UserRow | null {
  if (!rawToken) return null;
  const sess = db.get<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    hashSessionToken(rawToken)
  );
  if (!sess) return null;
  if (sess.expires_at < nowIso()) {
    db.run("DELETE FROM sessions WHERE id = ?", hashSessionToken(rawToken));
    return null;
  }
  const user = db.get<UserRow>("SELECT * FROM users WHERE id = ?", sess.user_id);
  if (!user || user.status !== "active") return null;
  return user;
}

export function destroySession(db: DB, rawToken: string | undefined) {
  if (!rawToken) return;
  db.run("DELETE FROM sessions WHERE id = ?", hashSessionToken(rawToken));
}

/** تحديد معدل بسيط في الذاكرة (الإنتاج: Redis/مزود مشترك) */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > max) err("RATE_LIMITED");
}
