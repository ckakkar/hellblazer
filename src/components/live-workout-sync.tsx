"use client";

import { useEffect } from "react";
import { setLiveWorkout } from "@/lib/live-workout";

/** Hands the server's answer to "is a workout under way?" to the nav. */
export function LiveWorkoutSync({ sessionId }: { sessionId: string | null }) {
  useEffect(() => {
    setLiveWorkout(sessionId);
  }, [sessionId]);
  return null;
}
