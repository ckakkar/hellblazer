"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { pushConfigured, sendPush } from "@/lib/push";

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

/** Fire a test notification to every device the user has registered. */
export async function sendTestPush(): Promise<TestPushResult> {
  if (!pushConfigured()) return { ok: false, error: "not_configured" };
  const { supabase, user } = await getAuthedContext();
  const { data: subs } = await supabase
    .from("push_subscription")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  if (!subs || subs.length === 0) {
    return { ok: false, error: "no_subscription" };
  }

  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, {
      title: "Hell Blazer",
      body: "Push is live. Time to make your numbers climb.",
      url: "/dashboard",
      tag: "test",
    });
    if (r.ok) sent++;
    else if (r.gone)
      await supabase
        .from("push_subscription")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", s.endpoint);
  }
  return sent > 0 ? { ok: true, sent } : { ok: false, error: "send_failed" };
}
