import { describe, expect, it } from "vitest";
import {
  describeSpokenSets,
  matchExercise,
  MAX_SPOKEN_SETS,
  parseHeard,
  planSpokenSets,
  type SpokenExercise,
} from "./spoken-sets";

const library: SpokenExercise[] = [
  { id: "bench", name: "Barbell Bench Press", same: { weight: 100, reps: 5 } },
  { id: "incline_db", name: "Incline Dumbbell Press", same: null },
  { id: "cgbp", name: "Close-Grip Bench Press", same: null },
  { id: "ohp", name: "Overhead Press", same: { weight: 50, reps: 8 } },
  { id: "rdl", name: "Romanian Deadlift", same: { weight: 120, reps: 6 } },
  { id: "skull", name: "Skull Crusher", same: null },
  { id: "pullup", name: "Weighted Pullup", same: { weight: 15, reps: 6 } },
  { id: "curl", name: "Dumbbell Curl", same: null },
];

describe("spoken-sets edge cases", () => {
  describe("matchExercise shorthand, punctuation, and aliases", () => {
    it("recognizes gym shorthand acronyms (ohp, rdl, bb, db)", () => {
      expect(matchExercise("ohp", library)?.id).toBe("ohp");
      expect(matchExercise("rdl", library)?.id).toBe("rdl");
      expect(matchExercise("bb bench", library)?.id).toBe("bench");
      expect(matchExercise("incline db", library)?.id).toBe("incline_db");
    });

    it("recognizes colloquial variations (skulls, pull-ups, close grip)", () => {
      expect(matchExercise("skulls", library)?.id).toBe("skull");
      expect(matchExercise("pull-ups", library)?.id).toBe("pullup");
      expect(matchExercise("close grip", library)?.id).toBe("cgbp");
    });

    it("strips punctuation, extra whitespace, and handles case insensitivity", () => {
      expect(matchExercise("  INCLINE DB PRESS!  ", library)?.id).toBe("incline_db");
      expect(matchExercise("bench...", library)?.id).toBe("bench");
    });

    it("returns null for nonsense input or filler words alone", () => {
      expect(matchExercise("xyz 999", library)).toBeNull();
      expect(matchExercise("and for the with", library)).toBeNull();
      expect(matchExercise("", library)).toBeNull();
    });

    it("breaks ties using preferred (current) exercise when score and coverage are equal", () => {
      const exA = { id: "incline_press", name: "Incline Dumbbell Press" };
      const exB = { id: "incline_curl", name: "Incline Dumbbell Curl" };
      expect(matchExercise("incline", [exA, exB], "incline_press")?.id).toBe("incline_press");
      expect(matchExercise("incline", [exA, exB], "incline_curl")?.id).toBe("incline_curl");
    });
  });

  describe("parseHeard sanitation and boundary limits", () => {
    it("handles non-array and malformed raw input gracefully", () => {
      expect(parseHeard(null)).toEqual([]);
      expect(parseHeard(undefined)).toEqual([]);
      expect(parseHeard("invalid")).toEqual([]);
      expect(parseHeard(123)).toEqual([]);
      expect(parseHeard({})).toEqual([]);
    });

    it("clamps sets to [1, 10]", () => {
      const parsed = parseHeard([
        { exercise: "bench", sets: 0, reps: 5, weight: 100 },
        { exercise: "bench", sets: 50, reps: 5, weight: 100 },
      ]);
      expect(parsed[0].sets).toBe(1);
      expect(parsed[1].sets).toBe(10);
    });

    it("drops reps outside [1, 100] and rounds fractional reps", () => {
      const parsed = parseHeard([
        { reps: 0 },
        { reps: 101 },
        { reps: -5 },
        { reps: 8.4 },
      ]);
      expect(parsed[0].reps).toBeNull();
      expect(parsed[1].reps).toBeNull();
      expect(parsed[2].reps).toBeNull();
      expect(parsed[3].reps).toBe(8);
    });

    it("drops negative or excessive weights (> 2000)", () => {
      const parsed = parseHeard([
        { weight: -10 },
        { weight: 2001 },
        { weight: 82.5 },
      ]);
      expect(parsed[0].weight).toBeNull();
      expect(parsed[1].weight).toBeNull();
      expect(parsed[2].weight).toBe(82.5);
    });

    it("rounds RPE to nearest 0.5 within [1, 10]", () => {
      const parsed = parseHeard([
        { rpe: 8.7 },
        { rpe: 0 }, // 0 means not described
        { rpe: 11 },
      ]);
      expect(parsed[0].rpe).toBe(8.5);
      expect(parsed[1].rpe).toBeNull();
      expect(parsed[2].rpe).toBeNull();
    });

    it("truncates exercise names to 80 characters and limits groups to 12", () => {
      const longName = "a".repeat(100);
      const manyGroups = Array.from({ length: 20 }, () => ({ exercise: longName }));
      const parsed = parseHeard(manyGroups);
      expect(parsed).toHaveLength(12);
      expect(parsed[0].exercise).toHaveLength(80);
    });
  });

  describe("planSpokenSets planning logic", () => {
    it("converts units when spoken unit differs from lifter unit", () => {
      // Spoke 100 kg for a lifter in lb: 100 / 0.45359237 = 220.46 lb -> 220.5 lb
      const plan = planSpokenSets(
        [{ exercise: "bench", sets: 1, reps: 5, weight: 100, unit: "kg", rpe: null, warmup: false }],
        library,
        { unit: "lb", current: "bench" },
      );
      expect(plan.sets[0].weight).toBe(220.5);
    });

    it("caps total planned sets at MAX_SPOKEN_SETS (30)", () => {
      const groups = [
        { exercise: "bench", sets: 10, reps: 5, weight: 100, unit: null, rpe: null, warmup: false },
        { exercise: "bench", sets: 10, reps: 5, weight: 100, unit: null, rpe: null, warmup: false },
        { exercise: "bench", sets: 10, reps: 5, weight: 100, unit: null, rpe: null, warmup: false },
        { exercise: "bench", sets: 10, reps: 5, weight: 100, unit: null, rpe: null, warmup: false },
      ];
      const plan = planSpokenSets(groups, library, { unit: "kg", current: "bench" });
      expect(plan.sets).toHaveLength(MAX_SPOKEN_SETS);
    });

    it("tracks unmatched exercises and unclear sets", () => {
      const groups = [
        { exercise: "hack squat", sets: 3, reps: 8, weight: 100, unit: null, rpe: null, warmup: false },
        { exercise: "incline_db", sets: 1, reps: null, weight: 30, unit: null, rpe: null, warmup: false },
      ];
      const plan = planSpokenSets(groups, library, { unit: "kg", current: null });
      expect(plan.unmatched).toEqual(["hack squat"]);
      expect(plan.unclear).toBe(1);
    });
  });

  describe("describeSpokenSets speech synthesis strings", () => {
    const names = new Map(library.map((e) => [e.id, e.name]));

    it("formats warmups vs working sets accurately", () => {
      const sets = [
        { exerciseId: "bench", weight: 60, reps: 10, rpe: null, warmup: true },
        { exerciseId: "bench", weight: 60, reps: 10, rpe: null, warmup: true },
        { exerciseId: "bench", weight: 100, reps: 5, rpe: null, warmup: false },
      ];
      const spoken = describeSpokenSets(sets, names, "kg");
      expect(spoken).toBe("2 warm-ups of 10 at 60 kg, then 1 set of 5 at 100 kg on Barbell Bench Press");
    });

    it("formats bodyweight sets as bodyweight", () => {
      const sets = [
        { exerciseId: "pullup", weight: 0, reps: 8, rpe: null, warmup: false },
      ];
      const spoken = describeSpokenSets(sets, names, "kg");
      expect(spoken).toBe("1 set of 8 at bodyweight on Weighted Pullup");
    });

    it("formats consistent RPE across multiple sets with 'all at RPE'", () => {
      const sets = [
        { exerciseId: "bench", weight: 100, reps: 5, rpe: 8.5, warmup: false },
        { exerciseId: "bench", weight: 100, reps: 5, rpe: 8.5, warmup: false },
      ];
      const spoken = describeSpokenSets(sets, names, "kg");
      expect(spoken).toBe("2 sets of 5 at 100 kg on Barbell Bench Press, all at RPE 8.5");
    });
  });
});
