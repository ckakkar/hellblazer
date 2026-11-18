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

/** Who the browser's session says is signed in. */
const signedIn = { id: "33333333-3333-4333-8333-333333333333" as string | null };

/** The account each request went as (the token it carried), in order. */
const wentAs: string[] = [];

vi.mock("@/lib/supabase/client", () => {
  const db = (as: () => string) => ({
    from: (table: string) => {
      const r = (label: string) => {
        wentAs.push(as());
        return respond(label);
      };
      return {
        upsert: (row: { id?: string; reps?: number; exercise_id?: string; note?: string }, opts?: { onConflict?: string }) =>
          r(
            row.id
              ? `${table} save ${row.id} ${row.reps}`
              : `${table} save ${row.exercise_id} ${JSON.stringify(row.note)} on ${opts?.onConflict}${"user_id" in row ? " +user" : ""}`,
          ),
        delete: () => ({ eq: (_: string, id: string) => r(`${table} delete ${id}`) }),
        update: (patch: { ended_at: string | null }) => ({
          eq: (_: string, id: string) => r(`${table} ended ${id} ${patch.ended_at ? "yes" : "no"}`),
        }),
        select: () => ({ eq: () => r(`${table} read`) }),
      };
    },
  });
  return {
    createClient: () => ({
      auth: {
        getSession: async () => ({
          data: { session: signedIn.id ? { user: { id: signedIn.id }, access_token: `token-of-${signedIn.id}` } : null },
        }),
      },
      ...db(() => `session ${signedIn.id}`),
    }),
    createClientAs: (token: string) => db(() => token),
  };
});

const { LIFT_NOTE_MAX, OUTBOX_HOLD_MS, deleteSetNow, failureCode, inSetOrder, saveLiftNoteNow, saveSetNow } = await import("./logger-sync");

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
  signedIn.id = USER;
  wentAs.length = 0;
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

  it("never sends a set past an upload of it from Home that's still out; fails instead, after a while", async () => {
    // From QA (R3-12, R3-15): an upload that hung held the set's saves for
    // good; sending past it let the old copy land last (or commit unseen).
    vi.useFakeTimers();
    try {
      let land!: () => void;
      const upload = inSetOrder(SET, () => new Promise<void>((r) => (land = r)));
      const save = saveSetNow(write(10), USER);
      const failed = expect(save).rejects.toMatchObject({ code: "held" });
      await vi.advanceTimersByTimeAsync(OUTBOX_HOLD_MS + 1_000);
      await failed;
      expect(sent).toEqual([]);
      expect(failureCode(await save.catch((e: unknown) => e))).toBe("held");
      // The upload gets its answer; the save sent again now goes, after it.
      land();
      await upload;
      await saveSetNow(write(10), USER);
      expect(sent).toEqual([`set save ${SET} 10`]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends a set right after an upload of it from Home that lands in time", async () => {
    let land!: () => void;
    const upload = inSetOrder(SET, () => new Promise<void>((r) => (land = r)));
    const save = saveSetNow(write(10), USER);
    await vi.waitFor(() => expect(land).toBeTypeOf("function"));
    await new Promise((r) => setTimeout(r, 10));
    expect(sent).toEqual([]);
    land();
    await Promise.all([upload, save]);
    expect(sent).toEqual([`set save ${SET} 10`]);
  });

  it("holds a delete behind an upload of the set too", async () => {
    let land!: () => void;
    const upload = inSetOrder(SET, () => new Promise<void>((r) => (land = r)));
    const remove = deleteSetNow(SET);
    await vi.waitFor(() => expect(land).toBeTypeOf("function"));
    expect(sent).toEqual([]);
    land();
    await Promise.all([upload, remove]);
    expect(sent).toEqual([`set delete ${SET}`]);
  });

  it("refuses a set with no reps before sending anything", () => {
    expect(() => saveSetNow(write(0), USER)).toThrow();
    expect(sent).toHaveLength(0);
  });
});

describe("lift notes", () => {
  const EX = "44444444-4444-4444-8444-444444444444";

  it("saves the note trimmed, as an upsert on lifter and exercise, naming the lifter", async () => {
    await saveLiftNoteNow(EX, "  Seat 4, pin 7  ", USER);
    expect(sent).toEqual([`exercise_note save ${EX} "Seat 4, pin 7" on user_id,exercise_id +user`]);
  });

  it("deletes the note when it's cleared or only spaces", async () => {
    await saveLiftNoteNow(EX, "   ", USER);
    await saveLiftNoteNow(EX, null, USER);
    expect(sent).toEqual([`exercise_note delete ${USER}`, `exercise_note delete ${USER}`]);
  });

  it("keeps a note within what the database allows, with no space left at the cut", async () => {
    await saveLiftNoteNow(EX, "x".repeat(LIFT_NOTE_MAX - 1) + " tail that runs over", USER);
    const saved = JSON.parse(sent[0].split(" ").slice(3, -3).join(" ")) as string;
    expect(saved).toBe("x".repeat(LIFT_NOTE_MAX - 1));
  });

  it("lands one movement's notes in the order they were written", async () => {
    answers = [later(30, ok), later(0, ok)];
    await Promise.all([saveLiftNoteNow(EX, "Seat 4", USER), saveLiftNoteNow(EX, null, USER)]);
    expect(sent).toEqual([`exercise_note save ${EX} "Seat 4" on user_id,exercise_id +user`, `exercise_note delete ${USER}`]);
  });

  it("sends nothing, and fails, once another account is signed in (a removal too)", async () => {
    // From QA (R3-18): a removal sent as the other account deleted nothing
    // and came back as done, so the first account's removal was lost.
    signedIn.id = "66666666-6666-4666-8666-666666666666";
    await expect(saveLiftNoteNow(EX, null, USER)).rejects.toMatchObject({ code: "account" });
    await expect(saveLiftNoteNow(EX, "Seat 4", USER)).rejects.toMatchObject({ code: "account" });
    signedIn.id = null;
    await expect(saveLiftNoteNow(EX, "Seat 4", USER)).rejects.toMatchObject({ code: "account" });
    expect(sent).toEqual([]);
  });

  it("goes as the note's own account, whoever the session says by the time it's sent", async () => {
    // From QA (R3-18): checking the account before and after didn't bind
    // the request (A, then B for the request, then A again); it carries the
    // token of the account it was checked as.
    answers = [
      () => {
        // The session switches once the note's been checked, as it's sent.
        signedIn.id = "66666666-6666-4666-8666-666666666666";
        return Promise.resolve({ data: null, error: null, status: 204 });
      },
    ];
    await saveLiftNoteNow(EX, null, USER);
    expect(wentAs).toEqual([`token-of-${USER}`]);
  });

  it("fails, rather than saying it saved, when the database refuses it", async () => {
    answers = [() => Promise.resolve({ data: null, error: { message: "denied", code: "23514" }, status: 400 })];
    await expect(saveLiftNoteNow(EX, "Seat 4", USER)).rejects.toBeTruthy();
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
