import { describe, expect, it } from "vitest";
import type { SessionDetail } from "@/lib/data/sessions";
import { liveBoard } from "./live-board";

let clock = 0;
const set = (id: string, weight: number, reps: number, extra: { warmup?: boolean; kind?: string } = {}) => ({
  id,
  set_number: 0,
  weight_kg: weight,
  reps,
  rpe: null,
  is_warmup: extra.warmup ?? false,
  is_completed: true,
  kind: extra.kind ?? null,
  created_at: new Date(Date.UTC(2026, 9, 19, 18, 0, clock++)).toISOString(),
  session_exercise_id: "",
  user_id: "u",
});

function session(rows: { id: string; exerciseId: string; superset?: number; sets: ReturnType<typeof set>[] }[]) {
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

describe("liveBoard", () => {
  it("puts the exercise with the newest set on the bar", () => {
    const b = liveBoard(
      session([
        { id: "a", exerciseId: "bench", sets: [set("a1", 80, 5)] },
        { id: "b", exerciseId: "row", sets: [set("b1", 70, 8)] },
        { id: "c", exerciseId: "curl", sets: [] },
      ]),
      {},
      {},
    );
    expect(b.currentId).toBe("b");
    expect(b.latestSetId).toBe("b1");
    expect(b.workingSets).toBe(2);
    expect(b.volumeKg).toBe(80 * 5 + 70 * 8);
  });

  it("starts on the first exercise before any set", () => {
    const b = liveBoard(session([{ id: "a", exerciseId: "bench", sets: [] }]), {}, {});
    expect(b.currentId).toBe("a");
    expect(b.latestSetId).toBeNull();
  });

  it("leaves warmups out of the sets and the volume", () => {
    const b = liveBoard(
      session([{ id: "a", exerciseId: "bench", sets: [set("w", 40, 10, { warmup: true }), set("a1", 80, 5)] }]),
      {},
      {},
    );
    expect(b.workingSets).toBe(1);
    expect(b.volumeKg).toBe(400);
    expect(b.exercises[0].workingSets).toBe(1);
  });

  it("is done at the target, drop sets aside", () => {
    const b = liveBoard(
      session([
        { id: "a", exerciseId: "bench", sets: [set("a1", 80, 5), set("a2", 64, 8, { kind: "drop" })] },
        { id: "b", exerciseId: "row", sets: [set("b1", 70, 8), set("b2", 70, 8)] },
      ]),
      { a: { sets: 2, rest: null, reps: "5" }, b: { sets: 2, rest: null, reps: "8" } },
      {},
    );
    expect(b.exercises.map((e) => e.done)).toEqual([false, true]);
    expect(b.doneCount).toBe(1);
  });

  it("without a target, is done once a later exercise has a set", () => {
    const b = liveBoard(
      session([
        { id: "a", exerciseId: "bench", sets: [set("a1", 80, 5)] },
        { id: "b", exerciseId: "row", sets: [set("b1", 70, 8)] },
      ]),
      {},
      {},
    );
    expect(b.exercises.map((e) => e.done)).toEqual([true, false]);
  });

  it("marks a record against earlier sessions, once", () => {
    const b = liveBoard(
      session([{ id: "a", exerciseId: "bench", sets: [set("a1", 100, 3), set("a2", 100, 3), set("a3", 95, 8)] }]),
      {},
      { bench: { bestWeightKg: 97.5, bestEst1rm: 110 } },
    );
    expect(b.exercises[0].sets.map((s) => s.record)).toEqual(["weight", null, "e1rm"]);
    expect(b.records).toBe(2);
  });

  it("never calls a first-ever lift a record", () => {
    const b = liveBoard(session([{ id: "a", exerciseId: "new", sets: [set("a1", 100, 3)] }]), {}, {});
    expect(b.records).toBe(0);
  });

  it("labels supersets", () => {
    const b = liveBoard(
      session([
        { id: "a", exerciseId: "curl", superset: 1, sets: [] },
        { id: "b", exerciseId: "pushdown", superset: 1, sets: [] },
        { id: "c", exerciseId: "raise", sets: [] },
      ]),
      {},
      {},
    );
    expect(b.exercises.map((e) => e.slot)).toEqual(["A1", "A2", null]);
  });
});
