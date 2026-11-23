import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 rounded-card border border-navy-950/8 bg-white p-5 shadow-[0_1px_3px_rgba(74,59,54,0.08)]", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-center justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-bold text-navy-950", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "lime" | "success" | "danger" | "navy" }) {
  const tones = {
    lime: "bg-lime-100 text-navy-950",
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    navy: "bg-navy-950 text-ivory",
  };
  return (
    <Card className={cn("flex flex-col gap-1", tone && tones[tone])}>
      <span className={cn("text-xs font-medium", tone ? "opacity-80" : "text-muted")}>{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      {hint && <span className={cn("text-xs", tone ? "opacity-70" : "text-muted")}>{hint}</span>}
    </Card>
  );
}
