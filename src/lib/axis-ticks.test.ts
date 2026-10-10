import { describe, expect, it } from "vitest";
import { roundTicks } from "./axis-ticks";

describe("roundTicks", () => {
  it("uses whole kilos for a bodyweight that moves a couple of kilos", () => {
    expect(roundTicks([77, 77.5, 78, 78.5])).toEqual({ domain: [76, 79], ticks: [76, 77, 78, 79] });
  });

  it("keeps headroom when the data sits on a whole number", () => {
    expect(roundTicks([80, 81])).toEqual({ domain: [79, 82], ticks: [79, 80, 81, 82] });
  });

  it("widens the step as the range grows", () => {
    const { ticks } = roundTicks([70, 90]);
    expect(ticks).toEqual([60, 70, 80, 90, 100]);
  });

  it("handles a flat line", () => {
    expect(roundTicks([75.4, 75.4]).ticks).toEqual([75, 76]);
  });

  it("never returns more ticks than asked for", () => {
    for (const span of [0.5, 3, 7, 15, 40, 120]) {
      expect(roundTicks([100, 100 + span]).ticks.length).toBeLessThanOrEqual(5);
    }
  });
});
