"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { pushConfigured, sendPush } from "@/lib/push";
import { isPushEndpoint } from "@/lib/push-endpoint";
import { apnsConfigured, sendApns } from "@/lib/apns";
import { isValidTimeZone } from "@/lib/local-date";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Store (or refresh) this browser's push subscription for the user. A browser
 * belongs to whoever saved it last, so its endpoint is taken off any other
 * account (signed out without cleaning up, say), as an iPhone's APNs token
 * moves in claim_apns_device; otherwise both accounts' reminders arrive here.
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone?: string | null;
  userAgent?: string | null;
}) {
  const v = z
    .object({
      // A real push service only: the server POSTs to this URL later.
      endpoint: z.string().url().max(1000).refine(isPushEndpoint, "Not a push service"),
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
      timezone: z.string().max(64).refine(isValidTimeZone, "Not a timezone").nullable().optional(),
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
  await createServiceClient()
    ?.from("push_subscription")
    .delete()
    .eq("endpoint", v.endpoint)
    .neq("user_id", user.id);
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
 * one phone, so it moves to whoever signed in there last. `alerts`: whether
 * reminders go to it too, or only the silent pushes that refresh its widgets.
 * Capacitor spells the token in capitals; it's kept in lower case. It runs
 * on every launch, and no page shows the devices, so nothing is revalidated.
 */
export async function registerApnsDevice(input: { token: string; timezone?: string | null; alerts?: boolean }) {
  const v = z
    .object({
      token: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64,200}$/),
      timezone: z.string().max(64).refine(isValidTimeZone, "Not a timezone").nullable().optional(),
      alerts: z.boolean().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.rpc("claim_apns_device", {
    p_token: v.token,
    p_timezone: v.timezone ?? undefined,
    p_alerts: v.alerts ?? true,
  });
  if (error) throw error;
}

/** Forget this iPhone's APNs token (notifications turned off in the app). */
export async function unregisterApnsDevice(input: { token: string }) {
  const v = z.object({ token: z.string().trim().toLowerCase().max(200) }).parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("apns_device")
    .delete()
    .eq("user_id", user.id)
    .eq("token", v.token);
  if (error) throw error;
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

/** The Sunday recap on or off. */
export async function setWeeklyRecap(input: { on: boolean }) {
  const v = z.object({ on: z.boolean() }).parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("profile")
    .upsert({ user_id: user.id, weekly_recap: v.on }, { onConflict: "user_id" });
  if (error) throw error;
  revalidatePath("/settings");
}

export type TestPushResult =
  | { ok: true; sent: number }
  | { ok: false; error: "not_configured" | "no_subscription" | "send_failed" };

/**
 * Fire a test notification. Given this device (the iPhone's APNs `token`, or
 * the browser's push `endpoint`), only to it, so success means this device
 * works; with neither, to every device the account has registered.
 */
export async function sendTestPush(input: { token?: string; endpoint?: string } = {}): Promise<TestPushResult> {
  const target = z
    .object({
      token: z.string().trim().toLowerCase().max(200).optional(),
      endpoint: z.string().max(1000).optional(),
    })
    .parse(input);
  const targeted = target.token !== undefined || target.endpoint !== undefined;
  const web = pushConfigured() && (!targeted || Boolean(target.endpoint));
  const ios = apnsConfigured() && (!targeted || Boolean(target.token));
  if (!pushConfigured() && !apnsConfigured()) return { ok: false, error: "not_configured" };
  const { supabase, user } = await getAuthedContext();
  const [{ data: subs }, { data: devices }] = await Promise.all([
    web
      ? (() => {
          const q = supabase.from("push_subscription").select("endpoint, p256dh, auth").eq("user_id", user.id);
          return target.endpoint ? q.eq("endpoint", target.endpoint) : q;
        })()
      : Promise.resolve({ data: [] as { endpoint: string; p256dh: string; auth: string }[] }),
    ios
      ? (() => {
          const q = supabase.from("apns_device").select("token").eq("user_id", user.id).eq("alerts", true);
          return target.token ? q.eq("token", target.token) : q;
        })()
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
