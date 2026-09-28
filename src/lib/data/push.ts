import { createClient } from "@/lib/supabase/server";

export type NotificationState = {
  reminderHour: number | null;
  /** The Sunday recap push (src/lib/weekly-recap.ts); on by default. */
  weeklyRecap: boolean;
  deviceCount: number;
};

/** The user's reminder schedule + how many devices they've enabled push on. */
export async function getNotificationState(): Promise<NotificationState> {
  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profile").select("reminder_hour, weekly_recap").maybeSingle(),
    supabase
      .from("push_subscription")
      .select("id", { count: "exact", head: true }),
  ]);
  return {
    reminderHour: profile?.reminder_hour ?? null,
    weeklyRecap: profile?.weekly_recap ?? true,
    deviceCount: count ?? 0,
  };
}
