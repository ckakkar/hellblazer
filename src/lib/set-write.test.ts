import { describe, expect, it } from "vitest";
import { plausibleLoggedAt, setRow, setWriteSchema, toSessionSets } from "./set-write";

const NOW = Date.parse("2026-11-04T10:00:00Z");

const input = {
  id: "11111111-1111-4111-8111-111111111111",
  sessionExerciseId: "22222222-2222-4222-8222-222222222222",
  setNumber: 2,
  weightKg: 62.5,
  reps: 10,
  rpe: null,
  isWarmup: false,
};

describe("plausibleLoggedAt", () => {
  it("trusts the device's clock for a week back and a few minutes ahead", () => {
    expect(plausibleLoggedAt(NOW - 3600_000, NOW)).toBe("2026-11-04T09:00:00.000Z");
    expect(plausibleLoggedAt(NOW - 8 * 24 * 3600_000, NOW)).toBeUndefined();
    expect(plausibleLoggedAt(NOW + 10 * 60_000, NOW)).toBeUndefined();
    expect(plausibleLoggedAt(undefined, NOW)).toBeUndefined();
  });
});

describe("setRow", () => {
  it("writes the set for the lifter, leaving out what it wasn't told", () => {
    const row = setRow(setWriteSchema.parse(input), "user-1");
    expect(row).toEqual({
      id: input.id,
      user_id: "user-1",
      session_exercise_id: input.sessionExerciseId,
      set_number: 2,
      weight_kg: 62.5,
      reps: 10,
      rpe: null,
      is_warmup: false,
      is_completed: true,
    });
  });

  it("keeps a drop set's kind, and when it was logged", () => {
    const loggedAt = Date.now() - 60_000;
    const row = setRow(setWriteSchema.parse({ ...input, kind: "drop", loggedAt }), "user-1");
    expect(row.kind).toBe("drop");
    expect(row.created_at).toBe(new Date(loggedAt).toISOString());
  });
});

describe("toSessionSets", () => {
  it("reads a workout's sets as the logger holds them", () => {
    const out = toSessionSets({
      finished_at: null,
      session_exercise: [
        {
          id: "se-1",
          exercise_id: "ex-1",
          set: [
            {
              id: "s-1",
              set_number: 1,
              weight_kg: "62.50",
              reps: 10,
              rpe: "8.5",
              is_warmup: false,
              kind: "something-new",
              created_at: "2026-11-04T09:00:00Z",
            },
          ],
        },
      ],
    });
    expect(out).toEqual({
      finished: false,
      exercises: [{ id: "se-1", exerciseId: "ex-1" }],
      sets: [
        {
          seId: "se-1",
          id: "s-1",
          setNumber: 1,
          weightKg: 62.5,
          reps: 10,
          rpe: 8.5,
          isWarmup: false,
          kind: null,
          at: Date.parse("2026-11-04T09:00:00Z"),
        },
      ],
    });
  });

  it("takes a workout that's gone as over", () => {
    expect(toSessionSets(null)).toEqual({ finished: true, gone: true, sets: [], exercises: [] });
  });
});
