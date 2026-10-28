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
  it("keeps the calendar's 26 weeks, each day once, oldest first", () => {
    expect(
      trainingDays(["2026-09-30", "2026-07-13", "2026-04-05", "2026-04-06", "2026-09-30", "2026-08-01"], "2026-09-30"),
    ).toEqual(["2026-04-06", "2026-07-13", "2026-08-01", "2026-09-30"]);
  });
});

describe("latestRecord", () => {
  const bench = { id: "b", name: "Bench Press", bestWeight: 100, bestReps: 3, estimatedMax: 110 };
  const squat = { id: "s", name: "Squat", bestWeight: 140, bestReps: 5, estimatedMax: 163 };

  it("is the latest lift to reach its all-time best, on the day it first did", () => {
    const record = latestRecord(
      [bench, squat],
      [
        { id: "b", date: "2026-09-20", sessionsBefore: 12 },
        { id: "s", date: "2026-09-18", sessionsBefore: 2 },
      ],
    );
    expect(record).toEqual({ name: "Bench Press", weight: 100, reps: 3, estimatedMax: 110, date: "2026-09-20" });
  });

  it("keeps a best reached long ago on its own date, however often it's matched since", () => {
    // 100 sessions in, the best was first reached in session 40, in June.
    expect(latestRecord([bench], [{ id: "b", date: "2026-06-02", sessionsBefore: 39 }])?.date).toBe("2026-06-02");
  });

  it("doesn't call a lift's first session a record", () => {
    expect(latestRecord([squat], [{ id: "s", date: "2026-09-18", sessionsBefore: 0 }])).toBeNull();
    expect(latestRecord([bench], [])).toBeNull();
  });
});
