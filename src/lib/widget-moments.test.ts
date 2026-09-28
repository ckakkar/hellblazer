import { describe, expect, it } from "vitest";
import { latestRecord, trainingDays, weekStreak } from "@/lib/widget-moments";

// 2026-09-28 is a Monday.
describe("weekStreak", () => {
  const weeksOf = (mondays: string[], perWeek: number) =>
    mondays.flatMap((m) => Array.from({ length: perWeek }, () => m));

  it("counts weeks in a row with the plan hit, not holding this week against it", () => {
    const dates = weeksOf(["2026-09-21", "2026-09-14", "2026-09-07"], 4);
    expect(weekStreak(dates, "2026-09-28", 4)).toBe(3);
    expect(weekStreak([...dates, "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"], "2026-10-01", 4)).toBe(4);
  });

  it("stops at a week short of the plan", () => {
    const dates = [...weeksOf(["2026-09-21"], 4), ...weeksOf(["2026-09-14"], 3), ...weeksOf(["2026-09-07"], 4)];
    expect(weekStreak(dates, "2026-09-28", 4)).toBe(1);
  });

  it("wants one workout a week without a program", () => {
    expect(weekStreak(["2026-09-24", "2026-09-16"], "2026-09-28", null)).toBe(2);
    expect(weekStreak([], "2026-09-28", null)).toBe(0);
  });

  it("is broken by a missed week, even with this one hit", () => {
    expect(weekStreak(["2026-09-28", "2026-09-16"], "2026-09-28", null)).toBe(1);
  });
});

describe("trainingDays", () => {
  it("keeps the calendar's twelve weeks, each day once, oldest first", () => {
    expect(trainingDays(["2026-09-30", "2026-07-13", "2026-07-12", "2026-09-30", "2026-08-01"], "2026-09-30")).toEqual([
      "2026-07-13",
      "2026-08-01",
      "2026-09-30",
    ]);
  });
});

describe("latestRecord", () => {
  const bench = { id: "b", name: "Bench Press", bestWeight: 100, bestReps: 3, estimatedMax: 110, sessions: 20 };
  const squat = { id: "s", name: "Squat", bestWeight: 140, bestReps: 5, estimatedMax: 163, sessions: 3 };

  it("is the newest first-time-at-its-best across lifts", () => {
    const record = latestRecord(
      [bench, squat],
      [
        { id: "b", points: [{ date: "2026-09-01", e1rm: 105 }, { date: "2026-09-20", e1rm: 110 }, { date: "2026-09-25", e1rm: 110 }] },
        { id: "s", points: [{ date: "2026-09-10", e1rm: 150 }, { date: "2026-09-18", e1rm: 163.3 }] },
      ],
    );
    expect(record).toEqual({ name: "Bench Press", weight: 100, reps: 3, estimatedMax: 110, date: "2026-09-20" });
  });

  it("isn't a lift's first session, or a best from before the trend", () => {
    expect(latestRecord([{ ...squat, sessions: 1 }], [{ id: "s", points: [{ date: "2026-09-18", e1rm: 163 }] }])).toBeNull();
    expect(
      latestRecord([bench], [{ id: "b", points: [{ date: "2026-09-01", e1rm: 100 }, { date: "2026-09-20", e1rm: 104 }] }]),
    ).toBeNull();
  });
});
