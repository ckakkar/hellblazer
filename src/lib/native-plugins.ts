import { isNativeApp } from "@/lib/native";
import type { NextSet } from "@/lib/watch/next-set";
import type { LatestRecord } from "@/lib/widget-moments";

export type HealthAccess = "authorized" | "denied" | "notDetermined";
export type HealthStatus =
  | { available: false }
  | { available: true; workouts: HealthAccess; bodyweight: HealthAccess };

/** What the Home Screen and Lock Screen widgets draw (ios/App/Shared/WidgetSnapshot.swift). */
export type WidgetSnapshot = {
  nextBout: string | null;
  /** The next day's template, for the widget's Start button. */
  nextTemplateId?: string | null;
  programName: string | null;
  sessionsThisWeek: number;
  sessionsPlanned: number | null;
  setsThisWeek: number;
  /** Monday of the week, yyyy-MM-dd. */
  weekStart: string;
  /** Epoch milliseconds. */
  updatedAt: number;
  /** For Siri and Spotlight (see buildWidgetSnapshot). */
  unit?: "kg" | "lb";
  workouts?: { templateId: string; label: string }[];
  lifts?: { id: string; name: string; bestWeight: number; bestReps: number; estimatedMax: number }[];
  /** This week's sets per muscle, in the dashboard chart's order. */
  muscles?: { key: string; label: string; sets: number; weak: boolean }[];
  /** Estimated-max history (display unit) for the Lift Trend widget. */
  trends?: { id: string; name: string; points: { date: string; e1rm: number }[] }[];
  /** The lifter's rank fighter, for the Fighter widget; null when unranked. */
  fighter?: {
    key: string;
    name: string;
    epithet: string;
    rank: number;
    /** Ranks on the ladder. */
    of: number;
    /** The next rank's fighter, or null at the top. */
    next: string | null;
    /** The portrait's path on the site, e.g. "/art/fighters/julius.webp". */
    image: string;
  } | null;
  /** Weeks in a row with the plan hit, and the plan (workouts a week; null: one). */
  streak?: { weeks: number; planned: number | null };
  /** Days trained in the last 12 weeks (yyyy-MM-dd), for the Streak widget's calendar. */
  trainingDays?: string[];
  /** The latest new best estimated max, for the Last PR widget. */
  record?: LatestRecord | null;
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
  /** The set the Lock Screen's Log Set button logs, as it shows it. */
  next?: NextSet;
};

/**
 * A rest changed outside the page: the Live Activity's +30s and Skip
 * buttons, the "Rest's up" alert's +30s, or a set logged on the watch.
 * `endsAt` null means the rest was skipped. `alert` false: something else
 * (the watch) already says when it's over, so the phone stays quiet.
 */
export type RestCommand = {
  sessionId: string;
  endsAt: number | null;
  /** Seconds, for the progress bar. */
  total: number;
  alert: boolean;
};

/** The paired Apple Watch, as the iPhone app sees it. */
export type WatchStatus = {
  /** WatchConnectivity works here and a watch is paired. */
  paired: boolean;
  /** Fatty is installed on that watch. */
  installed: boolean;
  /** Whose token the watch holds, or null when not connected. */
  linkedUserId: string | null;
  /** The lifter turned the watch off in Settings. */
  disabled: boolean;
  /** Starting a workout on the phone opens it on the watch. */
  autoOpen: boolean;
};

/** What the watch needs from the phone (ios/App/App/WatchBridge.swift). */
export type WatchSettings = {
  /** A new token, only when the watch isn't linked to this lifter yet. */
  token?: string;
  userId: string;
  unit: "kg" | "lb";
  /** The accent's hex, e.g. "#df2d28". */
  accent: string;
  restSeconds: number;
  /** Tap when the heart rate's back down during a rest (on by default). */
  hrRest?: boolean;
  timeZone: string;
};

/**
 * One day of Apple Health readings for Recovery on Home, read on the phone
 * (ios/App/App/HealthExtras.swift). A night's sleep is dated by the morning
 * it ends. Every field but the date may be missing.
 */
export type RecoveryDay = {
  /** yyyy-MM-dd, the phone's calendar. */
  date: string;
  /** Minutes asleep the night before. */
  sleepMin?: number;
  /** Heart rate variability (SDNN), the day's average, ms. */
  hrv?: number;
  /** Resting heart rate, bpm. */
  rhr?: number;
};

/**
 * Whether Apple's on-device model can read sets here: "available", or why
 * not: an iPhone before the 15 Pro ("ineligible"), Apple Intelligence off,
 * the model still downloading, or iOS before 26 ("unsupported").
 */
export type SetReaderStatus = "available" | "ineligible" | "off" | "downloading" | "unsupported" | "unavailable";

/** What the plugin's events carry. */
export type NativeEvents = {
  /** A RestCommand is waiting (see takeRestCommand). */
  restCommand: Record<string, never>;
  /** Something outside the page (the watch, a set said to Siri) logged or finished. */
  watchChanged: Record<string, never>;
  /** Sets were taken back outside the page ("Undo my last set"): see takeRemovedSets. */
  setsRemoved: Record<string, never>;
  /** The Apple Watch's latest heart rate, every 5-15 seconds while it records. */
  heartRate: { bpm: number; sessionId: string };
};

