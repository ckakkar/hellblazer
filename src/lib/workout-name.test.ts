import { describe, expect, it } from "vitest";
import { workoutName } from "@/lib/workout-name";

describe("workoutName", () => {
  it("names a workout from its lifts", () => {
    expect(workoutName([])).toBe("Workout");
    expect(workoutName(["Machine Chest Press"])).toBe("Machine Chest Press");
    expect(workoutName(["Machine Chest Press", "Lat Pulldown"])).toBe("Machine Chest Press and Lat Pulldown");
    expect(workoutName(["Machine Chest Press", "Lat Pulldown", "Leg Extension", "Seated Dumbbell Shoulder Press"])).toBe(
      "Machine Chest Press, Lat Pulldown and 2 more",
    );
  });

  it("fits a template name", () => {
    expect(workoutName(["x".repeat(100), "y".repeat(100)]).length).toBeLessThanOrEqual(120);
  });
});
