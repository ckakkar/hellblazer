"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Re-keys on the pathname so page content plays a subtle settle-in animation on
 * every navigation — the app feeling a touch more crafted without any layout
 * cost. Query-param changes (e.g. Progress tabs) don't re-trigger it.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="hb-page">
      {children}
    </div>
  );
}
