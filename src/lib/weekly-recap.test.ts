import { describe, expect, it } from "vitest";
import { recapMessage, recapWeek } from "./weekly-recap";

describe("when the recap goes out", () => {
  // 2026-09-27 is a Sunday; the week began Monday 2026-09-21.
  it("goes on Sunday evening", () => {
    expect(recapWeek("2026-09-27", 21)).toBe("2026-09-21");
  });

  it("goes on Monday morning where the run lands then, for the week just gone", () => {
    expect(recapWeek("2026-09-28", 1)).toBe("2026-09-21");
  });

  it("waits out Sunday morning, and skips the rest of the week", () => {
    expect(recapWeek("2026-09-27", 9)).toBeNull();
    expect(recapWeek("2026-09-28", 15)).toBeNull();
    expect(recapWeek("2026-09-24", 21)).toBeNull();
  });
});

describe("what it says", () => {
  it("counts the week against the plan, with bests and the weakest point", () => {
    expect(
      recapMessage({
        sessions: 4,
        planned: 5,
        sets: 62,
        records: ["Bench Press", "Barbell Row", "Squat"],
        weakest: { label: "Side delts", sets: 6 },
      }),
    ).toEqual({
      title: "4 of 5 workouts this week",
      body: "62 working sets. New bests on Bench Press, Barbell Row and 1 more. Side delts is lowest at 6 sets.",
    });
  });

  it("says when every weak point got its sets", () => {
    expect(
      recapMessage({ sessions: 1, planned: null, sets: 18, records: ["Deadlift"], weakest: null }).body,
    ).toBe("18 working sets. New best on Deadlift. Every weak point hit its sets.");
  });

  it("keeps a quiet week short", () => {
    expect(recapMessage({ sessions: 0, planned: 4, sets: 0, records: [], weakest: null }).title).toBe(
      "Your week in Fatty",
    );
  });
});
