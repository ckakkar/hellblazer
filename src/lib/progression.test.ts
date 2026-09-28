import { describe, expect, it } from "vitest";
import { increment, nextTarget, parseRange, targetLabel, targetReason, type Lift } from "@/lib/progression";

const bench: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "chest" };
const squat: Lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "quads" };
const curl: Lift = { equipment: "dumbbell", mechanic: "isolation", primaryMuscle: "biceps" };
const pullup: Lift = { equipment: "bodyweight", mechanic: "compound", primaryMuscle: "back" };

const sets = (...list: [number, number, (number | null)?][]) =>
  list.map(([weight, reps, rpe]) => ({ weight, reps, rpe: rpe ?? null }));

describe("parseRange", () => {
  it.each([
    ["8-12", [8, 12]],
    ["8–12", [8, 12]],
    [" 5 ", [5, 5]],
    ["3 to 5", [3, 5]],
  ])("%s", (range, bounds) => expect(parseRange(range)).toEqual(bounds));

  it("isn't a range", () => {
    expect(parseRange("AMRAP")).toBeNull();
    expect(parseRange(null)).toBeNull();
    expect(parseRange("12-8")).toBeNull();
  });
});

describe("increment", () => {
  it("steps as a gym does", () => {
    expect(increment(bench, "kg")).toBe(2.5);
    expect(increment(squat, "kg")).toBe(5);
    expect(increment(squat, "lb")).toBe(10);
    expect(increment(curl, "kg")).toBe(2);
    expect(increment(curl, "lb")).toBe(5);
  });
});

describe("nextTarget", () => {
  const target = (last: ReturnType<typeof sets>, range: string | null, lift = bench, unit: "kg" | "lb" = "kg") =>
    nextTarget({ last, range, lift, unit });

  it("adds weight once every set reached the top of the range", () => {
    expect(target(sets([80, 8], [80, 8], [80, 8, 8.5]), "6-8")).toEqual({ weight: 82.5, reps: 6, change: "up", added: 2.5 });
    expect(target(sets([140, 5], [140, 5]), "3-5", squat)).toMatchObject({ weight: 145, reps: 3 });
  });

  it("holds the weight when the last set was all-out, even at the top", () => {
    expect(target(sets([80, 8], [80, 8], [80, 8, 10]), "6-8")).toMatchObject({ weight: 80, reps: 8, change: "same" });
  });

  it("asks for one more rep inside the range", () => {
    expect(target(sets([80, 8], [80, 7], [80, 6]), "6-8")).toEqual({ weight: 80, reps: 7, change: "same", added: 0 });
  });

  it("holds the weight when last time fell short", () => {
    expect(target(sets([80, 6], [80, 4]), "6-8")).toEqual({ weight: 80, reps: 6, change: "hold", added: 0 });
  });

  it("reads the working weight, not the lighter back-off sets", () => {
    expect(target(sets([100, 5], [100, 5], [80, 10]), "3-5")).toMatchObject({ weight: 102.5, reps: 3, change: "up" });
  });

  it("goes up in reps on bodyweight work, and in weight once it's weighted", () => {
    expect(target(sets([0, 12], [0, 12]), "8-12", pullup)).toMatchObject({ weight: 0, reps: 13, change: "same" });
    expect(target(sets([20, 8], [20, 8]), "6-8", pullup)).toMatchObject({ weight: 22.5, reps: 6, change: "up" });
  });

  it("without a range: one more rep, or more weight when it was easy", () => {
    expect(target(sets([60, 10]), null)).toMatchObject({ weight: 60, reps: 11, change: "same" });
    expect(target(sets([60, 10, 7]), null)).toMatchObject({ weight: 62.5, reps: 10, change: "up" });
  });

  it("has nothing to say without last time", () => {
    expect(target([], "6-8")).toBeNull();
  });

  it("steps in pounds for a lifter in pounds", () => {
    expect(target(sets([185, 8], [185, 8]), "6-8", bench, "lb")).toMatchObject({ weight: 190, reps: 6 });
  });
});

describe("words", () => {
  it("labels and explains a target", () => {
    const t = { weight: 82.5, reps: 6, change: "up" as const, added: 2.5 };
    expect(targetLabel(t, "kg")).toBe("82.5 kg × 6");
    expect(targetReason(t, "kg")).toBe("up 2.5 kg");
    expect(targetLabel({ weight: 0, reps: 12 }, "kg")).toBe("Bodyweight × 12");
    expect(targetReason({ weight: 80, reps: 7, change: "same", added: 0 }, "kg")).toBe("one more rep");
  });
});
