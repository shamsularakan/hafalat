/** تهيئة عند إقلاع الخادم: ترحيلات + بذر (idempotent) */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("@/lib/db");
    (await getDb());
  }
}
