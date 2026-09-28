import { describe, expect, it } from "vitest";
import type { WatchExercise } from "./protocol";
import {
  activitySummary,
  exerciseForNextSet,
  isComplete,
  nextUnfinished,
  restsAfter,
  sameAgain,
} from "./next-set";

function ex(id: string, targetSets: number | null, done: number, last: [number, number][] = []): WatchExercise {
  return {
    id,
    name: id.toUpperCase(),
    targetSets,
    targetReps: null,
    restSeconds: null,
    sets: Array.from({ length: done }, (_, i) => ({
      id: `${id}-${i + 1}`,
      n: i + 1,
      weight: 60 + i * 2.5,
      reps: 5,
      warmup: false,
    })),
    last: last.map(([weight, reps]) => ({ weight, reps })),
    target: null,
    superset: null,
  };
}

describe("which exercise the next set goes to", () => {
  it("starts on the first exercise", () => {
    expect(exerciseForNextSet([ex("a", 3, 0), ex("b", 3, 0)])?.id).toBe("a");
  });

  it("stays on the exercise being worked until its target's met", () => {
    expect(exerciseForNextSet([ex("a", 3, 2), ex("b", 3, 0)])?.id).toBe("a");
    expect(exerciseForNextSet([ex("a", 3, 3), ex("b", 3, 0)])?.id).toBe("b");
  });

  it("comes back round to one that was skipped", () => {
    const exercises = [ex("a", 3, 3), ex("b", 3, 0), ex("c", 3, 3)];
    expect(exerciseForNextSet(exercises)?.id).toBe("b");
    expect(nextUnfinished(exercises, 2)?.id).toBe("b");
  });

  it("never moves on from an exercise without a target", () => {
    expect(exerciseForNextSet([ex("a", null, 6), ex("b", 3, 0)])?.id).toBe("a");
  });

  it("moves on from one the lifter ended early", () => {
    expect(exerciseForNextSet([ex("a", 4, 2), ex("b", 3, 0)], new Set(["a"]))?.id).toBe("b");
  });

  it("stays on the last exercise once everything's done", () => {
    expect(exerciseForNextSet([ex("a", 3, 3), ex("b", 2, 2)])?.id).toBe("b");
  });
});

describe("when a workout's done", () => {
  it("is done when every target is met", () => {
    expect(isComplete([ex("a", 3, 3), ex("b", 2, 2)])).toBe(true);
    expect(isComplete([ex("a", 3, 3), ex("b", 2, 1)])).toBe(false);
  });

  it("counts an exercise added without a target once it has a set", () => {
    expect(isComplete([ex("a", 3, 3), ex("extra", null, 0)])).toBe(false);
    expect(isComplete([ex("a", 3, 3), ex("extra", null, 1)])).toBe(true);
  });

  it("never calls a freeform session done", () => {
    expect(isComplete([ex("a", null, 5)])).toBe(false);
  });
});

describe("same again", () => {
  it("repeats this session's last set", () => {
    expect(sameAgain(ex("a", 3, 2))).toEqual({ weight: 62.5, reps: 5 });
  });

  it("falls back on last time's first set for a fresh exercise", () => {
    expect(sameAgain(ex("a", 3, 0, [[80, 6], [80, 5]]))).toEqual({ weight: 80, reps: 6 });
  });

  it("has nothing to repeat on a first-ever exercise", () => {
    expect(sameAgain(ex("a", 3, 0))).toBeNull();
  });

  it("starts a fresh exercise at today's target, then repeats the set before", () => {
    const fresh = { ...ex("a", 3, 0, [[80, 8], [80, 8]]), target: { weight: 82.5, reps: 6 } };
    expect(sameAgain(fresh)).toEqual({ weight: 82.5, reps: 6 });
    expect(sameAgain({ ...ex("a", 3, 1), target: { weight: 82.5, reps: 6 } })).toEqual({ weight: 60, reps: 5 });
  });
});

describe("the Live Activity's view", () => {
  it("words it as the page does", () => {
    const workout = { id: "s", title: "Upper", startedAt: 1, exercises: [ex("a", 3, 2), ex("b", 3, 0)] };
    expect(activitySummary(workout, workout.exercises[0], false, "kg")).toMatchObject({
      exercise: "A",
      detail: "2 sets done",
      sets: 2,
      volume: "613 kg",
      next: { sessionExerciseId: "a", weight: 62.5, reps: 5, label: "62.5 kg × 5" },
    });
    expect(activitySummary(workout, workout.exercises[0], true, "kg").next).toBeNull();
    expect(activitySummary(workout, workout.exercises[1], false, "kg").detail).toBe("Up next");
    expect(activitySummary(workout, workout.exercises[0], true, "kg").detail).toBe("All sets done");
  });
});

describe("supersets", () => {
  const pair = (a: number, b: number, target: number | null = 3) => [
    { ...ex("a", target, a), superset: 1 },
    { ...ex("b", target, b), superset: 1 },
    ex("c", target, 0),
  ];

  it("alternates between the pair, the one behind going next", () => {
    expect(exerciseForNextSet(pair(1, 0))?.id).toBe("b");
    expect(exerciseForNextSet(pair(1, 1))?.id).toBe("a");
    expect(exerciseForNextSet(pair(2, 1))?.id).toBe("b");
  });

  it("moves on once both are done", () => {
    expect(exerciseForNextSet(pair(3, 3))?.id).toBe("c");
  });

  it("finishes the one still going when the other's done", () => {
    expect(exerciseForNextSet([{ ...ex("a", 2, 2), superset: 1 }, { ...ex("b", 4, 2), superset: 1 }])?.id).toBe("b");
  });

  it("rests after the round, not between the pair", () => {
    expect(restsAfter(pair(1, 0), "a")).toBe(false);
    expect(restsAfter(pair(1, 1), "b")).toBe(true);
    expect(restsAfter([ex("a", 3, 1), ex("b", 3, 0)], "a")).toBe(true);
  });

  it("doesn't count a drop set toward the plan, or copy its numbers", () => {
    const withDrop = {
      ...ex("a", 2, 1),
      sets: [
        { id: "a-1", n: 1, weight: 100, reps: 8, warmup: false },
        { id: "a-2", n: 2, weight: 80, reps: 10, warmup: false, kind: "drop" },
      ],
    };
    expect(exerciseForNextSet([withDrop, ex("b", 2, 0)])?.id).toBe("a");
    expect(sameAgain(withDrop)).toEqual({ weight: 100, reps: 8 });
  });
});
