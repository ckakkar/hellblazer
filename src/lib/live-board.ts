import type { ExercisePR, SessionDetail, SessionTarget } from "@/lib/data/sessions";
import type { Muscle } from "@/lib/muscles";
import { slotLabel, supersetSlots } from "@/lib/supersets";
import { isStraight, isWork } from "@/lib/set-kinds";

/**
 * The iPad's live view of a workout under way on the phone or the watch,
 * worked out from the session as the server reads it: what's on the bar now,
 * what's done, and which sets broke a record. Records follow the logger's
 * Removal rule: a working set that beats the lift's best from earlier
 * sessions (heaviest, else best estimated 1RM), with each set folded into the
 * running best so a matching set later doesn't count twice.
 */

export type BoardSet = {
  id: string;
  number: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  warmup: boolean;
  kind: string | null;
  /** "weight" for a new heaviest, "e1rm" for a new best estimated 1RM. */
  record: "weight" | "e1rm" | null;
  createdAt: string;
};

export type BoardExercise = {
  id: string;
  exerciseId: string;
  name: string;
  muscle: Muscle | null;
  /** Superset label (A1, A2), or null. */
  slot: string | null;
  sets: BoardSet[];
  workingSets: number;
  /** Working sets the template asks for, or null. */
  target: number | null;
  reps: string | null;
  done: boolean;
};

export type LiveBoard = {
  exercises: BoardExercise[];
  /** The exercise with the newest set: what's on the bar. Else the first. */
  currentId: string | null;
  workingSets: number;
  volumeKg: number;
  doneCount: number;
  records: number;
  /** The newest set, for the moment it lands. */
  latestSetId: string | null;
};

/** A workout finished this recently still shows its final board. */
const FINAL_BOARD_MS = 10 * 60_000;

/** Whether a finished workout's board has given way to its session page. */
export function boardIsOver(finishedAt: string | null, now = Date.now()): boolean {
  return finishedAt != null && now - Date.parse(finishedAt) > FINAL_BOARD_MS;
}

export const estimatedMax = (weightKg: number, reps: number) => weightKg * (1 + reps / 30);

export function liveBoard(
  session: SessionDetail,
  targets: Record<string, SessionTarget>,
  priorBests: Record<string, ExercisePR>,
): LiveBoard {
  const rows = session.session_exercise;
  const slots = supersetSlots(rows, (r) => r.superset);
  const best = new Map(
    Object.entries(priorBests).map(([id, pr]) => [
      id,
      { weight: pr.bestWeightKg, est1rm: pr.bestEst1rm, hadHistory: pr.bestWeightKg > 0 },
    ]),
  );

  // Every working set in the order it was logged, so a record is judged
  // against what came before it, this session included.
  const records = new Map<string, "weight" | "e1rm">();
  const logged = rows
    .flatMap((se) => se.set.map((s) => ({ se, s })))
    .filter(({ s }) => !s.is_warmup)
    .sort((a, b) => a.s.created_at.localeCompare(b.s.created_at));
  for (const { se, s } of logged) {
    const w = Number(s.weight_kg);
    const reps = Number(s.reps);
    if (!(w > 0) || !(reps > 0)) continue;
    const e = estimatedMax(w, reps);
    const cur = best.get(se.exercise_id) ?? { weight: 0, est1rm: 0, hadHistory: false };
    if (cur.hadHistory) {
      if (w > cur.weight + 0.01) records.set(s.id, "weight");
      else if (e > cur.est1rm + 0.01) records.set(s.id, "e1rm");
    }
    best.set(se.exercise_id, {
      weight: Math.max(cur.weight, w),
      est1rm: Math.max(cur.est1rm, e),
      hadHistory: cur.hadHistory,
    });
  }

  const latest = logged.length > 0 ? logged[logged.length - 1] : null;
  let volumeKg = 0;
  const exercises: BoardExercise[] = rows.map((se, i) => {
    const sets: BoardSet[] = se.set.map((s) => ({
      id: s.id,
      number: s.set_number,
      weightKg: Number(s.weight_kg),
      reps: Number(s.reps),
      rpe: s.rpe == null ? null : Number(s.rpe),
      warmup: s.is_warmup,
      kind: s.kind,
      record: records.get(s.id) ?? null,
      createdAt: s.created_at,
    }));
    const working = sets.filter(isWork);
    for (const s of working) volumeKg += s.weightKg * s.reps;
    // Drop and rest-pause sets don't use up a planned set (set-kinds.ts).
    const planned = sets.filter(isStraight).length;
    const target = targets[se.id]?.sets ?? null;
    // Without a target, an exercise is done once the lifter has moved on.
    const movedOn = rows.slice(i + 1).some((later) => later.set.some((s) => !s.is_warmup));
    return {
      id: se.id,
      exerciseId: se.exercise_id,
      name: se.exercise?.name ?? "Exercise",
      muscle: se.exercise?.primary_muscle ?? null,
      slot: slots[i] ? slotLabel(slots[i]) : null,
      sets,
      workingSets: working.length,
      target,
      reps: targets[se.id]?.reps ?? null,
      done: target ? planned >= target : planned > 0 && movedOn,
    };
  });

  return {
    exercises,
    currentId: latest?.se.id ?? rows[0]?.id ?? null,
    workingSets: logged.length,
    volumeKg,
    doneCount: exercises.filter((e) => e.done).length,
    records: records.size,
    latestSetId: latest?.s.id ?? null,
  };
}
