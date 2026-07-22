"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowRight,
  Check,
  Flame,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Search,
  Swords,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
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
import type { LastPerformance, SessionDetail } from "@/lib/data/sessions";
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

export function SessionLogger({
  session,
  exerciseLibrary,
  lastPerformances,
  unit,
}: {
  session: SessionDetail;
  exerciseLibrary: Exercise[];
  lastPerformances: Record<string, LastPerformance>;
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

  // Mirror of state for debounced saves to read the latest values.
  const ref = useRef(exercises);
  useEffect(() => {
    ref.current = exercises;
  }, [exercises]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSaves = useRef<Map<string, string>>(new Map());

  const weightStep = unit === "lb" ? 5 : 2.5;

  const persist = useCallback(
    (seId: string, set: LocalSet, setNumber: number) => {
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
      }).catch(() => {});
    },
    [unit],
  );

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
    setExercises((p) =>
      p.map((e) => (e.seId === seId ? { ...e, sets: [...e.sets, seed] } : e)),
    );
    setFlashId(seed.id);
    void persist(seId, seed, nextNumber);
  }

  function removeSet(seId: string, setId: string) {
    void deleteSet({ id: setId }).catch(() => {});
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.seId !== seId) return ex;
        const sets = ex.sets.filter((s) => s.id !== setId);
        sets.forEach((s, i) => void persist(seId, s, i + 1));
        return { ...ex, sets };
      }),
    );
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
      // Jump straight into logging the new movement.
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

  function finish() {
    setFinishing(true);
    setVictory(randomVictory());
    setTimeout(() => {
      startNav(async () => {
        await finishSession({ sessionId: session.id, durationMin: duration });
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
      </div>

      {/* Exercise queue */}
      <div className="grid gap-3">
        {exercises.map((ex, i) => {
          const isDone = completed.has(ex.seId);
          const isCurrent = i === currentIndex;
          const isLocked = !isDone && !isCurrent;
          const workingSets = ex.sets.filter((s) => !s.isWarmup);
          const last = lastPerformances[ex.exerciseId];

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
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-base font-semibold text-text">
                    {ex.name}
                  </span>
                  <Badge variant="muted">{MUSCLE_LABEL[ex.primaryMuscle]}</Badge>
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

          // Locked — a later exercise you can't start yet.
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
            No exercises yet — add your first movement to begin.
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        onClick={() => setPicker(true)}
        className="mt-4 w-full"
      >
        <Swords className="size-4" />
        Add exercise
      </Button>

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
              placeholder="min"
              className="h-9 w-20 rounded-md border border-border bg-surface-2 px-2 text-center font-mono text-sm text-text focus:border-accent/60 focus:outline-none"
            />
          </label>
        </div>
        <Button
          onClick={finish}
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
          onClose={() => setActiveSeId(null)}
          onEnd={() => endExercise(active.seId)}
          onAddSet={() => addSet(active.seId)}
          onUpdateSet={(setId, patch) => updateSet(active.seId, setId, patch)}
          onRemoveSet={(setId) => removeSet(active.seId, setId)}
          onSwap={(newId) => swap(active.seId, newId)}
          onRemoveExercise={() => removeExercise(active.seId)}
        />
      )}

      {/* VICTORY slam */}
      {victory && (
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
              {Math.round(totalForce).toLocaleString()} {unit} moved · {totalSets}{" "}
              sets
            </div>
          </div>
        </div>
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
  onChange,
  onRemove,
}: {
  index: number;
  set: LocalSet;
  unit: Unit;
  weightStep: number;
  flash?: boolean;
  onChange: (patch: Partial<LocalSet>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        set.isWarmup
          ? "border-warn/30 bg-warn/[0.04]"
          : "border-border bg-surface-2/40",
        flash && "hb-hit",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-medium text-muted">
          {set.isWarmup ? "Warm-up" : `Set ${index + 1}`}
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
