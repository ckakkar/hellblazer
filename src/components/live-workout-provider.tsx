"use client";

import { LiveWorkoutContext, type LiveWorkout } from "@/lib/live-workout";

/** Hands the layout's answer to "is a workout under way?" to the nav. */
export function LiveWorkoutProvider({ value, children }: { value: LiveWorkout | null; children: React.ReactNode }) {
  return <LiveWorkoutContext value={value}>{children}</LiveWorkoutContext>;
}
