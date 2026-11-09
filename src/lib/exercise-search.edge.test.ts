import { describe, expect, it } from "vitest";
import { matchesExercise } from "./exercise-search";

const bench = { name: "Barbell Bench Press", primary_muscle: "chest" as const, equipment: "barbell" };
const inclineDb = { name: "Incline Dumbbell Press", primary_muscle: "chest" as const, equipment: "dumbbell" };
const pullup = { name: "Weighted Pull-Up", primary_muscle: "back" as const, equipment: "bodyweight" };
const rdl = { name: "Romanian Deadlift", primary_muscle: "hamstrings" as const, equipment: "barbell" };
const ohp = { name: "Overhead Press", primary_muscle: "front_delt" as const, equipment: "barbell" };
const cableCurl = { name: "Biceps Cable Curl", primary_muscle: "biceps" as const, equipment: "cable" };
const noEquip = { name: "Special Movement", primary_muscle: "abs" as const, equipment: null };

describe("exercise-search edge cases", () => {
  describe("empty and whitespace queries", () => {
    it("matches any exercise on empty query string", () => {
      expect(matchesExercise(bench, "")).toBe(true);
    });

    it("matches any exercise on pure whitespace or tab query", () => {
      expect(matchesExercise(bench, "   ")).toBe(true);
      expect(matchesExercise(bench, "\t\n")).toBe(true);
    });
  });

  describe("gym shorthand and word boundaries", () => {
    it("matches all supported shorthand acronyms (db, dbs, bb, kb, ohp, rdl, bw)", () => {
      expect(matchesExercise(inclineDb, "db")).toBe(true);
      expect(matchesExercise(inclineDb, "dbs")).toBe(true);
      expect(matchesExercise(bench, "bb")).toBe(true);
      expect(matchesExercise(ohp, "ohp")).toBe(true);
      expect(matchesExercise(rdl, "rdl")).toBe(true);
      expect(matchesExercise(pullup, "bw")).toBe(true);
    });

    it("ensures 'bb' does not accidentally match 'dumbbell'", () => {
      // Incline Dumbbell Press has 'dumbbell', which contains 'bb' as substring.
      // But shorthand rule uses word boundary regex \bbb\b or long expansion.
      // Dumbbell does not contain barbell, nor standalone word 'bb'.
      expect(matchesExercise(inclineDb, "bb")).toBe(false);
    });
  });

  describe("matching across name, muscle, and equipment in any order", () => {
    it("matches words scattered across name, primary muscle, and equipment", () => {
      // "chest" is muscle, "barbell" is equipment, "press" is name
      expect(matchesExercise(bench, "chest barbell press")).toBe(true);
      // reverse word order
      expect(matchesExercise(bench, "press chest barbell")).toBe(true);
    });

    it("matches partial word fragments", () => {
      expect(matchesExercise(cableCurl, "bic cab cur")).toBe(true);
      expect(matchesExercise(rdl, "rom dead")).toBe(true);
    });

    it("handles null or undefined equipment safely", () => {
      expect(matchesExercise(noEquip, "special")).toBe(true);
      expect(matchesExercise(noEquip, "abs")).toBe(true);
      expect(matchesExercise(noEquip, "barbell")).toBe(false);
    });
  });

  describe("case sensitivity and punctuation handling", () => {
    it("ignores casing in search queries", () => {
      expect(matchesExercise(bench, "BARBELL BENCH")).toBe(true);
      expect(matchesExercise(ohp, "OhP")).toBe(true);
      expect(matchesExercise(rdl, "RoMaNiAn")).toBe(true);
    });

    it("handles multiple spaces between search words", () => {
      expect(matchesExercise(bench, "barbell    bench   press")).toBe(true);
    });

    it("matches exact punctuation when present in name (e.g. hyphens)", () => {
      expect(matchesExercise(pullup, "pull-up")).toBe(true);
      expect(matchesExercise(pullup, "pull up")).toBe(true);
    });
  });
});
