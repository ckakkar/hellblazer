"use client";

import { createContext, useContext, useEffect } from "react";
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

/**
 * The logger's own count of its workout's sets, against the layout's read it
 * was made beside (`base`). The logger saves sets straight to the database,
 * which the layout doesn't hear about, and moving between pages doesn't read
 * the layout again: the count it read on loading (the sidebar's, the resume
 * banner's) said "0 sets" with seven logged. The logger's count stands in
 * until the layout reads the workout again.
 */
export type LiveSetsReport = { id: string; sets: number; base: LiveWorkout | null };

export const LiveSetsContext = createContext<{
  base: LiveWorkout | null;
  report: (report: LiveSetsReport) => void;
}>({ base: null, report: () => {} });

/** The report in force, apart, so a new count doesn't re-render the logger that made it. */
export const LoggedSetsContext = createContext<LiveSetsReport | null>(null);

/** The live workout in full, or null. */
export function useLiveSession(): LiveWorkout | null {
  return useContext(LiveWorkoutContext);
}

/** Just its id: enough for the controls that only need somewhere to go. */
export function useLiveWorkout(): string | null {
  return useLiveSession()?.id ?? null;
}

/** For the logger: the working sets in the workout it has open. */
export function useReportLiveSets(id: string, sets: number) {
  const { base, report } = useContext(LiveSetsContext);
  useEffect(() => report({ id, sets, base }), [id, sets, base, report]);
}

/** A workout's working sets as this page knows them: the logger's count, else `server`'s. */
export function useLiveSetCount(id: string, server: number): number {
  const logged = useContext(LoggedSetsContext);
  return logged?.id === id ? logged.sets : server;
}
