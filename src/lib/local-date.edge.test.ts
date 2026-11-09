import { describe, expect, it } from "vitest";
import { dateInTimeZone, isValidTimeZone, todayLocalISO } from "./local-date";

describe("local-date edge cases", () => {
  describe("DST changes in America/New_York", () => {
    // 2026-03-08: Clocks spring forward 2:00 AM -> 3:00 AM EST to EDT (UTC-5 to UTC-4).
    it("handles midnight transition into spring-forward day (EST)", () => {
      // 04:59:59 UTC is 23:59:59 EST on March 7
      expect(dateInTimeZone(new Date("2026-03-08T04:59:59Z"), "America/New_York")).toBe("2026-03-07");
      // 05:00:00 UTC is 00:00:00 EST on March 8
      expect(dateInTimeZone(new Date("2026-03-08T05:00:00Z"), "America/New_York")).toBe("2026-03-08");
    });

    it("handles the exact spring-forward instant in America/New_York", () => {
      // 06:59:59 UTC is 01:59:59 EST
      expect(dateInTimeZone(new Date("2026-03-08T06:59:59Z"), "America/New_York")).toBe("2026-03-08");
      // 07:00:00 UTC jumps directly to 03:00:00 EDT
      expect(dateInTimeZone(new Date("2026-03-08T07:00:00Z"), "America/New_York")).toBe("2026-03-08");
    });

    // 2026-11-01: Clocks fall back 2:00 AM -> 1:00 AM EDT to EST (UTC-4 to UTC-5).
    it("handles midnight transition into fall-back day (EDT)", () => {
      // 03:59:59 UTC is 23:59:59 EDT on Oct 31
      expect(dateInTimeZone(new Date("2026-11-01T03:59:59Z"), "America/New_York")).toBe("2026-10-31");
      // 04:00:00 UTC is 00:00:00 EDT on Nov 1
      expect(dateInTimeZone(new Date("2026-11-01T04:00:00Z"), "America/New_York")).toBe("2026-11-01");
    });

    it("handles the repeated hour during fall-back in America/New_York", () => {
      // 05:59:59 UTC is 01:59:59 EDT
      expect(dateInTimeZone(new Date("2026-11-01T05:59:59Z"), "America/New_York")).toBe("2026-11-01");
      // 06:00:00 UTC falls back to 01:00:00 EST
      expect(dateInTimeZone(new Date("2026-11-01T06:00:00Z"), "America/New_York")).toBe("2026-11-01");
    });
  });

  describe("DST changes in Europe/London", () => {
    // 2026-03-29: Spring forward 01:00 GMT -> 02:00 BST (UTC+0 to UTC+1).
    it("handles spring-forward boundary in Europe/London", () => {
      // 2026-03-28 23:59:59 UTC is 23:59:59 GMT
      expect(dateInTimeZone(new Date("2026-03-28T23:59:59Z"), "Europe/London")).toBe("2026-03-28");
      // 2026-03-29 00:00:00 UTC is 00:00:00 GMT
      expect(dateInTimeZone(new Date("2026-03-29T00:00:00Z"), "Europe/London")).toBe("2026-03-29");
      // 2026-03-29 01:00:00 UTC jumps to 02:00:00 BST
      expect(dateInTimeZone(new Date("2026-03-29T01:00:00Z"), "Europe/London")).toBe("2026-03-29");
    });

    // 2026-10-25: Fall back 02:00 BST -> 01:00 GMT (UTC+1 to UTC+0).
    it("handles fall-back boundary in Europe/London", () => {
      // 2026-10-24 22:59:59 UTC is 23:59:59 BST
      expect(dateInTimeZone(new Date("2026-10-24T22:59:59Z"), "Europe/London")).toBe("2026-10-24");
      // 2026-10-24 23:00:00 UTC is 00:00:00 BST
      expect(dateInTimeZone(new Date("2026-10-24T23:00:00Z"), "Europe/London")).toBe("2026-10-25");
      // 2026-10-25 01:00:00 UTC falls back to 01:00:00 GMT
      expect(dateInTimeZone(new Date("2026-10-25T01:00:00Z"), "Europe/London")).toBe("2026-10-25");
    });
  });

  describe("extreme timezones far from UTC", () => {
    it("handles Pacific/Kiritimati (UTC+14)", () => {
      // 09:59:59 UTC + 14h = 23:59:59 on May 1
      expect(dateInTimeZone(new Date("2026-05-01T09:59:59Z"), "Pacific/Kiritimati")).toBe("2026-05-01");
      // 10:00:00 UTC + 14h = 00:00:00 on May 2
      expect(dateInTimeZone(new Date("2026-05-01T10:00:00Z"), "Pacific/Kiritimati")).toBe("2026-05-02");
    });

    it("handles Pacific/Pago_Pago (UTC-11)", () => {
      // 10:59:59 UTC - 11h = 23:59:59 on April 30
      expect(dateInTimeZone(new Date("2026-05-01T10:59:59Z"), "Pacific/Pago_Pago")).toBe("2026-04-30");
      // 11:00:00 UTC - 11h = 00:00:00 on May 1
      expect(dateInTimeZone(new Date("2026-05-01T11:00:00Z"), "Pacific/Pago_Pago")).toBe("2026-05-01");
    });

    it("handles Pacific/Auckland across southern DST changes (+13 to +12)", () => {
      // 2026-04-04 10:59:59 UTC is 23:59:59 NZDT (+13)
      expect(dateInTimeZone(new Date("2026-04-04T10:59:59Z"), "Pacific/Auckland")).toBe("2026-04-04");
      // 2026-04-04 11:00:00 UTC is 00:00:00 NZDT (+13) on April 5
      expect(dateInTimeZone(new Date("2026-04-04T11:00:00Z"), "Pacific/Auckland")).toBe("2026-04-05");
      // 2026-04-04 14:00:00 UTC: falls back to NZST (+12), 02:00:00 on April 5
      expect(dateInTimeZone(new Date("2026-04-04T14:00:00Z"), "Pacific/Auckland")).toBe("2026-04-05");
    });
  });

  describe("year end and leap year boundaries", () => {
    it("handles New Year's Eve across timezones at the same UTC instant", () => {
      const instant = new Date("2026-12-31T23:30:00Z");
      // In London (GMT) it's still 23:30 on Dec 31
      expect(dateInTimeZone(instant, "Europe/London")).toBe("2026-12-31");
      // In Paris (CET, UTC+1) it's 00:30 on Jan 1
      expect(dateInTimeZone(instant, "Europe/Paris")).toBe("2027-01-01");
      // In New York (EST, UTC-5) it's 18:30 on Dec 31
      expect(dateInTimeZone(instant, "America/New_York")).toBe("2026-12-31");
      // In Auckland (NZDT, UTC+13) it's 12:30 on Jan 1
      expect(dateInTimeZone(instant, "Pacific/Auckland")).toBe("2027-01-01");
      // In Pago Pago (SST, UTC-11) it's 12:30 on Dec 31
      expect(dateInTimeZone(instant, "Pacific/Pago_Pago")).toBe("2026-12-31");
    });

    it("handles leap year transition into February 29", () => {
      // 2028 is a leap year.
      const justBeforeMidnight = new Date("2028-02-28T23:59:59Z");
      const midnight = new Date("2028-02-29T00:00:00Z");
      expect(dateInTimeZone(justBeforeMidnight, "UTC")).toBe("2028-02-28");
      expect(dateInTimeZone(midnight, "UTC")).toBe("2028-02-29");
    });
  });

  describe("isValidTimeZone validation", () => {
    it("accepts valid IANA timezone names", () => {
      expect(isValidTimeZone("America/New_York")).toBe(true);
      expect(isValidTimeZone("Europe/London")).toBe(true);
      expect(isValidTimeZone("Pacific/Auckland")).toBe(true);
      expect(isValidTimeZone("Pacific/Kiritimati")).toBe(true);
      expect(isValidTimeZone("Pacific/Pago_Pago")).toBe(true);
      expect(isValidTimeZone("UTC")).toBe(true);
    });

    it("rejects invalid timezone strings", () => {
      expect(isValidTimeZone("")).toBe(false);
      expect(isValidTimeZone("   ")).toBe(false);
      expect(isValidTimeZone("Not/AZone")).toBe(false);
      expect(isValidTimeZone("America/Fake_City")).toBe(false);
      expect(isValidTimeZone("GMT+14")).toBe(false);
      expect(isValidTimeZone("UTC+2")).toBe(false);
    });
  });

  describe("todayLocalISO", () => {
    it("returns a valid YYYY-MM-DD date string", () => {
      const today = todayLocalISO();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
