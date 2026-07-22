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
  weeks?: number;
  days: PresetDay[];
};

export const PRESETS: Preset[] = [
  {
    id: "back-arm-strength",
    name: "Back & Arm Focused Strength",
    weeks: 8,
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
  {
    id: "upper-lower-4",
    name: "Upper / Lower · 4-Day Strength",
    weeks: 8,
    description:
      "The gold-standard 4-day split. Two upper + two lower days, heavy strength work up top then hypertrophy volume — the best frequency/recovery balance for natural strength gains.",
    days: [
      {
        name: "Day 1 — Upper A",
        dayLabel: "Upper A (Strength)",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: "4-6", note: "main press" },
          {
            name: "Weighted Pull-Up",
            sets: 4,
            reps: "4-6",
            note: "heavy vertical pull",
          },
          { name: "Overhead Press", sets: 3, reps: "5-8" },
          { name: "Barbell Row", sets: 3, reps: "6-8" },
          { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
          { name: "Barbell Curl", sets: 3, reps: "8-10" },
          { name: "Rope Pushdown", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 2 — Lower A",
        dayLabel: "Lower A (Strength)",
        exercises: [
          { name: "Barbell Back Squat", sets: 4, reps: "4-6", note: "main squat" },
          { name: "Romanian Deadlift", sets: 3, reps: "6-8" },
          { name: "Leg Press", sets: 3, reps: "8-12" },
          { name: "Lying Leg Curl", sets: 3, reps: "10-12" },
          { name: "Standing Calf Raise", sets: 4, reps: "8-12" },
          { name: "Hanging Leg Raise", sets: 3, reps: "12-15" },
        ],
      },
      {
        name: "Day 3 — Upper B",
        dayLabel: "Upper B (Hypertrophy)",
        exercises: [
          { name: "Incline Barbell Press", sets: 4, reps: "6-8" },
          { name: "Lat Pulldown", sets: 4, reps: "8-10" },
          { name: "Seated Dumbbell Shoulder Press", sets: 3, reps: "8-10" },
          { name: "Seated Cable Row", sets: 3, reps: "10-12" },
          { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15" },
          { name: "Incline Dumbbell Curl", sets: 3, reps: "10-12" },
          { name: "Overhead Cable Extension", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 4 — Lower B",
        dayLabel: "Lower B (Strength)",
        exercises: [
          { name: "Deadlift", sets: 4, reps: "3-5", note: "main pull" },
          { name: "Bulgarian Split Squat", sets: 3, reps: "8-10" },
          { name: "Leg Extension", sets: 3, reps: "12-15" },
          { name: "Seated Leg Curl", sets: 3, reps: "10-12" },
          { name: "Seated Calf Raise", sets: 4, reps: "12-15" },
          { name: "Cable Crunch", sets: 3, reps: "12-15" },
        ],
      },
    ],
  },
  {
    id: "ppl-6",
    name: "Push / Pull / Legs ×2 · 6-Day",
    weeks: 8,
    description:
      "PPLPPL — the highest-frequency hypertrophy-strength split. Each muscle trained twice weekly: a heavy strength day and a higher-volume day. For advanced lifters who recover well.",
    days: [
      {
        name: "Day 1 — Push A",
        dayLabel: "Push A (Strength)",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: "4-6" },
          { name: "Overhead Press", sets: 3, reps: "5-8" },
          { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
          { name: "Cable Lateral Raise", sets: 4, reps: "12-15" },
          { name: "Close-Grip Bench Press", sets: 3, reps: "6-8" },
          { name: "Rope Pushdown", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 2 — Pull A",
        dayLabel: "Pull A (Strength)",
        exercises: [
          { name: "Weighted Pull-Up", sets: 4, reps: "4-6" },
          { name: "Barbell Row", sets: 4, reps: "5-8" },
          { name: "Lat Pulldown", sets: 3, reps: "8-10" },
          { name: "Face Pull", sets: 3, reps: "15-20" },
          { name: "Barbell Curl", sets: 3, reps: "8-10" },
          { name: "Hammer Curl", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 3 — Legs A",
        dayLabel: "Legs A (Strength)",
        exercises: [
          { name: "Barbell Back Squat", sets: 4, reps: "4-6" },
          { name: "Romanian Deadlift", sets: 3, reps: "6-8" },
          { name: "Leg Press", sets: 3, reps: "8-12" },
          { name: "Lying Leg Curl", sets: 3, reps: "10-12" },
          { name: "Standing Calf Raise", sets: 4, reps: "8-12" },
        ],
      },
      {
        name: "Day 4 — Push B",
        dayLabel: "Push B (Hypertrophy)",
        exercises: [
          { name: "Incline Barbell Press", sets: 4, reps: "6-8" },
          { name: "Machine Chest Press", sets: 3, reps: "8-12" },
          { name: "Seated Dumbbell Shoulder Press", sets: 3, reps: "8-10" },
          { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-20" },
          { name: "Overhead Cable Extension", sets: 3, reps: "10-12" },
          { name: "Triceps Pushdown", sets: 3, reps: "12-15" },
        ],
      },
      {
        name: "Day 5 — Pull B",
        dayLabel: "Pull B (Hypertrophy)",
        exercises: [
          { name: "Lat Pulldown", sets: 4, reps: "8-12" },
          { name: "Seated Cable Row", sets: 4, reps: "8-12" },
          { name: "Chest-Supported Row", sets: 3, reps: "10-12" },
          { name: "Rear Delt Fly", sets: 3, reps: "15-20" },
          { name: "Incline Dumbbell Curl", sets: 3, reps: "10-12" },
          { name: "Preacher Curl", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 6 — Legs B",
        dayLabel: "Legs B (Hypertrophy)",
        exercises: [
          { name: "Hack Squat", sets: 4, reps: "8-12" },
          { name: "Bulgarian Split Squat", sets: 3, reps: "8-10" },
          { name: "Leg Extension", sets: 3, reps: "12-15" },
          { name: "Seated Leg Curl", sets: 3, reps: "12-15" },
          { name: "Seated Calf Raise", sets: 4, reps: "12-15" },
          { name: "Hanging Leg Raise", sets: 3, reps: "12-15" },
        ],
      },
    ],
  },
  {
    id: "full-body-4",
    name: "Full Body · 4-Day Strength",
    weeks: 8,
    description:
      "Four full-body days, each built around one main lift (squat / deadlift / bench / pull). Maximal frequency on the big lifts — the fastest route to raw strength for busy or intermediate lifters.",
    days: [
      {
        name: "Day 1 — Squat Focus",
        dayLabel: "Full Body A",
        exercises: [
          { name: "Barbell Back Squat", sets: 4, reps: "5", note: "top priority" },
          { name: "Barbell Bench Press", sets: 3, reps: "5-8" },
          { name: "Barbell Row", sets: 3, reps: "6-8" },
          { name: "Overhead Press", sets: 3, reps: "8-10" },
          { name: "Lying Leg Curl", sets: 3, reps: "10-12" },
          { name: "Standing Calf Raise", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 2 — Deadlift Focus",
        dayLabel: "Full Body B",
        exercises: [
          { name: "Deadlift", sets: 4, reps: "3-5", note: "top priority" },
          { name: "Overhead Press", sets: 3, reps: "5-8" },
          { name: "Lat Pulldown", sets: 3, reps: "8-10" },
          { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
          { name: "Leg Extension", sets: 3, reps: "12-15" },
          { name: "Cable Crunch", sets: 3, reps: "12-15" },
        ],
      },
      {
        name: "Day 3 — Bench Focus",
        dayLabel: "Full Body C",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: "4-6", note: "top priority" },
          { name: "Hack Squat", sets: 3, reps: "8-10" },
          { name: "Weighted Pull-Up", sets: 3, reps: "6-8" },
          { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
          { name: "Dumbbell Lateral Raise", sets: 3, reps: "12-15" },
          { name: "Barbell Curl", sets: 3, reps: "10-12" },
        ],
      },
      {
        name: "Day 4 — Pull Focus",
        dayLabel: "Full Body D",
        exercises: [
          { name: "Weighted Pull-Up", sets: 4, reps: "5", note: "top priority" },
          { name: "Leg Press", sets: 3, reps: "8-12" },
          { name: "Incline Barbell Press", sets: 3, reps: "6-8" },
          { name: "Seated Cable Row", sets: 3, reps: "8-10" },
          { name: "Hip Thrust", sets: 3, reps: "8-12" },
          { name: "Rope Pushdown", sets: 3, reps: "12-15" },
        ],
      },
    ],
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
