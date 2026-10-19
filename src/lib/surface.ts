import { cache } from "react";
import { headers } from "next/headers";

/**
 * The iPad app is the showcase, not a bigger iPhone: workouts are started and
 * logged on the iPhone and the Apple Watch only, and the iPad shows them off
 * (the poster, the numbers, a workout under way as it happens) and is where
 * programs, templates and exercises get edited.
 *
 * The app shell appends "Fatty" to the web view's user agent
 * (capacitor.config.ts), so the server can tell from the request alone and
 * render the iPad's pages with no flash of the phone's. An iPad in desktop
 * content mode reports itself as a Mac, which no iPhone does.
 */
export function isIPadAppAgent(userAgent: string): boolean {
  return /\bFatty\b/.test(userAgent) && /\b(iPad|Macintosh)\b/.test(userAgent);
}

/** Whether this request comes from the iPad app. Cached per request. */
export const isIPadApp = cache(async function isIPadApp(): Promise<boolean> {
  return isIPadAppAgent((await headers()).get("user-agent") ?? "");
});
