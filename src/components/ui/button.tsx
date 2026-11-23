import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 [touch-action:manipulation] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-lime-400 text-navy-950 hover:bg-lime-500 shadow-sm",
        dark: "bg-navy-950 text-ivory hover:bg-navy-800",
        outline: "border border-navy-950/15 bg-white text-navy-950 hover:border-navy-950/40 hover:bg-ivory-soft",
        ghost: "text-navy-950 hover:bg-navy-950/5",
        danger: "bg-danger text-white hover:bg-danger/90",
        success: "bg-success text-white hover:bg-success/90",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { buttonVariants };
