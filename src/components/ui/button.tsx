import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* Primary is bone on black: the strongest contrast in the palette, and not
   the accent, which is reserved for what is live. `accent` exists for the one
   action on a screen that starts something (a workout, a set). */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[background-color,color,opacity] duration-150 ease-out active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40 disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary: "bg-text text-bg hover:bg-white",
        accent: "bg-accent text-black hover:brightness-110",
        secondary: "bg-surface-2 text-text hover:bg-[#242428]",
        outline:
          "bg-transparent text-text shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface",
        ghost: "text-muted hover:bg-surface hover:text-text",
        danger: "bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-10",
        xl: "h-14 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  // `type` defaults to "button": a bare <button> inside a <form> submits it,
  // which is never what these are for unless a caller says so explicitly.
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
