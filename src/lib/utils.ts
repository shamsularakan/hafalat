import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("ar").format(n ?? 0);
}

export function formatDateShort(iso: string | null | undefined, tz?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium", timeStyle: "short", timeZone: tz ?? "Asia/Riyadh",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function statusTone(status: string): "success" | "danger" | "warning" | "neutral" | "lime" {
  switch (status) {
    case "confirmed": case "checked_in": case "published": case "active": case "paid": case "ongoing":
      return "success";
    case "declined": case "cancelled": case "failed": case "revoked":
      return "danger";
    case "seen": case "delivered": case "pending": case "ready": case "past_due":
      return "warning";
    case "issued": case "trial":
      return "lime";
    default:
      return "neutral";
  }
}
