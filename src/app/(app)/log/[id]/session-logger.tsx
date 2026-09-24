"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { format, parseISO } from "date-fns";
import { unstable_rethrow } from "next/navigation";
import {
  ArrowRight,
  Check,
  CloudOff,
  Flame,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Trash2,
  TriangleAlert,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Portal } from "@/components/ui/portal";
import { Input } from "@/components/ui/input";
import { ExercisePicker } from "@/components/exercise-picker";
import { CountUp } from "@/components/reactbits/count-up";
import { RestTimer } from "@/components/workout/rest-timer";
import { VictoryScreen } from "@/components/workout/victory-screen";
import SlideCommit from "@/components/reactbits/slide-commit";
import type { TierKey } from "@/lib/tiers";
import { cn, selectAllOnFocus } from "@/lib/utils";
import { pickHype, randomVictory } from "@/lib/hype";
import { haptic } from "@/lib/haptics";
import {
  fromDisplayWeight,
  toDisplayWeight,
  trimNum,
  type Unit,
} from "@/lib/units";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import type { Exercise } from "@/lib/data/exercises";
import type {
  ExercisePR,
  LastPerformance,
  SessionDetail,
} from "@/lib/data/sessions";
import {
  getQueuedSets,
  nextStamp,
  queueSet,
  removeQueuedSet,
  type PendingSetWrite,
} from "@/lib/offline-set-queue";
import {
  addSessionExercise,
  deleteSet,
  finishSession,
  removeSessionExercise,
  saveSet,
  swapSessionExercise,
  updateSessionMeta,
} from "@/lib/actions/sessions";

type LocalSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
};
type LocalExercise = {
  seId: string;
  exerciseId: string;
  name: string;
  primaryMuscle: Muscle;
  note: string | null;
  sets: LocalSet[];
};

// Running personal-best tracker per exercise. `hadHistory` gates the Removal
// callout to exercises with prior-session data, so a brand-new lift never fires.
type PrBest = { weight: number; est1rm: number; hadHistory: boolean };

/**
 * Live connectivity. useSyncExternalStore rather than state+effect so the
 * server render and hydration agree (assume online) and no setState happens
 * inside an effect.
 */
function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Elapsed milliseconds → clock string: M:SS, then "1h 05m" past an hour
 *  (seconds stop mattering, and H:MM:SS won't fit the readout on a small
 *  phone). */
