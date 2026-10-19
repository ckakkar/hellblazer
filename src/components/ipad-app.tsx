"use client";

import { createContext, useContext } from "react";

const IPadAppContext = createContext(false);

/**
 * Hands the server's answer to "is this the iPad app?" (isIPadApp in
 * src/lib/surface.ts) to client components, so they render the iPad's
 * version from the first paint.
 */
export function IPadAppProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <IPadAppContext value={value}>{children}</IPadAppContext>;
}

/** True in the iPad app, where workouts are watched, not run. */
export function useIPadApp(): boolean {
  return useContext(IPadAppContext);
}
