import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSub = { endpoint: string; p256dh: string; auth: string };

let configured = false;

/** True once VAPID keys are present; configures web-push lazily. */
export function pushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@hellblazer.app",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

/**
 * Send one push. `gone` signals a 404/410 (the subscription is dead and the
 * caller should delete it).
 */
export async function sendPush(
  sub: PushSub,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!pushConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    return { ok: false, gone: status === 404 || status === 410 };
  }
}
