import { describe, expect, it } from "vitest";
import type { SessionDetail } from "./data/sessions";
import { boardIsOver, estimatedMax, liveBoard } from "./live-board";

let clock = 0;
const set = (
  id: string,
  weight: number,
  reps: number | null,
  extra: { warmup?: boolean; kind?: string } = {},
) => ({
  id,
  set_number: 0,
  weight_kg: weight,
  reps,
  rpe: null,
  is_warmup: extra.warmup ?? false,
  is_completed: true,
  kind: extra.kind ?? null,
  created_at: new Date(Date.UTC(2026, 10, 9, 10, 0, clock++)).toISOString(),
  session_exercise_id: "",
  user_id: "u",
});

function createSession(
  rows: { id: string; exerciseId: string; superset?: number; sets: ReturnType<typeof set>[] }[],
) {
  return {
    id: "s",
    session_exercise: rows.map((r, i) => ({
      id: r.id,
      exercise_id: r.exerciseId,
      position: i,
      superset: r.superset ?? null,
      exercise: { name: r.exerciseId, primary_muscle: "chest" },
      set: r.sets.map((s, n) => ({ ...s, set_number: n + 1, session_exercise_id: r.id })),
    })),
  } as unknown as SessionDetail;
}

describe("live-board edge cases", () => {
  describe("draft sets and working sets counting", () => {
    it(
      "leaves a draft (no reps) out of the board's working sets, as the exercises do",
      () => {
        // Input: session with 1 valid working set (80kg x 5) and 1 draft set (80kg x null)
        // Actual output: b.workingSets is 2, while b.exercises[0].workingSets is 1
        // Expected output: b.workingSets should be 1 (draft rows without reps do not count as work per set-kinds.ts and CLAUDE.md)
        const sess = createSession([
          {
            id: "se1",
            exerciseId: "bench",
            sets: [set("s1", 80, 5), set("s2", 80, null)],
          },
        ]);
        const b = liveBoard(sess, {}, {});
        // In live-board.ts:
        // const logged = rows.flatMap((se) => se.set.map((s) => ({ se, s }))).filter(({ s }) => !s.is_warmup)...
        // Notice it only filters out warmups, omitting isWork check!
        // This causes workingSets: logged.length to count drafts.
        expect(b.workingSets).toBe(1);
      },
    );

    it("leaves draft sets out of exercise-level workingSets and volume", () => {
      const sess = createSession([
        {
          id: "se1",
          exerciseId: "bench",
          sets: [set("s1", 80, 5), set("s2", 80, null)],
        },
      ]);
      const b = liveBoard(sess, {}, {});
      expect(b.exercises[0].workingSets).toBe(1);
      expect(b.volumeKg).toBe(400);
    });
  });

  describe("empty sessions", () => {
    it("handles an empty session with no exercises", () => {
      const b = liveBoard(createSession([]), {}, {});
      expect(b.exercises).toEqual([]);
      expect(b.currentId).toBeNull();
      expect(b.workingSets).toBe(0);
      expect(b.volumeKg).toBe(0);
      expect(b.doneCount).toBe(0);
      expect(b.records).toBe(0);
      expect(b.latestSetId).toBeNull();
    });
  });

  describe("PR tie-breaking and Removal logic", () => {
    it("does not award a new record when a set merely ties the prior best weight or e1RM", () => {
      const sess = createSession([
        {
          id: "se1",
          exerciseId: "bench",
          sets: [set("s1", 100, 5)], // e1RM = 100 * (1 + 5/30) = 116.67
        },
      ]);
      // Prior PR was exactly 100 kg and 116.67 e1RM
      const priorBests = {
        bench: { bestWeightKg: 100, bestEst1rm: 116.67 },
      };
      const b = liveBoard(sess, {}, priorBests);
      expect(b.records).toBe(0);
      expect(b.exercises[0].sets[0].record).toBeNull();
    });

    it("awards record when a set beats prior best weight by more than 0.01 kg", () => {
      const sess = createSession([
        {
          id: "se1",
          exerciseId: "bench",
          sets: [set("s1", 102.5, 5)],
        },
      ]);
      const priorBests = {
        bench: { bestWeightKg: 100, bestEst1rm: 116.67 },
      };
      const b = liveBoard(sess, {}, priorBests);
      expect(b.records).toBe(1);
      expect(b.exercises[0].sets[0].record).toBe("weight");
    });
  });

  describe("boardIsOver final board expiration", () => {
    const now = Date.parse("2026-11-09T18:00:00.000Z");

    it("returns false when workout is still active (finishedAt is null)", () => {
      expect(boardIsOver(null, now)).toBe(false);
    });

    it("returns false within 10 minutes of finishing (FINAL_BOARD_MS)", () => {
      const finished9MinAgo = new Date(now - 9 * 60_000).toISOString();
      expect(boardIsOver(finished9MinAgo, now)).toBe(false);
    });

    it("returns true once finished more than 10 minutes ago", () => {
      const finished11MinAgo = new Date(now - 11 * 60_000).toISOString();
      expect(boardIsOver(finished11MinAgo, now)).toBe(true);
    });
  });

  describe("estimatedMax calculation", () => {
    it("computes Epley 1RM accurately: weight * (1 + reps / 30)", () => {
      // 100 * (1 + 10 / 30) = 133.333...
      expect(estimatedMax(100, 10)).toBeCloseTo(133.333, 2);
      expect(estimatedMax(100, 30)).toBe(200);
      expect(estimatedMax(60, 0)).toBe(60);
    });
  });
});
