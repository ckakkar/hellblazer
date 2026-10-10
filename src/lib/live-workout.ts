import { useSyncExternalStore } from "react";

/**
 * The workout under way, for the nav. The layout's streamed banner slot knows
 * it (see LiveWorkoutSync) but the nav renders before that lookup finishes, so
 * the slot publishes the id here and the nav's start buttons turn into Resume.
 * Null when nothing is live, or only a session left open for hours.
 */
let liveId: string | null = null;
const listeners = new Set<() => void>();

export function setLiveWorkout(id: string | null) {
  if (id === liveId) return;
  liveId = id;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveWorkout(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => liveId,
    () => null,
  );
}
