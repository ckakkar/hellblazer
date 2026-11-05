"use client";

import { createContext, useContext } from "react";
import type { ActiveSession } from "@/lib/data/sessions";

/**
 * The workout under way, for the nav: the phone's start buttons turn into
 * Resume, and the desktop sidebar carries the workout itself (title, clock,
 * sets). The layout reads it with the rest of the page and hands it down
 * (LiveWorkoutProvider), so the nav is right from the first paint instead of
 * showing "Start workout" until the page wakes up. Null when nothing is
 * live, or only a session left open for hours.
 */
export type LiveWorkout = Pick<ActiveSession, "id" | "title" | "startedAt" | "workingSets">;

export const LiveWorkoutContext = createContext<LiveWorkout | null>(null);

/** The live workout in full, or null. */
export function useLiveSession(): LiveWorkout | null {
  return useContext(LiveWorkoutContext);
}

/** Just its id: enough for the controls that only need somewhere to go. */
export function useLiveWorkout(): string | null {
  return useLiveSession()?.id ?? null;
}
