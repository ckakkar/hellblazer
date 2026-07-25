import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-base text-text shadow-inset placeholder:text-muted/70 transition-colors focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-1 focus-visible:ring-accent/40 disabled:opacity-50 sm:text-sm",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
