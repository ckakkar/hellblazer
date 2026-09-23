import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Small sentence-case tags. The one place a pill shape belongs. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      variant: {
        default: "bg-surface-2 text-muted",
        accent: "bg-accent/15 text-accent",
        warn: "bg-warn/15 text-warn",
        muted: "text-muted shadow-[inset_0_0_0_1px_var(--color-border)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
