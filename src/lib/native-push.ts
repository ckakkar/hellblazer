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
        resolve(t.value);
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
    // Builds before 2.8 kept a token only while notifications were on.
    return stored === null ? storedToken() !== null : stored === "1";
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

/** Saves this phone's token with the account, alerts on or off. */
async function register(alerts: boolean): Promise<void> {
  const token = await deviceToken();
  await registerApnsDevice({ token, timezone: timezone(), alerts });
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
    await register(true);
    setAlertsWanted(true);
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
  const token = storedToken();
  storeToken(null);
  setAlertsWanted(false);
  if (token) await unregisterApnsDevice({ token });
}

/** Alerts off. The phone stays registered, so its widgets keep refreshing. */
export async function disableNativePush(): Promise<void> {
  setAlertsWanted(false);
  await register(false);
}

/**
 * On each launch, signed in: register again, since APNs can rotate a
 * phone's token, and refresh the server's copy (its timezone, and whether
 * alerts are on, which iOS Settings may have changed since).
 */
export async function refreshNativePush(): Promise<void> {
  await register(alertsWanted() && (await alertsAllowed()));
}
