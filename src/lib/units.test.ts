import { describe, expect, it } from "vitest";
import { fromDisplayWeight, toDisplayWeight } from "./units";

describe("fromDisplayWeight", () => {
  it("saves pounds as kg to the hundredth the database keeps", () => {
    expect(fromDisplayWeight(297.5, "lb")).toBe(134.94);
    expect(fromDisplayWeight(45, "lb")).toBe(20.41);
    expect(fromDisplayWeight(62.5, "kg")).toBe(62.5);
    // Kilos typed past the hundredth are saved as the database keeps them, too.
    expect(fromDisplayWeight(62.555, "kg")).toBe(62.56);
    expect(fromDisplayWeight(9999.99, "kg")).toBe(9999.99);
  });

  it("reads back as the weight that was typed, at every half pound", () => {
    for (let lb = 0.5; lb <= 1000; lb += 0.5) {
      expect(toDisplayWeight(fromDisplayWeight(lb, "lb"), "lb")).toBe(lb);
    }
  });
});
