import { connect } from "node:http2";
import { APP_BUNDLE_ID, appleKey, signAppleJwt } from "@/lib/apple";
import type { PushPayload } from "@/lib/push";

// Server-only: pushes to the iOS app through Apple Push Notification service.
// TestFlight and App Store builds both use APNs' production endpoint.
const APNS_ORIGIN = "https://api.push.apple.com";

/** True once the Apple server key is configured. */
export function apnsConfigured(): boolean {
  return appleKey() !== null;
}

// APNs wants the provider token reused, and refreshed between 20 and 60 minutes.
let cached: { token: string; at: number } | null = null;

function providerToken(key: NonNullable<ReturnType<typeof appleKey>>) {
  if (cached && Date.now() - cached.at < 45 * 60_000) return cached.token;
  const token = signAppleJwt(key, { iss: key.teamId, iat: Math.floor(Date.now() / 1000) });
  cached = { token, at: Date.now() };
  return token;
}

/**
 * Sends one alert to one device. `gone` means APNs says the token is dead
 * (app deleted, or it belongs to another app) and the caller should forget it.
 */
export function sendApns(deviceToken: string, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      ...(payload.tag ? { "thread-id": payload.tag } : {}),
    },
    // Read by the app when the notification is tapped (NativeBridge).
    ...(payload.url ? { url: payload.url } : {}),
  });
  return deliver(deviceToken, body, "alert", "10");
}

/**
 * A silent push: nothing shows, the app gets a few seconds in the background
 * with `data` (AppDelegate's didReceiveRemoteNotification). Apple rations
 * these, so they're for things like refreshing widgets, not every set.
 */
export function sendApnsBackground(deviceToken: string, data: Record<string, string>) {
  return deliver(deviceToken, JSON.stringify({ aps: { "content-available": 1 }, ...data }), "background", "5");
}

function deliver(
  deviceToken: string,
  body: string,
  pushType: "alert" | "background",
  priority: "10" | "5",
): Promise<{ ok: boolean; gone: boolean }> {
  const key = appleKey();
  if (!key) return Promise.resolve({ ok: false, gone: false });

  return new Promise((resolve) => {
    const session = connect(APNS_ORIGIN);
    let settled = false;
    const finish = (result: { ok: boolean; gone: boolean }) => {
      if (settled) return;
      settled = true;
      session.close();
      resolve(result);
    };
    session.on("error", () => finish({ ok: false, gone: false }));

    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(key)}`,
      "apns-topic": APP_BUNDLE_ID,
      "apns-push-type": pushType,
      "apns-priority": priority,
      "content-type": "application/json",
    });
    req.setTimeout(10_000, () => {
      req.close();
      finish({ ok: false, gone: false });
    });

    let status = 0;
    let text = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      text += chunk;
    });
    req.on("end", () => {
      let reason = "";
      try {
        reason = (JSON.parse(text) as { reason?: string }).reason ?? "";
      } catch {
        // Success responses have no body.
      }
      finish({
        ok: status === 200,
        gone: status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic",
      });
    });
    req.on("error", () => finish({ ok: false, gone: false }));
    req.end(body);
  });
}
