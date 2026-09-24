/**
 * Starter routines a user can load with one click. Exercise names here must
 * match the seeded exercise-library names exactly (looked up at load time).
 *
 * "Back & Arm Focused Strength" is the user's real 5-day weak-point split
 * (back · biceps · triceps · side delts): heavy compounds first (3-6), then
 * isolation in hypertrophy ranges (8-20).
 */
import type { TierKey } from "@/lib/tiers";

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
  /** The fighter whose style names the program; their portrait fronts its card. */
  fighter: TierKey;
  description: string;
  weeks?: number;
  days: PresetDay[];
};

export const PRESETS: Preset[] = [
  {
    id: "back-arm-strength",
    name: "Niko Style · Back & Arm Strength",
    fighter: "ohma",
    weeks: 8,
    description:
      "5-day weak-point split: back · biceps · triceps · side delts. Heavy compounds first (3-6), isolation after in hypertrophy ranges.",
    days: [
      {
        name: "Day 1: Upper",
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
        name: "Day 2: Lower",
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
            note: "delt #2: low-fatigue filler",
          },
        ],
      },
      {
        name: "Day 3: Push",
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
        name: "Day 4: Pull",
        dayLabel: "Pull (Strength)",
        exercises: [
          {
            name: "Weighted Pull-Up",
            sets: 5,
            reps: "4-6",
            note: "heavy back #2: vertical",
          },
          {
            name: "Seated Cable Row",
            sets: 4,
            reps: "6-8",
            note: "heavy back #2: horizontal",
          },
          { name: "Lat Pullover", sets: 3, reps: "10-12" },
          {
            name: "Barbell Curl",
            sets: 4,
            reps: "6-8",
            note: "bi #2: heavy mid-range anchor",
          },
          {
            name: "Incline Dumbbell Curl",
            sets: 3,
            reps: "8-10",
            note: "bi #3: stretch",
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
        name: "Day 5: Legs",
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
            note: "back #3: light frequency filler",
          },
          { name: "Preacher Curl", sets: 3, reps: "8-10", note: "bi #3.5" },
          { name: "Standing Calf Raise", sets: 4, reps: "8-10" },
        ],
      },
    ],
  },
  {
    id: "upper-lower-arms-5",
    name: "Hatsumi Aikido · Upper/Lower + Arms 5-Day",
    fighter: "hatsumi",
    weeks: 8,
    description:
      "Two upper days, two lower days and an arms day: Mon, Tue, Thu, Fri, Sat, with Wednesday and Sunday off. Each upper and lower day opens heavy (3-6 reps), then works down to isolation; Saturday adds direct arm, side-delt and rear-delt volume.",
    days: [
      {
        name: "Day 1: Upper A",
        dayLabel: "Upper A (Mon)",
        exercises: [
          { name: "Barbell Bench Press", sets: 4, reps: "3-5", note: "main press" },
          { name: "Weighted Pull-Up", sets: 3, reps: "4-6" },
          { name: "Overhead Press", sets: 2, reps: "6-8" },
          { name: "Seated Cable Row", sets: 3, reps: "6-8" },
          { name: "Incline Dumbbell Curl", sets: 3, reps: "8-12" },
          { name: "Overhead Cable Extension", sets: 3, reps: "10-15" },
        ],
      },
      {
        name: "Day 2: Lower A",
        dayLabel: "Lower A (Tue)",
        exercises: [
          { name: "Leg Press", sets: 4, reps: "4-6", note: "heavy" },
          { name: "Romanian Deadlift", sets: 3, reps: "6-8" },
          { name: "Lying Leg Curl", sets: 3, reps: "8-12" },
          { name: "Standing Calf Raise", sets: 3, reps: "8-12" },
          { name: "Hanging Leg Raise", sets: 3, reps: "10-15" },
        ],
      },
      {
        name: "Day 3: Upper B",
        dayLabel: "Upper B (Thu)",
        exercises: [
          { name: "Overhead Press", sets: 3, reps: "3-5", note: "main press" },
          { name: "Barbell Bench Press", sets: 3, reps: "6-8" },
          { name: "Pull-Up", sets: 3, reps: "6-8", note: "add weight as needed" },
          { name: "Seated Cable Row", sets: 2, reps: "6-8" },
          { name: "Preacher Curl", sets: 3, reps: "8-12" },
          { name: "Rope Pushdown", sets: 3, reps: "10-15" },
          { name: "Cable Lateral Raise", sets: 3, reps: "12-20" },
        ],
      },
      {
        name: "Day 4: Lower B",
        dayLabel: "Lower B (Fri)",
        exercises: [
          { name: "Romanian Deadlift", sets: 3, reps: "5-6", note: "main hinge" },
          { name: "Leg Press", sets: 3, reps: "6-8", note: "lighter than Tuesday" },
          { name: "Lying Leg Curl", sets: 2, reps: "10-15" },
          { name: "Seated Calf Raise", sets: 3, reps: "10-15" },
          { name: "Cable Crunch", sets: 3, reps: "10-15" },
        ],
      },
      {
        name: "Day 5: Arms",
        dayLabel: "Arms (Sat)",
        exercises: [
          { name: "Preacher Curl", sets: 3, reps: "8-12" },
          { name: "Overhead Cable Extension", sets: 3, reps: "10-15" },
          { name: "Hammer Curl", sets: 3, reps: "10-15" },
          { name: "Rope Pushdown", sets: 3, reps: "10-15" },
          { name: "Cable Lateral Raise", sets: 3, reps: "12-20" },
          { name: "Rear Delt Fly", sets: 3, reps: "12-20" },
        ],
      },
    ],
  },
  {
    id: "ppl-6",
    name: "Kaiwan Style · Push/Pull/Legs ×2",
    fighter: "kuroki",
    weeks: 8,
    description:
      "PPLPPL: the highest-frequency hypertrophy-strength split. Each muscle trained twice weekly: a heavy strength day and a higher-volume day. For advanced lifters who recover well.",
    days: [
      {
        name: "Day 1: Push A",
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
        name: "Day 2: Pull A",
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
        name: "Day 3: Legs A",
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
        name: "Day 4: Push B",
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
        name: "Day 5: Pull B",
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
        name: "Day 6: Legs B",
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
    id: "full-body-5",
    name: "Formless · Full-Body 5-Day",
    fighter: "agito",
    weeks: 8,
    description:
      "Five full-body days, each led by one heavy lift (squat, bench, deadlift, overhead press, weighted pull-up) at 3-5 reps, then moderate compounds and isolation. Every major muscle gets 10-17 hard sets a week, pushing and pulling evenly; biceps, triceps and side delts get direct work every session.",
    days: [
      {
        name: "Day 1: Squat Focus",
        dayLabel: "Full Body A",
        exercises: [
          {
            name: "Barbell Back Squat",
            sets: 5,
            reps: "3-5",
            note: "main lift: add load when every set hits 5",
          },
          { name: "Incline Dumbbell Press", sets: 3, reps: "6-8" },
          { name: "Chest-Supported Row", sets: 3, reps: "8-10" },
          { name: "Dumbbell Lateral Raise", sets: 4, reps: "12-15", note: "delt #1" },
          {
            name: "Incline Dumbbell Curl",
            sets: 3,
            reps: "10-12",
            note: "bi #1: stretch, superset with tri",
          },
          {
            name: "Overhead Cable Extension",
            sets: 3,
            reps: "10-12",
            note: "tri #1: long head",
          },
          { name: "Hanging Leg Raise", sets: 3, reps: "10-15" },
        ],
      },
      {
        name: "Day 2: Bench Focus",
        dayLabel: "Full Body B",
        exercises: [
          {
            name: "Barbell Bench Press",
            sets: 5,
            reps: "3-5",
            note: "main lift: add load when every set hits 5",
          },
          { name: "Weighted Pull-Up", sets: 3, reps: "6-8" },
          { name: "Romanian Deadlift", sets: 3, reps: "6-8" },
          { name: "Cable Lateral Raise", sets: 3, reps: "12-15", note: "delt #2" },
          {
            name: "Barbell Curl",
            sets: 3,
            reps: "6-8",
            note: "bi #2: heavy, superset with tri",
          },
          { name: "Skull Crusher", sets: 3, reps: "8-10", note: "tri #2" },
          { name: "Standing Calf Raise", sets: 3, reps: "8-12" },
        ],
      },
      {
        name: "Day 3: Deadlift Focus",
        dayLabel: "Full Body C",
        exercises: [
          {
            name: "Deadlift",
            sets: 3,
            reps: "3-5",
            note: "main lift: fewer, heavier sets",
          },
          { name: "Weighted Dip", sets: 3, reps: "6-8" },
          { name: "Lat Pulldown", sets: 3, reps: "8-10" },
          { name: "Seated Leg Curl", sets: 3, reps: "10-12" },
          {
            name: "Leaning Cable Lateral Raise",
            sets: 3,
            reps: "12-15",
            note: "delt #3",
          },
          {
            name: "Hammer Curl",
            sets: 3,
            reps: "10-12",
            note: "bi #3: brachialis, superset with tri",
          },
          { name: "Rope Pushdown", sets: 3, reps: "12-15", note: "tri #3" },
          { name: "Seated Calf Raise", sets: 3, reps: "12-15" },
        ],
      },
      {
        name: "Day 4: Press Focus",
        dayLabel: "Full Body D",
        exercises: [
          {
            name: "Overhead Press",
            sets: 5,
            reps: "3-5",
            note: "main lift: add load when every set hits 5",
          },
          { name: "Leg Press", sets: 3, reps: "8-10" },
          { name: "Barbell Row", sets: 3, reps: "6-8" },
          { name: "Lying Leg Curl", sets: 3, reps: "10-12" },
          { name: "Dumbbell Lateral Raise", sets: 3, reps: "12-15", note: "delt #4" },
          {
            name: "Preacher Curl",
            sets: 3,
            reps: "8-10",
            note: "bi #4, superset with tri",
          },
          {
            name: "Close-Grip Bench Press",
            sets: 3,
            reps: "6-8",
            note: "tri #4: heavy anchor",
          },
          { name: "Cable Crunch", sets: 3, reps: "10-15" },
        ],
      },
      {
        name: "Day 5: Pull Focus",
        dayLabel: "Full Body E",
        exercises: [
          {
            name: "Weighted Pull-Up",
            sets: 5,
            reps: "3-5",
            note: "main lift: add load when every set hits 5",
          },
          { name: "Incline Barbell Press", sets: 3, reps: "6-8" },
          { name: "Hack Squat", sets: 3, reps: "8-10" },
          { name: "Cable Lateral Raise", sets: 4, reps: "15-20", note: "delt #5" },
          { name: "Rear Delt Fly", sets: 3, reps: "12-15" },
          {
            name: "Lean-Forward Cable Curl",
            sets: 3,
            reps: "10-12",
            note: "bi #5: peak contraction, superset with tri",
          },
          {
            name: "Overhead Dumbbell Extension",
            sets: 3,
            reps: "10-12",
            note: "tri #5: long head",
          },
        ],
      },
    ],
  },
  {
    id: "dumbbell-home-5",
    name: "Kure Clan · Dumbbell Home Circuit",
    fighter: "raian",
    weeks: 8,
    description:
      "A dumbbell-only, home-friendly 5-day split, glute & leg focused with dedicated shoulders/arms, back/core, and posterior-chain days. No machines, no barbell: just a pair of dumbbells.",
    days: [
      {
        name: "Day 1: Legs & Glutes",
        dayLabel: "Legs & Glutes (Quad-dominant)",
        exercises: [
          { name: "Goblet Squat", sets: 3, reps: "12" },
          { name: "Dumbbell Forward Lunge", sets: 3, reps: "10", note: "per leg" },
          {
            name: "Dumbbell Step-Up",
            sets: 3,
            reps: "10",
            note: "per leg · chair/bench",
          },
          { name: "Sumo Squat", sets: 3, reps: "12" },
          { name: "Standing Calf Raise", sets: 3, reps: "15", note: "dumbbells in hand" },
        ],
      },
      {
        name: "Day 2: Shoulders & Arms",
        dayLabel: "Upper Body (Shoulders & Arms)",
        exercises: [
          { name: "Seated Dumbbell Shoulder Press", sets: 3, reps: "10" },
          { name: "Dumbbell Lateral Raise", sets: 3, reps: "12" },
          { name: "Dumbbell Curl", sets: 3, reps: "12" },
          { name: "Skull Crusher", sets: 3, reps: "12", note: "dumbbells" },
          { name: "Dumbbell Front Raise", sets: 3, reps: "12" },
        ],
      },
      {
        name: "Day 3: Glutes & Hamstrings",
        dayLabel: "Glutes & Hamstrings (Posterior chain)",
        exercises: [
          { name: "Dumbbell Romanian Deadlift", sets: 3, reps: "12" },
          { name: "Single-Leg Romanian Deadlift", sets: 3, reps: "8", note: "per leg" },
          { name: "Glute Bridge", sets: 3, reps: "15", note: "dumbbell on hips" },
          { name: "Curtsy Lunge", sets: 3, reps: "10", note: "per leg" },
          { name: "Donkey Kick", sets: 3, reps: "12", note: "per leg · weighted" },
        ],
      },
      {
        name: "Day 4: Back & Core",
        dayLabel: "Upper Body (Back & Core)",
        exercises: [
          { name: "Dumbbell Bent-Over Row", sets: 3, reps: "12" },
          { name: "Renegade Row", sets: 3, reps: "8", note: "per side" },
          { name: "Dumbbell Pullover", sets: 3, reps: "12" },
          { name: "Weighted Crunch", sets: 3, reps: "15" },
          { name: "Russian Twist", sets: 3, reps: "12", note: "per side" },
        ],
      },
      {
        name: "Day 5: Glutes Focus",
        dayLabel: "Glutes Focus",
        exercises: [
          { name: "Bulgarian Split Squat", sets: 3, reps: "10", note: "per leg" },
          { name: "Sumo Deadlift", sets: 3, reps: "12" },
          { name: "Fire Hydrant", sets: 3, reps: "12", note: "per leg · weighted" },
          { name: "Hip Thrust", sets: 3, reps: "15", note: "dumbbell on hips" },
          { name: "Lateral Lunge", sets: 3, reps: "10", note: "per leg" },
        ],
      },
    ],
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
