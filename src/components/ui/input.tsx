import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-xl bg-surface-2 px-3.5 text-base text-text placeholder:text-muted/70 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/25 disabled:opacity-50 sm:text-[15px]",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
