import { describe, expect, it } from "vitest";
import { linkGroup, slotLabel, supersetChanges, supersetSlots } from "@/lib/supersets";

describe("supersetSlots", () => {
  it("labels consecutive runs A1/A2, B1/B2/B3, and leaves lone ones alone", () => {
    const slots = supersetSlots([null, 1, 1, null, 2, 2, 2, 3], (g) => g);
    expect(slots.map((s) => (s ? slotLabel(s) : null))).toEqual([null, "A1", "A2", null, "B1", "B2", "B3", null]);
    expect(slots[5]?.members).toEqual([4, 5, 6]);
  });

  it("never joins two exercises that only share a number from afar", () => {
    expect(supersetSlots([1, null, 1], (g) => g)).toEqual([null, null, null]);
  });
});

describe("linkGroup", () => {
  it("joins a superset already there, else starts a fresh number", () => {
    expect(linkGroup([1, 1, null], 1)).toBe(1);
    expect(linkGroup([null, null, 2], 1)).toBe(2);
    expect(linkGroup([1, 1, null, null], 2)).toBe(2);
  });
});

describe("supersetChanges", () => {
  const rows = (...groups: (number | null)[]) => groups.map((superset, i) => ({ id: `r${i}`, superset }));

  it("links an exercise with the next under one number", () => {
    expect(supersetChanges(rows(null, null, null), 0, true)).toEqual([
      { id: "r0", superset: 1 },
      { id: "r1", superset: 1 },
    ]);
    // Onto the end of a superset: A3.
    expect(supersetChanges(rows(1, 1, null), 1, true)).toEqual([{ id: "r2", superset: 1 }]);
  });

  it("takes an exercise out, and has nothing to link the last one to", () => {
    expect(supersetChanges(rows(1, 1), 1, false)).toEqual([{ id: "r1", superset: null }]);
    expect(supersetChanges(rows(null, null), 1, true)).toEqual([]);
  });
});
