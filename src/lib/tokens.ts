import crypto from "node:crypto";

/**
 * رموز الدعوات: غير قابلة للتخمين (HMAC-SHA256 بمفتاح سري + عشوائية إعادة الإصدار).
 * لا يُخزن الرمز الخام أبدًا — فقط sha256(token). يمكن إعادة اشتقاق الرمز للمشاركة
 * من (invitationId, token_nonce) دون تخزينه، والإبطال عبر تغيير nonce أو حالة الدعوة.
 * لا يحتوي QR على أي بيانات شخصية — فقط رابط الدعوة.
 */
function secret(): string {
  return (
    process.env.DAWAT_SECRET ?? "dev-only-change-me-to-a-long-random-secret"
  );
}

export function deriveToken(invitationId: string, nonce: string): string {
  const mac = crypto
    .createHmac("sha256", secret())
    .update(`${invitationId}:${nonce}`)
    .digest();
  return mac.toString("base64url").slice(0, 43);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function newNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function publicUrl(): string {
  return (process.env.DAWAT_PUBLIC_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export function invitationUrl(rawToken: string): string {
  return `${publicUrl()}/i/${rawToken}`;
}
