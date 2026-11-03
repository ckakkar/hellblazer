import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Answer = { data: unknown; error: unknown; status: number };

/** What the fake database was asked, in the order the requests went out. */
const sent: string[] = [];
/** How each request is answered, in turn (default: fine, at once). */
let answers: (() => Promise<Answer>)[] = [];

function respond(label: string): PromiseLike<Answer> & { abortSignal: () => PromiseLike<Answer>; eq: () => unknown; maybeSingle: () => PromiseLike<Answer> } {
  const go = () => {
    sent.push(label);
    const next = answers.shift();
    return next ? next() : Promise.resolve({ data: null, error: null, status: 200 });
  };
  const chain = {
    eq: () => chain,
    abortSignal: () => chain,
    maybeSingle: () => chain,
    then: (ok: (a: Answer) => unknown, fail?: (e: unknown) => unknown) => go().then(ok, fail),
  };
  return chain as never;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: (row: { id: string; reps: number }) => respond(`${table} save ${row.id} ${row.reps}`),
      delete: () => ({ eq: (_: string, id: string) => respond(`${table} delete ${id}`) }),
      update: (patch: { ended_at: string | null }) => ({
        eq: (_: string, id: string) => respond(`${table} ended ${id} ${patch.ended_at ? "yes" : "no"}`),
      }),
      select: () => ({ eq: () => respond(`${table} read`) }),
    }),
  }),
}));

const { deleteSetNow, failureCode, saveSetNow } = await import("./logger-sync");

const SET = "11111111-1111-4111-8111-111111111111";
const SE = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

const write = (reps: number) => ({
  id: SET,
  sessionExerciseId: SE,
  setNumber: 1,
  weightKg: 60,
  reps,
  rpe: null,
  isWarmup: false,
});

const later = (ms: number, answer: Answer) => () => new Promise<Answer>((r) => setTimeout(() => r(answer), ms));
const ok: Answer = { data: null, error: null, status: 200 };
const dropped: Answer = { data: null, error: { message: "TypeError: Load failed", code: "" }, status: 0 };

beforeEach(() => {
  sent.length = 0;
  answers = [];
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("logger writes", () => {
  it("lands one set's writes in the order they were made, even when the first is slow", async () => {
    answers = [later(30, ok), later(0, ok)];
    const save = saveSetNow(write(8), USER);
    const remove = deleteSetNow(SET);
    await Promise.all([save, remove]);
    expect(sent).toEqual([`set save ${SET} 8`, `set delete ${SET}`]);
  });

  it("still sends the next write when the one before it failed", async () => {
    answers = [() => Promise.resolve({ data: null, error: { message: "nope", code: "42501" }, status: 403 })];
    const first = saveSetNow(write(8), USER);
    const second = saveSetNow(write(9), USER);
    await expect(first).rejects.toBeTruthy();
    await second;
    expect(sent).toEqual([`set save ${SET} 8`, `set save ${SET} 9`]);
  });

  it("sends a write once more when it died at once without an answer", async () => {
    answers = [() => Promise.resolve(dropped), () => Promise.resolve(ok)];
    await saveSetNow(write(8), USER);
    expect(sent).toEqual([`set save ${SET} 8`, `set save ${SET} 8`]);
  });

  it("doesn't send it again offline, or when the database refused it", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    answers = [() => Promise.resolve(dropped)];
    await expect(saveSetNow(write(8), USER)).rejects.toBeTruthy();
    vi.stubGlobal("navigator", { onLine: true });
    answers = [() => Promise.resolve({ data: null, error: { message: "denied", code: "42501" }, status: 403 })];
    await expect(saveSetNow(write(8), USER)).rejects.toBeTruthy();
    expect(sent).toHaveLength(2);
  });

  it("refuses a set with no reps before sending anything", () => {
    expect(() => saveSetNow(write(0), USER)).toThrow();
    expect(sent).toHaveLength(0);
  });
});

describe("failureCode", () => {
  it("says what kind of failure, never the message", () => {
    expect(failureCode({ message: "AbortError: signal is aborted", code: "" })).toBe("timeout");
    expect(failureCode({ message: "TypeError: Load failed", code: "" })).toBe("network");
    expect(failureCode({ message: "violates row-level security", code: "42501" })).toBe("db 42501");
    expect(failureCode({ issues: [] })).toBe("invalid");
  });
});
