import { describe, expect, it } from "vitest";
import { matchesExercise } from "./exercise-search";

const incline = { name: "Incline Dumbbell Press", primary_muscle: "chest" as const, equipment: "dumbbell" };
const rdl = { name: "Romanian Deadlift", primary_muscle: "hamstrings" as const, equipment: "barbell" };

describe("exercise search", () => {
  it("matches word by word, in any order, with gym shorthand", () => {
    expect(matchesExercise(incline, "incline db")).toBe(true);
    expect(matchesExercise(incline, "press chest")).toBe(true);
    expect(matchesExercise(rdl, "rdl")).toBe(true);
    expect(matchesExercise(rdl, "bb hamstrings")).toBe(true);
  });

  it("needs every word to match", () => {
    expect(matchesExercise(incline, "incline bb")).toBe(false);
    expect(matchesExercise(incline, "")).toBe(true);
  });
});
