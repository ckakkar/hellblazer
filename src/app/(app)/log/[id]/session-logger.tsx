"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import { format, parseISO } from "date-fns";
import { unstable_rethrow, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  CloudOff,
  Flame,
  Heart,
  Link2,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Trash2,
  TriangleAlert,
  Trophy,
  Unlink,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Badge } from "@/components/ui/badge";
import { useGlide } from "@/components/ui/use-glide";
import { Sheet } from "@/components/ui/sheet";
import { Collapse } from "@/components/ui/collapse";
import { getExerciseGuide } from "@/lib/exercise-guides";
import { Portal } from "@/components/ui/portal";
import { Input } from "@/components/ui/input";
import { TitleField } from "@/components/ui/title-field";
import { ExercisePicker } from "@/components/exercise-picker";
import { CountUp } from "@/components/reactbits/count-up";
import { RestTimerBar, RestTimerCard, useRestTimer, type RestTimerControls } from "@/components/workout/rest-timer";
import { SaySets } from "@/components/workout/say-sets";
import { VictoryScreen } from "@/components/workout/victory-screen";
import SlideCommit from "@/components/reactbits/slide-commit";
import type { TierKey } from "@/lib/tiers";
import { cn, fitFigure, selectAllOnFocus } from "@/lib/utils";
import { randomVictory } from "@/lib/hype";
import { coachLine, notebookSets } from "@/lib/coach";
import { isLogged, isStraight, isWork } from "@/lib/set-kinds";
import { matchesExercise } from "@/lib/exercise-search";
import { SessionDate } from "./session-date";
import { haptic } from "@/lib/haptics";
import { formatElapsed, STALE_CLOCK_MS } from "@/lib/workout-clock";
import { isNativeApp } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import { useKeepAwake } from "@/lib/keep-awake";
import { exerciseForNextSet, nextSetLabel, restsAfter, sameAgain, type PlanExercise } from "@/lib/watch/next-set";
import { slotLabel, supersetSlots, type SupersetSlot } from "@/lib/supersets";
import { nextTarget, targetLabel, targetReason, type Target } from "@/lib/progression";
import type { SpokenExercise, SpokenSet } from "@/lib/spoken-sets";
import { healthSyncOn, onNative, withNative, type WorkoutActivityState } from "@/lib/native-plugins";
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
  SessionTarget,
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
  discardSession,
  finishSession,
  getSessionSets,
  removeSessionExercise,
  saveSet,
  setSessionSuperset,
  swapSessionExercise,
  updateSessionMeta,
  setExerciseEnded,
} from "@/lib/actions/sessions";

type SetKind = "drop" | "rest_pause" | null;
type LocalSet = {
  id: string;
  weight: number | null;
  /** The weight as stored, in kg, for a set that came from the server (or
   *  the device queue, or the watch). Display weights are rounded to the
   *  plate step, so re-saving a set the lifter didn't touch (a renumber,
   *  say) keeps this rather than the rounded figure. */
  kg?: number;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
  /** A drop or rest-pause set; null for a plain one. */
  kind: SetKind;
  /** When it was first logged on this device (epoch ms), kept through edits
   *  and retries, so a set that only reaches the server later still says
   *  when it was done. Absent for one that came from the server. */
  loggedAt?: number;
};

/** A set as the shared rules count it (set-kinds.ts). */
const counted = (s: LocalSet) => ({ warmup: s.isWarmup, kind: s.kind, reps: s.reps });
/** Counts toward the workout's sets and volume: not a warm-up, not a draft. */
const work = (s: LocalSet) => isWork(counted(s));

type LocalExercise = {
  seId: string;
  exerciseId: string;
  name: string;
  primaryMuscle: Muscle;
  note: string | null;
  /** Its superset group (supersets.ts); null on its own. */
  superset: number | null;
  sets: LocalSet[];
};

/**
 * The kg to save for a set: what's stored, while the weight shown is still
 * that stored weight rounded; otherwise the weight shown, converted.
 */
function storedKg(set: LocalSet, unit: Unit): number {
  const shown = Number.isFinite(set.weight ?? NaN) ? (set.weight as number) : 0;
  if (set.kg != null && toDisplayWeight(set.kg, unit) === shown) return set.kg;
  return fromDisplayWeight(shown, unit);
}

// Running personal-best tracker per exercise. `hadHistory` gates the Removal
// callout to exercises with prior-session data, so a brand-new lift never fires.
type PrBest = { weight: number; est1rm: number; hadHistory: boolean };

/** The stat strip's figures: scale with the phone, and fit their column. */
const STAT_SIZE = "clamp(1.25rem, 5.4vw, 1.625rem)";

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

/**
 * The Apple Watch's heart rate while it records this session (iOS app).
 * It arrives every 5 to 15 seconds; a minute without one means the watch
 * stopped, and the reading goes.
 */
function useWatchHeartRate(sessionId: string, live: boolean): number | null {
  const [bpm, setBpm] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    let stale: number | undefined;
    const off = onNative("heartRate", (data) => {
      if (data.sessionId !== sessionId) return;
      setBpm(data.bpm);
      window.clearTimeout(stale);
      stale = window.setTimeout(() => setBpm(null), 60_000);
    });
    return () => {
      off();
      window.clearTimeout(stale);
    };
  }, [sessionId, live]);
  return live ? bpm : null;
}

