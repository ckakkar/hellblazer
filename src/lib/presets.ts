/**
 * Starter routines a user can load with one click. Exercise names here must
 * match the seeded exercise-library names exactly (looked up at load time).
 *
 * "Back & Arm Focused Strength" is the user's real 5-day weak-point split
 * (back · biceps · triceps · side delts): heavy compounds first (3–6), then
 * isolation in hypertrophy ranges (8–20).
 */
export type PresetExercise = {
  name: string;
  sets: number;
  reps: string;
  note?: string;
};

export type PresetDay = {
  name: string;
  dayLabel: string;
  exercises: PresetExercise[];
};

export type Preset = {
  id: string;
  name: string;
  description: string;
  days: PresetDay[];
};

export const PRESETS: Preset[] = [
  {
    id: "back-arm-strength",
    name: "Back & Arm Focused Strength",
    description:
      "5-day weak-point split — back · biceps · triceps · side delts. Heavy compounds first (3–6), isolation after in hypertrophy ranges.",
    days: [
      {
        name: "Day 1 — Upper",
        dayLabel: "Upper (Strength)",
        exercises: [
          { name: "Barbell Bench Press", sets: 5, reps: "3-5" },
          { name: "Pendlay Row", sets: 5, reps: "4-6", note: "heavy back #1" },
          { name: "Overhead Press", sets: 4, reps: "4-6" },
          {
            name: "Close-Grip Bench Press",
            sets: 3,
            reps: "5-7",
            note: "heavy tri anchor",
          },
          { name: "Skull Crusher", sets: 3, reps: "6-8", note: "long head" },
          {
            name: "Lean-Forward Cable Curl",
            sets: 3,
            reps: "8-10",
            note: "bi #1",
          },
          {
            name: "Dumbbell Lateral Raise",
            sets: 4,
            reps: "10-12",
            note: "delt #1",
          },
        ],
      },
      {
        name: "Day 2 — Lower",
        dayLabel: "Lower (Controlled)",
        exercises: [
          { name: "Romanian Deadlift", sets: 5, reps: "4-6" },
          { name: "Leg Extension", sets: 4, reps: "8-10" },
          { name: "Hip Abduction", sets: 4, reps: "8-10" },
          { name: "Seated Calf Raise", sets: 3, reps: "10-12" },
          {
            name: "Cable Lateral Raise",
            sets: 3,
            reps: "15-20",
            note: "delt #2 — low-fatigue filler",
          },
        ],
      },
      {
        name: "Day 3 — Push",
        dayLabel: "Push (Strength)",
        exercises: [
          { name: "Incline Dumbbell Press", sets: 5, reps: "3-5" },
          { name: "Overhead Press", sets: 5, reps: "3-5", note: "standing military" },
          {
            name: "Overhead Cable Extension",
            sets: 4,
            reps: "6-8",
            note: "tri long head",
          },
          {
            name: "Rope Pushdown",
            sets: 3,
            reps: "12-15",
            note: "tri lateral/medial",
          },
          { name: "Pec Deck", sets: 3, reps: "10-12", note: "seated chest fly" },
          {
            name: "Cable Lateral Raise",
            sets: 4,
            reps: "12-15",
            note: "delt #3",
          },
        ],
      },
      {
        name: "Day 4 — Pull",
        dayLabel: "Pull (Strength)",
        exercises: [
          {
            name: "Weighted Pull-Up",
            sets: 5,
            reps: "4-6",
            note: "heavy back #2 — vertical",
          },
          {
            name: "Seated Cable Row",
            sets: 4,
            reps: "6-8",
            note: "heavy back #2 — horizontal",
          },
          { name: "Lat Pullover", sets: 3, reps: "10-12" },
          {
            name: "Barbell Curl",
            sets: 4,
            reps: "6-8",
            note: "bi #2 — heavy mid-range anchor",
          },
          {
            name: "Incline Dumbbell Curl",
            sets: 3,
            reps: "8-10",
            note: "bi #3 — stretch",
          },
          { name: "Rear Delt Fly", sets: 3, reps: "12-15", note: "rear delt" },
          {
            name: "Cable Lateral Raise",
            sets: 3,
            reps: "15-20",
            note: "delt #4",
          },
        ],
      },
      {
        name: "Day 5 — Legs",
        dayLabel: "Legs (Strength)",
        exercises: [
          { name: "Leg Press", sets: 5, reps: "3-5" },
          { name: "Lying Leg Curl", sets: 5, reps: "6-8" },
          {
            name: "Hip Adduction",
            sets: 4,
            reps: "6-8",
            note: "swapped from abduction",
          },
          { name: "Leg Extension", sets: 4, reps: "10-12" },
          {
            name: "Chest-Supported Row",
            sets: 3,
            reps: "8-10",
            note: "back #3 — light frequency filler",
          },
          { name: "Preacher Curl", sets: 3, reps: "8-10", note: "bi #3.5" },
          { name: "Standing Calf Raise", sets: 4, reps: "8-10" },
        ],
      },
    ],
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
