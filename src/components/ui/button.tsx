import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background,color,box-shadow,border-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-45 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-bg hover:brightness-110 shadow-glow active:brightness-95",
        secondary:
          "bg-surface-2 text-text border border-border hover:border-accent/40 hover:text-accent",
        outline:
          "border border-border bg-transparent text-text hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        danger:
          "bg-transparent text-danger border border-danger/30 hover:bg-danger/10",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
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
