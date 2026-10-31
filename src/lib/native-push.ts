import type { PluginListenerHandle } from "@capacitor/core";
import { deviceName } from "@/lib/device";
import { registerApnsDevice, unregisterApnsDevice } from "@/lib/actions/push";

// iOS app only: notifications through Apple Push Notification service. The
// website and PWA use Web Push instead (settings/notifications-manager.tsx).

const TOKEN_KEY = "hell-blazer:apns-token";

function storedToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the server copy is what counts.
  }
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Registers with APNs and resolves with this phone's device token. */
async function deviceToken(): Promise<string> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const handles: PluginListenerHandle[] = [];
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("APNs registration timed out")), 15_000);
      void PushNotifications.addListener("registration", (t) => {
        clearTimeout(timer);
        // Capacitor spells it in capitals; the server keeps lower case.
        resolve(t.value.toLowerCase());
      }).then((h) => handles.push(h));
      void PushNotifications.addListener("registrationError", (e) => {
        clearTimeout(timer);
        reject(new Error(e.error));
      }).then((h) => handles.push(h));
      void PushNotifications.register();
    });
  } finally {
    // Only our own listeners: the tap handler in NativeBridge must survive.
    for (const h of handles) void h.remove();
  }
}

/*
 * Two things ride on one APNs token. Widgets refresh by silent push, which
 * iOS delivers without asking, so every signed-in phone registers its token
 * whether or not it allows alerts. Reminders and the recap are alerts: only
 * when the lifter turned notifications on here and iOS allows them
 * (`alerts` on the server's copy).
 */
const ALERTS_KEY = "hell-blazer:apns-alerts";

function alertsWanted(): boolean {
  try {
    const stored = window.localStorage.getItem(ALERTS_KEY);
    if (stored !== null) return stored === "1";
    // Builds before 2.8 kept a token only while notifications were on. Read
    // once and written down: from here every registration stores a token,
    // alerts or not, so a token alone is no longer consent.
    const legacy = storedToken() !== null;
    setAlertsWanted(legacy);
    return legacy;
  } catch {
    return false;
  }
}

function setAlertsWanted(on: boolean) {
  try {
    window.localStorage.setItem(ALERTS_KEY, on ? "1" : "0");
  } catch {
    // Storage blocked: the server copy is what counts.
  }
}

async function alertsAllowed(): Promise<boolean> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return (await PushNotifications.checkPermissions()).receive === "granted";
}

/*
 * Registrations run one at a time, in the order they were asked for, and
 * each decides "alerts on?" only once it has the token, right before it
 * writes. A launch's refresh still waiting on APNs can't then land after
 * "Enable notifications" with the answer it had before the tap.
 */
let queue: Promise<unknown> = Promise.resolve();

function serially<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

/** Saves this phone's token with the account; `alerts` is asked at the moment of writing. */
async function register(alerts: () => boolean | Promise<boolean>): Promise<void> {
  const token = await deviceToken();
  await registerApnsDevice({ token, timezone: timezone(), alerts: await alerts() });
  storeToken(token);
}

/** Whether notifications are on for this phone: asked for here, and allowed by iOS. */
export async function nativePushEnabled(): Promise<boolean> {
  return alertsWanted() && (await alertsAllowed());
}

/** Asks iOS for permission and turns this phone's alerts on. Returns a message on failure. */
export async function enableNativePush(): Promise<string | null> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    return "Notifications are off for Fatty. Turn them on in iOS Settings → Notifications → Fatty.";
  }
  try {
    await serially(async () => {
      await register(() => true);
      setAlertsWanted(true);
    });
    return null;
  } catch {
    return `Couldn't register this ${deviceName()} for notifications. Try again.`;
  }
}

/**
 * On sign-out: this phone leaves the account entirely (its token goes, so
 * neither alerts nor widget pushes arrive), and the next account starts
 * with alerts off. iOS's permission stays, so turning them on is one tap.
 */
export async function forgetNativePush(): Promise<void> {
  await serially(async () => {
    setAlertsWanted(false);
    const token = storedToken();
    if (!token) return;
    // Off the server first, with one more try. Only then is the token let
    // go: if both fail, it's kept, so the next sign-in here claims the
    // phone for that account (alerts off) instead of leaving it on this one.
    await unregisterApnsDevice({ token }).catch(() => unregisterApnsDevice({ token }));
    storeToken(null);
  });
}

/**
 * Alerts off. The phone stays registered, so its widgets keep refreshing.
 * Off here only once the server has it; a failure throws, and the switch
 * stays on.
 */
export async function disableNativePush(): Promise<void> {
  await serially(async () => {
    await register(() => false);
    setAlertsWanted(false);
  });
}

/** This phone's APNs token, once it has registered: the test notification goes to it alone. */
export function thisPhoneToken(): string | null {
  return storedToken();
}

/**
 * On each launch, signed in: register again, since APNs can rotate a
 * phone's token, and refresh the server's copy (its timezone, and whether
 * alerts are on, which iOS Settings may have changed since).
 */
export async function refreshNativePush(): Promise<void> {
  await serially(() => register(async () => alertsWanted() && (await alertsAllowed())));
}
