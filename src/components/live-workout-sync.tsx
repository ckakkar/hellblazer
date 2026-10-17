"use client";

import { useEffect } from "react";
import { setLiveWorkout, type LiveWorkout } from "@/lib/live-workout";

/** Hands the server's answer to "is a workout under way?" to the nav. */
export function LiveWorkoutSync({ session }: { session: LiveWorkout | null }) {
  const id = session?.id ?? null;
  const title = session?.title ?? null;
  const startedAt = session?.startedAt ?? null;
  const workingSets = session?.workingSets ?? 0;
  useEffect(() => {
    setLiveWorkout(id && startedAt ? { id, title, startedAt, workingSets } : null);
  }, [id, title, startedAt, workingSets]);
  return null;
}
