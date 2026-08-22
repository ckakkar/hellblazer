import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Hard-edged mono stamps rather than pills: on a card built out of rules and
   tables, a rounded-full badge is the one shape that has nowhere to belong.
   These read as annotations struck onto a record book. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[2px] border px-1.5 py-px font-mono text-[10px] uppercase leading-[1.45] tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-2 text-muted",
        accent: "border-accent/45 bg-accent/10 text-accent",
        warn: "border-warn/40 bg-warn/10 text-warn",
        muted: "border-border/70 bg-transparent text-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
