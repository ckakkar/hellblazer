import { createClient } from "@/lib/supabase/server";

export type NotificationState = {
  reminderHour: number | null;
  deviceCount: number;
};

/** The user's reminder schedule + how many devices they've enabled push on. */
export async function getNotificationState(): Promise<NotificationState> {
  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profile").select("reminder_hour").maybeSingle(),
    supabase
      .from("push_subscription")
      .select("id", { count: "exact", head: true }),
  ]);
  return {
    reminderHour: profile?.reminder_hour ?? null,
    deviceCount: count ?? 0,
  };
}
