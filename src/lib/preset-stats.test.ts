import { describe, expect, it } from "vitest";
import { lowReps, presetBreakdown, type LibraryMuscles } from "./preset-stats";
import type { Preset } from "./presets";

const library: LibraryMuscles = new Map([
  ["Barbell Bench Press", { primary: "chest", secondary: ["triceps", "front_delt"] }],
  ["Rope Pushdown", { primary: "triceps", secondary: [] }],
  ["Cable Lateral Raise", { primary: "side_delt", secondary: [] }],
]);

const preset: Preset = {
  id: "t",
  name: "Test · Test",
  fighter: "ohma",
  description: "",
  days: [
    {
      name: "A",
      dayLabel: "A",
      exercises: [
        { name: "Barbell Bench Press", sets: 5, reps: "3-5" },
        { name: "Rope Pushdown", sets: 3, reps: "10-12" },
        { name: "Cable Lateral Raise", sets: 4, reps: "15-20" },
      ],
    },
  ],
};

describe("presetBreakdown", () => {
  it("counts secondary muscles at half a set", () => {
    const b = presetBreakdown(preset, library);
    expect(b.muscles).toEqual([
      { muscle: "chest", sets: 5 },
      { muscle: "triceps", sets: 5.5 },
      { muscle: "side_delt", sets: 4 },
      { muscle: "front_delt", sets: 2.5 },
    ].sort((a, b) => b.sets - a.sets));
    expect(b.sets).toBe(12);
  });

  it("splits sets by the low end of each rep range", () => {
    expect(presetBreakdown(preset, library).ranges).toEqual({ strength: 5, hypertrophy: 3, endurance: 4 });
  });

  it("reads rep prescriptions", () => {
    expect(lowReps("3-5")).toBe(3);
    expect(lowReps("12")).toBe(12);
    expect(lowReps("AMRAP")).toBeNull();
  });
});