/** The app's own native plugin (ios/App/App/HellBlazerNativePlugin.swift). */
export interface HellBlazerNative {
  workoutActivity(state: WorkoutActivityState): Promise<void>;
  /** Ends the workout's Live Activity, or every one but `except`'s. */
  endWorkoutActivity(options?: { except?: string }): Promise<void>;
  /** `sessionId` lets the alert's +30s and a tap find the workout. */
  scheduleRestAlert(options: { endsAt: number; label?: string; sessionId?: string }): Promise<void>;
  cancelRestAlert(): Promise<void>;
  healthStatus(): Promise<HealthStatus>;
  requestHealth(): Promise<HealthStatus>;
  /** `effort` (1-10, the session's average RPE) becomes its Effort rating (iOS 18). */
  saveWorkout(options: {
    start: number;
    end: number;
    sessionId?: string;
    effort?: number;
  }): Promise<{ saved: boolean }>;
  saveBodyweight(options: { kg: number; date: number }): Promise<{ saved: boolean }>;
  updateWidget(options: { json: string }): Promise<void>;
  /** The iOS share sheet for a file; `data` is base64. */
  share(options: { fileName: string; data: string; text?: string }): Promise<{ completed: boolean }>;
  /** The page is interactive: lift the launch screen. */
  ready(): Promise<void>;
  /** The edge swipe back, on for pushed pages only. */
  setBackGesture(options: { enabled: boolean }): Promise<void>;
  /** The latest rest change made outside the page for this session, once. */
  takeRestCommand(options: { sessionId: string }): Promise<Partial<RestCommand>>;
  watchStatus(): Promise<WatchStatus>;
  /** Hands the watch its settings, and a token when it needs one. */
  watchSync(options: WatchSettings): Promise<void>;
  /** Forgets the watch's token here and on the watch; returns it for revoking. */
  watchUnlink(options: { disable: boolean }): Promise<{ token: string | null }>;
  setWatchAutoOpen(options: { on: boolean }): Promise<void>;
  /** Whose device token this iPhone holds, for background widget refreshes. */
  phoneStatus(): Promise<{ linkedUserId?: string }>;
  /** Unit and timezone for those refreshes, and a token when it needs one. */
  phoneSync(options: { token?: string; userId: string; unit: "kg" | "lb"; timeZone: string }): Promise<void>;
  /** Forgets this iPhone's token; returns it for revoking. */
  phoneUnlink(): Promise<{ token: string | null }>;
  /** Keeps the screen from locking (a workout's open), or lets it lock again. */
  keepAwake(options: { on: boolean }): Promise<void>;
  /** The rest a set logged by voice starts, while the page is asleep. */
  setRestDefaults(options: { seconds: number; auto: boolean }): Promise<void>;
  /** Whether Health's permission sheet still has something to ask. */
  recoveryStatus(): Promise<{ available: boolean; shouldRequest: boolean }>;
  /** Four weeks of sleep, HRV and resting heart rate, oldest first. */
  recoveryData(): Promise<{ days: RecoveryDay[] }>;
  /** Sets taken back outside the page for this session, handed over once. */
  takeRemovedSets(options: { sessionId: string }): Promise<{ setIds: string[] }>;
  /** Tells Siri a workout day was started, so it can suggest it next time. */
  donateWorkoutStart(options: { sessionId: string; templateId: string; label: string }): Promise<void>;
  /** Whether finished workouts go to Apple Health, for one finished by voice. */
  setHealthSync(options: { on: boolean }): Promise<void>;
  /** Whether this iPhone can read sets said in words (Apple's on-device model). */
  setReaderStatus(): Promise<{ status: SetReaderStatus }>;
  /**
   * Sets typed or dictated in the lifter's words, as the on-device model
   * reads them (spoken-sets.ts parseHeard makes them safe). Rejects with
   * code "unavailable" or "failed".
   */
  readSets(options: { text: string; exercises: string[]; unit: "kg" | "lb" }): Promise<{ runs: unknown[] }>;
  addListener<E extends keyof NativeEvents>(
    event: E,
    listener: (data: NativeEvents[E]) => void,
  ): Promise<{ remove: () => Promise<void> }>;
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

/**
 * Listens for one of the plugin's events inside the app; does nothing on
 * the website. Returns the unsubscribe, safe to call before it's attached.
 */
export function onNative<E extends keyof NativeEvents>(
  event: E,
  listener: (data: NativeEvents[E]) => void,
): () => void {
  const plugin = nativePlugin();
  if (!plugin) return () => {};
  let handle: { remove: () => Promise<void> } | null = null;
  let cancelled = false;
  void plugin
    .then(({ api }) => api.addListener(event, listener))
    .then((h) => {
      if (cancelled) void h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    void handle?.remove().catch(() => {});
  };
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

let readerReady: Promise<boolean> | null = null;

/**
 * Whether the logger can offer "Say it": only in the app, on an iPhone that
 * runs Apple's on-device model (15 Pro or newer, iOS 26, Apple Intelligence
 * on). An app build from before it answers no. A yes is kept for the visit;
 * a no is asked again, since the model may have finished downloading.
 */
export function canReadSets(): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return Promise.resolve(false);
  if (readerReady) return readerReady;
  const asking = plugin
    .then(({ api }) => api.setReaderStatus())
    .then(({ status }) => status === "available")
    .catch(() => false);
  readerReady = asking;
  void asking.then((ok) => {
    if (!ok) readerReady = null;
  });
  return asking;
}
