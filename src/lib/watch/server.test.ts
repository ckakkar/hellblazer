import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashWatchToken } from "./token";

// The watch API runs as the service role, so the only thing between one
// lifter's watch and another lifter's data is this file's own scoping. These
// tests drive it against an in-memory stand-in for the Supabase client.

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const fake = vi.hoisted(() => ({
  client: null as unknown,
  available: true,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => (fake.available ? fake.client : null),
}));

// A finish schedules a widget refresh for after the response; there's no
// response here.
vi.mock("next/server", () => ({ after: () => {} }));

/** Just enough of supabase-js's query builder: eq/is filters, reads, writes. */
function fakeDb(tables: Tables) {
  const rpc = vi.fn<(name: string, args: Row) => Promise<{ data: unknown; error: unknown }>>(async () => ({
    data: null,
    error: null,
  }));
  function from(table: string) {
    let op: "select" | "update" | "insert" | "delete" = "select";
    let payload: Row | Row[] | undefined;
    let returning = false;
    const filters: [string, unknown][] = [];
    const within: [string, unknown[]][] = [];
    const without: [string, unknown][] = [];
    const atLeast: [string, string][] = [];
    const rows = () => (tables[table] ??= []);
    const matches = (row: Row) =>
      filters.every(([column, value]) => row[column] === value) &&
      within.every(([column, values]) => values.includes(row[column])) &&
      without.every(([column, value]) => (row[column] ?? null) !== value) &&
      atLeast.every(([column, value]) => String(row[column] ?? "") >= value);
    const run = (): { data: unknown; error: { code: string; message: string } | null } => {
      if (op === "select") return { data: rows().filter(matches), error: null };
      if (op === "update") {
        const hit = rows().filter(matches);
        for (const row of hit) Object.assign(row, payload);
        return { data: returning ? hit : null, error: null };
      }
      if (op === "delete") {
        tables[table] = rows().filter((row) => !matches(row));
        return { data: null, error: null };
      }
      for (const row of Array.isArray(payload) ? payload : [payload!]) {
        if (row.id && rows().some((existing) => existing.id === row.id)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        rows().push({ ...row });
      }
      return { data: null, error: null };
    };
    const builder = {
      select() {
        if (op !== "select") returning = true;
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      is(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        within.push([column, values]);
        return builder;
      },
      gte(column: string, value: string) {
        atLeast.push([column, value]);
        return builder;
      },
      not(column: string, _op: "is", value: unknown) {
        without.push([column, value]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      update(row: Row) {
        op = "update";
        payload = row;
        return builder;
      },
      insert(row: Row | Row[]) {
        op = "insert";
        payload = row;
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      maybeSingle: async () => {
        const result = run();
        return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error };
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }
  return { from, rpc };
}

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const TOKEN_A = "a".repeat(43);
const PHONE_TOKEN_A = "p".repeat(43);
const SE_A = "10000000-0000-4000-8000-000000000001";
const SE_B = "10000000-0000-4000-8000-000000000002";
const SESSION_A = "20000000-0000-4000-8000-000000000001";
const SESSION_B = "20000000-0000-4000-8000-000000000002";
const SET_B = "30000000-0000-4000-8000-000000000002";

let tables: Tables;
let db: ReturnType<typeof fakeDb>;

beforeEach(() => {
  tables = {
    watch_link: [
      { id: "link-a", user_id: A, kind: "watch", token_hash: hashWatchToken(TOKEN_A), last_seen_at: null },
      { id: "phone-a", user_id: A, kind: "phone", token_hash: hashWatchToken(PHONE_TOKEN_A), last_seen_at: null },
    ],
    session: [
      { id: SESSION_A, user_id: A, finished_at: new Date().toISOString(), created_at: new Date().toISOString() },
      { id: SESSION_B, user_id: B, finished_at: null, created_at: new Date().toISOString() },
    ],
    session_exercise: [
      { id: SE_A, user_id: A, session_id: SESSION_A },
      { id: SE_B, user_id: B, session_id: SESSION_B },
    ],
    set: [{ id: SET_B, user_id: B, session_exercise_id: SE_B, set_number: 1, weight_kg: 140, reps: 3 }],
    program: [],
    workout_template: [],
  };
  db = fakeDb(tables);
  fake.client = db;
  fake.available = true;
});

const {
  handleWatch,
  saveWatchSet,
  deleteWatchSet,
  finishWatchWorkout,
  startWatchWorkout,
  logVoiceSet,
  undoVoiceSet,
  finishVoiceWorkout,
  logHeardSets,
  spokenWorkout,
  watchState,
} = await import("./server");

function request(headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/watch/x", { headers });
}
const signedIn = (extra: Record<string, string> = {}) =>
  request({ authorization: `Bearer ${TOKEN_A}`, ...extra });

describe("who's asking", () => {
  it("is refused without a token, or with an unknown one", async () => {
    const run = vi.fn();
    expect((await handleWatch(request(), run)).status).toBe(401);
    expect((await handleWatch(request({ authorization: `Bearer ${"b".repeat(43)}` }), run)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("only accepts a token minted for that kind of device", async () => {
    const run = vi.fn(async () => ({}));
    // The phone's token can't drive the watch's API…
    expect((await handleWatch(request({ authorization: `Bearer ${PHONE_TOKEN_A}` }), run, "watch")).status).toBe(401);
    // …and the watch's can't stand in for the phone's.
    expect((await handleWatch(signedIn(), run, "phone")).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    expect((await handleWatch(request({ authorization: `Bearer ${PHONE_TOKEN_A}` }), run, "phone")).status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ userId: A }));
  });

  it("is a clear 503 when the server has no service key", async () => {
    fake.available = false;
    expect((await handleWatch(signedIn(), vi.fn())).status).toBe(503);
  });

  it("resolves to the token's lifter, with the unit and timezone the watch sends", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const res = await handleWatch(signedIn({ "x-fatty-unit": "lb", "x-fatty-tz": "Asia/Kolkata" }), run);
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ userId: A, unit: "lb", timeZone: "Asia/Kolkata" }));
    expect(tables.watch_link[0].last_seen_at).toEqual(expect.any(String));
  });

  it("ignores a timezone that isn't one, and defaults to kg", async () => {
    const run = vi.fn(async () => ({}));
    await handleWatch(signedIn({ "x-fatty-tz": "Not/AZone" }), run);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ unit: "kg", timeZone: "UTC" }));
  });

  it("answers a malformed body with 400", async () => {
    const res = await handleWatch(signedIn(), (ctx) => saveWatchSet(ctx, { id: "nope" }));
    expect(res.status).toBe(400);
  });
});

describe("logging sets", () => {
  const set = (overrides: Row = {}) => ({
    id: "30000000-0000-4000-8000-000000000001",
    sessionExerciseId: SE_A,
    setNumber: 1,
    weight: 225,
    reps: 5,
    ...overrides,
  });

  it("saves to the lifter's own exercise, converting the display unit to kg", async () => {
    const res = await handleWatch(signedIn({ "x-fatty-unit": "lb" }), (ctx) => saveWatchSet(ctx, set()));
    expect(res.status).toBe(200);
    const saved = tables.set.find((row) => row.id === set().id)!;
    expect(saved).toMatchObject({ user_id: A, session_exercise_id: SE_A, reps: 5, is_warmup: false });
    expect(saved.weight_kg).toBeCloseTo(102.06, 2);
  });

  it("updates rather than duplicates when the same set is sent again", async () => {
    await handleWatch(signedIn(), (ctx) => saveWatchSet(ctx, set()));
    await handleWatch(signedIn(), (ctx) => saveWatchSet(ctx, set({ reps: 6 })));
    const copies = tables.set.filter((row) => row.id === set().id);
    expect(copies).toHaveLength(1);
    expect(copies[0].reps).toBe(6);
  });

  it("won't log into someone else's exercise", async () => {
    const res = await handleWatch(signedIn(), (ctx) => saveWatchSet(ctx, set({ sessionExerciseId: SE_B })));
    expect(res.status).toBe(404);
    expect(tables.set).toHaveLength(1);
  });

  it("won't overwrite someone else's set by reusing its id", async () => {
    const res = await handleWatch(signedIn(), (ctx) => saveWatchSet(ctx, set({ id: SET_B })));
    expect(res.status).toBe(409);
    expect(tables.set.find((row) => row.id === SET_B)).toMatchObject({ user_id: B, weight_kg: 140, reps: 3 });
  });

  it("only ever deletes the lifter's own sets", async () => {
    await handleWatch(signedIn(), (ctx) => deleteWatchSet(ctx, { id: SET_B }));
    expect(tables.set.some((row) => row.id === SET_B)).toBe(true);
  });
});

describe("starting and finishing", () => {
  it("starts through start_session for the token's lifter", async () => {
    const day = "40000000-0000-4000-8000-000000000001";
    const template = "50000000-0000-4000-8000-000000000001";
    await handleWatch(signedIn(), (ctx) =>
      startWatchWorkout(ctx, { templateId: template, programDayId: day, localDate: "2026-09-26" }),
    );
    expect(db.rpc).toHaveBeenCalledWith("start_session", {
      p_user: A,
      p_program_day_id: day,
      p_date: "2026-09-26",
    });
  });

  it("turns start_session's not-found into a 404", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "template not found" } });
    const res = await handleWatch(signedIn(), (ctx) =>
      startWatchWorkout(ctx, {
        templateId: "50000000-0000-4000-8000-000000000001",
        programDayId: null,
        localDate: "2026-09-26",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("won't finish someone else's session", async () => {
    const res = await handleWatch(signedIn(), (ctx) =>
      finishWatchWorkout(ctx, { sessionId: SESSION_B, durationMin: 45 }),
    );
    expect(res.status).toBe(404);
    expect(tables.session.find((row) => row.id === SESSION_B)?.finished_at).toBeNull();
  });
});

describe("logging by voice on the phone", () => {
  const LIVE = "20000000-0000-4000-8000-000000000003";
  const BENCH = "10000000-0000-4000-8000-000000000003";
  const ROW = "10000000-0000-4000-8000-000000000004";
  const FIRST = "31000000-0000-4000-8000-000000000001";
  const phone = () => request({ authorization: `Bearer ${PHONE_TOKEN_A}` });
  const say = async (body: unknown) => (await handleWatch(phone(), (ctx) => logVoiceSet(ctx, body), "phone")).json();

  beforeEach(() => {
    const first = { id: FIRST, set_number: 1, weight_kg: 80, reps: 5, is_warmup: false };
    tables.session.push({
      id: LIVE,
      user_id: A,
      title: "Upper",
      template_id: null,
      finished_at: null,
      created_at: new Date().toISOString(),
    });
    tables.session_exercise.push(
      { id: BENCH, user_id: A, session_id: LIVE, exercise_id: "e1", position: 0, exercise: { name: "Bench Press" }, set: [first] },
      { id: ROW, user_id: A, session_id: LIVE, exercise_id: "e2", position: 1, exercise: { name: "Row" }, set: [] },
    );
    tables.set.push({ ...first, user_id: A, session_exercise_id: BENCH });
  });

  it("logs the same set again on the exercise being worked", async () => {
    expect(await say({})).toMatchObject({
      status: "logged",
      exercise: "Bench Press",
      weight: 80,
      reps: 5,
      setNumber: 2,
      complete: false,
      activity: { sessionId: LIVE, sets: 2, volume: "800 kg" },
    });
    const bench = tables.set.filter((row) => row.session_exercise_id === BENCH);
    expect(bench).toHaveLength(2);
    expect(bench[1]).toMatchObject({ user_id: A, set_number: 2, weight_kg: 80, reps: 5, is_warmup: false });
  });

  it("logs the numbers it's told", async () => {
    expect(await say({ weight: 85, reps: 3 })).toMatchObject({ status: "logged", weight: 85, reps: 3 });
  });

  it("logs the Lock Screen's set on the exercise it showed", async () => {
    expect(await say({ weight: 60, reps: 10, sessionExerciseId: ROW })).toMatchObject({
      status: "logged",
      exercise: "Row",
      setNumber: 1,
    });
    expect(tables.set.filter((row) => row.session_exercise_id === ROW)).toHaveLength(1);
  });

  it("takes back the last set", async () => {
    const res = await handleWatch(phone(), undoVoiceSet, "phone");
    expect(await res.json()).toMatchObject({ status: "undone", setId: FIRST, exercise: "Bench Press", weight: 80 });
    expect(tables.set.some((row) => row.id === FIRST)).toBe(false);
  });

  it("finishes the workout, with its average RPE as the effort", async () => {
    tables.set.find((row) => row.id === FIRST)!.rpe = 8;
    const res = await handleWatch(phone(), finishVoiceWorkout, "phone");
    expect(await res.json()).toMatchObject({ status: "finished", sessionId: LIVE, sets: 1, volume: "400 kg", effort: 8 });
    expect(tables.session.find((row) => row.id === LIVE)?.finished_at).toEqual(expect.any(String));
  });

  it("wants both numbers or neither", async () => {
    const res = await handleWatch(phone(), (ctx) => logVoiceSet(ctx, { weight: 85 }), "phone");
    expect(res.status).toBe(400);
  });

  it("says so when no workout's going", async () => {
    tables.session.find((row) => row.id === LIVE)!.finished_at = new Date().toISOString();
    expect(await say({})).toEqual({ status: "no-workout" });
  });

  it("is the phone's to use, not the watch's", async () => {
    const res = await handleWatch(signedIn(), (ctx) => logVoiceSet(ctx, {}), "phone");
    expect(res.status).toBe(401);
  });

  describe("in the lifter's own words", () => {
    const heard = async (body: unknown) =>
      (await handleWatch(phone(), (ctx) => logHeardSets(ctx, body), "phone")).json();

    it("names the workout's exercises for the phone's model", async () => {
      const res = await handleWatch(phone(), spokenWorkout, "phone");
      expect(await res.json()).toEqual({ status: "ok", unit: "kg", exercises: ["Bench Press", "Row"] });
    });

    it("logs what was heard, effort and all, numbered after the sets already in", async () => {
      const reply = await heard({
        heard: [
          { exercise: "rows", sets: 2, reps: 8, weight: 60, unit: null, rpe: null, warmup: false },
          { exercise: null, sets: 1, reps: 8, weight: 60, unit: null, rpe: 9, warmup: false },
          { exercise: "bench", sets: 1, reps: null, weight: 85, unit: null, rpe: null, warmup: false },
        ],
      });
      expect(reply).toMatchObject({
        status: "logged",
        count: 4,
        said: "3 sets of 8 at 60 kg on Row, the last at RPE 9; 1 set of 5 at 85 kg on Bench Press",
        unmatched: [],
        warmup: false,
        activity: { sessionId: LIVE, sets: 5 },
      });
      const rows = tables.set.filter((row) => row.session_exercise_id === ROW);
      expect(rows.map((row) => [row.set_number, row.weight_kg, row.reps, row.rpe, row.user_id])).toEqual([
        [1, 60, 8, null, A],
        [2, 60, 8, null, A],
        [3, 60, 8, 9, A],
      ]);
      expect(tables.set.filter((row) => row.session_exercise_id === BENCH).map((row) => row.set_number)).toEqual([
        1, 2,
      ]);
    });

    it("says what it couldn't find, and logs nothing when that's all there was", async () => {
      expect(
        await heard({
          heard: [{ exercise: "leg press", sets: 3, reps: 10, weight: 200, unit: null, rpe: null, warmup: false }],
        }),
      ).toEqual({ status: "nothing", unmatched: ["leg press"] });
      expect(tables.set.filter((row) => row.user_id === A)).toHaveLength(1);
    });

    it("says so when no workout's going", async () => {
      tables.session.find((row) => row.id === LIVE)!.finished_at = new Date().toISOString();
      expect(await heard({ heard: [] })).toEqual({ status: "no-workout" });
    });
  });
});

describe("starting on the watch with no connection", () => {
  const TEMPLATE = "50000000-0000-4000-8000-000000000002";

  it("sends each day's plan while no workout is on", async () => {
    tables.workout_template.push({
      id: TEMPLATE,
      user_id: A,
      name: "Upper",
      day_label: "Day 1: Upper",
      position: 0,
      template_exercise: [{ id: "te-1" }],
    });
    tables.template_exercise = [
      {
        template_id: TEMPLATE,
        user_id: A,
        position: 0,
        exercise_id: "e1",
        target_sets: 3,
        target_rep_range: "5",
        rest_seconds: 180,
        exercise: { name: "Bench Press" },
      },
      { template_id: TEMPLATE, user_id: B, position: 0, exercise_id: "e9", exercise: { name: "Not yours" } },
    ];
    tables.v_session_summary = [];
    const res = await handleWatch(signedIn(), watchState);
    const state = await res.json();
    expect(state.active).toBeNull();
    expect(state.options[0].plan).toEqual([
      { name: "Bench Press", targetSets: 3, targetReps: "5", restSeconds: 180, last: [], target: null },
    ]);
  });
});
