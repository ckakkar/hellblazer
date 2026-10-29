import { getAllQueuedSets, removeQueuedSet, type PendingSetWrite } from "@/lib/offline-set-queue";
import { replaySet } from "@/lib/actions/sessions";
import { reportProblem } from "@/lib/report";

/**
 * The device's outbox: sets logged with no signal wait in IndexedDB
 * (offline-set-queue.ts). The logger uploads its own workout's as soon as it
 * can; this uploads the rest from anywhere in the app, so a set doesn't sit
 * on the phone because the lifter left that workout's page. Only the signed-in
 * account's writes are sent (and RLS would refuse another's anyway). A write
 * the server refuses for good (its workout deleted since) is let go; anything
 * else stays for the next try.
 */

export type OutboxState = {
  /** Writes waiting, outside the workout open on screen. */
  waiting: number;
  sending: boolean;
};

let state: OutboxState = { waiting: 0, sending: false };
const listeners = new Set<() => void>();
const publish = (next: OutboxState) => {
  state = next;
  listeners.forEach((l) => l());
};

export const subscribeOutbox = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getOutbox = () => state;
const EMPTY: OutboxState = { waiting: 0, sending: false };
export const getServerOutbox = () => EMPTY;

const mine = (w: PendingSetWrite, userId: string, openSession: string | null) =>
  (w.userId === undefined || w.userId === userId) && w.sessionId !== openSession;

let running = false;

/** Sends what's waiting. `openSession`: the workout on screen, whose logger sends its own. */
export async function drainOutbox(userId: string, openSession: string | null): Promise<void> {
  if (running) return;
  running = true;
  try {
    const waiting = (await getAllQueuedSets()).filter((w) => mine(w, userId, openSession));
    publish({ waiting: waiting.length, sending: waiting.length > 0 && navigator.onLine });
    if (waiting.length === 0 || !navigator.onLine) return;
    // Oldest first, so a set and the edit after it land in order.
    for (const w of waiting.toSorted((a, b) => a.updatedAt - b.updatedAt)) {
      const result = await replaySet({
        id: w.id,
        sessionExerciseId: w.sessionExerciseId,
        setNumber: Math.max(1, w.setNumber),
        weightKg: w.weightKg,
        reps: w.reps,
        rpe: w.rpe,
        isWarmup: w.isWarmup,
        kind: w.kind ?? null,
        loggedAt: w.loggedAt,
        deleted: w.deleted,
      }).catch(() => ({ ok: false as const, permanent: false }));
      if (!result.ok && result.permanent) reportProblem("outbox-dropped");
      if (result.ok || result.permanent) await removeQueuedSet(w.id, w.updatedAt).catch(() => undefined);
      else {
        reportProblem("outbox-stuck");
        break;
      } // Offline again, or the server's struggling: the next try picks up here.
    }
    const left = (await getAllQueuedSets()).filter((w) => mine(w, userId, openSession));
    publish({ waiting: left.length, sending: false });
  } catch {
    publish({ ...state, sending: false });
  } finally {
    running = false;
  }
}
