import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";

// From QA (R3-02): Home's outbox was uploading a queued 8-rep set when the
// lifter opened its workout and changed it to 10; the logger's save landed,
// then the older upload did, and 8 reps stuck with nothing left to fix it.
// The two now share the set's order, so the newer save goes after.

const db = vi.hoisted(() => ({ reps: 0, release: null as null | (() => void), entered: null as null | (() => void), order: [] as string[] }));
const USER = "33333333-3333-4333-8333-333333333333";
const SET = "11111111-1111-4111-8111-111111111111";
const SE = "22222222-2222-4222-8222-222222222222";

// The outbox's upload (a server action): held until released.
vi.mock("@/lib/auth", () => ({
  getAuthedContext: async () => ({
    user: { id: "33333333-3333-4333-8333-333333333333" },
    supabase: {
      from: () => ({
        upsert: async (row: { id: string; reps: number }) => {
          if (row.id === "11111111-1111-4111-8111-111111111111") {
            db.entered?.();
            await new Promise<void>((r) => (db.release = r));
          }
          db.reps = row.reps;
          db.order.push(`outbox ${row.id.slice(0, 1)} ${row.reps}`);
          return { error: null };
        },
      }),
    },
  }),
}));
// The logger's direct save.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: { set_id?: string; id: string; reps: number }) => ({
        abortSignal: async () => {
          if (row.id === "11111111-1111-4111-8111-111111111111") db.reps = row.reps;
          db.order.push(`logger ${row.id.slice(0, 1)} ${row.reps}`);
          return { data: null, error: null, status: 200 };
        },
      }),
    }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/widget-push", () => ({ widgetDevices: async () => [], refreshWidgets: vi.fn() }));
vi.mock("@/lib/data/sessions", () => ({ getActiveSession: async () => null }));
vi.mock("@/lib/report", () => ({ reportProblem: vi.fn() }));

const { queueSet, removeQueuedSet, getAllQueuedSets } = await import("./offline-set-queue");
const { drainOutbox } = await import("./offline-outbox");
const { saveSetNow } = await import("./logger-sync");

afterEach(() => vi.unstubAllGlobals());

it("lands the logger's newer save after an older upload from Home, never before it", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const first = {
    id: SET,
    userId: USER,
    sessionId: "44444444-4444-4444-8444-444444444444",
    sessionExerciseId: SE,
    setNumber: 1,
    weightKg: 60,
    reps: 8,
    rpe: null,
    isWarmup: false,
    updatedAt: 100,
  };
  await queueSet(first);
  const entered = new Promise<void>((r) => (db.entered = r));
  const draining = drainOutbox(USER, null);
  await entered;

  // The workout opens while Home's upload is in the air; the set becomes 10.
  const edited = { ...first, reps: 10, updatedAt: 200 };
  await queueSet(edited);
  const saving = saveSetNow(edited, USER).then(() => removeQueuedSet(SET, edited.updatedAt));
  await new Promise((r) => setTimeout(r, 20));
  expect(db.order, "the newer save waits for the upload already on its way").toEqual([]);

  db.release!();
  await Promise.all([draining, saving]);
  expect(db.order).toEqual(["outbox 1 8", "logger 1 10"]);
  expect(db.reps).toBe(10);
  expect(await getAllQueuedSets()).toHaveLength(0);
});

it("uploads a queued set as the device has it when its turn comes, not as it was listed", async () => {
  // The logger saved the second set (and cleared it from the device) while
  // Home was still on the first: the second isn't sent again from the list.
  db.order = [];
  vi.stubGlobal("navigator", { onLine: true });
  const base = { userId: USER, sessionId: "44444444-4444-4444-8444-444444444444", sessionExerciseId: SE, setNumber: 1, weightKg: 60, rpe: null, isWarmup: false };
  const OTHER = "55555555-5555-4555-8555-555555555555";
  await queueSet({ ...base, id: SET, reps: 8, updatedAt: 100 });
  await queueSet({ ...base, id: OTHER, setNumber: 2, reps: 8, updatedAt: 101 });
  const entered = new Promise<void>((r) => (db.entered = r));
  const draining = drainOutbox(USER, null);
  await entered;
  const edited = { ...base, id: OTHER, setNumber: 2, reps: 10, updatedAt: 200 };
  await queueSet(edited);
  await saveSetNow(edited, USER);
  await removeQueuedSet(OTHER, edited.updatedAt);
  db.release!();
  await draining;
  expect(db.order).toEqual(["logger 5 10", "outbox 1 8"]);
  expect(await getAllQueuedSets()).toHaveLength(0);
});
