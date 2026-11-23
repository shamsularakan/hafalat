/** عميل API موحد: يفك {ok, data, error} ويرمي رسائل عربية قابلة للعرض */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;
  constructor(code: string, message: string, status: number, details?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: isForm ? undefined : body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* response non-JSON */ }
  if (!res.ok || payload?.ok === false) {
    const e = payload?.error;
    throw new ApiError(e?.code ?? "INTERNAL", e?.message ?? "تعذر الاتصال بالخادم", res.status, e?.details);
  }
  return payload?.data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
  form: <T>(url: string, form: FormData) => request<T>("POST", url, form, true),
};
