import { z } from "zod";

/**
 * One set as the logger, the offline outbox and the server write it: the
 * same rules whichever sends it (the logger writes straight to the
 * database, logger-sync.ts; the outbox through replaySet).
 */
export const setWriteSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0).max(9999),
  // At least one rep: a row without one is a draft that stays on the device.
  reps: z.number().int().min(1).max(999),
  rpe: z.number().min(0).max(10).nullable(),
  isWarmup: z.boolean(),
  /** A drop or rest-pause set; absent from a build before them, which only logs plain ones. */
  kind: z.enum(["drop", "rest_pause"]).nullable().optional(),
  /** When it was logged on the device (epoch ms), for a set that reaches the
   *  server late (offline). Becomes its created_at, which heart-rate reads
   *  line the sets up by. */
  loggedAt: z.number().int().positive().optional(),
});

export type SetWrite = z.input<typeof setWriteSchema>;

/** A device's clock is trusted for a week back and a few minutes ahead. */
export function plausibleLoggedAt(ms: number | undefined, now = Date.now()): string | undefined {
  if (ms === undefined) return undefined;
  if (ms < now - 7 * 24 * 3600_000 || ms > now + 5 * 60_000) return undefined;
  return new Date(ms).toISOString();
}

/** The `set` row a write upserts, for the lifter `userId`. */
export function setRow(v: z.output<typeof setWriteSchema>, userId: string) {
  const loggedAt = plausibleLoggedAt(v.loggedAt);
  return {
    id: v.id,
    user_id: userId,
    session_exercise_id: v.sessionExerciseId,
    set_number: v.setNumber,
    weight_kg: v.weightKg,
    reps: v.reps,
    rpe: v.rpe,
    is_warmup: v.isWarmup,
    ...(v.kind !== undefined ? { kind: v.kind } : {}),
    // The same first-logged time on every save of the set, so editing it
    // later doesn't move when it happened.
    ...(loggedAt ? { created_at: loggedAt } : {}),
    is_completed: true,
  };
}

export type SessionSet = {
  seId: string;
  id: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  kind: "drop" | "rest_pause" | null;
  /** When it was logged (epoch ms). */
  at: number;
};

export type SessionSets = {
  finished: boolean;
  sets: SessionSet[];
  exercises: { id: string; exerciseId: string }[];
};

/** What the logger reads to pick up another device's changes. */
export const SESSION_SETS_SELECT =
  "finished_at, session_exercise(id, exercise_id, set(id, set_number, weight_kg, reps, rpe, is_warmup, kind, created_at))";

type SessionSetsRow = {
  finished_at: string | null;
  session_exercise: {
    id: string;
    exercise_id: string;
    set: {
      id: string;
      set_number: number;
      weight_kg: number | string;
      reps: number;
      rpe: number | string | null;
      is_warmup: boolean;
      kind: string | null;
      created_at: string;
    }[];
  }[];
};

/** A session's sets as the logger holds them. No row: it's gone, so it's over. */
export function toSessionSets(data: SessionSetsRow | null): SessionSets {
  if (!data) return { finished: true, sets: [], exercises: [] };
  const sets = data.session_exercise.flatMap((se) =>
    se.set.map((s): SessionSet => ({
      seId: se.id,
      id: s.id,
      setNumber: s.set_number,
      weightKg: Number(s.weight_kg),
      reps: s.reps,
      rpe: s.rpe === null ? null : Number(s.rpe),
      isWarmup: s.is_warmup,
      kind: s.kind === "drop" || s.kind === "rest_pause" ? s.kind : null,
      at: Date.parse(s.created_at),
    })),
  );
  return {
    finished: data.finished_at !== null,
    sets,
    exercises: data.session_exercise.map((se) => ({ id: se.id, exerciseId: se.exercise_id })),
  };
}
