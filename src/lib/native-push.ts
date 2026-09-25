import type { PluginListenerHandle } from "@capacitor/core";
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

/** Whether notifications are on for this phone: permission granted and a token saved. */
export async function nativePushEnabled(): Promise<boolean> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const permission = await PushNotifications.checkPermissions();
  return permission.receive === "granted" && storedToken() !== null;
}

/** Asks iOS for permission and registers this phone. Returns a message on failure. */
export async function enableNativePush(): Promise<string | null> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    return "Notifications are off for Fatty. Turn them on in iOS Settings → Notifications → Fatty.";
  }
  try {
    const token = await deviceToken();
    await registerApnsDevice({ token, timezone: timezone() });
    storeToken(token);
    return null;
  } catch {
    return "Couldn't register this iPhone for notifications. Try again.";
  }
}

export async function disableNativePush(): Promise<void> {
  const token = storedToken();
  if (token) await unregisterApnsDevice({ token });
  storeToken(null);
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.unregister();
}

/**
 * On each launch with notifications on: re-register, since APNs can rotate
 * a phone's token, and refresh the server's copy (and its timezone).
 */
export async function refreshNativePush(): Promise<void> {
  if (!(await nativePushEnabled())) return;
  const token = await deviceToken();
  await registerApnsDevice({ token, timezone: timezone() });
  storeToken(token);
}