/** Past this, the clock is measuring a session left open, not a workout. */
const STALE_CLOCK_MS = 6 * 60 * 60 * 1000;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}h ${mm}m` : `${m}:${ss}`;
}

export function SessionLogger({
  session,
  exerciseLibrary,
  lastPerformances,
  exercisePRs,
  unit,
  fighter,
}: {
  session: SessionDetail;
  exerciseLibrary: Exercise[];
  lastPerformances: Record<string, LastPerformance>;
  exercisePRs: Record<string, ExercisePR>;
  unit: Unit;
  /** The lifter's rank fighter, who stars in the finish screen. */
  fighter: TierKey;
}) {
  const [, startNav] = useTransition();
  const [finishing, setFinishing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [victory, setVictory] = useState<string | null>(null);
  const [activeSeId, setActiveSeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(
    session.duration_min ?? null,
  );
  // Live workout clock: ticks from when the session was started (created_at).
  const startedAt = new Date(session.created_at).getTime();
  const [elapsed, setElapsed] = useState(0);
  const elapsedMin = Math.max(1, Math.round(elapsed / 60000));
  // Reopening a finished session to fix it is not a workout in progress: no
  // live badge, no running clock, and saving keeps its logged duration. A
  // clock past STALE_CLOCK_MS is a session someone forgot to finish; it stops
  // reading as time trained and nothing is auto-recorded from it.
  const isEditing = session.finished_at != null;
  const clockLive = !isEditing && elapsed <= STALE_CLOCK_MS;
  const autoDuration = clockLive ? elapsedMin : null;
  const timeLabel = clockLive
    ? formatElapsed(elapsed)
    : duration
      ? `${duration} min`
      : "Not timed";
  // Exercises added mid-session via "Advance", bonus work, tagged in the queue.
  const [advanceIds, setAdvanceIds] = useState<Set<string>>(new Set());
  // Sets that broke a personal best this session, and the active Removal toast.
  const [prSets, setPrSets] = useState<Set<string>>(new Set());
  const [removal, setRemoval] = useState<{
    name: string;
    label: string;
    value: string;
  } | null>(null);
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A change that needs the server and couldn't reach it (add, swap, remove,
  // finish). Shown as a toast above the exercise sheet, since most of these
  // are triggered from inside it.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "last:" targets for movements added mid-session, which the page's
  // server-rendered lastPerformances never included.
  const [addedLast, setAddedLast] = useState<Record<string, LastPerformance>>(
    {},
  );
  const lastFor = (exerciseId: string): LastPerformance | undefined =>
    addedLast[exerciseId] ?? lastPerformances[exerciseId];
  const hype = pickHype(session.id);

  const [exercises, setExercises] = useState<LocalExercise[]>(() =>
    session.session_exercise.map((se) => ({
      seId: se.id,
      exerciseId: se.exercise_id,
      name: se.exercise?.name ?? "Exercise",
      primaryMuscle: se.exercise?.primary_muscle ?? "chest",
      note: se.note,
      sets: se.set.map((s) => ({
        id: s.id,
        weight: toDisplayWeight(s.weight_kg, unit),
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.is_warmup,
      })),
    })),
  );

  // Exercises are done in order. An exercise counts as "done" once it's been
  // ended; any exercise that already had logged sets (a resumed session) starts
  // done so you pick up where you left off.
  const [completed, setCompleted] = useState<Set<string>>(
    () =>
      new Set(
        session.session_exercise
          .filter((se) => se.set.length > 0)
          .map((se) => se.id),
      ),
  );

  // Prior all-time working-set bests per exercise, for the Removal PR callout.
  // Seeded from previous sessions (DB), then folded with any sets already logged
  // in this one so a resumed session won't re-fire on numbers you already hit.
  const prBest = useRef<Map<string, PrBest> | null>(null);
  if (prBest.current === null) {
    const m = new Map<string, PrBest>();
    for (const [exId, pr] of Object.entries(exercisePRs)) {
      m.set(exId, {
        weight: pr.bestWeightKg,
        est1rm: pr.bestEst1rm,
        hadHistory: pr.bestWeightKg > 0,
      });
    }
    for (const se of session.session_exercise) {
      for (const s of se.set) {
        if (s.is_warmup) continue;
        const w = Number(s.weight_kg ?? 0);
        const e = w * (1 + Number(s.reps ?? 0) / 30);
        const cur = m.get(se.exercise_id) ?? {
          weight: 0,
          est1rm: 0,
          hadHistory: false,
        };
        m.set(se.exercise_id, {
          weight: Math.max(cur.weight, w),
          est1rm: Math.max(cur.est1rm, e),
          hadHistory: cur.hadHistory,
        });
      }
    }
    prBest.current = m;
  }

  // Mirror of state for debounced saves to read the latest values.
  const ref = useRef(exercises);
  useEffect(() => {
    ref.current = exercises;
  }, [exercises]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSaves = useRef<Map<string, string>>(new Map());
  // Deleted sets whose delete the server hasn't confirmed: set id → its
  // session_exercise id. They're gone from the screen, so retries look here.
  const pendingDeletes = useRef<Map<string, string>>(new Map());

  // Save health. `failed` holds the ids of sets the server never accepted, so
  // they can be retried and, crucially, shown.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  // Remounts the finish slider after a failed finish, so it's ready again.
  const [slideKey, setSlideKey] = useState(0);
  const online = useOnline();
  const wasOffline = useRef(false);
  const failedRef = useRef(failed);
  useEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  const weightStep = unit === "lb" ? 5 : 2.5;

  const toQueuedWrite = useCallback(
    (seId: string, set: LocalSet, setNumber: number): PendingSetWrite => ({
      id: set.id,
      sessionId: session.id,
      sessionExerciseId: seId,
      setNumber,
      weightKg: fromDisplayWeight(
        Number.isFinite(set.weight ?? NaN) ? (set.weight as number) : 0,
        unit,
      ),
      reps: Number.isFinite(set.reps ?? NaN) ? (set.reps as number) : 0,
      rpe: set.rpe,
      isWarmup: set.isWarmup,
      updatedAt: nextStamp(),
    }),
    [session.id, unit],
  );

  const clearFailed = useCallback((setId: string) => {
    setFailed((prev) => {
      if (!prev.has(setId)) return prev;
      const next = new Set(prev);
      next.delete(setId);
      return next;
    });
  }, []);

  const persist = useCallback(
    (seId: string, set: LocalSet, setNumber: number) => {
      const write = toQueuedWrite(seId, set, setNumber);
      setInFlight((n) => n + 1);
      return queueSet(write)
        .catch(() => undefined)
        .then(() =>
          saveSet({
            id: write.id,
            sessionExerciseId: write.sessionExerciseId,
            setNumber: write.setNumber,
            weightKg: write.weightKg,
            reps: write.reps,
            rpe: write.rpe,
            isWarmup: write.isWarmup,
          }),
        )
        .then(async () => {
          // Only clears the copy this upload carried. A newer edit queued
          // meanwhile stays on the device until its own upload lands.
          await removeQueuedSet(set.id, write.updatedAt).catch(() => undefined);
          clearFailed(set.id);
        })
        .catch(() => {
          // Keep the device copy and expose the failed upload. The row can now
          // survive a reload, but the lifter still deserves honest sync status.
          setFailed((prev) => new Set(prev).add(set.id));
        })
        .finally(() => setInFlight((n) => Math.max(0, n - 1)));
    },
    [toQueuedWrite, clearFailed],
  );

  // Deletes go through the device queue too, as a tombstone, so a set removed
  // offline stays removed after a reload instead of reappearing from the
  // server's copy. Actions run in call order, so an earlier save of the same
  // set can't land after this.
  const persistDelete = useCallback(
    (seId: string, setId: string) => {
      const tombstone: PendingSetWrite = {
        id: setId,
        sessionId: session.id,
        sessionExerciseId: seId,
        setNumber: 0,
        weightKg: 0,
        reps: 0,
        rpe: null,
        isWarmup: false,
        updatedAt: nextStamp(),
        deleted: true,
      };
      pendingDeletes.current.set(setId, seId);
      setInFlight((n) => n + 1);
      return queueSet(tombstone)
        .catch(() => undefined)
        .then(() => deleteSet({ id: setId }))
        .then(async () => {
          await removeQueuedSet(setId, tombstone.updatedAt).catch(
            () => undefined,
          );
          pendingDeletes.current.delete(setId);
          clearFailed(setId);
        })
        .catch(() => {
          setFailed((prev) => new Set(prev).add(setId));
        })
        .finally(() => setInFlight((n) => Math.max(0, n - 1)));
    },
    [session.id, clearFailed],
  );

  // Restore device-local writes before the lifter touches the screen. Queued
  // values win over the older server snapshot, then replay automatically when
  // a connection is available. This is what makes closing an offline PWA safe.
  useEffect(() => {
    let cancelled = false;
    void getQueuedSets(session.id)
      .then((writes) => {
        if (cancelled || writes.length === 0) return;
        // A write whose exercise no longer exists has nothing to attach to:
        // drop it, rather than raise a "didn't save" warning no retry can clear.
        const known = new Set(ref.current.map((exercise) => exercise.seId));
        for (const write of writes) {
          if (!known.has(write.sessionExerciseId)) {
            void removeQueuedSet(write.id).catch(() => undefined);
          }
        }
        const live = writes.filter((write) => known.has(write.sessionExerciseId));
        if (live.length === 0) return;
        const upserts = live.filter((write) => !write.deleted);
        const deletes = live.filter((write) => write.deleted);
        const deletedIds = new Set(deletes.map((write) => write.id));

        const next = ref.current.map((exercise) => {
          const pending = upserts.filter(
            (write) => write.sessionExerciseId === exercise.seId,
          );
          const hasDeleted = exercise.sets.some((set) => deletedIds.has(set.id));
          if (pending.length === 0 && !hasDeleted) return exercise;

          const sets = exercise.sets.filter((set) => !deletedIds.has(set.id));
          for (const write of pending) {
            const restored: LocalSet = {
              id: write.id,
              weight: toDisplayWeight(write.weightKg, unit),
              reps: write.reps,
              rpe: write.rpe,
              isWarmup: write.isWarmup,
            };
            const existing = sets.findIndex((set) => set.id === write.id);
            if (existing >= 0) sets[existing] = restored;
            else {
              sets.splice(
                Math.min(write.setNumber - 1, sets.length),
                0,
                restored,
              );
            }
          }
          return { ...exercise, sets };
        });
        ref.current = next;
        setExercises(next);
        for (const write of deletes) {
          pendingDeletes.current.set(write.id, write.sessionExerciseId);
        }
        setFailed((prev) => {
          const restored = new Set(prev);
          live.forEach((write) => restored.add(write.id));
          return restored;
        });

        if (navigator.onLine) {
          for (const write of deletes) {
            void persistDelete(write.sessionExerciseId, write.id);
          }
          for (const write of upserts) {
            const exercise = next.find(
              (candidate) => candidate.seId === write.sessionExerciseId,
            );
            const set = exercise?.sets.find(
              (candidate) => candidate.id === write.id,
            );
            if (exercise && set) {
              void persist(exercise.seId, set, write.setNumber);
            }
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [persist, persistDelete, session.id, unit]);

  // Re-send every change that failed. Numbers are recomputed from current
  // positions, so a retry after a delete still writes the right set_number.
  const retryFailed = useCallback(() => {
    for (const setId of failedRef.current) {
      const deletedFrom = pendingDeletes.current.get(setId);
      if (deletedFrom) {
        void persistDelete(deletedFrom, setId);
        continue;
      }
      for (const ex of ref.current) {
        const idx = ex.sets.findIndex((s) => s.id === setId);
        if (idx >= 0) {
          void persist(ex.seId, ex.sets[idx], idx + 1);
          break;
        }
      }
    }
  }, [persist, persistDelete]);

  // Coming back from a dead connection is the common case (a gym basement),
  // so retry automatically rather than making them find the button.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      retryFailed();
    }
  }, [online, retryFailed]);

  // Flush debounced saves when the tab is hidden/closed/unmounted.
  useEffect(() => {
    const flush = () => {
      for (const [setId, seId] of pendingSaves.current) {
        const t = timers.current.get(setId);
        if (t) clearTimeout(t);
        const ex = ref.current.find((e) => e.seId === seId);
        const idx = ex?.sets.findIndex((s) => s.id === setId) ?? -1;
        if (ex && idx >= 0) void persist(seId, ex.sets[idx], idx + 1);
      }
      pendingSaves.current.clear();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  useEffect(
    () => () => {
      if (removalTimer.current) clearTimeout(removalTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  /**
   * Structural changes (adding, swapping or removing a movement, finishing)
   * need the server; only set values queue on the device. Say so up front
   * rather than failing after a network timeout.
   */
  function needsConnection(what: string): boolean {
    if (navigator.onLine) return false;
    showNotice(
      `You're offline. ${what} needs a connection. Sets you log still save on this device.`,
    );
    return true;
  }

  // Tick the workout clock once a second while the logger is open.
  useEffect(() => {
    if (isEditing) return;
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, isEditing]);

  // Evaluate a just-committed working set against the running PR. Fires the
  // Removal callout only when it beats the prior all-time best (heaviest load,
  // else best est. 1RM), and always folds the value into the running best so it
  // won't re-fire on equal or lighter follow-up sets.
  const checkPR = useCallback(
    (exerciseId: string, name: string, set: LocalSet) => {
      if (set.isWarmup) return;
      const reps = Number(set.reps ?? 0);
      const wDisp = Number(set.weight ?? 0);
      if (!(reps > 0) || !(wDisp > 0)) return;

      const wKg = fromDisplayWeight(wDisp, unit);
      const e1rm = wKg * (1 + reps / 30);
      const cur = prBest.current?.get(exerciseId) ?? {
        weight: 0,
        est1rm: 0,
        hadHistory: false,
      };

      let kind: "weight" | "e1rm" | null = null;
      if (cur.hadHistory) {
        if (wKg > cur.weight + 0.01) kind = "weight";
        else if (e1rm > cur.est1rm + 0.01) kind = "e1rm";
      }

      prBest.current?.set(exerciseId, {
        weight: Math.max(cur.weight, wKg),
        est1rm: Math.max(cur.est1rm, e1rm),
        hadHistory: cur.hadHistory,
      });

      if (!kind) return;
      setPrSets((prev) => new Set(prev).add(set.id));
      setRemoval(
        kind === "weight"
          ? { name, label: "New heaviest", value: `${trimNum(wDisp)} ${unit} × ${reps}` }
          : {
              name,
              label: "New best estimated 1RM",
              value: `${Math.round(toDisplayWeight(e1rm, unit))} ${unit}`,
            },
      );
      // A short buzz: the Taptic Engine in the iOS app, vibration on Android.
      haptic("record");
      if (removalTimer.current) clearTimeout(removalTimer.current);
      removalTimer.current = setTimeout(() => setRemoval(null), 2600);
    },
    [unit],
  );

  function scheduleSave(seId: string, setId: string) {
    const existing = timers.current.get(setId);
    if (existing) clearTimeout(existing);
    pendingSaves.current.set(setId, seId);
    timers.current.set(
      setId,
      setTimeout(() => {
        pendingSaves.current.delete(setId);
        const ex = ref.current.find((e) => e.seId === seId);
        if (!ex) return;
        const idx = ex.sets.findIndex((s) => s.id === setId);
        if (idx < 0) return;
        void persist(seId, ex.sets[idx], idx + 1);
        checkPR(ex.exerciseId, ex.name, ex.sets[idx]);
      }, 500),
    );
  }

  function updateSet(seId: string, setId: string, patch: Partial<LocalSet>) {
    const next = ref.current.map((ex) =>
      ex.seId !== seId
        ? ex
        : {
            ...ex,
            sets: ex.sets.map((s) =>
              s.id === setId ? { ...s, ...patch } : s,
            ),
          },
    );
    ref.current = next;
    setExercises(next);
    const exercise = next.find((ex) => ex.seId === seId);
    const setIndex = exercise?.sets.findIndex((set) => set.id === setId) ?? -1;
    if (exercise && setIndex >= 0) {
      void queueSet(
        toQueuedWrite(seId, exercise.sets[setIndex], setIndex + 1),
      ).catch(() => undefined);
    }
    scheduleSave(seId, setId);
  }

  function addSet(seId: string) {
    const ex = ref.current.find((e) => e.seId === seId);
    if (!ex) return;
    const prev = ex.sets[ex.sets.length - 1];
    const last = lastFor(ex.exerciseId)?.sets[ex.sets.length];
    const seed: LocalSet = {
      id: crypto.randomUUID(),
      weight: prev
        ? prev.weight
        : last
          ? toDisplayWeight(last.weight_kg, unit)
          : null,
      reps: prev ? prev.reps : (last?.reps ?? null),
      rpe: null,
      isWarmup: false,
    };
    const nextNumber = ex.sets.length + 1;
    // `ref.current` is also synced from an effect, which lands a commit behind.
    // Advance it here as well so two "+ set" taps inside the same frame can't
    // both read the old array and write two sets with the same set_number.
    const next = ref.current.map((e) =>
      e.seId === seId ? { ...e, sets: [...e.sets, seed] } : e,
    );
    ref.current = next;
    setExercises(next);
    setFlashId(seed.id);
    void persist(seId, seed, nextNumber);
  }

  function removeSet(seId: string, setId: string) {
    // Cancel any debounced save still queued for the row being deleted, so it
    // can't resurrect the set after the delete lands.
    const queued = timers.current.get(setId);
    if (queued) clearTimeout(queued);
    timers.current.delete(setId);
    pendingSaves.current.delete(setId);
    // A failed save of this row is moot now; the delete (below) tracks its own
    // failure, so the warning only stays up if the delete itself doesn't land.
    clearFailed(setId);
    void persistDelete(seId, setId);

    // Renumber the survivors. Computed out here, not inside the state updater:
    // updaters must be pure, and React may invoke them more than once per
    // commit: which would fire duplicate writes for every remaining set.
    const next = ref.current.map((ex) =>
      ex.seId === seId
        ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
        : ex,
    );
    ref.current = next;
    setExercises(next);
    const target = next.find((e) => e.seId === seId);
    target?.sets.forEach((s, i) => void persist(seId, s, i + 1));
  }

  function addExercise(exerciseId: string) {
    const meta = exerciseLibrary.find((e) => e.id === exerciseId);
    if (!meta) return;
    if (needsConnection("Adding a movement")) return;
    startNav(async () => {
      // Caught here: a throw inside a transition goes to the error boundary,
      // which would replace the whole logger mid-workout.
      let added: Awaited<ReturnType<typeof addSessionExercise>>;
      try {
        added = await addSessionExercise({ sessionId: session.id, exerciseId });
      } catch {
        showNotice(`Couldn't add ${meta.name}. Check your connection and try again.`);
        return;
      }
      const { id, lastPerformance } = added;
      if (lastPerformance) {
        setAddedLast((prev) => ({ ...prev, [exerciseId]: lastPerformance }));
      }
      const next = [
        ...ref.current,
        {
          seId: id,
          exerciseId,
          name: meta.name,
          primaryMuscle: meta.primary_muscle,
          note: null,
          sets: [],
        },
      ];
      ref.current = next;
      setExercises(next);
      // Mark it as bonus "Advance" work and jump straight into logging it.
      setAdvanceIds((prev) => new Set(prev).add(id));
      setActiveSeId(id);
    });
  }

  function removeExercise(seId: string) {
    if (needsConnection("Removing a movement")) return;
    const index = ref.current.findIndex((e) => e.seId === seId);
    const removed = ref.current[index];
    if (!removed) return;
    const wasCompleted = completed.has(seId);
    // Hold its pending saves: if the removal lands they'd be writing to a row
    // that's gone; if it fails they're re-armed below.
    const heldSaves = removed.sets
      .map((s) => s.id)
      .filter((id) => pendingSaves.current.has(id));
    for (const id of heldSaves) {
      const t = timers.current.get(id);
      if (t) clearTimeout(t);
      timers.current.delete(id);
      pendingSaves.current.delete(id);
    }

    const next = ref.current.filter((e) => e.seId !== seId);
    ref.current = next;
    setExercises(next);
    setCompleted((prev) => {
      const without = new Set(prev);
      without.delete(seId);
      return without;
    });
    setActiveSeId((cur) => (cur === seId ? null : cur));

    removeSessionExercise({ id: seId })
      .then(() => {
        // Its sets went with it (cascade), so their device copies and any
        // "didn't save" flags have nothing left to sync.
        for (const s of removed.sets) {
          void removeQueuedSet(s.id).catch(() => undefined);
          pendingDeletes.current.delete(s.id);
          clearFailed(s.id);
        }
      })
      .catch(() => {
        const restored = [...ref.current];
        restored.splice(Math.min(index, restored.length), 0, removed);
        ref.current = restored;
        setExercises(restored);
        if (wasCompleted) setCompleted((prev) => new Set(prev).add(seId));
        for (const id of heldSaves) scheduleSave(seId, id);
        showNotice(
          `Couldn't remove ${removed.name}, so it's back in the queue. Try again with a connection.`,
        );
      });
  }

  function swap(seId: string, newExerciseId: string) {
    const meta = exerciseLibrary.find((e) => e.id === newExerciseId);
    if (!meta) return;
    if (needsConnection("Swapping a movement")) return;
    const before = ref.current.find((e) => e.seId === seId);
    if (!before) return;
    const relabel = (exerciseId: string, name: string, primaryMuscle: Muscle) => {
      const next = ref.current.map((e) =>
        e.seId === seId ? { ...e, exerciseId, name, primaryMuscle } : e,
      );
      ref.current = next;
      setExercises(next);
    };

    relabel(newExerciseId, meta.name, meta.primary_muscle);
    swapSessionExercise({ sessionExerciseId: seId, newExerciseId }).catch(() => {
      // The server still has the old movement, and the logged sets belong to
      // it. Showing the new name would misattribute them.
      relabel(before.exerciseId, before.name, before.primaryMuscle);
      showNotice(
        `Couldn't swap to ${meta.name}. Your sets are still logged under ${before.name}.`,
      );
    });
  }

  function endExercise(seId: string) {
    setCompleted((prev) => new Set(prev).add(seId));
    setActiveSeId(null);
  }

  /** Returns whether finishing actually started (the slider resets if not). */
  function finish(force = false): boolean {
    // Finishing discards the page, so unsaved sets would be gone for good.
    // Retry once and make them confirm rather than losing work silently.
    if (!force && failed.size > 0) {
      retryFailed();
      setConfirmFinish(true);
      return false;
    }
    if (needsConnection("Finishing the session")) return false;
    setConfirmFinish(false);
    setFinishing(true);
    setVictory(isEditing ? "Saved" : randomVictory());
    setTimeout(() => {
      startNav(async () => {
        try {
          // Auto-record the live clock unless a duration was typed by hand.
          await finishSession({
            sessionId: session.id,
            durationMin: duration ?? autoDuration,
          });
        } catch (err) {
          // Success arrives as a redirect, which rejects this promise; let
          // the router have it. Anything else is a real failure.
          unstable_rethrow(err);
          setVictory(null);
          setFinishing(false);
          setSlideKey((k) => k + 1);
          showNotice(
            "Couldn't finish the session. Your sets are safe; try again in a moment.",
          );
        }
      });
    }, 1700);
    return true;
  }

  const totalSets = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => !s.isWarmup).length,
    0,
  );
  const totalForce = exercises.reduce(
    (n, e) =>
      n +
      e.sets
        .filter((s) => !s.isWarmup)
        .reduce(
          (m, s) => m + (Number(s.weight) || 0) * (Number(s.reps) || 0),
          0,
        ),
    0,
  );

  const currentIndex = exercises.findIndex((e) => !completed.has(e.seId));
  const active = exercises.find((e) => e.seId === activeSeId) ?? null;
  const doneCount = exercises.filter((e) => completed.has(e.seId)).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3">
          {isEditing ? (
            <span className="text-[13px] font-medium text-muted">Editing</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
              <span className="size-1.5 rounded-full bg-accent" />
              Live
            </span>
          )}
          <input
            type="date"
            defaultValue={session.date}
            aria-label="Session date"
            onBlur={(e) =>
              e.target.value &&
              updateSessionMeta({
                sessionId: session.id,
                date: e.target.value,
              }).catch(() => showNotice("Couldn't save the session date."))
            }
            className="tnum rounded-lg bg-transparent px-1 py-0.5 text-right text-[13px] text-muted [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-text/25"
          />
        </div>
        <input
          defaultValue={session.title ?? "Session"}
          aria-label="Session title"
          data-display
          onBlur={(e) =>
            updateSessionMeta({
              sessionId: session.id,
              title: e.target.value.trim() || null,
            }).catch(() => showNotice("Couldn't save the session title."))
          }
          className="font-display mt-1 w-full bg-transparent text-[2rem] leading-tight text-text focus:outline-none sm:text-[2.5rem]"
        />
        <p className="tnum mt-0.5 text-[13px] text-muted">
          {exercises.length > 0
            ? `${doneCount} of ${exercises.length} exercises done`
            : "No exercises yet"}
        </p>

        {/* Live readout: glanced at mid-set, not read, so three figures on one
            baseline. The clock is the only accent because it is the thing
            moving. */}
        <div className="mt-5 grid grid-cols-[1.3fr_0.8fr_1.1fr] divide-x divide-white/[0.06] rounded-2xl bg-surface py-4">
          <div className="min-w-0 px-3.5">
            <p className="text-[13px] text-muted">Volume</p>
            <p className="font-display mt-1.5 whitespace-nowrap text-[clamp(1.25rem,5.4vw,1.625rem)] leading-none text-text">
              {/* Animates only when it changes, which here means a set just
                  landed. The move is the information. */}
              <CountUp to={Math.round(totalForce)} animateOnMount={false} duration={0.7} separator="," />
              <span className="ml-1 text-[13px] font-normal text-muted">{unit}</span>
            </p>
          </div>
          <div className="min-w-0 px-3.5">
            <p className="text-[13px] text-muted">Sets</p>
            <p className="font-display mt-1.5 text-[clamp(1.25rem,5.4vw,1.625rem)] leading-none text-text">
              <CountUp to={totalSets} animateOnMount={false} duration={0.5} />
            </p>
          </div>
          <div className="min-w-0 px-3.5" title="Workout time" aria-label={`Time ${timeLabel}`}>
            <p className="text-[13px] text-muted">Time</p>
            <p
              className={cn(
                "font-display mt-1.5 whitespace-nowrap text-[clamp(1.25rem,5.4vw,1.625rem)] leading-none",
                clockLive ? "text-accent" : "text-text",
              )}
            >
              {timeLabel}
            </p>
          </div>
        </div>
        <p className="mt-3 px-1 text-[13px] text-muted">{hype}</p>
        {!isEditing && <RestTimer />}

        {/* Save health. Silence here used to mean "saved" and "lost" alike. */}
        {failed.size > 0 ? (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-danger/10 px-4 py-3"
          >
            <TriangleAlert className="size-4 shrink-0 text-danger" />
            <span className="min-w-0 flex-1 text-[13px] leading-5 text-text">
              <strong className="font-medium text-danger">
                {failed.size} {failed.size === 1 ? "change" : "changes"}{" "}
                didn&apos;t save.
              </strong>{" "}
              {online
                ? "Saved on this device. Retry the upload when you're ready."
                : "Saved on this device. They'll upload when you reconnect."}
            </span>
            <Button size="sm" variant="secondary" onClick={retryFailed} disabled={inFlight > 0 || !online}>
              {inFlight > 0 ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Retry
            </Button>
          </div>
        ) : !online ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-warn/10 px-4 py-3 text-[13px] text-warn">
            <CloudOff className="size-4 shrink-0" />
            Offline. Keep logging: sets save on this device.
          </div>
        ) : inFlight > 0 ? (
          <div className="mt-3 flex items-center gap-2 px-1 text-[13px] text-muted">
            <Loader2 className="size-3 animate-spin" />
            Saving
          </div>
        ) : null}
      </header>

      {/* The queue in three states. Done work and upcoming work are quiet
          grouped rows; only the exercise you're on is lifted out, with the
          one button that matters. */}
      {(() => {
        const rows = exercises.map((ex, i) => ({ ex, i }));
        const done = rows.filter(({ ex }) => completed.has(ex.seId));
        const current = currentIndex >= 0 ? rows[currentIndex] : null;
        const upcoming = rows.filter(
          ({ ex, i }) => !completed.has(ex.seId) && i !== currentIndex,
        );
        const addedTag = (seId: string) =>
          advanceIds.has(seId) ? <Badge variant="muted">Added</Badge> : null;

        return (
          <section className="space-y-3">
            {done.length > 0 && (
              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
                {done.map(({ ex }) => {
                  const workingSets = ex.sets.filter((s) => !s.isWarmup);
                  const hasPR = ex.sets.some((s) => prSets.has(s.id));
                  return (
                    <button
                      key={ex.seId}
                      onClick={() => setActiveSeId(ex.seId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
                    >
                      <Check className="size-4 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-medium text-text/75">{ex.name}</span>
                          {addedTag(ex.seId)}
                          {hasPR && (
                            <Badge variant="accent" className="gap-1">
                              <Zap className="size-3" />
                              PR
                            </Badge>
                          )}
                        </div>
                        <div className="tnum mt-0.5 truncate text-[13px] text-muted">
                          {workingSets.length > 0
                            ? workingSets
                                .map((s) => `${trimNum(Number(s.weight) || 0)}×${s.reps ?? 0}`)
                                .join(", ")
                            : "Skipped"}
                        </div>
                      </div>
                      <Pencil className="size-3.5 shrink-0 text-muted/60" />
                    </button>
                  );
                })}
              </div>
            )}

            {current && (() => {
              const { ex, i } = current;
              const last = lastFor(ex.exerciseId);
              return (
                <div className="rounded-2xl bg-surface p-5">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium text-text">Up now</span>
                    <span className="tnum text-muted">
                      {i + 1} of {exercises.length}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-text">
                      {ex.name}
                    </span>
                    {addedTag(ex.seId)}
                  </div>
                  <p className="tnum mt-1 text-[13px] text-muted">
                    {MUSCLE_LABEL[ex.primaryMuscle]}
                    {last &&
                      `. Last time (${format(parseISO(last.session_date), "d MMM")}): ${last.sets
                        .slice(0, 4)
                        .map((s) => `${trimNum(toDisplayWeight(s.weight_kg, unit))}×${s.reps}`)
                        .join(", ")}${last.sets.length > 4 ? "…" : ""}`}
                  </p>
                  {ex.note && <p className="mt-1 text-[13px] text-muted">{ex.note}</p>}
                  <Button variant="accent" size="lg" className="mt-4 w-full" onClick={() => setActiveSeId(ex.seId)}>
                    <Play className="size-4" />
                    {ex.sets.length > 0 ? "Continue exercise" : "Start exercise"}
                  </Button>
                </div>
              );
            })()}

            {upcoming.length > 0 && (
              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
                {upcoming.map(({ ex, i }) => (
                  <div key={ex.seId} className="flex items-center gap-3 px-4 py-3">
                    <Lock className="size-3.5 shrink-0 text-muted/60" />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-muted">{ex.name}</span>
                    {addedTag(ex.seId)}
                    <span className="tnum shrink-0 text-[13px] text-muted/60">{i + 1}</span>
                  </div>
                ))}
              </div>
            )}

            {exercises.length === 0 && (
              <div className="rounded-2xl bg-surface px-6 py-10 text-center text-[15px] text-muted">
                No exercises yet. Add your first one below.
              </div>
            )}

            {/* Bonus work for this session only; the program is untouched. */}
            <button
              onClick={() => setPicker(true)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text">
                <Plus className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-text">Add exercise</span>
                <span className="block text-[13px] text-muted">This session only. Your program stays as it is.</span>
              </span>
            </button>
          </section>
        );
      })()}

      {/* Finish */}
      <section className="mt-10 rounded-2xl bg-surface p-4">
        <label className="flex items-center justify-between gap-3 px-1 pb-4 text-[15px] text-text">
          Duration
          <span className="flex items-center gap-2">
            <input
              type="number"
              onFocus={selectAllOnFocus}
              inputMode="numeric"
              value={duration ?? ""}
              onChange={(e) => setDuration(e.target.value === "" ? null : Number(e.target.value))}
              placeholder={autoDuration != null ? String(autoDuration) : "–"}
              title={
                autoDuration != null
                  ? "Tracked from the workout clock. Type to override."
                  : "How long the session took, in minutes."
              }
              className="tnum h-9 w-20 rounded-lg bg-surface-2 px-2 text-center text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-text/25"
            />
            <span className="text-[13px] text-muted">min</span>
          </span>
        </label>
        {/* `() => finish()` deliberately, not `onClick={finish}`: the latter
            hands the click event in as `force` and skips the unsaved guard. */}
        {confirmFinish ? (
          <div className="flex w-full flex-col gap-3">
            <p className="px-1 text-[13px] text-danger">
              {failed.size} {failed.size === 1 ? "change is" : "changes are"}{" "}
              still unsaved. Finishing now loses{" "}
              {failed.size === 1 ? "it" : "them"}.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmFinish(false)}
                className="flex-1"
              >
                Keep logging
              </Button>
              <Button
                variant="danger"
                onClick={() => finish(true)}
                disabled={finishing}
                className="flex-1"
              >
                Finish anyway
              </Button>
            </div>
          </div>
        ) : isEditing ? (
          <Button
            onClick={() => finish()}
            disabled={finishing}
            size="lg"
            className="w-full"
          >
            {finishing ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
            Save session
          </Button>
        ) : (
          // A slide, not a tap: finishing ends the workout, and a stray tap
          // mid-set shouldn't. It resets if finishing can't go ahead.
          <SlideCommit
            key={slideKey}
            label="Slide to finish"
            doneLabel="Finished"
            errorLabel="Not finished"
            successTextColor="#000000"
            height={56}
            holdMs={0}
            disabled={finishing}
            onConfirm={() => {
              if (!finish()) throw new Error("Finish didn't start");
            }}
          />
        )}
      </section>

      {/* Add-exercise picker (appends to the queue) */}
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exercises={exerciseLibrary}
        onPick={addExercise}
      />

      {/* Active-exercise logging modal */}
      {active && (
        <ActiveExerciseModal
          key={active.seId}
          exercise={active}
          exerciseLibrary={exerciseLibrary}
          lastPerformance={lastFor(active.exerciseId) ?? null}
          unit={unit}
          weightStep={weightStep}
          flashId={flashId}
          prSets={prSets}
          onClose={() => setActiveSeId(null)}
          onEnd={() => endExercise(active.seId)}
          onAddSet={() => addSet(active.seId)}
          onUpdateSet={(setId, patch) => updateSet(active.seId, setId, patch)}
          onRemoveSet={(setId) => removeSet(active.seId, setId)}
          onSwap={(newId) => swap(active.seId, newId)}
          onRemoveExercise={() => removeExercise(active.seId)}
        />
      )}

      {/* Toasts above the exercise sheet: a sync notice, and the REMOVAL
          callout when a PR breaks. Stacked so both can show at once. */}
      {(notice || removal) && (
        <Portal>
          {/* A PR rings the screen once in the accent: the record is the
              one thing worth interrupting a set for. */}
          {removal && (
            <div
              key={removal.value + removal.name}
              aria-hidden
              className="hb-pr-edge pointer-events-none fixed inset-0 z-[54]"
            />
          )}
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[55] flex flex-col items-center gap-2 px-4">
            {notice && (
              <div
                role="alert"
                className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-[rgb(28_28_31/0.96)] px-4 py-3 shadow-raised backdrop-blur"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                <p className="min-w-0 flex-1 text-xs leading-5 text-text">
                  {notice}
                </p>
                <button
                  onClick={() => setNotice(null)}
                  aria-label="Dismiss"
                  className="-mr-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-text"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            {removal && (
              <div role="status" aria-live="polite" className="w-full max-w-md">
                <div className="hb-pr-banner pointer-events-auto relative overflow-hidden rounded-2xl bg-[rgb(22_22_25/0.96)] py-3.5 pl-5 pr-4 shadow-raised backdrop-blur">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
                  <span
                    aria-hidden
                    className="hb-pr-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="hb-pr-word font-display text-[1.375rem] leading-none text-accent">Removal</span>
                    <span className="truncate text-[13px] text-muted">{removal.name}</span>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{removal.label}</p>
                  <p className="font-display mt-1 text-[1.75rem] leading-none text-text">{removal.value}</p>
                </div>
              </div>
            )}
          </div>
        </Portal>
      )}

      {victory && (
        <VictoryScreen
          word={victory}
          fighter={fighter}
          records={prSets.size}
          stats={[
            { label: "Volume", value: Math.round(totalForce).toLocaleString(), unit },
            { label: "Sets", value: String(totalSets) },
            { label: "Time", value: timeLabel },
          ]}
        />
      )}
    </div>
  );
}

function ActiveExerciseModal({
  exercise,
  exerciseLibrary,
  lastPerformance,
  unit,
  weightStep,
  flashId,
  prSets,
  onClose,
  onEnd,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onSwap,
  onRemoveExercise,
}: {
  exercise: LocalExercise;
  exerciseLibrary: Exercise[];
  lastPerformance: LastPerformance | null;
  unit: Unit;
  weightStep: number;
  flashId: string | null;
  prSets: Set<string>;
  onClose: () => void;
  onEnd: () => void;
  onAddSet: () => void;
  onUpdateSet: (setId: string, patch: Partial<LocalSet>) => void;
  onRemoveSet: (setId: string) => void;
  onSwap: (newExerciseId: string) => void;
  onRemoveExercise: () => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const [q, setQ] = useState("");
  const hasSets = exercise.sets.length > 0;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = exerciseLibrary.filter((e) => e.id !== exercise.exerciseId);
    if (!s) return base;
    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(s) ||
        MUSCLE_LABEL[e.primary_muscle].toLowerCase().includes(s) ||
        (e.equipment ?? "").toLowerCase().includes(s),
    );
  }, [q, exerciseLibrary, exercise.exerciseId]);

  return (
    <Sheet
      open
      onClose={onClose}
      title={swapping ? "Swap movement" : exercise.name}
      footer={
        swapping ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setSwapping(false)}
          >
            Cancel
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={onEnd}>
            <Check className="size-4" />
            {hasSets ? "End exercise" : "Skip exercise"}
            <ArrowRight className="size-4" />
          </Button>
        )
      }
    >
      {swapping ? (
        <div>
          <div className="sticky top-0 z-10 bg-[rgb(20_20_22)] px-4 pb-3 pt-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Swap for…"
                className="pl-9"
              />
            </div>
            <p className="mt-2 px-1 text-[13px] text-muted">
              Picks become this day’s new default going forward.
            </p>
          </div>
          <ul className="mx-4 mb-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.04]">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    onSwap(e.id);
                    setSwapping(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] text-text">{e.name}</div>
                    <div className="truncate text-[13px] text-muted">
                      {MUSCLE_LABEL[e.primary_muscle]}
                      {e.equipment ? `, ${e.equipment}` : ""}
                    </div>
                  </div>
                  {e.user_id && (
                    <span className="shrink-0 text-[13px] text-muted">Custom</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge variant="muted">{MUSCLE_LABEL[exercise.primaryMuscle]}</Badge>
            <button
              onClick={() => setSwapping(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[13px] text-text transition-colors active:bg-white/[0.1]"
            >
              <Repeat2 className="size-3.5" />
              Swap movement
            </button>
          </div>

          {lastPerformance && (
            <div className="tnum mb-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-muted">
              Last time ({format(parseISO(lastPerformance.session_date), "d MMM")}):{" "}
              {lastPerformance.sets
                .slice(0, 5)
                .map(
                  (s) =>
                    `${trimNum(toDisplayWeight(s.weight_kg, unit))}${unit}×${s.reps}`,
                )
                .join(", ")}
            </div>
          )}
          {exercise.note && (
            <div className="mb-3 text-[13px] text-muted">{exercise.note}</div>
          )}

          <div className="grid gap-2">
            {exercise.sets.map((s, i) => (
              <SetRow
                key={s.id}
                index={i}
                set={s}
                unit={unit}
                weightStep={weightStep}
                flash={s.id === flashId}
                isPR={prSets.has(s.id)}
                onChange={(patch) => onUpdateSet(s.id, patch)}
                onRemove={() => onRemoveSet(s.id)}
              />
            ))}

            <Button variant="secondary" size="lg" onClick={onAddSet} className="mt-1 w-full">
              <Plus className="size-4" />
              {exercise.sets.length === 0
                ? "Log first set"
                : "Add set"}
            </Button>
          </div>

          <button
            onClick={onRemoveExercise}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-danger"
          >
            <Trash2 className="size-3.5" />
            Remove from session
          </button>
        </div>
      )}
    </Sheet>
  );
}

function SetRow({
  index,
  set,
  unit,
  weightStep,
  flash,
  isPR,
  onChange,
  onRemove,
}: {
  index: number;
  set: LocalSet;
  unit: Unit;
  weightStep: number;
  flash?: boolean;
  isPR?: boolean;
  onChange: (patch: Partial<LocalSet>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        set.isWarmup ? "bg-warn/[0.07]" : isPR ? "bg-accent/[0.09]" : "bg-white/[0.04]",
        flash && "hb-landed",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 tnum text-[13px] text-muted">
          {set.isWarmup ? "Warm-up" : `Set ${index + 1}`}
          {isPR && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-black">
              <Zap className="size-2.5" />
              PR
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            RPE
            <input
              type="number"
              onFocus={selectAllOnFocus}
              inputMode="decimal"
              step={0.5}
              min={0}
              max={10}
              value={set.rpe ?? ""}
              onChange={(e) =>
                onChange({
                  rpe: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="tnum h-9 w-12 rounded-lg bg-white/[0.06] px-1 text-center text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-text/25"
            />
          </label>
          <button
            aria-label="Toggle warm-up"
            onClick={() => onChange({ isWarmup: !set.isWarmup })}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              set.isWarmup ? "bg-warn/15 text-warn" : "bg-white/[0.06] text-muted hover:text-text",
            )}
          >
            <Flame className="size-4" />
          </button>
          <button
            aria-label="Delete set"
            onClick={onRemove}
            className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-muted transition-colors hover:text-danger"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 tnum text-[12px] text-muted">
            Weight ({unit})
          </div>
          <NumberStepper
            ariaLabel="weight"
            value={set.weight}
            onChange={(v) => onChange({ weight: Number.isNaN(v) ? null : v })}
            step={weightStep}
            precision={2}
          />
        </div>
        <div>
          <div className="mb-1 tnum text-[12px] text-muted">
            Reps
          </div>
          <NumberStepper
            ariaLabel="reps"
            value={set.reps}
            onChange={(v) => onChange({ reps: Number.isNaN(v) ? null : v })}
            step={1}
            precision={0}
          />
        </div>
      </div>
    </div>
  );
}
