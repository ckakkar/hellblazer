import { describe, expect, it } from "vitest";
import { liftStory } from "./lift-story";

describe("liftStory", () => {
  it("is null without a working set", () => {
    expect(liftStory([])).toBeNull();
    expect(liftStory([{ date: "2026-10-01", est1rm: 0 }])).toBeNull();
  });

  it("measures the block from its first session to the latest", () => {
    const s = liftStory([
      { date: "2026-05-01", est1rm: 90 },
      { date: "2026-09-07", est1rm: 100 },
      { date: "2026-09-28", est1rm: 110 },
      { date: "2026-10-19", est1rm: 107.5 },
    ]);
    // May falls outside the 12 weeks, so the block opens on 7 Sep.
    expect(s).toMatchObject({ change: 7.5, from: 100, to: 107.5, weeks: 6, sessions: 3 });
    expect(s?.record).toEqual({ value: 110, date: "2026-09-28" });
  });

  it("calls one session a week", () => {
    expect(liftStory([{ date: "2026-10-19", est1rm: 80 }])).toMatchObject({ change: 0, weeks: 1, sessions: 1 });
  });
});
