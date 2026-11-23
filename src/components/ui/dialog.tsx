"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * حوار موحّد لكل النوافذ — متجاوب مع جميع الشاشات:
 * - ارتفاع ديناميكي (dvh) يتكيّف مع لوحة مفاتيح الجوال وشريط المتصفح
 * - تمرير داخلي رأسي فقط + حماية من التجاوز الأفقي للجداول/النماذج
 * - ترويسة ثابتة (زر الإغلاق يبقى ظاهرًا) ومنطقة محتوى قابلة للتمرير
 * - حبس تركيز (Tab) وإغلاق بـ Escape + منع تمرير الخلفية
 * - مساحة آمنة لأجهزة iPhone (notch/home indicator)
 */
export function Dialog({
  open, onClose, title, children, className, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // التركيز أولًا على أول حقل داخل المحتوى، وإلا زر الإغلاق
    const firstField = ref.current?.querySelector<HTMLElement>(
      ".dialog-content input, .dialog-content select, .dialog-content textarea"
    );
    (firstField ?? closeRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal إلى body: عناصر الصفحة ذات الحركة (transform) تُصبح containing block
  // لـ position:fixed — لذا يجب إخراج الحوار منها ليبقى مثبّتًا على الشاشة.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          "relative z-10 flex w-full min-w-0 flex-col overflow-hidden rounded-card bg-white shadow-2xl animate-fade-up",
          "max-h-[calc(100vh-3.5rem)] supports-[height:100dvh]:max-h-[calc(100dvh-3.5rem)]",
          "sm:max-h-[calc(100vh-3rem)] sm:supports-[height:100dvh]:max-h-[calc(100dvh-3rem)]",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
          className
        )}
      >
        {/* ترويسة ثابتة — زر الإغلاق لا يختفي عند تمرير المحتوى */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-navy-950/8 bg-white px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 truncate text-base font-bold sm:text-lg">{title}</h2>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق" className="shrink-0">
            <X className="h-4.5 w-4.5" />
          </Button>
        </div>
        {/* محتوى قابل للتمرير — min-h-0 يسمح بالانكماش داخل flex، overscroll يمنع تمرير الخلفية */}
        <div className="dialog-content min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
