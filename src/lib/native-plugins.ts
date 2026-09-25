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

/**
 * The workout in progress, for its Live Activity on the Lock Screen and in
 * the Dynamic Island (ios/App/Shared/WorkoutActivityAttributes.swift). The
 * logger sends the whole state on every change; times are epoch ms.
 */
export type WorkoutActivityState = {
  sessionId: string;
  startedAt: number;
  title: string;
  exercise?: string;
  /** A short line under the exercise, e.g. "3 sets done". */
  detail?: string;
  sets: number;
  /** Already formatted: "4,210 kg". */
  volume: string;
  restEndsAt?: number;
  /** Seconds. */
  restTotal?: number;
};

/** The app's own native plugin (ios/App/App/HellBlazerNativePlugin.swift). */
export interface HellBlazerNative {
  workoutActivity(state: WorkoutActivityState): Promise<void>;
  /** Ends the workout's Live Activity, or every one but `except`'s. */
  endWorkoutActivity(options?: { except?: string }): Promise<void>;
  scheduleRestAlert(options: { endsAt: number; label?: string }): Promise<void>;
  cancelRestAlert(): Promise<void>;
  healthStatus(): Promise<HealthStatus>;
  requestHealth(): Promise<HealthStatus>;
  saveWorkout(options: { start: number; end: number; sessionId?: string }): Promise<{ saved: boolean }>;
  saveBodyweight(options: { kg: number; date: number }): Promise<{ saved: boolean }>;
  updateWidget(options: { json: string }): Promise<void>;
  /** The iOS share sheet for a file; `data` is base64. */
  share(options: { fileName: string; data: string; text?: string }): Promise<{ completed: boolean }>;
  /** The page is interactive: lift the launch screen. */
  ready(): Promise<void>;
  /** The edge swipe back, on for pushed pages only. */
  setBackGesture(options: { enabled: boolean }): Promise<void>;
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

/** base64 of a Blob, for handing files to the native plugin. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * The iOS share sheet for a file the site built. Resolves false when not in
 * the app (the caller falls back to the web's own sharing), true otherwise,
 * whether or not the lifter went through with it.
 */
export async function shareNatively(blob: Blob, fileName: string, text?: string): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  const { api } = await plugin;
  await api.share({ fileName, data: await blobToBase64(blob), text });
  return true;
}
