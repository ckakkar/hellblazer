import { describe, expect, it } from "vitest";
import { linkGroup, slotLabel, supersetChanges, supersetSlots } from "./supersets";

describe("supersets edge cases", () => {
  describe("supersetSlots runs, boundaries, and lone exercises", () => {
    it("returns an empty array for empty rows", () => {
      expect(supersetSlots([], (g) => g)).toEqual([]);
    });

    it("does not form a superset for a single exercise with a group ID", () => {
      const slots = supersetSlots([1], (g) => g);
      expect(slots).toEqual([null]);
    });

    it("does not join non-consecutive exercises with the same group ID", () => {
      const slots = supersetSlots([1, null, 1], (g) => g);
      expect(slots).toEqual([null, null, null]);
    });

    it("handles large supersets (3+ exercises) with correct member indices", () => {
      const slots = supersetSlots([5, 5, 5, 5], (g) => g);
      expect(slots.map((s) => (s ? slotLabel(s) : null))).toEqual(["A1", "A2", "A3", "A4"]);
      expect(slots[0]?.members).toEqual([0, 1, 2, 3]);
      expect(slots[3]?.members).toEqual([0, 1, 2, 3]);
    });

    it("labels consecutive distinct groups with sequential letters", () => {
      const slots = supersetSlots([1, 1, 2, 2, 3, 3], (g) => g);
      expect(slots.map((s) => (s ? slotLabel(s) : null))).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    });

    it("wraps superset letters past 26 (Z -> A)", () => {
      // 27 distinct pairs of exercises
      const groups = Array.from({ length: 27 }, (_, i) => [i + 1, i + 1]).flat();
      const slots = supersetSlots(groups, (g) => g);
      // 26th superset is Z (indices 50, 51)
      expect(slots[50]?.letter).toBe("Z");
      // 27th superset wraps around to A (indices 52, 53)
      expect(slots[52]?.letter).toBe("A");
    });
  });

  describe("linkGroup selection logic", () => {
    it("reuses own group if present", () => {
      expect(linkGroup([10, null, null], 0)).toBe(10);
    });

    it("reuses partner group if own is null", () => {
      expect(linkGroup([null, 15, null], 0)).toBe(15);
    });

    it("picks smallest positive integer unused by any row", () => {
      expect(linkGroup([1, 2, null, null], 2)).toBe(3);
      expect(linkGroup([2, 3, null, null], 2)).toBe(1);
    });
  });

  describe("supersetChanges row updates", () => {
    const rows = (...groups: (number | null)[]) =>
      groups.map((superset, i) => ({ id: `row-${i}`, superset }));

    it("returns empty when trying to link the final exercise with non-existent next", () => {
      expect(supersetChanges(rows(null, null), 1, true)).toEqual([]);
    });

    it("returns empty when unlinking an exercise that is not in a superset", () => {
      expect(supersetChanges(rows(null, 1, 1), 0, false)).toEqual([]);
    });

    it("returns empty when linking two exercises already in the same superset", () => {
      expect(supersetChanges(rows(1, 1), 0, true)).toEqual([]);
    });

    it("unlinks an exercise from its superset cleanly", () => {
      expect(supersetChanges(rows(1, 1), 0, false)).toEqual([{ id: "row-0", superset: null }]);
    });
  });
});
