import { isNativeApp } from "@/lib/native";

export type HealthAccess = "authorized" | "denied" | "notDetermined";
export type HealthStatus =
  | { available: false }
  | { available: true; workouts: HealthAccess; bodyweight: HealthAccess };

/** What the Home Screen and Lock Screen widgets draw (ios/App/Shared/WidgetSnapshot.swift). */
export type WidgetSnapshot = {
  nextBout: string | null;
  programName: string | null;
  sessionsThisWeek: number;
  sessionsPlanned: number | null;
  setsThisWeek: number;
  /** Monday of the week, yyyy-MM-dd. */
  weekStart: string;
  /** Epoch milliseconds. */
  updatedAt: number;
};

/** The app's own native plugin (ios/App/App/HellBlazerNativePlugin.swift). */
export interface HellBlazerNative {
  startRest(options: { endsAt: number; total: number; label?: string }): Promise<void>;
  stopRest(): Promise<void>;
  healthStatus(): Promise<HealthStatus>;
  requestHealth(): Promise<HealthStatus>;
  saveWorkout(options: { start: number; end: number; sessionId?: string }): Promise<{ saved: boolean }>;
  saveBodyweight(options: { kg: number; date: number }): Promise<{ saved: boolean }>;
  updateWidget(options: { json: string }): Promise<void>;
}

// Boxed: Capacitor's plugin proxy answers to any property, `then` included,
// so resolving a Promise with the bare proxy would call a native "then".
let loaded: Promise<{ api: HellBlazerNative }> | null = null;

/**
 * The native plugin, or null on the website. @capacitor/core is loaded on
 * first use and only inside the app.
 */
export function nativePlugin(): Promise<{ api: HellBlazerNative }> | null {
  if (!isNativeApp()) return null;
  loaded ??= import("@capacitor/core").then(({ registerPlugin }) => ({
    api: registerPlugin<HellBlazerNative>("HellBlazerNative"),
  }));
  return loaded;
}

/**
 * Fire and forget: runs `fn` with the plugin inside the app, does nothing on
 * the website, and never throws. For native extras the page doesn't depend on.
 */
export function withNative(fn: (api: HellBlazerNative) => Promise<unknown>) {
  const plugin = nativePlugin();
  if (!plugin) return;
  void plugin.then(({ api }) => fn(api)).catch(() => {});
}

const HEALTH_SYNC_KEY = "hell-blazer:health-sync";

/** Whether the lifter turned on Apple Health sync on this device. */
export function healthSyncOn(): boolean {
  try {
    return window.localStorage.getItem(HEALTH_SYNC_KEY) === "on";
  } catch {
    return false;
  }
}

export function setHealthSync(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HEALTH_SYNC_KEY, "on");
    else window.localStorage.removeItem(HEALTH_SYNC_KEY);
  } catch {
    // Storage blocked: sync just stays off.
  }
}
