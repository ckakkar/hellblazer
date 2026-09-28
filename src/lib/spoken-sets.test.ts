import { describe, expect, it } from "vitest";
import {
  describeSpokenSets,
  matchExercise,
  parseHeard,
  planSpokenSets,
  type HeardGroup,
  type SpokenExercise,
} from "@/lib/spoken-sets";

const heard = (g: Partial<HeardGroup>): HeardGroup => ({
  exercise: null,
  sets: 1,
  reps: null,
  weight: null,
  unit: null,
  rpe: null,
  warmup: false,
  ...g,
});

const workout: SpokenExercise[] = [
  { id: "bench", name: "Barbell Bench Press", same: { weight: 100, reps: 5 } },
  { id: "incline", name: "Incline Dumbbell Press", same: null },
  { id: "cgbp", name: "Close-Grip Bench Press", same: null },
  { id: "pullup", name: "Weighted Pull-Up", same: { weight: 20, reps: 6 } },
  { id: "raise", name: "Dumbbell Lateral Raise", same: { weight: 12, reps: 15 } },
  { id: "row", name: "Pendlay Row", same: null },
];

describe("matchExercise", () => {
  it.each([
    ["incline", "incline"],
    ["Incline Dumbbell Press", "incline"],
    ["incline DB press", "incline"],
    ["bench", "bench"],
    ["close grip", "cgbp"],
    ["pull-ups", "pullup"],
    ["pullups", "pullup"],
    ["lateral raises", "raise"],
    ["laterals", "raise"],
    ["rows", "row"],
  ])("%s is %s", (words, id) => {
    expect(matchExercise(words, workout)?.id).toBe(id);
  });

  it("finds nothing for an exercise the workout doesn't have", () => {
    expect(matchExercise("leg press", workout)).toBeNull();
    expect(matchExercise("the", workout)).toBeNull();
  });

  it("settles a tie on the one they're on", () => {
    const two = [
      { id: "a", name: "Incline Dumbbell Press" },
      { id: "b", name: "Incline Dumbbell Curl" },
    ];
    expect(matchExercise("incline", two)?.id).toBe("a");
    expect(matchExercise("incline", two, "b")?.id).toBe("b");
  });
});

