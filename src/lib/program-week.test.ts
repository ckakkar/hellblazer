import { describe, expect, it } from "vitest";
import { blockDate, countInWeek, readPauses, weekDays } from "./program-week";

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

describe("weekDays", () => {
  const week = { weekStart: "2026-10-26", pauses: [], restartedAt: null };
  const days = ["d1", "d2", "d3"];
  const entry = (date: string, day: string | null, at = `${date}T09:00:00Z`) => ({
    date,
    created_at: at,
    program_day_id: day,
  });

  it("counts a workout as the day it was, and offers the first open day next", () => {
    expect(weekDays(days, [entry("2026-10-26", "d3")], [], week)).toEqual({
      status: [null, null, "done"],
      extra: 0,
      next: 0,
    });
  });

  it("covers a skipped day, and a day done after its skip is done", () => {
    expect(weekDays(days, [], [entry("2026-10-26", "d1")], week).next).toBe(1);
    expect(
      weekDays(days, [entry("2026-10-27", "d1")], [entry("2026-10-26", "d1")], week).status,
    ).toEqual(["done", null, null]);
  });

  it("calls a day done twice an extra workout, not the next day", () => {
    expect(weekDays(days, [entry("2026-10-26", "d1"), entry("2026-10-27", "d1")], [], week)).toEqual({
      status: ["done", null, null],
      extra: 1,
      next: 1,
    });
  });

  it("fills open days in order with workouts from before days were recorded", () => {
    expect(weekDays(days, [entry("2026-10-26", "d2"), entry("2026-10-27", null)], [], week).status).toEqual([
      "done",
      "done",
      null,
    ]);
  });

  it("leads into next week's first day once every day is in", () => {
    const all = days.map((d, i) => entry(`2026-10-2${6 + i}`, d));
    expect(weekDays(days, all, [], week)).toEqual({ status: ["done", "done", "done"], extra: 0, next: 0 });
  });

  it("leaves out what's outside the week", () => {
    expect(weekDays(days, [entry("2026-10-25", "d1")], [], week).status).toEqual([null, null, null]);
  });
});
