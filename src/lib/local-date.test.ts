import { describe, expect, it } from "vitest";
import { dateInTimeZone, isValidTimeZone } from "./local-date";

describe("dateInTimeZone", () => {
  // 00:30 on Monday in India is still Sunday evening in UTC: the window where
  // a server working in UTC put the lifter's "today" and "this week" a day back.
  const justAfterMidnightIST = new Date("2026-09-20T19:00:00Z");

  it("uses the lifter's calendar, not UTC's", () => {
    expect(dateInTimeZone(justAfterMidnightIST, "Asia/Kolkata")).toBe("2026-09-21");
    expect(dateInTimeZone(justAfterMidnightIST, "UTC")).toBe("2026-09-20");
  });

  it("handles zones behind UTC", () => {
    expect(dateInTimeZone(new Date("2026-09-21T03:00:00Z"), "America/Los_Angeles")).toBe(
      "2026-09-20",
    );
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
