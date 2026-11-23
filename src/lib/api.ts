/** مساعدات route handlers: استجابة موحدة {ok, data|error, request_id} (القسم 09) */
import crypto from "node:crypto";
import { AppError } from "./errors";

export function ok(data: unknown, status = 200) {
  return Response.json(
    { ok: true, data, request_id: crypto.randomUUID() },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function fail(e: unknown) {
  const requestId = crypto.randomUUID();
  if (e instanceof AppError) {
    return Response.json(
      { ok: false, error: { code: e.code, message: e.message, details: e.details ?? null }, request_id: requestId },
      { status: e.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[dawat][${requestId}]`, e);
  return Response.json(
    { ok: false, error: { code: "INTERNAL", message: "خطأ داخلي في الخادم" }, request_id: requestId },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export async function readJson<T = any>(req: Request, maxBytes = 1024 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("VALIDATION", "حمولة الطلب كبيرة جدًا");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("VALIDATION", "JSON غير صالح");
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/** غلاف موحد لالتقاط الأخطاء */
export function route<A extends any[]>(handler: (...args: A) => Promise<Response> | Response) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return fail(e);
    }
  };
}
