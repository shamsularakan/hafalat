import type { DB } from "./db";

/** أدوار المنظمة */
export type OrgRole = "owner" | "admin" | "member";
/** أدوار المناسبة */
export type EventRole =
  | "owner"
  | "manager"
  | "supervisor"
  | "delegate"
  | "receptionist"
  | "designer";

export interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  password_hash: string;
  status: string;
  is_platform_admin: number;
  email_verified: number;
  phone_verified: number;
  locale: string;
  created_at: string;
}

export interface Actor {
  user: UserRow;
  orgId: string;
  orgRole: OrgRole;
  isPlatformAdmin: boolean;
}

/** سياق التنفيذ: قاعدة + فاعل موثق (الخدمات لا تقرأ cookies أبدًا — قابلة للاختبار) */
export interface Ctx {
  db: DB;
  actor: Actor;
  ip?: string;
}

export interface DelegationPermissions {
  can_issue?: boolean;
  can_edit?: boolean;
  can_cancel?: boolean;
  can_send?: boolean;
  can_view_rsvp?: boolean;
  can_view_all?: boolean;
  can_delegate_sub?: boolean; // السماح بإنشاء مفوّضين فرعيين (مشرف)
  allow_vip?: boolean;
  allow_companions?: boolean;
  allowed_group_ids?: string[] | null; // null = كل الفئات
  gates?: string[]; // لموظف الاستقبال: فارغ = كل البوابات
}

export const DEFAULT_DELEGATE_PERMISSIONS: DelegationPermissions = {
  can_issue: true,
  can_edit: false,
  can_cancel: false,
  can_send: true,
  can_view_rsvp: true,
  can_view_all: false,
  allow_vip: false,
  allow_companions: true,
  allowed_group_ids: null,
};

export type EventStatus =
  | "draft"
  | "ready"
  | "published"
  | "ongoing"
  | "ended"
  | "archived"
  | "cancelled";

export type InvitationStatus =
  | "draft"
  | "issued"
  | "delivered"
  | "seen"
  | "confirmed"
  | "declined"
  | "checked_in"
  | "no_show"
  | "cancelled"
  | "expired";

export type QuotaUnit = "card" | "person";

export interface PlanRow {
  id: string;
  name_ar: string;
  price_monthly_sar: number;
  max_active_events: number;
  max_guests_per_event: number;
  max_delegates_per_event: number;
  storage_mb: number;
  advanced_templates: number;
  custom_branding: number;
  multi_seat: number;
  sort_order: number;
}

export const EVENT_TYPES: { id: string; ar: string }[] = [
  { id: "wedding", ar: "زواج" },
  { id: "engagement", ar: "ملكة / خطوبة" },
  { id: "graduation", ar: "تخرج" },
  { id: "newborn", ar: "مولود جديد" },
  { id: "birthday", ar: "عيد ميلاد" },
  { id: "family", ar: "مناسبة عائلية" },
  { id: "corporate", ar: "شركة / افتتاح" },
  { id: "opening", ar: "افتتاح" },
  { id: "meeting", ar: "اجتماع" },
  { id: "festival", ar: "فعالية / مهرجان" },
  { id: "conference", ar: "مؤتمر" },
  { id: "official", ar: "مناسبة رسمية" },
  { id: "other", ar: "أخرى" },
];

export const EVENT_STATUS_AR: Record<EventStatus, string> = {
  draft: "مسودة",
  ready: "جاهزة",
  published: "منشورة / تقبل الردود",
  ongoing: "جارية",
  ended: "منتهية",
  archived: "مؤرشفة",
  cancelled: "ملغاة",
};

export const INVITATION_STATUS_AR: Record<InvitationStatus, string> = {
  draft: "مسودة",
  issued: "صادرة",
  delivered: "تم تسليمها",
  seen: "شوهدت",
  confirmed: "مؤكد",
  declined: "معتذر",
  checked_in: "تم الدخول",
  no_show: "لم يحضر",
  cancelled: "ملغاة",
  expired: "منتهية الصلاحية",
};
