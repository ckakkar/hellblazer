import { describe, expect, it } from "vitest";
import { ageOn, birthdayBounds, isAcceptedBirthday, profileAge } from "./age";

describe("ageOn", () => {
  it("counts a birthday that has already happened this year", () => {
    expect(ageOn("1998-03-14", "2026-09-25")).toBe(28);
  });
  it("doesn't count a birthday still to come", () => {
    expect(ageOn("1998-11-02", "2026-09-25")).toBe(27);
  });
  it("turns a year older on the birthday itself", () => {
    expect(ageOn("1998-09-25", "2026-09-25")).toBe(28);
    expect(ageOn("1998-09-26", "2026-09-25")).toBe(27);
  });
  it("ages a 29 February birthday on 1 March in non-leap years", () => {
    expect(ageOn("2004-02-29", "2027-02-28")).toBe(22);
    expect(ageOn("2004-02-29", "2027-03-01")).toBe(23);
  });
  it("rejects anything that isn't a date", () => {
    expect(ageOn("14/03/1998", "2026-09-25")).toBeNull();
  });
});

describe("profileAge", () => {
  it("prefers the exact birthday", () => {
    expect(profileAge({ birth_date: "1998-11-02", birth_year: 1998 }, "2026-09-25")).toBe(27);
  });
  it("falls back to the birth year for older profiles", () => {
    expect(profileAge({ birth_date: null, birth_year: 1998 }, "2026-09-25")).toBe(28);
  });
  it("is null with neither", () => {
    expect(profileAge({}, "2026-09-25")).toBeNull();
    expect(profileAge(null, "2026-09-25")).toBeNull();
  });
});

describe("birthday limits", () => {
  it("allows ages 10 to 100", () => {
    expect(birthdayBounds("2026-09-25")).toEqual({ min: "1926-09-25", max: "2016-09-25" });
    expect(isAcceptedBirthday("2016-09-25", "2026-09-25")).toBe(true);
    expect(isAcceptedBirthday("2016-09-26", "2026-09-25")).toBe(false);
    expect(isAcceptedBirthday("1926-09-25", "2026-09-25")).toBe(true);
    expect(isAcceptedBirthday("1925-09-24", "2026-09-25")).toBe(false);
  });
  it("keeps the bounds valid on 29 February", () => {
    expect(birthdayBounds("2028-02-29")).toEqual({ min: "1928-02-28", max: "2018-02-28" });
  });
});