describe("planSpokenSets", () => {
  const plan = (groups: HeardGroup[], current: string | null = "bench") =>
    planSpokenSets(groups, workout, { unit: "kg", current });

  it("spreads a run into its sets, the grinder apart", () => {
    const { sets, unmatched, unclear } = plan([
      heard({ exercise: "incline", sets: 2, reps: 8, weight: 30 }),
      heard({ exercise: "incline", sets: 1, reps: 8, weight: 30, rpe: 9 }),
    ]);
    expect(sets).toEqual([
      { exerciseId: "incline", weight: 30, reps: 8, rpe: null, warmup: false },
      { exerciseId: "incline", weight: 30, reps: 8, rpe: null, warmup: false },
      { exerciseId: "incline", weight: 30, reps: 8, rpe: 9, warmup: false },
    ]);
    expect(unmatched).toEqual([]);
    expect(unclear).toBe(0);
  });

  it("puts a run without an exercise on the one before it, else the current", () => {
    const { sets } = plan([
      heard({ exercise: "rows", sets: 1, reps: 8, weight: 60 }),
      heard({ sets: 2, weight: 65 }),
    ]);
    expect(sets.map((s) => [s.exerciseId, s.weight, s.reps])).toEqual([
      ["row", 60, 8],
      ["row", 65, 8],
      ["row", 65, 8],
    ]);
    expect(plan([heard({ reps: 3, weight: 110 })]).sets[0].exerciseId).toBe("bench");
  });

  it("fills numbers left out from the workout", () => {
    const { sets } = plan([heard({ exercise: "pull ups", sets: 2 }), heard({ exercise: "bench", reps: 3 })]);
    expect(sets.map((s) => [s.exerciseId, s.weight, s.reps])).toEqual([
      ["pullup", 20, 6],
      ["pullup", 20, 6],
      ["bench", 100, 3],
    ]);
  });

  it("leaves out a run with no reps to go on, and says what it couldn't find", () => {
    const { sets, unmatched, unclear } = plan([
      heard({ exercise: "incline", weight: 30 }),
      heard({ exercise: "leg press", reps: 10, weight: 200 }),
    ]);
    expect(sets).toEqual([]);
    expect(unclear).toBe(1);
    expect(unmatched).toEqual(["leg press"]);
  });

  it("converts a weight said in the other unit", () => {
    const kg = plan([heard({ reps: 5, weight: 225, unit: "lb" })]).sets[0];
    expect(kg.weight).toBe(102);
    const lb = planSpokenSets([heard({ reps: 5, weight: 100, unit: "kg" })], workout, { unit: "lb", current: "bench" })
      .sets[0];
    expect(lb.weight).toBe(220.5);
  });

  it("takes bodyweight when no weight is said or known", () => {
    expect(plan([heard({ exercise: "rows", reps: 10 })]).sets[0].weight).toBe(0);
  });

  it("doesn't let a warm-up set the numbers that follow", () => {
    const { sets } = plan([
      heard({ exercise: "bench", reps: 10, weight: 60, warmup: true }),
      heard({ sets: 1 }),
    ]);
    expect(sets[1]).toMatchObject({ weight: 100, reps: 5, warmup: false });
  });

  it("stops at 30 sets", () => {
    const groups = Array.from({ length: 5 }, () => heard({ sets: 10, reps: 5, weight: 100 }));
    expect(plan(groups).sets).toHaveLength(30);
  });
});

describe("parseHeard", () => {
  it("keeps what's in range and drops the rest", () => {
    expect(
      parseHeard([
        { exercise: "  bench ", sets: 3.2, reps: 8, weight: 80, unit: "kg", rpe: 8.7, warmup: false },
        { exercise: "", sets: 40, reps: 0, weight: -5, unit: "stone", rpe: 0, warmup: "yes" },
        "junk",
      ]),
    ).toEqual([
      { exercise: "bench", sets: 3, reps: 8, weight: 80, unit: "kg", rpe: 8.5, warmup: false },
      { exercise: null, sets: 10, reps: null, weight: null, unit: null, rpe: null, warmup: false },
    ]);
    expect(parseHeard({ sets: 1 })).toEqual([]);
  });
});

describe("describeSpokenSets", () => {
  const names = new Map(workout.map((e) => [e.id, e.name]));

  it("says a run once, and the effort", () => {
    const { sets } = planSpokenSets(
      [
        heard({ exercise: "incline", sets: 2, reps: 8, weight: 30 }),
        heard({ sets: 1, reps: 8, weight: 30, rpe: 9 }),
      ],
      workout,
      { unit: "kg", current: null },
    );
    expect(describeSpokenSets(sets, names, "kg")).toBe(
      "3 sets of 8 at 30 kg on Incline Dumbbell Press, the last at RPE 9",
    );
  });

  it("says changes of numbers, warm-ups and bodyweight, exercise by exercise", () => {
    const { sets } = planSpokenSets(
      [
        heard({ exercise: "bench", reps: 10, weight: 60, warmup: true }),
        heard({ reps: 5, weight: 100 }),
        heard({ reps: 4, weight: 105 }),
        heard({ exercise: "rows", reps: 12 }),
      ],
      workout,
      { unit: "kg", current: null },
    );
    expect(describeSpokenSets(sets, names, "kg")).toBe(
      "a warm-up of 10 at 60 kg, then 1 set of 5 at 100 kg, then 1 set of 4 at 105 kg on Barbell Bench Press; " +
        "1 set of 12 at bodyweight on Pendlay Row",
    );
  });
});
