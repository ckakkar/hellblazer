import { describe, expect, it } from "vitest";
import { blockDate, countInWeek, readPauses } from "./program-week";

const row = (date: string, created_at = `${date}T18:00:00Z`) => ({ date, created_at });

describe("countInWeek", () => {
  it("counts the week's rows", () => {
    expect(
      countInWeek([row("2026-10-12"), row("2026-10-14"), row("2026-10-19")], {
        weekStart: "2026-10-12",
        pauses: [],
        restartedAt: null,
      }),
    ).toBe(2);
  });

  it("keeps a workout done before a pause in the week it belongs to", () => {
    // Block from Mon 5 Oct: a workout Mon 12, paused Wed 14 for 5 days, so
    // the start moved to Sat 10 and week 2 runs Sat 17 to Fri 23.
    const pauses = [{ at: "2026-10-14", days: 5 }];
    expect(blockDate("2026-10-12", pauses)).toBe("2026-10-17");
    expect(
      countInWeek([row("2026-10-12"), row("2026-10-20")], { weekStart: "2026-10-17", pauses, restartedAt: null }),
    ).toBe(2);
  });

  it("doesn't move what came after the pause", () => {
    expect(blockDate("2026-10-20", [{ at: "2026-10-14", days: 5 }])).toBe("2026-10-20");
  });

  it("adds up pauses after a date", () => {
    expect(
      blockDate("2026-10-01", [
        { at: "2026-10-03", days: 2 },
        { at: "2026-10-10", days: 3 },
      ]),
    ).toBe("2026-10-06");
  });

  it("leaves out what was done before a restart, even earlier the same day", () => {
    expect(
      countInWeek([row("2026-10-19", "2026-10-19T07:00:00Z"), row("2026-10-19", "2026-10-19T19:00:00Z")], {
        weekStart: "2026-10-19",
        pauses: [],
        restartedAt: "2026-10-19T12:00:00Z",
      }),
    ).toBe(1);
  });
});

describe("readPauses", () => {
  it("drops anything malformed", () => {
    expect(readPauses([{ at: "2026-10-14", days: 5 }, { at: "nope", days: 2 }, { at: "2026-10-01", days: 0 }, null])).toEqual([
      { at: "2026-10-14", days: 5 },
    ]);
    expect(readPauses("x")).toEqual([]);
  });
});
