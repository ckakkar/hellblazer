import { describe, expect, it } from "vitest";
import { coachLine, notebookSets, repsToBeat } from "./coach";

describe("notebookSets", () => {
  it("writes the weight once when it held", () => {
    expect(notebookSets([{ weight: 62.5, reps: 11 }, { weight: 62.5, reps: 11 }, { weight: 62.5, reps: 10 }], "kg")).toBe(
      "62.5 kg × 11, 11, 10",
    );
  });
  it("writes each set's weight when it changed", () => {
    expect(notebookSets([{ weight: 60, reps: 8 }, { weight: 62.5, reps: 6 }], "kg")).toBe("60 × 8, 62.5 × 6 kg");
  });
  it("calls bodyweight BW", () => {
    expect(notebookSets([{ weight: 0, reps: 12 }, { weight: 0, reps: 10 }], "kg")).toBe("BW × 12, 10");
  });
  it("is empty without sets", () => {
    expect(notebookSets([], "kg")).toBe("");
  });
});

describe("repsToBeat", () => {
  it("finds the reps that beat a best estimated max", () => {
    // 100 kg × 6 = 120; 100 × 7 = 123.3.
    expect(repsToBeat(100, 121)).toBe(7);
    expect(repsToBeat(100, 90)).toBe(1);
  });
});

describe("coachLine", () => {
  const base = { exercises: 5, done: 1, records: 0, next: null, unit: "kg" as const };

  it("says nothing without something to say", () => {
    expect(coachLine(base)).toBeNull();
  });

  it("names the reps that beat the best, when they're in reach", () => {
    const next = { name: "Bench Press", targetWeight: 100, targetWeightKg: 100, targetReps: 6, bestEst1rm: 121 };
    expect(coachLine({ ...base, next })).toBe("7 reps at 100 kg on Bench Press beats your best.");
    expect(coachLine({ ...base, next: { ...next, bestEst1rm: 140 } })).toBeNull();
  });

  it("counts records broken today", () => {
    expect(coachLine({ ...base, records: 2 })).toBe("2 records broken today.");
  });

  it("says when everything's done", () => {
    expect(coachLine({ ...base, done: 5, records: 1 })).toBe("Every exercise done, a record broken. Finish when you're ready.");
  });
});
