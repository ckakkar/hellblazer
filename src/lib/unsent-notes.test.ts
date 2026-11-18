import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dropUnsentNote, keepUnsentNote, readUnsentNotes } from "./unsent-notes";

// From QA (R3-16): a note that didn't save was gone once the lifter left the
// page. It's kept on the device, per account, until the server has it.

const A = "33333333-3333-4333-8333-333333333333";
const B = "66666666-6666-4666-8666-666666666666";
const EX = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps a note until the server has it, for its own account only", () => {
  const at = keepUnsentNote(A, EX, "Seat 4, pin 7");
  expect(readUnsentNotes(A)).toEqual({ [EX]: "Seat 4, pin 7" });
  expect(readUnsentNotes(B)).toEqual({});
  dropUnsentNote(A, EX, at);
  expect(readUnsentNotes(A)).toEqual({});
});

it("keeps a removal too", () => {
  keepUnsentNote(A, EX, null);
  expect(readUnsentNotes(A)).toEqual({ [EX]: null });
});

it("doesn't drop a newer note when an older one lands", () => {
  const first = keepUnsentNote(A, EX, "Seat 4");
  keepUnsentNote(A, EX, "Seat 5");
  dropUnsentNote(A, EX, first);
  expect(readUnsentNotes(A)).toEqual({ [EX]: "Seat 5" });
});

it("doesn't drop the last of A, B, A when the first A's answer comes", () => {
  // From QA (R3-17): kept copies were matched by their words.
  const firstA = keepUnsentNote(A, EX, "Seat 4");
  const b = keepUnsentNote(A, EX, "Seat 5");
  keepUnsentNote(A, EX, "Seat 4");
  dropUnsentNote(A, EX, firstA);
  dropUnsentNote(A, EX, b);
  expect(readUnsentNotes(A)).toEqual({ [EX]: "Seat 4" });
});

it("reads nothing from storage it can't use", () => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => "not json",
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    },
  });
  expect(readUnsentNotes(A)).toEqual({});
  expect(() => keepUnsentNote(A, EX, "x")).not.toThrow();
});
