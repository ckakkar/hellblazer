import { describe, expect, it } from "vitest";
import { displayEm, fitFigure } from "./utils";

describe("displayEm", () => {
  // Measured in the browser at 100px: the estimate must never come in under.
  it.each([
    ["Wongsawat", 6.64],
    ["Reinhold", 4.89],
    ["12,450", 3.85],
    ["1:05:32", 4.13],
    ["Not timed", 5.54],
  ])("%s is at least its measured width", (text, measured) => {
    expect(displayEm(text) * 1.02).toBeGreaterThanOrEqual(measured);
    expect(displayEm(text)).toBeLessThan(measured * 1.1);
  });
});

describe("fitFigure", () => {
  it("fits the widest of several words", () => {
    const style = fitFigure(["Gaolang", "Wongsawat"], "3rem") as Record<string, string>;
    expect(Number(style["--fit-em"])).toBeCloseTo(displayEm("Wongsawat") * 1.02, 2);
    expect(style["--fit-max"]).toBe("3rem");
    expect(style["--fit-reserve"]).toBe("0px");
  });
});
