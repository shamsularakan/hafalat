/** أخطاء موحدة: رمز ثابت + رسالة عربية قابلة للترجمة + تفاصيل (القسم 09) */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "QUOTA_EXCEEDED"
  | "CAPACITY_EXCEEDED"
  | "CONFLICT"
  | "INVALID_TOKEN"
  | "EXPIRED"
  | "DUPLICATE_ENTRY"
  | "REENTRY_DENIED"
  | "EVENT_CLOSED"
  | "UNIT_LOCKED"
  | "PLAN_LIMIT"
  | "RATE_LIMITED"
  | "DECLINED_INVITATION"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  QUOTA_EXCEEDED: 409,
  CAPACITY_EXCEEDED: 409,
  CONFLICT: 409,
  INVALID_TOKEN: 404,
  EXPIRED: 410,
  DUPLICATE_ENTRY: 409,
  REENTRY_DENIED: 409,
  EVENT_CLOSED: 409,
  UNIT_LOCKED: 409,
  PLAN_LIMIT: 402,
  RATE_LIMITED: 429,
  DECLINED_INVITATION: 409,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

const MESSAGES_AR: Record<ErrorCode, string> = {
  UNAUTHORIZED: "يلزم تسجيل الدخول",
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  NOT_FOUND: "العنصر غير موجود",
  VALIDATION: "بيانات غير صالحة",
  QUOTA_EXCEEDED: "تجاوزت حصة الدعوات المخصصة لك",
  CAPACITY_EXCEEDED: "بلغت المناسبة سعتها القصوى",
  CONFLICT: "تعارض مع حالة موجودة",
  INVALID_TOKEN: "رابط الدعوة غير صالح",
  EXPIRED: "انتهت صلاحية هذه الدعوة",
  DUPLICATE_ENTRY: "سجل مكرر",
  REENTRY_DENIED: "تم تسجيل دخول هذه الدعوة مسبقًا",
  EVENT_CLOSED: "المناسبة لا تقبل هذا الإجراء في حالتها الحالية",
  UNIT_LOCKED: "وحدة الحصة مقفلة بعد أول إصدار دعوة",
  PLAN_LIMIT: "بلغت حد الباقة الحالية — يلزم الترقية",
  RATE_LIMITED: "محاولات كثيرة، انتظر قليلًا",
  DECLINED_INVITATION: "هذه الدعوة معتذر عنها",
  NOT_IMPLEMENTED: "هذه الميزة غير مفعلة بعد",
  INTERNAL: "خطأ داخلي في الخادم",
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, messageAr?: string, details?: unknown) {
    super(messageAr ?? MESSAGES_AR[code]);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function err(code: ErrorCode, messageAr?: string, details?: unknown): never {
  throw new AppError(code, messageAr, details);
}