export function SessionLogger({
  session,
  exerciseLibrary,
  lastPerformances,
  targets: sessionTargets,
  exercisePRs,
  unit,
  fighter,
}: {
  session: SessionDetail;
  exerciseLibrary: Exercise[];
  lastPerformances: Record<string, LastPerformance>;
  /** The template's sets and rest per session exercise (by seId). */
  targets: Record<string, SessionTarget>;
  exercisePRs: Record<string, ExercisePR>;
  unit: Unit;
  /** The lifter's rank fighter, who stars in the finish screen. */
  fighter: TierKey;
}) {
  const [, startNav] = useTransition();
  const router = useRouter();
  // A movement swapped in after sets were logged keeps the one it replaced's
  // targets; the rest are the session's own.
  const [carriedTargets, setTargets] = useState<Record<string, SessionTarget>>({});
  const targets = useMemo(() => ({ ...sessionTargets, ...carriedTargets }), [sessionTargets, carriedTargets]);
  const [finishing, setFinishing] = useState(false);
  // Throwing the workout away: asked once, then gone.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [picker, setPicker] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  // A superset just made from the sheet: its line snaps in, once.
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [victory, setVictory] = useState<string | null>(null);
  const [activeSeId, setActiveSeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(
    session.duration_min ?? null,
  );
  // The landing and link animations play once; reopening a sheet doesn't replay them.
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 700);
    return () => clearTimeout(t);
  }, [flashId]);
  useEffect(() => {
    if (!linkedId) return;
    const t = setTimeout(() => setLinkedId(null), 900);
    return () => clearTimeout(t);
  }, [linkedId]);

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
  // Mirrors the title field (saved on blur) for the Live Activity.
  const [title, setTitle] = useState(session.title ?? "Workout");
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
  // Set once this session is in Apple Health, so a retried finish doesn't add it twice.
  const savedToHealth = useRef(false);
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
  const liftById = useMemo(() => new Map(exerciseLibrary.map((e) => [e.id, e])), [exerciseLibrary]);
  // Today's target on a lift (progression.ts): last time's sets against the
  // template's rep range. The first set starts there.
  const targetFor = (ex: { seId: string; exerciseId: string }): Target | null => {
    const lift = liftById.get(ex.exerciseId);
    return nextTarget({
      last: (lastFor(ex.exerciseId)?.sets ?? []).map((s) => ({
        weight: toDisplayWeight(s.weight_kg, unit),
        reps: s.reps,
        rpe: s.rpe,
      })),
      range: targets[ex.seId]?.reps ?? null,
      plannedSets: targets[ex.seId]?.sets ?? null,
      lift: {
        equipment: lift?.equipment ?? null,
        mechanic: lift?.mechanic ?? null,
        primaryMuscle: lift?.primary_muscle ?? null,
      },
      unit,
    });
  };

  const [exercises, setExercises] = useState<LocalExercise[]>(() =>
    session.session_exercise.map((se) => ({
      seId: se.id,
      exerciseId: se.exercise_id,
      name: se.exercise?.name ?? "Exercise",
      primaryMuscle: se.exercise?.primary_muscle ?? "chest",
      note: se.note,
      superset: se.superset,
      sets: se.set.map((s) => ({
        id: s.id,
        weight: toDisplayWeight(s.weight_kg, unit),
        kg: Number(s.weight_kg),
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.is_warmup,
        kind: s.kind === "drop" || s.kind === "rest_pause" ? (s.kind as SetKind) : null,
      })),
    })),
  );

  // Exercises the lifter ended by hand, short of their target or not: the
  // Lock Screen moves on from these (unlike `completed`, which also marks
  // everything already started when a session is reopened).
  // Kept with the workout (session_exercise.ended_at), so the watch, Siri and
  // a reload agree on what's next.
  const [endedHere, setEndedHere] = useState<Set<string>>(
    () => new Set(session.session_exercise.filter((se) => se.ended_at).map((se) => se.id)),
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
  // Every set removed on this page, so a pull of the server's copy that was
  // already in flight can't bring one back (see the watch merge below).
  const deletedHere = useRef<Set<string>>(new Set());
  // When each set was last changed here, and when an exercise was last added,
  // removed or swapped here: a pull of the server's copy leaves those alone
  // for a few seconds, while the server catches up (see the pull below).
  const touched = useRef<Map<string, number>>(new Map());
  const lastStructural = useRef(0);

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
      userId: session.user_id,
      sessionId: session.id,
      sessionExerciseId: seId,
      setNumber,
      weightKg: storedKg(set, unit),
      reps: Number.isFinite(set.reps ?? NaN) ? (set.reps as number) : 0,
      rpe: set.rpe,
      isWarmup: set.isWarmup,
      kind: set.kind,
      loggedAt: set.loggedAt,
      updatedAt: nextStamp(),
    }),
    [session.id, session.user_id, unit],
  );

  const clearFailed = useCallback((setId: string) => {
    setFailed((prev) => {
      if (!prev.has(setId)) return prev;
      const next = new Set(prev);
      next.delete(setId);
      return next;
    });
  }, []);

  // Every upload under way, so finishing can wait for the last of them.
  const uploads = useRef<Set<Promise<boolean>>>(new Set());
  const track = useCallback((upload: Promise<boolean>) => {
    uploads.current.add(upload);
    void upload.finally(() => uploads.current.delete(upload));
    return upload;
  }, []);

  /** Saves a set. Resolves to whether the server has it (a draft: nothing to save). */
  const persist = useCallback(
    (seId: string, set: LocalSet, setNumber: number): Promise<boolean> => {
      // No reps yet: a draft, kept on this page until it has one.
      if (!isLogged(set.reps)) return Promise.resolve(true);
      touched.current.set(set.id, Date.now());
      const write = toQueuedWrite(seId, set, setNumber);
      setInFlight((n) => n + 1);
      return track(queueSet(write)
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
            kind: write.kind ?? null,
            loggedAt: write.loggedAt,
          }),
        )
        .then(async () => {
          // Only clears the copy this upload carried. A newer edit queued
          // meanwhile stays on the device until its own upload lands.
          await removeQueuedSet(set.id, write.updatedAt).catch(() => undefined);
          clearFailed(set.id);
          return true;
        })
        .catch(() => {
          // Keep the device copy and expose the failed upload. The row can now
          // survive a reload, but the lifter still deserves honest sync status.
          setFailed((prev) => new Set(prev).add(set.id));
          return false;
        })
        .finally(() => setInFlight((n) => Math.max(0, n - 1))));
    },
    [toQueuedWrite, clearFailed, track],
  );

  // Deletes go through the device queue too, as a tombstone, so a set removed
  // offline stays removed after a reload instead of reappearing from the
  // server's copy. Actions run in call order, so an earlier save of the same
  // set can't land after this.
  const persistDelete = useCallback(
    (seId: string, setId: string) => {
      const tombstone: PendingSetWrite = {
        id: setId,
        userId: session.user_id,
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
      touched.current.set(setId, Date.now());
      setInFlight((n) => n + 1);
      return track(queueSet(tombstone)
        .catch(() => undefined)
        .then(() => deleteSet({ id: setId }))
        .then(async () => {
          await removeQueuedSet(setId, tombstone.updatedAt).catch(
            () => undefined,
          );
          pendingDeletes.current.delete(setId);
          clearFailed(setId);
          return true;
        })
        .catch(() => {
          setFailed((prev) => new Set(prev).add(setId));
          return false;
        })
        .finally(() => setInFlight((n) => Math.max(0, n - 1))));
    },
    [session.id, session.user_id, clearFailed, track],
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
              kg: write.weightKg,
              reps: write.reps,
              rpe: write.rpe,
              isWarmup: write.isWarmup,
              kind: write.kind ?? null,
              loggedAt: write.loggedAt,
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

  // Another device's changes to this workout: the Apple Watch, Siri, or the
  // same account in another browser. Pulled when the page comes back to the
  // screen, when the watch says it logged something, and when the database
  // says a set or exercise changed. The server's copy is taken only for sets
  // with nothing pending here (queued, failed, mid-save, or touched in the
  // last few seconds), so a pull can't undo an edit, resurrect a set deleted
  // here, or drop one not yet uploaded. An exercise added, removed or swapped
  // elsewhere can't be merged into a workout in hand: the page says so and
  // offers a reload.
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  useEffect(() => {
    if (isEditing) return;
    let busy = false;
    let again = false;
    const pull = async () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const [{ finished, sets: remote, exercises: remoteExercises }, queued] = await Promise.all([
          getSessionSets({ sessionId: session.id }),
          getQueuedSets(session.id).catch(() => [] as PendingSetWrite[]),
        ]);
        // Finished elsewhere: this page is done too.
        if (finished) {
          withNative((api) => api.endWorkoutActivity());
          router.replace(`/history/${session.id}`);
          return;
        }
        const now = Date.now();
        const pending = new Set(queued.map((w) => w.id));
        const dirty = (id: string) =>
          pending.has(id) ||
          pendingSaves.current.has(id) ||
          pendingDeletes.current.has(id) ||
          failedRef.current.has(id) ||
          now - (touched.current.get(id) ?? 0) < 15_000;
        const byId = new Map(remote.map((r) => [r.id, r]));
        let changed = false;
        const next = ref.current.map((ex) => {
          const known = new Set(ex.sets.map((s) => s.id));
          const incoming = remote
            .filter(
              (r) =>
                r.seId === ex.seId &&
                !known.has(r.id) &&
                !deletedHere.current.has(r.id) &&
                !pendingDeletes.current.has(r.id),
            )
            .sort((a, b) => a.setNumber - b.setNumber);
          let touchedHere = incoming.length > 0;
          const sets: LocalSet[] = [];
          for (const s of ex.sets) {
            const r = byId.get(s.id);
            if (dirty(s.id) || !isLogged(s.reps)) {
              sets.push(s);
            } else if (!r || r.seId !== ex.seId) {
              // Deleted (or moved) elsewhere.
              touchedHere = true;
            } else if (
              r.weightKg !== s.kg ||
              r.reps !== s.reps ||
              r.rpe !== s.rpe ||
              r.isWarmup !== s.isWarmup ||
              r.kind !== s.kind
            ) {
              touchedHere = true;
              sets.push({
                ...s,
                weight: toDisplayWeight(r.weightKg, unit),
                kg: r.weightKg,
                reps: r.reps,
                rpe: r.rpe,
                isWarmup: r.isWarmup,
                kind: r.kind,
              });
            } else {
              sets.push(s);
            }
          }
          if (!touchedHere) return ex;
          changed = true;
          for (const r of incoming) {
            sets.splice(Math.min(r.setNumber - 1, sets.length), 0, {
              id: r.id,
              weight: toDisplayWeight(r.weightKg, unit),
              kg: r.weightKg,
              reps: r.reps,
              rpe: r.rpe,
              isWarmup: r.isWarmup,
              kind: r.kind,
            });
          }
          return { ...ex, sets };
        });
        if (changed) {
          ref.current = next;
          setExercises(next);
        }
        const local = new Map(ref.current.map((ex) => [ex.seId, ex.exerciseId]));
        if (
          now - lastStructural.current > 10_000 &&
          (remoteExercises.length !== local.size ||
            remoteExercises.some((e) => local.get(e.id) !== e.exerciseId))
        ) {
          setChangedElsewhere(true);
        }
      } catch {
        // Offline or signed out: the next pull catches up.
      } finally {
        busy = false;
        if (again) {
          again = false;
          void pull();
        }
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    const off = onNative("watchChanged", () => void pull());

    // The database's word that something changed, a beat later so a burst
    // (a whole exercise of sets from Siri) is one pull. This page's own
    // saves arrive too; their sets are pending or just touched, so they stay.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void pull(), 1200);
    };
    const supabase = createClient();
    const channel = supabase.channel(`hb-logger-${session.id}`);
    for (const table of ["set", "session_exercise"] as const) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${session.user_id}` },
        soon,
      );
    }
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "session", filter: `id=eq.${session.id}` },
      soon,
    );
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      off();
      void supabase.removeChannel(channel);
    };
  }, [isEditing, router, session.id, session.user_id, unit]);

  // Sets taken back outside the page ("Undo my last set" to Siri): gone here
  // too, the same as a delete from this page. The app keeps them until taken.
  const dropRemoved = useRef<(ids: string[]) => void>(() => {});
  useEffect(() => {
    dropRemoved.current = (ids) => {
      for (const id of ids) {
        const ex = ref.current.find((e) => e.sets.some((s) => s.id === id));
        if (ex) removeSet(ex.seId, id);
      }
    };
  });
  useEffect(() => {
    if (!isNativeApp() || isEditing) return;
    const take = () =>
      withNative(async (api) => {
        const { setIds } = await api.takeRemovedSets({ sessionId: session.id });
        if (setIds?.length) dropRemoved.current(setIds);
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") take();
    };
    take();
    document.addEventListener("visibilitychange", onVisible);
    const off = onNative("setsRemoved", take);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      off();
    };
  }, [isEditing, session.id]);

  // A workout day just started: Siri learns the routine, and offers the
  // day on the Lock Screen around when it's usually trained.
  useEffect(() => {
    if (isEditing || !session.template_id || Date.now() - startedAt > 10 * 60_000) return;
    const templateId = session.template_id;
    withNative((api) =>
      api.donateWorkoutStart({ sessionId: session.id, templateId, label: session.title ?? "Workout" }),
    );
  }, [isEditing, session.id, session.template_id, session.title, startedAt]);

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
    haptic("error");
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
    if (exercise && setIndex >= 0 && isLogged(exercise.sets[setIndex].reps)) {
      void queueSet(
        toQueuedWrite(seId, exercise.sets[setIndex], setIndex + 1),
      ).catch(() => undefined);
    }
    scheduleSave(seId, setId);
  }

  /** The exercises as the shared next-set rules see them (next-set.ts). */
  function planOf(list: LocalExercise[]): (PlanExercise & { ex: LocalExercise })[] {
    return list.map((ex) => ({
      ex,
      id: ex.seId,
      targetSets: targets[ex.seId]?.sets ?? null,
      superset: ex.superset,
      sets: ex.sets.map((s, i) => ({
        n: i + 1,
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
        warmup: s.isWarmup,
        kind: s.kind,
      })),
      last: (lastFor(ex.exerciseId)?.sets ?? []).map((s) => ({
        weight: toDisplayWeight(s.weight_kg, unit),
        reps: s.reps,
      })),
      target: targetFor(ex),
    }));
  }

  function addSet(seId: string) {
    const ex = ref.current.find((e) => e.seId === seId);
    if (!ex) return;
    // As "same again" (next-set.ts): the last straight set, else today's
    // target, else the same set last time. A warm-up's or a drop set's
    // numbers are never the next working set's.
    const straight = ex.sets.filter((s) => isStraight(counted(s)));
    const prev = straight.at(-1);
    const pastSets = lastFor(ex.exerciseId)?.sets;
    const last = pastSets?.[straight.length] ?? pastSets?.at(-1);
    const target = prev ? null : targetFor(ex);
    const seed: LocalSet = {
      id: crypto.randomUUID(),
      weight: prev
        ? prev.weight
        : target
          ? target.weight
          : last
            ? toDisplayWeight(last.weight_kg, unit)
            : null,
      reps: prev ? prev.reps : target ? target.reps : (last?.reps ?? null),
      rpe: null,
      isWarmup: false,
      kind: null,
      loggedAt: Date.now(),
    };
    // A set added to an exercise ended early picks it back up.
    if (endedHere.has(seId)) resumeExercise(seId);
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
    // In a superset, straight on to the partner still behind on the round;
    // the rest comes after the round.
    const after = planOf(next);
    const upNext = exerciseForNextSet(after, endedHere);
    if (!restsAfter(after, seId, endedHere)) {
      haptic("tap");
      if (upNext && activeSeId === seId) setActiveSeId(upNext.id);
      return;
    }
    // A superset's round done: its first exercise is ready while you rest.
    const slot = supersetSlots(next, (e) => e.superset)[next.findIndex((e) => e.seId === seId)];
    if (slot && upNext && upNext.id !== seId && activeSeId === seId) {
      const index = next.findIndex((e) => e.seId === upNext.id);
      if (slot.members.includes(index)) setActiveSeId(upNext.id);
    }
    // A set just landed: that's when the rest starts, as in any gym app.
    // The template's rest for this exercise, else the lifter's usual.
    if (!isEditing && rest.auto) rest.start(targets[seId]?.rest ?? undefined);
    else haptic("tap");
  }

  // A drop set: the set before's reps at about a fifth less weight, rounded
  // to the plates, straight after it with no rest.
  function addDropSet(seId: string) {
    const ex = ref.current.find((e) => e.seId === seId);
    const prev = ex?.sets[ex.sets.length - 1];
    if (!ex || !prev || prev.isWarmup) return;
    const weight = Number(prev.weight) || 0;
    const set: LocalSet = {
      id: crypto.randomUUID(),
      weight: Math.max(0, Math.round((weight * 0.8) / weightStep) * weightStep),
      reps: prev.reps,
      rpe: null,
      isWarmup: false,
      kind: "drop",
      loggedAt: Date.now(),
    };
    const next = ref.current.map((e) => (e.seId === seId ? { ...e, sets: [...e.sets, set] } : e));
    ref.current = next;
    setExercises(next);
    setFlashId(set.id);
    void persist(seId, set, ex.sets.length + 1);
    haptic("tap");
  }

  // Links an exercise with the one after it in a superset, or takes it out.
  function linkSuperset(seId: string, link: boolean) {
    if (needsConnection(link ? "Making a superset" : "Changing a superset")) return;
    startNav(async () => {
      let changes: Awaited<ReturnType<typeof setSessionSuperset>>;
      try {
        changes = await setSessionSuperset({ sessionExerciseId: seId, link });
      } catch {
        showNotice("Couldn't change the superset. Check your connection and try again.");
        return;
      }
      const byId = new Map(changes.map((c) => [c.id, c.superset]));
      const next = ref.current.map((e) => (byId.has(e.seId) ? { ...e, superset: byId.get(e.seId) ?? null } : e));
      ref.current = next;
      setExercises(next);
      if (link) {
        setLinkedId(seId);
        haptic("tap");
      }
    });
  }

  // Sets said in words ("Say it"), each with its own numbers, added as
  // "+ set" adds one; then the one rest, after the last of them.
  function logSpokenSets(spoken: SpokenSet[]) {
    let next = ref.current;
    const added: { seId: string; set: LocalSet }[] = [];
    for (const s of spoken) {
      if (!next.some((e) => e.seId === s.exerciseId)) continue;
      const set: LocalSet = {
        id: crypto.randomUUID(),
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        isWarmup: s.warmup,
        kind: null,
      };
      next = next.map((e) =>
        e.seId === s.exerciseId ? { ...e, sets: [...e.sets, set] } : e,
      );
      added.push({ seId: s.exerciseId, set });
    }
    const last = added[added.length - 1];
    if (!last) return;
    ref.current = next;
    setExercises(next);
    for (const { seId, set } of added) {
      const ex = next.find((e) => e.seId === seId);
      if (!ex) continue;
      void persist(seId, set, ex.sets.findIndex((x) => x.id === set.id) + 1);
      checkPR(ex.exerciseId, ex.name, set);
    }
    setFlashId(last.set.id);
    if (!isEditing && rest.auto && !last.set.isWarmup) rest.start(targets[last.seId]?.rest ?? undefined);
    else haptic("tap");
  }

  function removeSet(seId: string, setId: string) {
    deletedHere.current.add(setId);
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

    // Renumber the survivors after it. Computed out here, not inside the
    // state updater: updaters must be pure, and React may invoke them more
    // than once per commit: which would fire duplicate writes for every
    // remaining set. The ones before it keep their numbers, so aren't saved.
    const removedAt = ref.current.find((ex) => ex.seId === seId)?.sets.findIndex((s) => s.id === setId) ?? 0;
    const next = ref.current.map((ex) =>
      ex.seId === seId
        ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
        : ex,
    );
    ref.current = next;
    setExercises(next);
    const target = next.find((e) => e.seId === seId);
    target?.sets.forEach((s, i) => {
      if (i >= removedAt) void persist(seId, s, i + 1);
    });
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
        lastStructural.current = Date.now();
        added = await addSessionExercise({ sessionId: session.id, exerciseId });
        lastStructural.current = Date.now();
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
          superset: null,
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

    lastStructural.current = Date.now();
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

  // For this workout only: the template is changed on the Templates page.
  // Before any set it's the same row with a new movement; with sets logged,
  // those stay where they were done, and the new movement comes in after.
  function swap(seId: string, newExerciseId: string) {
    const meta = exerciseLibrary.find((e) => e.id === newExerciseId);
    if (!meta) return;
    if (needsConnection("Swapping a movement")) return;
    const before = ref.current.find((e) => e.seId === seId);
    if (!before) return;
    const hasSets = before.sets.some((s) => isLogged(s.reps));
    const relabel = (exerciseId: string, name: string, primaryMuscle: Muscle) => {
      const next = ref.current.map((e) =>
        e.seId === seId ? { ...e, exerciseId, name, primaryMuscle } : e,
      );
      ref.current = next;
      setExercises(next);
    };

    // Nothing logged yet: shown at once, put back if the server says no.
    if (!hasSets) relabel(newExerciseId, meta.name, meta.primary_muscle);
    startNav(async () => {
      let swapped: Awaited<ReturnType<typeof swapSessionExercise>>;
      try {
        lastStructural.current = Date.now();
        swapped = await swapSessionExercise({ sessionExerciseId: seId, newExerciseId });
        lastStructural.current = Date.now();
      } catch {
        if (!hasSets) relabel(before.exerciseId, before.name, before.primaryMuscle);
        showNotice(`Couldn't swap to ${meta.name}. Check your connection and try again.`);
        return;
      }
      if (swapped.lastPerformance) {
        setAddedLast((prev) => ({ ...prev, [newExerciseId]: swapped.lastPerformance! }));
      }
      if (!swapped.split) return;
      // The old movement keeps its sets and ends here; the new one follows it.
      const index = ref.current.findIndex((e) => e.seId === seId);
      const old = ref.current[index];
      if (!old) return;
      const next = [
        ...ref.current.slice(0, index + 1),
        {
          seId: swapped.id,
          exerciseId: newExerciseId,
          name: meta.name,
          primaryMuscle: meta.primary_muscle,
          note: old.note,
          superset: old.superset,
          sets: [],
        },
        ...ref.current.slice(index + 1),
      ];
      ref.current = next;
      setExercises(next);
      setTargets((prev) => (prev[seId] ? { ...prev, [swapped.id]: prev[seId] } : prev));
      setCompleted((prev) => new Set(prev).add(seId));
      setEndedHere((prev) => new Set(prev).add(seId));
      setActiveSeId(swapped.id);
    });
  }

  // "Done with this one" is kept with the workout, so a reload, the watch
  // and Siri move on from it too. Saved quietly: offline, the page still
  // moves on, and the next save that lands brings the server up to date.
  function endExercise(seId: string) {
    setCompleted((prev) => new Set(prev).add(seId));
    setEndedHere((prev) => new Set(prev).add(seId));
    setActiveSeId(null);
    if (!isEditing) void setExerciseEnded({ sessionExerciseId: seId, ended: true }).catch(() => undefined);
  }

  function resumeExercise(seId: string) {
    setEndedHere((prev) => {
      const next = new Set(prev);
      next.delete(seId);
      return next;
    });
    if (!isEditing) void setExerciseEnded({ sessionExerciseId: seId, ended: false }).catch(() => undefined);
  }

  /**
   * In the iOS app, with Apple Health sync on: the finished session becomes a
   * strength-training workout. Only live sessions, and only with a known
   * length: the typed duration, or the clock while it was still running.
   */
  function saveToHealth() {
    if (isEditing || savedToHealth.current || !healthSyncOn()) return;
    const minutes = duration ?? autoDuration;
    if (!minutes || minutes <= 0) return;
    savedToHealth.current = true;
    const typed = duration;
    // The session's average RPE is its Effort rating in the Fitness app.
    const rpes = exercises
      .flatMap((e) => e.sets)
      .filter((s) => work(s) && s.rpe != null)
      .map((s) => Number(s.rpe));
    const effort = rpes.length
      ? Math.min(10, Math.max(1, Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length)))
      : undefined;
    withNative((api) =>
      api.saveWorkout({
        start: startedAt,
        end: typed != null ? startedAt + typed * 60_000 : Date.now(),
        sessionId: session.id,
        effort,
      }),
    );
  }

  /**
   * Every save still waiting (a debounced edit) goes now, and every upload
   * under way is waited for. Resolves to whether the server has them all.
   */
  async function flushSaves(): Promise<boolean> {
    const now: Promise<boolean>[] = [];
    for (const [setId, seId] of pendingSaves.current) {
      const timer = timers.current.get(setId);
      if (timer) clearTimeout(timer);
      timers.current.delete(setId);
      const ex = ref.current.find((e) => e.seId === seId);
      const idx = ex?.sets.findIndex((s) => s.id === setId) ?? -1;
      if (ex && idx >= 0) {
        now.push(persist(seId, ex.sets[idx], idx + 1));
        checkPR(ex.exerciseId, ex.name, ex.sets[idx]);
      }
    }
    pendingSaves.current.clear();
    const results = await Promise.all([...uploads.current, ...now]);
    return results.every(Boolean) && failedRef.current.size === 0;
  }

  /**
   * Returns whether finishing actually started (the slider resets if not).
   * The order matters: every set saved, then the server marks the workout
   * finished, and only then the victory, the haptic and Apple Health. A
   * finish that fails leaves the workout as it was, with nothing celebrated
   * and nothing in Health.
   */
  function finish(force = false): boolean {
    // Finishing discards the page, so unsaved sets would be gone for good.
    // Retry once and make them confirm rather than losing work silently.
    if (!force && failed.size > 0) {
      retryFailed();
      setConfirmFinish(true);
      return false;
    }
    // Nothing logged means nothing to finish: it would land in History as an
    // empty bout. A mistaken start is discarded instead.
    if (!isEditing && !exercises.some((e) => e.sets.some((s) => isLogged(s.reps)))) {
      showNotice("Nothing's logged yet. Log a set to finish, or discard the workout.");
      return false;
    }
    if (needsConnection("Finishing the session")) return false;
    setConfirmFinish(false);
    setFinishing(true);
    const failedFinish = (message: string) => {
      setFinishing(false);
      setSlideKey((k) => k + 1);
      showNotice(message);
    };
    startNav(async () => {
      const saved = await flushSaves();
      if (!saved && !force) {
        setConfirmFinish(true);
        failedFinish("A set didn't save, so the workout isn't finished yet. Retry it, or finish without it.");
        return;
      }
      try {
        // Auto-record the live clock unless a duration was typed by hand.
        await finishSession({
          sessionId: session.id,
          durationMin: duration ?? autoDuration,
          navigate: false,
        });
      } catch (err) {
        unstable_rethrow(err);
        failedFinish("Couldn't finish the session. Your sets are safe; try again in a moment.");
        return;
      }
      rest.skip();
      setVictory(isEditing ? "Saved" : randomVictory());
      haptic("success");
      saveToHealth();
      await new Promise((resolve) => setTimeout(resolve, 1700));
      router.replace(`/history/${session.id}`);
    });
    return true;
  }

  /** Abandon the workout: the session and every set in it are deleted. */
  function discard() {
    if (needsConnection("Discarding the workout")) return;
    setDiscarding(true);
    rest.skip();
    startNav(async () => {
      try {
        await discardSession({ id: session.id });
        router.replace("/dashboard");
      } catch {
        setDiscarding(false);
        setConfirmDiscard(false);
        showNotice("Couldn't discard the workout. Try again in a moment.");
      }
    });
  }

  const totalSets = exercises.reduce(
    (n, e) => n + e.sets.filter(work).length,
    0,
  );
  const totalForce = exercises.reduce(
    (n, e) =>
      n +
      e.sets
        .filter(work)
        .reduce(
          (m, s) => m + (Number(s.weight) || 0) * (Number(s.reps) || 0),
          0,
        ),
    0,
  );

  const currentIndex = exercises.findIndex((e) => !completed.has(e.seId));
  const active = exercises.find((e) => e.seId === activeSeId) ?? null;
  const doneCount = exercises.filter((e) => completed.has(e.seId)).length;
  // One observation about this workout, from its numbers, or nothing.
  const coach = (() => {
    if (isEditing) return null;
    const on = currentIndex >= 0 ? exercises[currentIndex] : null;
    const target = on && on.sets.length === 0 ? targetFor(on) : null;
    const best = on ? prBest.current?.get(on.exerciseId) : undefined;
    return coachLine({
      exercises: exercises.length,
      done: doneCount,
      records: prSets.size,
      next:
        on && target && best?.hadHistory
          ? {
              name: on.name,
              targetWeight: target.weight,
              targetWeightKg: fromDisplayWeight(target.weight, unit),
              targetReps: target.reps,
              bestEst1rm: best.est1rm,
            }
          : null,
      unit,
    });
  })();
  // What's up next, for the Lock Screen and the rest alert: the exercise
  // open on screen, else the same rule the watch and Siri follow
  // (next-set.ts): the one being worked until its target's met, then the
  // next unfinished one.
  const plans = planOf(exercises);
  const slots = supersetSlots(exercises, (e) => e.superset);
  const current = active ?? exerciseForNextSet(plans, endedHere)?.ex ?? null;
  // "Say it" matches what's said against these, and fills in what isn't.
  const spokenExercises: SpokenExercise[] = plans.map((p) => ({
    id: p.id,
    name: p.ex.name,
    same: sameAgain(p),
  }));
  const spokenCurrent = current?.seId ?? null;
  // The set "+ set" would add to it (copy-forward), for the Lock Screen's
  // Log Set button to log as shown.
  const nextSet = (() => {
    if (!current || isEditing) return undefined;
    const plan = plans.find((p) => p.id === current.seId);
    const same = plan ? sameAgain(plan) : null;
    if (!same || !isLogged(same.reps)) return undefined;
    return {
      sessionExerciseId: current.seId,
      weight: same.weight,
      reps: same.reps,
      label: nextSetLabel(same.weight, same.reps, unit),
    };
  })();

  // Declared after the queue it labels its alert with; functions above that
  // use it only run on events, after this render.
  const rest = useRestTimer({ sessionId: session.id, label: current?.name });

  // The workout on the Lock Screen and in the Dynamic Island (iOS app). The
  // whole state goes over on every change, debounced; the clock and the rest
  // countdown are dates the system draws from. It outlives this page, since
  // the workout goes on while you look at another tab, and ends when the
  // session is finished (or found abandoned; see WorkoutActivitySync).
  const currentDone = current ? current.sets.filter(work).length : 0;
  const activityState = JSON.stringify({
    sessionId: session.id,
    startedAt,
    title,
    exercise: current?.name,
    detail: current
      ? currentDone > 0
        ? `${currentDone} ${currentDone === 1 ? "set" : "sets"} done`
        : `Exercise ${exercises.indexOf(current) + 1} of ${exercises.length}`
      : undefined,
    sets: totalSets,
    volume: `${Math.round(totalForce).toLocaleString("en-US")} ${unit}`,
    restEndsAt: rest.endsAt ?? undefined,
    restTotal: rest.endsAt !== null ? rest.total : undefined,
    next: nextSet,
  } satisfies WorkoutActivityState);
  const activityEnded = finishing || discarding || victory !== null;
  useEffect(() => {
    if (isEditing) return;
    if (activityEnded || Date.now() - startedAt > STALE_CLOCK_MS) {
      withNative((api) => api.endWorkoutActivity());
      return;
    }
    const id = window.setTimeout(
      () => withNative((api) => api.workoutActivity(JSON.parse(activityState) as WorkoutActivityState)),
      300,
    );
    return () => window.clearTimeout(id);
  }, [activityState, activityEnded, isEditing, startedAt]);

  // Mid-workout the phone sits on a bench: it shouldn't lock between sets.
  useKeepAwake(!isEditing && !activityEnded);
  const heartRate = useWatchHeartRate(session.id, !isEditing && !activityEnded);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3">
          {isEditing ? (
            <span className="text-[13px] font-medium text-muted">Editing</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-ink">
              <span className="size-1.5 rounded-full bg-accent" />
              Live
              {heartRate !== null && (
                <span className="tnum ml-2 inline-flex items-center gap-1 text-text">
                  <Heart aria-hidden className="size-3.5 fill-danger text-danger" />
                  {heartRate}
                  <span className="sr-only">beats per minute, from your Apple Watch</span>
                </span>
              )}
            </span>
          )}
          <SessionDate
            defaultValue={session.date}
            onCommit={(date) =>
              updateSessionMeta({ sessionId: session.id, date }).catch(() =>
                showNotice("Couldn't save the session date."),
              )
            }
          />
        </div>
        <h1 className="sr-only">{title}</h1>
        <TitleField
          defaultValue={session.title ?? "Session"}
          label="Session title"
          onCommit={(value) => {
            setTitle(value.trim() || "Workout");
            updateSessionMeta({
              sessionId: session.id,
              title: value.trim() || null,
            }).catch(() => showNotice("Couldn't save the session title."));
          }}
          className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.03em] text-text sm:text-[2.5rem]"
        />
        <p className="tnum mt-0.5 text-[13px] text-muted">
          {exercises.length > 0
            ? `${doneCount} of ${exercises.length} exercises done`
            : "No exercises yet"}
        </p>

        {/* The workout's figures, ruled off like a scoreboard strip rather
            than boxed: glanced at mid-set, not read. Time first, as it's the
            one that moves (and the one accent). */}
        <dl className="mt-5 grid grid-cols-[1.05fr_0.75fr_1.2fr] border-y border-text/[0.1] py-3">
          <div
            className="@container min-w-0 pr-3"
            title="Workout time"
            aria-label={`Time ${timeLabel}`}
          >
            <dt className="text-[12px] text-muted">Time</dt>
            <dd className="mt-1 flex h-[1.5rem] items-end whitespace-nowrap leading-none">
              {clockLive || duration ? (
                <span
                  className={cn("font-display hb-fit", clockLive ? "text-accent-ink" : "text-text")}
                  style={fitFigure(timeLabel, STAT_SIZE)}
                >
                  {timeLabel}
                </span>
              ) : (
                <span className="text-[15px] text-muted">{timeLabel}</span>
              )}
            </dd>
          </div>
          <div className="@container min-w-0 border-l border-text/[0.08] px-3">
            <dt className="text-[12px] text-muted">Sets</dt>
            <dd className="mt-1 flex h-[1.5rem] items-end leading-none">
              <span className="font-display hb-fit text-text" style={fitFigure(String(totalSets), STAT_SIZE)}>
                <CountUp to={totalSets} animateOnMount={false} duration={0.5} />
              </span>
            </dd>
          </div>
          <div className="@container min-w-0 border-l border-text/[0.08] pl-3">
            <dt className="text-[12px] text-muted">Volume</dt>
            <dd className="mt-1 flex h-[1.5rem] items-end leading-none">
              <span className="whitespace-nowrap">
                {/* Animates only when it changes, which here means a set just
                    landed. The move is the information. */}
                <span
                  className="font-display hb-fit text-text"
                  style={fitFigure(Math.round(totalForce).toLocaleString("en-US"), STAT_SIZE, "1.25rem")}
                >
                  <CountUp to={Math.round(totalForce)} animateOnMount={false} duration={0.7} separator="," />
                </span>
                <span className="ml-1 text-[12px] text-muted">{unit}</span>
              </span>
            </dd>
          </div>
        </dl>
        {coach && <p className="mt-3 text-[14px] leading-5 text-text">{coach}</p>}

        {/* Save health. Silence here used to mean "saved" and "lost" alike. */}
        {changedElsewhere && failed.size === 0 && (
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface px-4 py-3"
          >
            <RefreshCw className="size-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 text-[13px] leading-5 text-text">
              This workout&apos;s exercises changed on another device.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                // Whatever's uploading lands first; the device queue keeps the rest.
                await Promise.allSettled([...uploads.current]);
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </div>
        )}
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

      {/* The queue in three states. Done work and upcoming work are ruled
          lines on the page, a training log rather than cards; only the
          exercise you're on is lifted out, with the one button that matters. */}
      {(() => {
        const rows = exercises.map((ex, i) => ({ ex, i }));
        const done = rows.filter(({ ex }) => completed.has(ex.seId));
        const current = currentIndex >= 0 ? rows[currentIndex] : null;
        const upcoming = rows.filter(
          ({ ex, i }) => !completed.has(ex.seId) && i !== currentIndex,
        );
        const addedTag = (seId: string) => {
          const slot = slots[exercises.findIndex((e) => e.seId === seId)];
          return (
            <>
              {slot && <Badge variant="muted">{slotLabel(slot)}</Badge>}
              {advanceIds.has(seId) && <Badge variant="muted">Added</Badge>}
            </>
          );
        };

        return (
          <section className="space-y-3">
            {done.length > 0 && (
              <div className="divide-y divide-text/[0.08] border-y border-text/[0.08]">
                {done.map(({ ex }) => {
                  const workingSets = ex.sets.filter(work);
                  const hasPR = ex.sets.some((s) => prSets.has(s.id));
                  return (
                    <button
                      key={ex.seId}
                      onClick={() => setActiveSeId(ex.seId)}
                      className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]"
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
                            ? notebookSets(
                                workingSets.map((s) => ({ weight: Number(s.weight) || 0, reps: s.reps ?? 0 })),
                                unit,
                              )
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
              const target = ex.sets.length === 0 ? targetFor(ex) : null;
              const today = ex.sets.filter(work);
              return (
                <div className="rounded-3xl bg-surface p-5">
                  <div className="flex items-baseline justify-between gap-2 text-[13px] text-muted">
                    <span>{MUSCLE_LABEL[ex.primaryMuscle]}</span>
                    <span className="tnum">
                      {i + 1} of {exercises.length}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-[1.5rem] font-bold leading-tight tracking-[-0.025em] text-text">
                      {ex.name}
                    </h2>
                    {addedTag(ex.seId)}
                  </div>
                  {ex.note && <p className="mt-1 text-[13px] text-muted">{ex.note}</p>}
                  {slots[i] && <SupersetLine slot={slots[i]} exercises={exercises} index={i} className="mt-2" />}
                  <LastAndTarget
                    last={last ?? null}
                    target={target}
                    today={today.length > 0 ? today : null}
                    unit={unit}
                    className="mt-4 border-t border-text/[0.08] pt-4"
                  />
                  <Button variant="accent" size="lg" className="mt-5 w-full" onClick={() => setActiveSeId(ex.seId)}>
                    <Play className="size-4" />
                    {ex.sets.length > 0 ? "Continue exercise" : "Start exercise"}
                  </Button>
                </div>
              );
            })()}

            {/* Under the exercise you're on, not above it: on a small phone the
                card above pushed Start exercise below the fold. Mid-set, the
                countdown is in the exercise sheet too. */}
            {!isEditing && <RestTimerCard timer={rest} />}

            {upcoming.length > 0 && (
              <ol aria-label="Still to come" className="divide-y divide-text/[0.08] border-y border-text/[0.08]">
                {upcoming.map(({ ex, i }) => (
                  <li key={ex.seId} className="flex items-center gap-3 px-1 py-3">
                    <span className="tnum w-4 shrink-0 text-[13px] text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-text/80">{ex.name}</span>
                    {addedTag(ex.seId)}
                    <span className="shrink-0 text-[13px] text-muted">{MUSCLE_LABEL[ex.primaryMuscle]}</span>
                  </li>
                ))}
              </ol>
            )}

            {exercises.length === 0 && (
              <div className="rounded-2xl bg-surface px-6 py-10 text-center text-[15px] text-muted">
                No exercises yet. Add your first one below.
              </div>
            )}

            {/* Sets in the lifter's own words, on iPhones that can read them. */}
            {exercises.length > 0 && (
              <SaySets
                exercises={spokenExercises}
                current={spokenCurrent}
                unit={unit}
                onLog={logSpokenSets}
              />
            )}

            {/* Bonus work for this session only; the program is untouched. */}
            <button
              onClick={() => setPicker(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-text/[0.07] text-text">
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
          // A slide (or two taps), not one tap: finishing ends the workout,
          // and a stray tap mid-set shouldn't. It resets if finishing can't
          // go ahead.
          <SlideCommit
            key={slideKey}
            label="Slide to finish"
            tapAgainLabel="Tap again to finish"
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

      {/* The way out of a workout started by mistake. Quiet, below the
          finish, and asked twice: it deletes everything logged here. */}
      {!isEditing && (
        <div className="mt-3 flex min-h-11 justify-center">
          {confirmDiscard ? (
            <div className="flex w-full items-center gap-2 rounded-2xl bg-surface py-2 pl-4 pr-2">
              <p className="min-w-0 flex-1 text-[13px] leading-5 text-text">
                {totalSets > 0
                  ? `Discard this workout and its ${totalSets} ${totalSets === 1 ? "set" : "sets"}?`
                  : "Discard this workout?"}
              </p>
              <Button variant="ghost" onClick={() => setConfirmDiscard(false)} disabled={discarding}>
                Keep
              </Button>
              <Button variant="danger" onClick={discard} disabled={discarding}>
                {discarding && <Loader2 className="size-4 animate-spin" />}
                Discard
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              disabled={finishing}
              className="h-11 rounded-xl px-4 text-[14px] text-muted transition-colors hover:text-danger disabled:opacity-40"
            >
              Discard workout
            </button>
          )}
        </div>
      )}

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
          target={targetFor(active)}
          superset={(() => {
            const i = exercises.findIndex((e) => e.seId === active.seId);
            return { slot: slots[i], index: i, exercises };
          })()}
          onLink={(link) => linkSuperset(active.seId, link)}
          linkedNow={linkedId === active.seId}
          onAddDrop={() => addDropSet(active.seId)}
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
          rest={isEditing ? null : rest}
          sayIt={
            <SaySets
              inSheet
              exercises={spokenExercises}
              current={active.seId}
              unit={unit}
              onLog={logSpokenSets}
            />
          }
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
                data-state="open"
                className="hb-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-elevated/95 px-4 py-3 shadow-raised backdrop-blur"
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
                <div className="hb-plate hb-pr-banner pointer-events-auto relative overflow-hidden rounded-2xl bg-elevated/95 py-3.5 pl-5 pr-4 shadow-raised backdrop-blur">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
                  <span
                    aria-hidden
                    className="hb-pr-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-text/[0.12] to-transparent"
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
  target,
  superset,
  onLink,
  linkedNow,
  onAddDrop,
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
  rest,
  sayIt,
}: {
  exercise: LocalExercise;
  exerciseLibrary: Exercise[];
  lastPerformance: LastPerformance | null;
  /** Today's target on it (progression.ts). */
  target: Target | null;
  /** Where it sits among the session's exercises, and its superset if any. */
  superset: { slot: SupersetSlot | null; index: number; exercises: LocalExercise[] };
  /** Joins it with the exercise after it (true), or takes it out of its superset. */
  onLink: (link: boolean) => void;
  /** The superset was made a moment ago: its line snaps in. */
  linkedNow?: boolean;
  onAddDrop: () => void;
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
  /** Live sessions only: the rest countdown, kept in view above End. */
  rest: RestTimerControls | null;
  /** "Say it", on iPhones that can read sets said in words. */
  sayIt?: ReactNode;
}) {
  const [swapping, setSwapping] = useState(false);
  const [q, setQ] = useState("");
  const hasSets = exercise.sets.length > 0;
  // The set in the editor: the newest, unless an earlier one was tapped. A
  // new set takes the editor back.
  const [openId, setOpenId] = useState<string | null>(null);
  const [setCount, setSetCount] = useState(exercise.sets.length);
  if (setCount !== exercise.sets.length) {
    setSetCount(exercise.sets.length);
    if (exercise.sets.length > setCount) setOpenId(null);
  }
  const openIndex = exercise.sets.findIndex((s) => s.id === openId);
  const editIndex = openIndex >= 0 ? openIndex : exercise.sets.length - 1;
  const editing = editIndex >= 0 ? { set: exercise.sets[editIndex], index: editIndex } : null;
  // A set landing pushes what's under it down: it glides there, not jumps.
  const actionsRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  useGlide(actionsRef, exercise.sets.length);
  useGlide(linksRef, `${exercise.sets.length}:${superset.slot ? 1 : 0}`);
  const guide = getExerciseGuide(exercise.name);
  const [showGuide, setShowGuide] = useState(false);

  const filtered = useMemo(
    () => exerciseLibrary.filter((e) => e.id !== exercise.exerciseId && !e.archived_at && matchesExercise(e, q)),
    [q, exerciseLibrary, exercise.exerciseId],
  );

  return (
    <Sheet
      open
      onClose={onClose}
      fill={swapping}
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
          <>
            {rest && <RestTimerBar timer={rest} />}
            {/* Until the first set is in, logging it is the main action and
                skipping is the quiet one. */}
            <Button
              size="lg"
              variant={hasSets ? "primary" : "secondary"}
              className="w-full"
              onClick={onEnd}
            >
              {hasSets && <Check className="size-4" />}
              {hasSets ? "End exercise" : "Skip exercise"}
              <ArrowRight className="size-4" />
            </Button>
          </>
        )
      }
    >
      {swapping ? (
        <div>
          <div className="sticky top-0 z-10 bg-[var(--sheet-solid)] px-4 pb-3 pt-1">
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
              {hasSets
                ? `For this workout only. Your sets stay on ${exercise.name}, and the new movement comes in after it.`
                : "For this workout only. To change it for good, swap it in the template."}
            </p>
          </div>
          <ul className="mx-4 mb-4 divide-y divide-text/[0.06] overflow-hidden rounded-2xl bg-text/[0.04]">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    onSwap(e.id);
                    setSwapping(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-text/[0.05]"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-text/[0.07] px-3 text-[13px] text-text transition-colors active:bg-text/[0.1]"
            >
              <Repeat2 className="size-3.5" />
              Swap movement
            </button>
          </div>

          <LastAndTarget
            last={lastPerformance}
            target={target}
            unit={unit}
            className="mb-4 border-b border-text/[0.08] pb-4"
          />
          {exercise.note && (
            <div className="mb-3 text-[13px] text-muted">{exercise.note}</div>
          )}
          {guide && (
            // The library's how-to, without leaving the workout.
            <div className="mb-3">
              <button
                type="button"
                aria-expanded={showGuide}
                aria-controls={`guide-${exercise.seId}`}
                onClick={() => setShowGuide((g) => !g)}
                className="hb-hit inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-text"
              >
                How it&apos;s done
                <ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-200", showGuide && "rotate-180")} />
              </button>
              <Collapse open={showGuide} id={`guide-${exercise.seId}`}>
                <p className="mt-2 rounded-xl bg-text/[0.04] px-3.5 py-3 text-[14px] leading-[1.55] text-muted">{guide}</p>
              </Collapse>
            </div>
          )}

          {superset.slot && (
            <SupersetLine
              slot={superset.slot}
              exercises={superset.exercises}
              index={superset.index}
              className={cn("mb-3", linkedNow && "hb-link-in")}
            />
          )}

          <div className="grid grid-cols-1 gap-2">
            {/* Sets done are a quiet record, one line each; the set being
                worked is the big editor, in its place in the order. Tapping
                a line opens that set there. */}
            {(() => {
              const line = (s: LocalSet) => {
                const i = exercise.sets.indexOf(s);
                return (
                  <SetLine
                    key={s.id}
                    label={setLabel(exercise.sets, i)}
                    set={s}
                    unit={unit}
                    isPR={prSets.has(s.id)}
                    flash={s.id === flashId}
                    onOpen={() => setOpenId(s.id)}
                  />
                );
              };
              const before = exercise.sets.slice(0, editIndex);
              const after = exercise.sets.slice(editIndex + 1);
              return (
                <div role="group" aria-label="Sets" className="tnum">
                  {exercise.sets.length > 1 && (
                    // Column heads for the eye; each line's button says it all to a screen reader.
                    <div aria-hidden className={cn(SET_COLUMNS, "pb-1.5 text-[12px] text-muted")}>
                      <span>Set</span>
                      <span className="text-right">{unit}</span>
                      <span className="text-right">Reps</span>
                      <span className="text-right">RPE</span>
                      <span />
                    </div>
                  )}
                  {before.length > 0 && (
                    <div className="mb-2 divide-y divide-text/[0.07] border-y border-text/[0.07]">
                      {before.map(line)}
                    </div>
                  )}
                  {editing && (
                    <SetRow
                      key={editing.set.id}
                      label={setLabel(exercise.sets, editing.index)}
                      set={editing.set}
                      unit={unit}
                      weightStep={weightStep}
                      flash={editing.set.id === flashId}
                      isPR={prSets.has(editing.set.id)}
                      onChange={(patch) => onUpdateSet(editing.set.id, patch)}
                      onRemove={() => {
                        setOpenId(null);
                        onRemoveSet(editing.set.id);
                      }}
                    />
                  )}
                  {after.length > 0 && (
                    <div className="mt-2 divide-y divide-text/[0.07] border-y border-text/[0.07]">
                      {after.map(line)}
                    </div>
                  )}
                </div>
              );
            })()}

            <div ref={actionsRef} className="grid grid-cols-1 gap-2">
              <Button
                variant={hasSets ? "secondary" : "primary"}
                size="lg"
                onClick={onAddSet}
                className="mt-1 w-full"
              >
                <Plus className="size-4" />
                {exercise.sets.length === 0
                  ? "Log first set"
                  : "Add set"}
              </Button>
              {hasSets && !exercise.sets[exercise.sets.length - 1].isWarmup && (
                <Button variant="ghost" size="lg" onClick={onAddDrop} className="w-full">
                  <ArrowDownRight className="size-4" />
                  Add drop set
                </Button>
              )}
              {sayIt}
            </div>
          </div>

          <div ref={linksRef} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            {superset.slot ? (
              <button
                onClick={() => onLink(false)}
                className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-text"
              >
                <Unlink className="size-3.5" />
                Take out of superset
              </button>
            ) : superset.exercises[superset.index + 1] ? (
              <button
                onClick={() => onLink(true)}
                className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-text"
              >
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate">Superset with {superset.exercises[superset.index + 1].name}</span>
              </button>
            ) : null}
            <button
              onClick={onRemoveExercise}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-danger"
            >
              <Trash2 className="size-3.5" />
              Remove from session
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/**
 * "A1, with Seated Cable Row. No rest in between; rest after the round."
 * The partners named in order, the rest said once.
 */
function SupersetLine({
  slot,
  exercises,
  index,
  className,
}: {
  slot: SupersetSlot;
  exercises: LocalExercise[];
  index: number;
  className?: string;
}) {
  const partners = slot.members.filter((m) => m !== index).map((m) => exercises[m]?.name ?? "Exercise");
  return (
    <p className={cn("flex items-start gap-1.5 text-[13px] text-muted", className)}>
      <Link2 className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">
        <span className="text-text">Superset {slotLabel(slot)}</span>, with {partners.join(" and ")}. No rest in between;
        rest after the round.
      </span>
    </p>
  );
}

/** A set's name in its exercise: "Set 2", or what kind it is. Plain sets are numbered alone. */
function setLabel(sets: LocalSet[], i: number): string {
  const set = sets[i];
  if (set.isWarmup) return "Warm-up";
  if (set.kind === "drop") return "Drop set";
  if (set.kind === "rest_pause") return "Rest-pause";
  return `Set ${sets.slice(0, i + 1).filter((s) => !s.isWarmup && s.kind == null).length}`;
}

/** What a set counts for, said once it isn't a plain one (set-kinds.ts). */
const KIND_NOTE = {
  warmup: "A warm-up: not counted in your totals or the plan.",
  drop: "Counts in your totals, not toward the plan's sets.",
  rest_pause: "Counts in your totals, not toward the plan's sets.",
} as const;

/**
 * Last session and today's target in two aligned rows, the way a lifter
 * reads a training card: down the weights, not across a sentence. Mid
 * exercise, today's sets so far take the target's place.
 */
function LastAndTarget({
  last,
  target,
  today,
  unit,
  className,
}: {
  last: LastPerformance | null;
  target: Target | null;
  today?: LocalSet[] | null;
  unit: Unit;
  className?: string;
}) {
  if (!last && !target && !today) return null;
  return (
    <dl
      className={cn(
        "tnum grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5 text-[15px] leading-5 [text-wrap:balance]",
        className,
      )}
    >
      {last && (
        <>
          <dt className="text-[13px] text-muted">Last session</dt>
          <dd className="text-text/85">
            {keepSetsTogether(
              notebookSets(
                last.sets.map((s) => ({ weight: toDisplayWeight(s.weight_kg, unit), reps: s.reps })),
                unit,
              ),
            )}
            <span className="ml-2 whitespace-nowrap text-[13px] text-muted">
              {format(parseISO(last.session_date), "d MMM")}
            </span>
          </dd>
        </>
      )}
      {today ? (
        <>
          <dt className="text-[13px] text-muted">Today so far</dt>
          <dd className="font-semibold text-text">
            {keepSetsTogether(
              notebookSets(
                today.map((s) => ({ weight: Number(s.weight) || 0, reps: s.reps ?? 0 })),
                unit,
              ),
            )}
          </dd>
        </>
      ) : target ? (
        <>
          <dt className="text-[13px] text-muted">Today&apos;s target</dt>
          <dd>
            <span className="whitespace-nowrap font-semibold text-text">{targetLabel(target, unit)}</span>
            <span
              className={cn(
                "ml-2 whitespace-nowrap text-[13px]",
                target.change === "up" ? "text-accent-ink" : "text-muted",
              )}
            >
              {targetReason(target, unit)}
            </span>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

/** "62.5 kg × 11" never splits across lines; a list wraps only after a comma. */
function keepSetsTogether(text: string): string {
  return text.replace(/ (kg|lb|×)/g, "\u00a0$1").replace(/× /g, "×\u00a0");
}

/** The set table's columns: label, weight, reps, RPE, a marker. */
const SET_COLUMNS = "grid grid-cols-[minmax(0,1fr)_4.5rem_3rem_3rem_1.25rem] items-center gap-x-2 px-1";

/** A set already done, as one line of the record. Tap to edit it. */
function SetLine({
  label,
  set,
  unit,
  isPR,
  flash,
  onOpen,
}: {
  label: string;
  set: LocalSet;
  unit: Unit;
  isPR?: boolean;
  flash?: boolean;
  onOpen: () => void;
}) {
  // A plain button, so it's announced as one: "Set 2, 80 kg by 8 reps, RPE 8, a record. Edit".
  const spoken = [
    label,
    `${trimNum(Number(set.weight) || 0)} ${unit} by ${set.reps ?? 0} ${set.reps === 1 ? "rep" : "reps"}`,
    set.rpe != null ? `RPE ${set.rpe}` : null,
    isPR ? "a record" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${spoken}. Edit`}
      className={cn(
        SET_COLUMNS,
        "hb-hit w-full py-2.5 text-left text-[15px] transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]",
        flash && "hb-set-in",
      )}
    >
      <span className={cn("truncate text-[13px]", set.isWarmup ? "text-warn" : "text-muted")}>
        {label}
      </span>
      <span className="text-right text-text">
        {set.weight == null ? "–" : trimNum(set.weight)}
      </span>
      <span className="text-right text-text">
        {set.reps ?? "–"}
      </span>
      <span className="text-right text-muted">
        {set.rpe ?? ""}
      </span>
      <span className="flex justify-end">
        {isPR && <Zap aria-label="Record" className="size-3.5 fill-current text-accent" />}
      </span>
    </button>
  );
}

function SetRow({
  label,
  set,
  unit,
  weightStep,
  flash,
  isPR,
  onChange,
  onRemove,
}: {
  /** "Set 2", "Drop set" (setLabel). */
  label: string;
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
        "rounded-3xl p-3.5",
        set.isWarmup ? "bg-warn/[0.07]" : isPR ? "bg-accent/[0.09]" : "bg-text/[0.05]",
        flash && "hb-set-in",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 tnum text-[15px] font-semibold text-text">
          {set.isWarmup ? (
            label
          ) : (
            // The set's kind, picked by name from the system's own menu:
            // plain, drop, rest-pause.
            <span
              className={cn(
                "relative -mx-1.5 inline-flex items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-text/30",
                set.kind && "bg-text/[0.07]",
              )}
            >
              <select
                value={set.kind ?? "plain"}
                onChange={(e) =>
                  onChange({ kind: e.target.value === "plain" ? null : (e.target.value as SetKind) })
                }
                aria-label={`${label}: set type`}
                className="hb-hit appearance-none bg-transparent py-0.5 pl-1.5 pr-6 font-semibold text-text focus:outline-none"
              >
                <option value="plain">{set.kind ? "Straight set" : label}</option>
                <option value="drop">Drop set</option>
                <option value="rest_pause">Rest-pause</option>
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 size-3.5 text-muted" />
            </span>
          )}
          {isPR && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-black">
              <Zap className="size-2.5" />
              PR
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            <abbr title="Rate of perceived exertion: 10 is nothing left, 8 is two more reps in the tank" className="no-underline">
              RPE
            </abbr>
            <input
              aria-label="RPE, effort out of 10 (optional)"
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
              className="tnum h-9 w-12 rounded-lg bg-text/[0.06] px-1 text-center text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-text/25"
            />
          </label>
          <button
            aria-label="Warm-up set"
            aria-pressed={set.isWarmup}
            onClick={() => onChange({ isWarmup: !set.isWarmup })}
            className={cn(
              "hb-hit flex size-10 items-center justify-center rounded-full transition-colors",
              set.isWarmup ? "bg-warn/15 text-warn" : "bg-text/[0.06] text-muted hover:text-text",
            )}
          >
            <Flame className="size-4" />
          </button>
          {/* Set apart from the warm-up toggle, so a thumb aiming for one
              can't land on the other: each has a 44pt target, and they
              don't overlap. */}
          <button
            aria-label="Delete set"
            onClick={onRemove}
            className="hb-hit ml-2 flex size-10 items-center justify-center rounded-full bg-text/[0.06] text-muted transition-colors hover:text-danger"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      {(set.isWarmup || set.kind) && (
        <p className="-mt-1.5 mb-3 px-0.5 text-[12px] text-muted">
          {KIND_NOTE[set.isWarmup ? "warmup" : set.kind!]}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1.5 px-1 tnum text-[12px] text-muted">
            Weight, {unit}
          </div>
          <NumberStepper
            size="lg"
            ariaLabel={`${label} weight, ${unit}`}
            value={set.weight}
            onChange={(v) => onChange({ weight: Number.isNaN(v) ? null : v })}
            step={weightStep}
            precision={2}
            max={unit === "lb" ? 2000 : 900}
          />
        </div>
        <div>
          <div className="mb-1.5 px-1 tnum text-[12px] text-muted">
            Reps
          </div>
          <NumberStepper
            size="lg"
            ariaLabel={`${label} reps`}
            value={set.reps}
            onChange={(v) => onChange({ reps: Number.isNaN(v) ? null : v })}
            step={1}
            precision={0}
            max={999}
          />
        </div>
      </div>
    </div>
  );
}
