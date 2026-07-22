import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shiny wordmark — an ember glint sweeps across an off-white base. Pure CSS
 * (see `.hb-shiny` in globals), no animation library, respects reduced motion.
 */
export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("hb-shiny", className)}>{children}</span>;
}

/**
 * Blur-rise entrance. Stagger multiple by passing increasing `delay` (ms).
 * CSS-only; under reduced-motion it resolves instantly to the final state.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("hb-reveal", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
