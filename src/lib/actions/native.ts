"use server";

import { getAuthedContext } from "@/lib/auth";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { getExerciseStats } from "@/lib/data/exercise-stats";
import { getTemplates } from "@/lib/data/templates";
import { getUnit } from "@/lib/settings";
import { toDisplayWeight, type Unit } from "@/lib/units";

/** The most-trained lifts Siri and Spotlight know about. */
const MAX_LIFTS = 40;

/**
 * What Siri and Spotlight in the iOS app know (ios/App/Shared/WidgetSnapshot
 * .swift): the days /log offers, so "Start Day 2 in Fatty" works, and the
 * lifter's bests, so "What's my bench max in Fatty?" gets an answer without
 * opening the app. Weights in the display unit.
 */
export type SiriSnapshot = {
  unit: Unit;
  workouts: { templateId: string; label: string }[];
  lifts: { id: string; name: string; bestWeight: number; bestReps: number; estimatedMax: number }[];
};

export async function getSiriSnapshot(): Promise<SiriSnapshot> {
  await getAuthedContext();
  const [progress, stats, unit] = await Promise.all([
    getActiveProgramProgress(),
    getExerciseStats(),
    getUnit(),
  ]);

  // The same days /log offers: the active program's, else every template.
  const workouts: SiriSnapshot["workouts"] = [];
  if (progress) {
    const seen = new Set<string>();
    for (const day of progress.program.program_day) {
      const t = day.workout_template;
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id);
      workouts.push({ templateId: t.id, label: t.day_label || t.name });
    }
  } else {
    for (const t of await getTemplates()) {
      workouts.push({ templateId: t.id, label: t.day_label || t.name });
    }
  }

  const lifts = [...stats]
    .sort((a, b) => Number(b.sessions_logged) - Number(a.sessions_logged))
    .slice(0, MAX_LIFTS)
    .map((s) => ({
      id: s.exercise_id,
      name: s.exercise_name,
      bestWeight: toDisplayWeight(Number(s.best_weight_kg), unit),
      bestReps: Number(s.best_reps),
      estimatedMax: Math.round(toDisplayWeight(Number(s.best_est_1rm), unit)),
    }));

  return { unit, workouts, lifts };
}
