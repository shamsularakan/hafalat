import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-navy-950/8">
      <table className={cn("w-full min-w-max text-sm", className)} {...props} />
    </div>
  );
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("bg-ivory-soft px-3.5 py-2.5 text-right text-xs font-bold text-muted", className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t border-navy-950/6 px-3.5 py-2.5 align-middle", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors hover:bg-ivory-soft/60", className)} {...props} />;
}
