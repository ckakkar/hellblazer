import { describe, expect, it } from "vitest";
import type { WatchExercise } from "./protocol";
import {
  activitySummary,
  exerciseForNextSet,
  isComplete,
  nextUnfinished,
  sameAgain,
} from "./next-set";

function ex(id: string, targetSets: number | null, done: number, last: [number, number][] = []): WatchExercise {
  return {
    id,
    name: id.toUpperCase(),
    targetSets,
    targetReps: null,
    sets: Array.from({ length: done }, (_, i) => ({
      id: `${id}-${i + 1}`,
      n: i + 1,
      weight: 60 + i * 2.5,
      reps: 5,
      warmup: false,
    })),
    last: last.map(([weight, reps]) => ({ weight, reps })),
  };
}

describe("which exercise the next set goes to", () => {
  it("starts on the first exercise", () => {
    expect(exerciseForNextSet([ex("a", 3, 0), ex("b", 3, 0)], null)?.id).toBe("a");
  });

  it("stays on the exercise being worked until its target's met", () => {
    expect(exerciseForNextSet([ex("a", 3, 2), ex("b", 3, 0)], "a")?.id).toBe("a");
    expect(exerciseForNextSet([ex("a", 3, 3), ex("b", 3, 0)], "a")?.id).toBe("b");
  });

  it("comes back round to one that was skipped", () => {
    const exercises = [ex("a", 3, 3), ex("b", 3, 0), ex("c", 3, 3)];
    expect(exerciseForNextSet(exercises, "c")?.id).toBe("b");
    expect(nextUnfinished(exercises, 2)?.id).toBe("b");
  });

  it("never moves on from an exercise without a target", () => {
    expect(exerciseForNextSet([ex("a", null, 6), ex("b", 3, 0)], "a")?.id).toBe("a");
  });

  it("stays on the last exercise once everything's done", () => {
    expect(exerciseForNextSet([ex("a", 3, 3), ex("b", 2, 2)], "b")?.id).toBe("b");
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
});

describe("the Live Activity's view", () => {
  it("words it as the page does", () => {
    const workout = { id: "s", title: "Upper", startedAt: 1, exercises: [ex("a", 3, 2), ex("b", 3, 0)] };
    expect(activitySummary(workout, workout.exercises[0], false, "kg")).toMatchObject({
      exercise: "A",
      detail: "2 sets done",
      sets: 2,
      volume: "613 kg",
    });
    expect(activitySummary(workout, workout.exercises[1], false, "kg").detail).toBe("Up next");
    expect(activitySummary(workout, workout.exercises[0], true, "kg").detail).toBe("All sets done");
  });
});
