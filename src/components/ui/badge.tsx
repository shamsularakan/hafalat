import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-navy-950/8 text-navy-950",
        lime: "bg-lime-100 text-navy-950 border border-lime-400/50",
        success: "bg-success/10 text-success",
        danger: "bg-danger/10 text-danger",
        warning: "bg-brand-orange/10 text-brand-orange",
        navy: "bg-navy-950 text-ivory",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
