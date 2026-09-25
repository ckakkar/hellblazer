"use client";

import { useEffect } from "react";
import { withNative } from "@/lib/native-plugins";

/**
 * iOS app only. Keeps the workout Live Activity honest from outside the
 * logger: when the server says no session is in progress (finished,
 * discarded, deleted elsewhere), the activity and any pending "Rest's up"
 * alert go; when another session is the live one, the old activity goes.
 * The logger starts and updates the activity itself.
 */
export function WorkoutActivitySync({ activeSessionId }: { activeSessionId: string | null }) {
  useEffect(() => {
    withNative(async (api) => {
      await api.endWorkoutActivity(activeSessionId ? { except: activeSessionId } : {});
      if (!activeSessionId) await api.cancelRestAlert();
    });
  }, [activeSessionId]);
  return null;
}
