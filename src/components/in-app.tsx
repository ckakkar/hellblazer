"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

const InAppContext = createContext(false);
const never = () => () => {};

/**
 * Hands the server's answer to "is this the iOS app?" (from the user agent
 * the app sets, isNativeAppRequest in src/lib/surface.ts) to the page, so
 * what only the app shows (Sign in with Apple, the Health switches, a back
 * button on the legal pages) is there from the first paint instead of
 * appearing once the page wakes up.
 */
export function InAppProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <InAppContext value={value}>{children}</InAppContext>;
}

/** Whether this is the iOS (or iPad) app: the server's word until the page runs, then Capacitor's. */
export function useInApp(): boolean {
  const server = useContext(InAppContext);
  return useSyncExternalStore(never, isNativeApp, () => server);
}

/** For a check the page makes itself (`canKeepAwake`), with the server's word on the app for the first paint. */
export function useInAppOr(check: () => boolean): boolean {
  const server = useContext(InAppContext);
  return useSyncExternalStore(never, check, () => server);
}
