import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full appearance-none rounded-xl bg-surface-2 pl-3.5 pr-9 text-base text-text transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/25 disabled:opacity-50 sm:text-[15px]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
  </div>
));
Select.displayName = "Select";
