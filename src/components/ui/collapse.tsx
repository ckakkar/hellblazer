"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A disclosure's content: it opens by sliding its height and fades in, and
 * closes the same way (`.hb-collapse` in globals.css), so the eye follows
 * where it came from instead of the page jumping. The content mounts on
 * first open and leaves once the close has played; while closed it's inert.
 */
export function Collapse({
  open,
  children,
  id,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return (
    <div
      id={id}
      data-open={open ? "" : undefined}
      inert={!open}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && e.propertyName === "grid-template-rows") setMounted(false);
      }}
      className="hb-collapse"
    >
      {/* Padding goes inside the clipped row, or it would hold it open. */}
      <div>{mounted && <div className={cn(className)}>{children}</div>}</div>
    </div>
  );
}
