import { describe, expect, it } from "vitest";
import { isLogged, isStraight, isWork } from "./set-kinds";

describe("set kinds", () => {
  it("needs a whole rep to be logged", () => {
    expect(isLogged(1)).toBe(true);
    expect(isLogged(0)).toBe(false);
    expect(isLogged(8.5)).toBe(false);
    expect(isLogged(null)).toBe(false);
  });

  it("counts drops and rest-pause as work, and only plain sets as straight", () => {
    expect(isWork({ warmup: false, kind: "drop", reps: 10 })).toBe(true);
    expect(isStraight({ warmup: false, kind: "drop", reps: 10 })).toBe(false);
    expect(isStraight({ warmup: false, kind: "rest_pause", reps: 4 })).toBe(false);
    expect(isStraight({ warmup: false, kind: null, reps: 5 })).toBe(true);
  });

  it("leaves warm-ups and bodyweight drafts out, and keeps bodyweight work", () => {
    expect(isWork({ warmup: true, reps: 10 })).toBe(false);
    expect(isWork({ warmup: false, reps: null })).toBe(false);
    expect(isStraight({ warmup: false, reps: 12 })).toBe(true);
  });
});
