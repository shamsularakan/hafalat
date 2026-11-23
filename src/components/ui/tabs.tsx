"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs, active, onChange, className,
}: {
  tabs: { id: string; label: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto rounded-xl bg-navy-950/5 p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
            active === t.id ? "bg-white text-navy-950 shadow-sm" : "text-muted hover:text-navy-950"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
