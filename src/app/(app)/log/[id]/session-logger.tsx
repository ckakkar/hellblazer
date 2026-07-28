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
import {
  ArrowRight,
  Check,
  ChevronsUp,
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
  Timer,
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
import { cn } from "@/lib/utils";
import { pickHype, randomVictory } from "@/lib/hype";
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

/** Elapsed milliseconds → clock string (H:MM:SS past an hour, else M:SS). */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function SessionLogger({
  session,
  exerciseLibrary,
  lastPerformances,
  exercisePRs,
  unit,
}: {
  session: SessionDetail;
  exerciseLibrary: Exercise[];
  lastPerformances: Record<string, LastPerformance>;
  exercisePRs: Record<string, ExercisePR>;
  unit: Unit;
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
  // Exercises added mid-session via "Advance", bonus work, tagged in the queue.
  const [advanceIds, setAdvanceIds] = useState<Set<string>>(new Set());
  // Sets that broke a personal best this session, and the active Removal toast.
  const [prSets, setPrSets] = useState<Set<string>>(new Set());
  const [removal, setRemoval] = useState<{
    name: string;
    detail: string;
  } | null>(null);
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Save health. `failed` holds the ids of sets the server never accepted, so
  // they can be retried and, crucially, shown.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const online = useOnline();
  const wasOffline = useRef(false);
  const failedRef = useRef(failed);
  useEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  const weightStep = unit === "lb" ? 5 : 2.5;

  const persist = useCallback(
    (seId: string, set: LocalSet, setNumber: number) => {
      setInFlight((n) => n + 1);
      return saveSet({
        id: set.id,
        sessionExerciseId: seId,
        setNumber,
        weightKg: fromDisplayWeight(
          Number.isFinite(set.weight ?? NaN) ? (set.weight as number) : 0,
          unit,
        ),
        reps: Number.isFinite(set.reps ?? NaN) ? (set.reps as number) : 0,
        rpe: set.rpe,
        isWarmup: set.isWarmup,
      })
        .then(() => {
          setFailed((prev) => {
            if (!prev.has(set.id)) return prev;
            const next = new Set(prev);
            next.delete(set.id);
            return next;
          });
        })
        .catch(() => {
          // Never swallow this. A set that didn't reach the server is a set the
          // lifter will lose, and mid-workout they have no other way to tell.
          setFailed((prev) => new Set(prev).add(set.id));
        })
        .finally(() => setInFlight((n) => Math.max(0, n - 1)));
    },
    [unit],
  );

  // Re-send every set that failed. Numbers are recomputed from current
  // positions, so a retry after a delete still writes the right set_number.
  const retryFailed = useCallback(() => {
    for (const setId of failedRef.current) {
      for (const ex of ref.current) {
        const idx = ex.sets.findIndex((s) => s.id === setId);
        if (idx >= 0) {
          void persist(ex.seId, ex.sets[idx], idx + 1);
          break;
        }
      }
    }
  }, [persist]);

  // Last line of defence: warn before the tab closes while sets are still
  // unsaved. The pagehide flush covers the happy path, but if the write is
  // failing, leaving is what actually destroys the data.
  useEffect(() => {
    if (failed.size === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [failed]);

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
    },
    [],
  );

  // Tick the workout clock once a second while the logger is open.
  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

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
      const detail =
        kind === "weight"
          ? `New heaviest · ${trimNum(wDisp)}${unit} × ${reps}`
          : `New est. 1RM · ${Math.round(toDisplayWeight(e1rm, unit))}${unit}`;
      setRemoval({ name, detail });
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
    setExercises((prev) =>
      prev.map((ex) =>
        ex.seId !== seId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, ...patch } : s,
              ),
            },
      ),
    );
    scheduleSave(seId, setId);
  }

  function addSet(seId: string) {
    const ex = ref.current.find((e) => e.seId === seId);
    if (!ex) return;
    const prev = ex.sets[ex.sets.length - 1];
    const last = lastPerformances[ex.exerciseId]?.sets[ex.sets.length];
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
    void deleteSet({ id: setId }).catch(() => {});
    // Cancel any debounced save still queued for the row being deleted, so it
    // can't resurrect the set after the delete lands.
    const queued = timers.current.get(setId);
    if (queued) clearTimeout(queued);
    timers.current.delete(setId);
    pendingSaves.current.delete(setId);
    // Drop it from the failed list too, or a deleted row would keep the
    // "didn't save" warning up forever with nothing left to retry.
    setFailed((prev) => {
      if (!prev.has(setId)) return prev;
      const next = new Set(prev);
      next.delete(setId);
      return next;
    });

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
    startNav(async () => {
      const { id } = await addSessionExercise({
        sessionId: session.id,
        exerciseId,
      });
      setExercises((prev) => [
        ...prev,
        {
          seId: id,
          exerciseId,
          name: meta.name,
          primaryMuscle: meta.primary_muscle,
          note: null,
          sets: [],
        },
      ]);
      // Mark it as bonus "Advance" work and jump straight into logging it.
      setAdvanceIds((prev) => new Set(prev).add(id));
      setActiveSeId(id);
    });
  }

  function removeExercise(seId: string) {
    void removeSessionExercise({ id: seId }).catch(() => {});
    setExercises((prev) => prev.filter((e) => e.seId !== seId));
    setCompleted((prev) => {
      const next = new Set(prev);
      next.delete(seId);
      return next;
    });
    setActiveSeId((cur) => (cur === seId ? null : cur));
  }

  function swap(seId: string, newExerciseId: string) {
    const meta = exerciseLibrary.find((e) => e.id === newExerciseId);
    if (!meta) return;
    void swapSessionExercise({
      sessionExerciseId: seId,
      newExerciseId,
    }).catch(() => {});
    setExercises((prev) =>
      prev.map((e) =>
        e.seId === seId
          ? {
              ...e,
              exerciseId: newExerciseId,
              name: meta.name,
              primaryMuscle: meta.primary_muscle,
            }
          : e,
      ),
    );
  }

  function endExercise(seId: string) {
    setCompleted((prev) => new Set(prev).add(seId));
    setActiveSeId(null);
  }

  function finish(force = false) {
    // Finishing discards the page, so unsaved sets would be gone for good.
    // Retry once and make them confirm rather than losing work silently.
    if (!force && failed.size > 0) {
      retryFailed();
      setConfirmFinish(true);
      return;
    }
    setConfirmFinish(false);
    setFinishing(true);
    setVictory(randomVictory());
    setTimeout(() => {
      startNav(async () => {
        // Auto-record the live clock unless a duration was typed by hand.
        await finishSession({
          sessionId: session.id,
          durationMin: duration ?? elapsedMin,
        });
      });
    }, 1100);
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
  const allDone = exercises.length > 0 && currentIndex === -1;
  const active = exercises.find((e) => e.seId === activeSeId) ?? null;
  const doneCount = exercises.filter((e) => completed.has(e.seId)).length;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Session header */}
      <div className="mb-5">
        <input
          defaultValue={session.title ?? "Session"}
          aria-label="Session title"
          onBlur={(e) =>
            updateSessionMeta({
              sessionId: session.id,
              title: e.target.value.trim() || null,
            })
          }
          className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-text focus:outline-none"
        />
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <input
            type="date"
            defaultValue={session.date}
            aria-label="Session date"
            onBlur={(e) =>
              e.target.value &&
              updateSessionMeta({ sessionId: session.id, date: e.target.value })
            }
            className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-text focus:border-accent/60 focus:outline-none"
          />
          <span
            className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-accent"
            title="Workout time"
            aria-label={`Elapsed ${formatElapsed(elapsed)}`}
          >
            <Timer className="size-3.5" />
            {formatElapsed(elapsed)}
          </span>
          {exercises.length > 0 && (
            <span className="font-mono text-xs text-muted">
              {doneCount}/{exercises.length} exercises done
            </span>
          )}
        </div>

        {/* Live power HUD */}
        <div className="mt-3 flex items-stretch gap-3">
          <div className="flex-1 overflow-hidden rounded-lg border border-border bg-surface px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Total force
            </div>
            <div className="mt-0.5 font-impact text-[2rem] leading-none text-accent tabular-nums">
              {Math.round(totalForce).toLocaleString()}
              <span className="ml-1 text-base text-muted">{unit}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-right">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Sets
            </div>
            <div className="mt-0.5 font-impact text-[2rem] leading-none text-text tabular-nums">
              {totalSets}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-accent/70">
          {hype}
        </p>

        {/* Save health. Silence here used to mean "saved" and "lost" alike. */}
        {failed.size > 0 ? (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5"
          >
            <TriangleAlert className="size-4 shrink-0 text-danger" />
            <span className="min-w-0 flex-1 text-xs text-text">
              <strong className="font-medium text-danger">
                {failed.size} {failed.size === 1 ? "set" : "sets"} didn&apos;t
                save.
              </strong>{" "}
              {online
                ? "Your log is safe on this screen until you retry."
                : "You're offline. They'll go up automatically when you reconnect."}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={retryFailed}
              disabled={inFlight > 0 || !online}
            >
              {inFlight > 0 ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Retry
            </Button>
          </div>
        ) : !online ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
            <CloudOff className="size-3.5 shrink-0" />
            Offline. Keep logging, sets go up when you reconnect.
          </div>
        ) : inFlight > 0 ? (
          <div className="mt-3 flex items-center gap-2 px-1 font-mono text-[11px] text-muted">
            <Loader2 className="size-3 animate-spin" />
            Saving…
          </div>
        ) : null}
      </div>

      {/* Exercise queue */}
      <div className="grid gap-3">
        {exercises.map((ex, i) => {
          const isDone = completed.has(ex.seId);
          const isCurrent = i === currentIndex;
          const isLocked = !isDone && !isCurrent;
          const isAdvance = advanceIds.has(ex.seId);
          const hasPR = ex.sets.some((s) => prSets.has(s.id));
          const workingSets = ex.sets.filter((s) => !s.isWarmup);
          const last = lastPerformances[ex.exerciseId];
          const advanceBadge = isAdvance ? (
            <Badge variant="accent" className="gap-1">
              <ChevronsUp className="size-3" />
              Advance
            </Badge>
          ) : null;

          if (isDone) {
            return (
              <button
                key={ex.seId}
                onClick={() => setActiveSeId(ex.seId)}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-accent/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text">
                      {ex.name}
                    </span>
                    <Badge variant="muted">{MUSCLE_LABEL[ex.primaryMuscle]}</Badge>
                    {advanceBadge}
                    {hasPR && (
                      <Badge variant="accent" className="gap-1">
                        <Zap className="size-3" />
                        PR
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-muted">
                    {workingSets.length > 0
                      ? workingSets
                          .map(
                            (s) =>
                              `${trimNum(Number(s.weight) || 0)}×${s.reps ?? 0}`,
                          )
                          .join(" · ")
                      : "skipped"}
                  </div>
                </div>
                <Pencil className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          }

          if (isCurrent) {
            return (
              <div
                key={ex.seId}
                className="rounded-lg border border-accent/40 bg-accent/[0.04] p-4 shadow-glow"
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
                  Up next · {i + 1} of {exercises.length}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-text">
                    {ex.name}
                  </span>
                  <Badge variant="muted">{MUSCLE_LABEL[ex.primaryMuscle]}</Badge>
                  {advanceBadge}
                </div>
                {last && (
                  <div className="mt-1 font-mono text-xs text-muted">
                    last · {format(parseISO(last.session_date), "MMM d")}:{" "}
                    {last.sets
                      .slice(0, 4)
                      .map(
                        (s) =>
                          `${trimNum(toDisplayWeight(s.weight_kg, unit))}${unit}×${s.reps}`,
                      )
                      .join(", ")}
                    {last.sets.length > 4 ? " …" : ""}
                  </div>
                )}
                {ex.note && (
                  <div className="mt-1 text-xs text-muted">{ex.note}</div>
                )}
                <Button
                  size="lg"
                  className="mt-3 w-full"
                  onClick={() => setActiveSeId(ex.seId)}
                >
                  <Play className="size-4" />
                  {ex.sets.length > 0 ? "Continue exercise" : "Start exercise"}
                </Button>
              </div>
            );
          }

          // Locked: a later exercise you can't start yet.
          return (
            <div
              key={ex.seId}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-surface/50 p-4",
                isLocked && "opacity-55",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted">
                <Lock className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-text">{ex.name}</span>
                  <Badge variant="muted">{MUSCLE_LABEL[ex.primaryMuscle]}</Badge>
                  {advanceBadge}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  Finish the current exercise first
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted">
                {i + 1}
              </span>
            </div>
          );
        })}

        {exercises.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
            No exercises yet. Add your first movement to begin.
          </div>
        )}
      </div>

      {/* Advance: bonus movement beyond the program, this session only */}
      <button
        onClick={() => setPicker(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] px-4 py-3.5 text-left transition-colors hover:border-accent/60 hover:bg-accent/[0.07]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 text-accent">
          <ChevronsUp className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-text">
              Advance
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/70">
              前進
            </span>
          </div>
          <div className="text-xs text-muted">
            Add a movement beyond your program, this session only.
          </div>
        </div>
      </button>

      {/* Finish bar */}
      <div
        className={cn(
          "mt-8 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
          allDone ? "border-accent/40 bg-accent/[0.04]" : "border-border bg-surface",
        )}
      >
        <div className="flex items-center gap-3">
          {allDone && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <Check className="size-4" />
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-muted">
            Duration
            <input
              type="number"
              inputMode="numeric"
              value={duration ?? ""}
              onChange={(e) =>
                setDuration(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder={String(elapsedMin)}
              title="Auto-tracked from the workout clock, type to override"
              className="h-9 w-20 rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-sm text-text focus:border-accent/60 focus:outline-none"
            />
            <span className="text-xs text-muted/70">min</span>
          </label>
        </div>
        {/* `() => finish()` deliberately, not `onClick={finish}`: the latter
            hands the click event in as `force` and skips the unsaved guard. */}
        {confirmFinish ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <p className="text-xs text-danger sm:text-right">
              {failed.size} {failed.size === 1 ? "set is" : "sets are"} still
              unsaved. Finishing now loses {failed.size === 1 ? "it" : "them"}.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmFinish(false)}
                className="flex-1 sm:flex-none"
              >
                Keep logging
              </Button>
              <Button
                variant="danger"
                onClick={() => finish(true)}
                disabled={finishing}
                className="flex-1 sm:flex-none"
              >
                Finish anyway
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => finish()}
            disabled={finishing}
            size="lg"
            className="w-full sm:w-auto"
          >
            {finishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trophy className="size-4" />
            )}
            Claim victory
          </Button>
        )}
      </div>

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
          lastPerformance={lastPerformances[active.exerciseId] ?? null}
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

      {/* REMOVAL: a PR broke; brief limiter-release callout */}
      {removal && (
        <Portal>
          <div
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[55] flex justify-center px-4"
            role="status"
            aria-live="polite"
          >
            <div className="hb-slam pointer-events-auto flex items-center gap-3 rounded-xl border border-accent/40 bg-surface/95 px-4 py-2.5 shadow-glow backdrop-blur">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Zap className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-impact text-lg uppercase leading-none tracking-tight text-accent">
                    Removal
                  </span>
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    {removal.name}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-text">
                  {removal.detail}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* VICTORY slam */}
      {victory && (
        <Portal>
          <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-bg/95 px-6 backdrop-blur">
            <div
              aria-hidden
              className="hb-speedlines pointer-events-none absolute inset-0 opacity-70"
              style={{
                maskImage:
                  "radial-gradient(circle at 50% 45%, black, transparent 68%)",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 45%, black, transparent 68%)",
              }}
            />
            <div className="hb-slam relative text-center">
              <div
                aria-hidden
                className="font-display text-sm font-bold uppercase tracking-[0.4em] text-accent/70"
              >
                勝利
              </div>
              <div className="mt-2 font-impact text-6xl uppercase tracking-tight text-accent sm:text-8xl">
                {victory}
              </div>
              <div className="mt-4 font-mono text-sm text-muted">
                {Math.round(totalForce).toLocaleString()} {unit} moved ·{" "}
                {totalSets} sets · {formatElapsed(elapsed)}
              </div>
            </div>
          </div>
        </Portal>
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
          <div className="sticky top-0 z-10 border-b border-border bg-surface p-3">
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
            <p className="mt-2 px-0.5 text-xs text-muted">
              Picks become this day’s new default going forward.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    onSwap(e.id);
                    setSwapping(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">{e.name}</div>
                    <div className="truncate text-xs text-muted">
                      {MUSCLE_LABEL[e.primary_muscle]}
                      {e.equipment ? ` · ${e.equipment}` : ""}
                    </div>
                  </div>
                  {e.user_id && (
                    <span className="shrink-0 text-xs text-accent">custom</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge variant="muted">{MUSCLE_LABEL[exercise.primaryMuscle]}</Badge>
            <button
              onClick={() => setSwapping(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              <Repeat2 className="size-3.5" />
              Swap movement
            </button>
          </div>

          {lastPerformance && (
            <div className="mb-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2 font-mono text-xs text-muted">
              last · {format(parseISO(lastPerformance.session_date), "MMM d")}:{" "}
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
            <div className="mb-3 text-xs text-muted">{exercise.note}</div>
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

            <Button variant="outline" onClick={onAddSet} className="mt-1 w-full">
              <Plus className="size-4" />
              {exercise.sets.length === 0
                ? "Log first set"
                : "Next set · copy forward"}
            </Button>
          </div>

          <button
            onClick={onRemoveExercise}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-danger"
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
        "rounded-lg border p-2.5",
        set.isWarmup
          ? "border-warn/30 bg-warn/[0.04]"
          : isPR
            ? "border-accent/50 bg-accent/[0.05]"
            : "border-border bg-surface-2/40",
        flash && "hb-hit",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-muted">
          {set.isWarmup ? "Warm-up" : `Set ${index + 1}`}
          {isPR && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-bg">
              <Zap className="size-2.5" />
              PR
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-muted">
            RPE
            <input
              type="number"
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
              className="h-8 w-12 rounded-md border border-border bg-surface px-1 text-center font-mono text-sm text-text focus:border-accent/60 focus:outline-none"
            />
          </label>
          <button
            aria-label="Toggle warm-up"
            onClick={() => onChange({ isWarmup: !set.isWarmup })}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border transition-colors",
              set.isWarmup
                ? "border-warn/40 bg-warn/10 text-warn"
                : "border-border text-muted hover:text-text",
            )}
          >
            <Flame className="size-4" />
          </button>
          <button
            aria-label="Delete set"
            onClick={onRemove}
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:text-danger"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">
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
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">
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
