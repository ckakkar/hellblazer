"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WATCHED_TABLES = [
  "session",
  "program",
  "program_day",
  "program_skip",
  "workout_template",
] as const;

/** Away for longer than this, the page refreshes when it comes back. */
const AWAY_MS = 60_000;

/**
 * Keeps server-rendered views live within a session. Subscribes to the user's
 * own row changes on a few tables and debounce-refreshes the current route.
 * The set-logger stays optimistic (its table isn't watched), so this never
 * interferes with mid-workout logging.
 */
export function RealtimeSync({ userId }: { userId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel("hb-live");
    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        refresh,
      );
    }
    channel.subscribe();

    // Changes made while the app was in the background (or the phone was
    // locked) never arrived: the socket was asleep. Coming back after a
    // while, refresh once, the way a native app shows fresh data on return.
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) {
        hiddenAt = 0;
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
