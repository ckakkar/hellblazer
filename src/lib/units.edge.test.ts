import { describe, expect, it } from "vitest";
import {
  formatVolume,
  fromDisplayWeight,
  KG_PER_LB,
  kgToLb,
  lbToKg,
  toDisplayBodyweight,
  toDisplayWeight,
  trimNum,
} from "./units";

describe("units edge cases", () => {
  describe("conversions and precision", () => {
    it("converts using the exact international pound constant", () => {
      expect(KG_PER_LB).toBe(0.45359237);
      expect(lbToKg(1)).toBe(0.45359237);
      expect(kgToLb(0.45359237)).toBe(1);
    });

    it("handles zero and negative weights in conversions", () => {
      expect(kgToLb(0)).toBe(0);
      expect(lbToKg(0)).toBe(0);
      expect(toDisplayWeight(0, "kg")).toBe(0);
      expect(toDisplayWeight(0, "lb")).toBe(0);
      expect(fromDisplayWeight(0, "lb")).toBe(0);
      expect(fromDisplayWeight(0, "kg")).toBe(0);
    });

    it("rounds display weights in kg to nearest 0.5 kg gym plate steps", () => {
      expect(toDisplayWeight(62.24, "kg")).toBe(62);
      expect(toDisplayWeight(62.25, "kg")).toBe(62.5);
      expect(toDisplayWeight(62.74, "kg")).toBe(62.5);
      expect(toDisplayWeight(62.75, "kg")).toBe(63);
    });

    it("rounds display weights in lb to nearest 0.5 lb increments", () => {
      // 100 kg is ~220.462 lb -> rounds to 220.5 lb
      expect(toDisplayWeight(100, "lb")).toBe(220.5);
      // 20 kg is ~44.092 lb -> rounds to 44 lb
      expect(toDisplayWeight(20, "lb")).toBe(44);
    });

    it("preserves 2 decimal precision (numeric(6,2)) when converting lb to kg", () => {
      // 135 lb = 61.23496... kg -> 61.23 kg
      expect(fromDisplayWeight(135, "lb")).toBe(61.23);
      // 225 lb = 102.058... kg -> 102.06 kg
      expect(fromDisplayWeight(225, "lb")).toBe(102.06);
      // 315 lb = 142.881... kg -> 142.88 kg
      expect(fromDisplayWeight(315, "lb")).toBe(142.88);
    });

    it("handles maximum database capacity numeric(6,2) up to 9999.99", () => {
      expect(fromDisplayWeight(9999.99, "kg")).toBe(9999.99);
      expect(toDisplayWeight(9999.5, "kg")).toBe(9999.5);
    });
  });

  describe("toDisplayBodyweight tenth-of-a-unit precision", () => {
    it("rounds bodyweight to 1 decimal place instead of plates' 0.5", () => {
      expect(toDisplayBodyweight(70.12, "kg")).toBe(70.1);
      expect(toDisplayBodyweight(70.15, "kg")).toBe(70.2);
      expect(toDisplayBodyweight(70.0, "kg")).toBe(70);
    });

    it("converts bodyweight to lb with tenth precision", () => {
      // 70 kg in lb is ~154.3236 lb -> 154.3 lb
      expect(toDisplayBodyweight(70, "lb")).toBe(154.3);
      // 82.5 kg in lb is ~181.881 lb -> 181.9 lb
      expect(toDisplayBodyweight(82.5, "lb")).toBe(181.9);
    });
  });

  describe("trimNum formatting", () => {
    it("trims trailing .0 for whole numbers", () => {
      expect(trimNum(60)).toBe("60");
      expect(trimNum(0)).toBe("0");
      expect(trimNum(100.0)).toBe("100");
    });

    it("preserves single and double decimals and rounds extra decimals", () => {
      expect(trimNum(62.5)).toBe("62.5");
      expect(trimNum(62.25)).toBe("62.25");
      expect(trimNum(62.256)).toBe("62.26");
    });
  });

  describe("formatVolume formatting", () => {
    it("formats sub-1000 volume with rounded integer and unit", () => {
      expect(formatVolume(0, "kg")).toBe("0 kg");
      expect(formatVolume(750, "kg")).toBe("750 kg");
      expect(formatVolume(999, "kg")).toBe("999 kg");
    });

    it("formats 1000+ volume in thousands (k) with 1 decimal place", () => {
      expect(formatVolume(1000, "kg")).toBe("1k kg");
      expect(formatVolume(1250, "kg")).toBe("1.3k kg");
      expect(formatVolume(12000, "kg")).toBe("12k kg");
    });

    it("converts kg volume to lb before applying thousand formatting", () => {
      // 400 kg is ~881.8 lb (sub-1000 lb)
      expect(formatVolume(400, "lb")).toBe("882 lb");
      // 500 kg is ~1102.3 lb (1000+ lb)
      expect(formatVolume(500, "lb")).toBe("1.1k lb");
    });
  });
});
