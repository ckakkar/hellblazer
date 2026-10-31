import { setsPerMuscle, type Muscle } from "@/lib/muscles";
import type { Preset } from "@/lib/presets";

export type LibraryMuscles = Map<string, { primary: Muscle; secondary: Muscle[] }>;

/**
 * What a starter program asks of a week, for its preview: hard sets per
 * muscle (the primary muscle counts a set, each secondary half, as the
 * weekly-sets view counts them) and how the sets split across rep ranges.
 */
export type PresetBreakdown = {
  /** Most-trained first; only muscles the program trains. */
  muscles: { muscle: Muscle; sets: number }[];
  /** Sets a week by rep range, by the low end of each prescription: "4-6" is
   *  strength work (1-5), "8-12" hypertrophy (6-12), "15-20" endurance (13+). */
  ranges: { strength: number; hypertrophy: number; endurance: number };
  sets: number;
};

/** The low end of a rep prescription ("3-5" → 3, "12" → 12), or null. */
export function lowReps(reps: string): number | null {
  const n = parseInt(reps, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function presetBreakdown(preset: Preset, library: LibraryMuscles): PresetBreakdown {
  const ranges = { strength: 0, hypertrophy: 0, endurance: 0 };
  const trained: { primary: Muscle; secondary: Muscle[]; sets: number }[] = [];
  let sets = 0;
  for (const day of preset.days) {
    for (const ex of day.exercises) {
      sets += ex.sets;
      const low = lowReps(ex.reps);
      if (low !== null) ranges[low <= 5 ? "strength" : low <= 12 ? "hypertrophy" : "endurance"] += ex.sets;
      const m = library.get(ex.name);
      if (m) trained.push({ ...m, sets: ex.sets });
    }
  }
  return { muscles: setsPerMuscle(trained), ranges, sets };
}
