"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted", className)} aria-label="جارٍ التحميل" />;
}

export function Loading({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-navy-950/15 bg-white/60 px-6 py-14 text-center">
      <Inbox className="mb-1 h-8 w-8 text-muted" />
      <p className="font-bold text-navy-950">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-danger/20 bg-danger/5 px-6 py-10 text-center" role="alert">
      <AlertTriangle className="h-7 w-7 text-danger" />
      <p className="text-sm font-semibold text-danger">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>إعادة المحاولة</Button>}
    </div>
  );
}

/** تنبيه عائم بسيط للنجاح/الخطأ */
export function Toast({ message, tone, onDone }: { message: string; tone: "success" | "error"; onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  // Portal إلى body لتفادي containing-block الناتج عن حركة الصفحة (transform)
  return createPortal(
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:bottom-6" role="status">
      <div className={cn(
        "animate-fade-up rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-lg",
        tone === "success" ? "bg-success" : "bg-danger"
      )}>
        {message}
      </div>
    </div>,
    document.body
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; tone: "success" | "error" } | null>(null);
  const show = React.useCallback((message: string, tone: "success" | "error" = "success") => setToast({ message, tone }), []);
  const node = toast ? <Toast message={toast.message} tone={toast.tone} onDone={() => setToast(null)} /> : null;
  return { show, node };
}
