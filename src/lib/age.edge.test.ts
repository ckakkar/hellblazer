import { describe, expect, it } from "vitest";
import {
  ageOn,
  birthdayBounds,
  isAcceptedBirthday,
  MAX_AGE,
  MIN_AGE,
  profileAge,
} from "./age";

describe("age edge cases", () => {
  describe("leap year February 29 birthdays", () => {
    // Lifter born on 2004-02-29
    it("turns older on Feb 29 in leap years", () => {
      // 2028 is a leap year (24th birthday)
      expect(ageOn("2004-02-29", "2028-02-28")).toBe(23);
      expect(ageOn("2004-02-29", "2028-02-29")).toBe(24);
      expect(ageOn("2004-02-29", "2028-03-01")).toBe(24);
    });

    it("turns older on March 1 in non-leap years", () => {
      // 2029 is a non-leap year (25th birthday)
      expect(ageOn("2004-02-29", "2029-02-28")).toBe(24);
      expect(ageOn("2004-02-29", "2029-03-01")).toBe(25);
    });

    it("evaluates a Feb 28 birthday across leap and non-leap years", () => {
      // Born on 2004-02-28
      expect(ageOn("2004-02-28", "2028-02-27")).toBe(23);
      expect(ageOn("2004-02-28", "2028-02-28")).toBe(24);
      expect(ageOn("2004-02-28", "2028-02-29")).toBe(24);
      expect(ageOn("2004-02-28", "2029-02-28")).toBe(25);
    });
  });

  describe("year-end and year-start boundaries", () => {
    it("handles birthdays on January 1", () => {
      expect(ageOn("2000-01-01", "2026-12-31")).toBe(26);
      expect(ageOn("2000-01-01", "2027-01-01")).toBe(27);
    });

    it("handles birthdays on December 31", () => {
      expect(ageOn("2000-12-31", "2026-12-30")).toBe(25);
      expect(ageOn("2000-12-31", "2026-12-31")).toBe(26);
      expect(ageOn("2000-12-31", "2027-01-01")).toBe(26);
    });
  });

  describe("exact acceptance bounds (MIN_AGE = 10, MAX_AGE = 100)", () => {
    const today = "2026-11-09";

    it("accepts a lifter exactly on their 10th birthday and rejects 1 day younger", () => {
      expect(isAcceptedBirthday("2016-11-09", today)).toBe(true);
      expect(ageOn("2016-11-09", today)).toBe(MIN_AGE);
      expect(isAcceptedBirthday("2016-11-10", today)).toBe(false);
      expect(ageOn("2016-11-10", today)).toBe(9);
    });

    it("accepts a lifter on their 100th birthday and rejects a 101-year-old", () => {
      expect(isAcceptedBirthday("1926-11-09", today)).toBe(true);
      expect(ageOn("1926-11-09", today)).toBe(MAX_AGE);
      expect(isAcceptedBirthday("1925-11-09", today)).toBe(false);
      expect(ageOn("1925-11-09", today)).toBe(101);
    });

    it("rejects future birthdays where age is negative", () => {
      expect(ageOn("2030-01-01", today)).toBe(-4);
      expect(isAcceptedBirthday("2030-01-01", today)).toBe(false);
    });
  });

  describe("birthdayBounds generation", () => {
    it("safely adjusts February 29 bounds to February 28", () => {
      const bounds = birthdayBounds("2028-02-29");
      expect(bounds.min).toBe("1928-02-28");
      expect(bounds.max).toBe("2018-02-28");
    });

    it("generates 100-year and 10-year bounds on standard dates", () => {
      const bounds = birthdayBounds("2026-07-15");
      expect(bounds.min).toBe("1926-07-15");
      expect(bounds.max).toBe("2016-07-15");
    });
  });

  describe("profileAge handling", () => {
    it("computes approximate age from birth_year alone", () => {
      expect(profileAge({ birth_year: 1995 }, "2026-03-01")).toBe(31);
    });

    it("prefers exact birth_date over birth_year", () => {
      // On 2026-03-01, a person born on 1995-12-01 is still 30, even though 2026 - 1995 is 31
      expect(profileAge({ birth_date: "1995-12-01", birth_year: 1995 }, "2026-03-01")).toBe(30);
    });

    it("returns null for empty profiles or missing fields", () => {
      expect(profileAge(undefined, "2026-11-09")).toBeNull();
      expect(profileAge({}, "2026-11-09")).toBeNull();
      expect(profileAge({ birth_date: null, birth_year: null }, "2026-11-09")).toBeNull();
    });
  });

  describe("invalid date inputs", () => {
    it("returns null for malformed date formats", () => {
      expect(ageOn("1990/01/01", "2026-11-09")).toBeNull();
      expect(ageOn("1990-1-1", "2026-11-09")).toBeNull();
      expect(ageOn("90-01-01", "2026-11-09")).toBeNull();
      expect(ageOn("invalid", "2026-11-09")).toBeNull();
      expect(ageOn("", "")).toBeNull();
    });
  });
});
