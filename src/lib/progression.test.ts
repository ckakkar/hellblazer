import { describe, expect, it } from "vitest";
import { daysBetween, increment, nextTarget, parseRange, targetLabel, targetReason, type Lift } from "@/lib/progression";

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

describe("a shortened day", () => {
  const lift = { equipment: "barbell", mechanic: "compound", primaryMuscle: "chest" };
  it("doesn't add weight when fewer sets were done than planned", () => {
    expect(
      nextTarget({ last: [{ weight: 80, reps: 8, rpe: 7 }], range: "6-8", lift, unit: "kg", plannedSets: 3 }),
    ).toMatchObject({ weight: 80, reps: 8, change: "same" });
  });
  it("adds it once every planned set reached the top", () => {
    const sets = [1, 2, 3].map(() => ({ weight: 80, reps: 8, rpe: 8 }));
    expect(nextTarget({ last: sets, range: "6-8", lift, unit: "kg", plannedSets: 3 })).toMatchObject({
      weight: 82.5,
      reps: 6,
      change: "up",
    });
  });
});

describe("back after a break", () => {
  const back = (last: ReturnType<typeof sets>, range: string | null, daysOff: number, lift = bench, unit: "kg" | "lb" = "kg") =>
    nextTarget({ last, range, lift, unit, daysOff });

  it("counts calendar days", () => {
    expect(daysBetween("2026-10-01", "2026-10-29")).toBe(28);
    expect(daysBetween("2026-10-29", "2026-10-29")).toBe(0);
    // Across the clocks going back.
    expect(daysBetween("2026-10-20", "2026-11-03")).toBe(14);
  });

  it("is business as usual under three weeks", () => {
    expect(back(sets([100, 8], [100, 8]), "6-8", 20)).toMatchObject({ weight: 102.5, change: "up" });
  });

  it("starts about a tenth lighter at last time's reps, to the gym's steps", () => {
    expect(back(sets([100, 8], [100, 8]), "6-8", 28)).toEqual({
      weight: 90,
      reps: 8,
      change: "back",
      added: 0,
      weeksOff: 4,
    });
    // 62.5 × 0.9 = 56.25: the nearest bar load is 55.
    expect(back(sets([62.5, 10], [62.5, 9]), null, 35)).toMatchObject({ weight: 55, reps: 10, weeksOff: 5 });
    // Dumbbells go in 2 kg: 24 × 0.9 = 21.6, so 22.
    expect(back(sets([24, 12]), "10-12", 21, curl)).toMatchObject({ weight: 22, reps: 12, weeksOff: 3 });
    expect(back(sets([135, 5], [135, 5]), "5", 30, bench, "lb")).toMatchObject({ weight: 120, reps: 5 });
  });

  it("keeps the reps inside the range", () => {
    expect(back(sets([80, 5], [80, 4]), "6-8", 25)).toMatchObject({ weight: 72.5, reps: 6 });
  });

  it("takes at least one step off", () => {
    // 10 × 0.9 = 9, which rounds back up to 10 on 2.5 kg steps.
    expect(back(sets([10, 12]), null, 40, bench)).toMatchObject({ weight: 7.5, change: "back" });
  });

  it("asks for fewer reps at bodyweight, or when there's no step to take off", () => {
    expect(back(sets([0, 10], [0, 9]), null, 30, pullup)).toMatchObject({ weight: 0, reps: 9, change: "back" });
    expect(back(sets([2, 15]), null, 30, curl)).toMatchObject({ weight: 2, reps: 14, change: "back" });
  });

  it("says why", () => {
    expect(targetReason({ weight: 90, reps: 8, change: "back", added: 0, weeksOff: 4 }, "kg")).toBe(
      "10% under, 4 weeks off",
    );
  });
});
