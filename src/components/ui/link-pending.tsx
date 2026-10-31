"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inside a `Link`: its usual mark (a chevron, a figure) until the link is
 * tapped, then a spinner in its place while the page it opens loads, so a
 * row that opens something slow never looks like it ignored the tap.
 */
export function LinkPending({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return children;
  return <Loader2 aria-label="Loading" className={cn("animate-spin text-muted", className)} />;
}
