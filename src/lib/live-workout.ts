import { useSyncExternalStore } from "react";
import type { ActiveSession } from "@/lib/data/sessions";

/**
 * The workout under way, for the nav. The layout's streamed banner slot knows
 * it (see LiveWorkoutSync) but the nav renders before that lookup finishes, so
 * the slot publishes it here: the phone's start buttons turn into Resume, and
 * the desktop sidebar carries the workout itself (title, clock, sets).
 * Null when nothing is live, or only a session left open for hours.
 */
export type LiveWorkout = Pick<ActiveSession, "id" | "title" | "startedAt" | "workingSets">;

let live: LiveWorkout | null = null;
const listeners = new Set<() => void>();

const same = (a: LiveWorkout | null, b: LiveWorkout | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.id === b.id &&
    a.title === b.title &&
    a.startedAt === b.startedAt &&
    a.workingSets === b.workingSets);

export function setLiveWorkout(next: LiveWorkout | null) {
  if (same(next, live)) return;
  live = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The live workout in full, or null. */
export function useLiveSession(): LiveWorkout | null {
  return useSyncExternalStore(
    subscribe,
    () => live,
    () => null,
  );
}

/** Just its id: enough for the controls that only need somewhere to go. */
export function useLiveWorkout(): string | null {
  return useLiveSession()?.id ?? null;
}
