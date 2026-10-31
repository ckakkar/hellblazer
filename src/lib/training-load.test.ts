import { describe, expect, it } from "vitest";
import { computeTrainingLoad, isHeavy, type LoadSession } from "./training-load";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-01T09:00:00Z");

/** A session `daysAgo` before NOW (ended then), on that calendar day. */
function session(daysAgo: number, sets: number, volume: number, title = "Upper"): LoadSession {
  const at = NOW - daysAgo * DAY;
  return { at, date: new Date(at).toISOString().slice(0, 10), title, sets, volume };
}

describe("training load", () => {
  it("finds the last session that moved well over the usual", () => {
    const sessions = [
      session(20, 15, 8000),
      session(16, 15, 8000),
      session(12, 15, 8100),
      session(8, 16, 8000),
      session(4, 22, 11000, "Lower (Heavy)"),
      session(1, 10, 5000),
    ];
    const load = computeTrainingLoad(sessions, NOW, "2026-11-01");
    expect(load.lastHeavy).toMatchObject({ title: "Lower (Heavy)", sets: 22 });
  });

  it("needs eight working sets to call a session heavy", () => {
    const all = [session(9, 4, 9000), session(8, 4, 2000), session(7, 4, 2000), session(6, 4, 2000)];
    expect(isHeavy(all[0], all)).toBe(false);
  });

  it("compares the last three days with the usual three days", () => {
    const sessions = [
      ...[28, 24, 20, 16, 12, 8].map((d) => session(d, 14, 7000)),
      session(2, 20, 9000),
      session(1, 20, 9000),
    ];
    const load = computeTrainingLoad(sessions, NOW, "2026-11-01");
    expect(load.recentSets).toBe(40);
    expect(load.usualSets).toBe(9);
  });

  it("counts days in a row, from yesterday when today's not trained", () => {
    const sessions = [session(1, 10, 1), session(2, 10, 1), session(3, 10, 1), session(5, 10, 1)];
    expect(computeTrainingLoad(sessions, NOW, "2026-11-01").streakDays).toBe(3);
  });
});
