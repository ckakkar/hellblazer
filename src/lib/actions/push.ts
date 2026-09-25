"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { pushConfigured, sendPush } from "@/lib/push";
import { apnsConfigured, sendApns } from "@/lib/apns";

/** Store (or refresh) this browser's push subscription for the user. */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone?: string | null;
  userAgent?: string | null;
}) {
  const v = z
    .object({
      endpoint: z.string().url().max(1000),
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
      timezone: z.string().max(64).nullable().optional(),
      userAgent: z.string().max(500).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("push_subscription").upsert(
    {
      user_id: user.id,
      endpoint: v.endpoint,
      p256dh: v.p256dh,
      auth: v.auth,
      timezone: v.timezone ?? null,
      user_agent: v.userAgent ?? null,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
  revalidatePath("/settings");
}

/** Remove this browser's subscription (on disable / unsubscribe). */
export async function deletePushSubscription(input: { endpoint: string }) {
  const v = z.object({ endpoint: z.string().max(1000) }).parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("push_subscription")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", v.endpoint);
  if (error) throw error;
  revalidatePath("/settings");
}

/**
 * Store this iPhone's APNs token for the signed-in user. A token belongs to
 * one phone, so it moves to whoever signed in there last.
 */
export async function registerApnsDevice(input: { token: string; timezone?: string | null }) {
  const v = z
    .object({
      token: z.string().regex(/^[0-9a-f]{64,200}$/),
      timezone: z.string().max(64).nullable().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.rpc("claim_apns_device", {
    p_token: v.token,
    p_timezone: v.timezone ?? undefined,
  });
  if (error) throw error;
  revalidatePath("/settings");
}

/** Forget this iPhone's APNs token (notifications turned off in the app). */
export async function unregisterApnsDevice(input: { token: string }) {
  const v = z.object({ token: z.string().max(200) }).parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("apns_device")
    .delete()
    .eq("user_id", user.id)
    .eq("token", v.token);
  if (error) throw error;
  revalidatePath("/settings");
}

/** Set the local hour (0-23) for the daily workout reminder; null = off. */
export async function setReminderHour(input: { hour: number | null }) {
  const v = z
    .object({ hour: z.number().int().min(0).max(23).nullable() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("profile")
    .upsert({ user_id: user.id, reminder_hour: v.hour }, { onConflict: "user_id" });
  if (error) throw error;
  revalidatePath("/settings");
}

export type TestPushResult =
  | { ok: true; sent: number }
  | { ok: false; error: "not_configured" | "no_subscription" | "send_failed" };

/**
 * Fire a test notification to every device the user has registered: browsers
 * and home-screen PWAs over Web Push, the iOS app over APNs.
 */
export async function sendTestPush(): Promise<TestPushResult> {
  const web = pushConfigured();
  const ios = apnsConfigured();
  if (!web && !ios) return { ok: false, error: "not_configured" };
  const { supabase, user } = await getAuthedContext();
  const [{ data: subs }, { data: devices }] = await Promise.all([
    web
      ? supabase.from("push_subscription").select("endpoint, p256dh, auth").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { endpoint: string; p256dh: string; auth: string }[] }),
    ios
      ? supabase.from("apns_device").select("token").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { token: string }[] }),
  ]);
  if ((subs?.length ?? 0) + (devices?.length ?? 0) === 0) {
    return { ok: false, error: "no_subscription" };
  }

  const payload = {
    title: "Fatty",
    body: "Push is live. Time to make your numbers climb.",
    url: "/dashboard",
    tag: "test",
  };
  let sent = 0;
  for (const s of subs ?? []) {
    const r = await sendPush(s, payload);
    if (r.ok) sent++;
    else if (r.gone)
      await supabase
        .from("push_subscription")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", s.endpoint);
  }
  for (const d of devices ?? []) {
    const r = await sendApns(d.token, payload);
    if (r.ok) sent++;
    else if (r.gone)
      await supabase.from("apns_device").delete().eq("user_id", user.id).eq("token", d.token);
  }
  return sent > 0 ? { ok: true, sent } : { ok: false, error: "send_failed" };
}
