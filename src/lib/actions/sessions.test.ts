import { beforeEach, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const fake = vi.hoisted(() => ({ client: null as unknown, live: null as { id: string; stale: boolean } | null }));
vi.mock("@/lib/auth", () => ({ getAuthedContext: async () => ({ supabase: fake.client, user: { id: "a" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/widget-push", () => ({ widgetDevices: async () => [], refreshWidgets: vi.fn() }));
vi.mock("@/lib/data/sessions", () => ({ getActiveSession: async () => fake.live }));

const { finishSession, startSession, repeatSession } = await import("./sessions");
const ID = "20000000-0000-4000-8000-000000000001";
let session: { id: string; created_at: string; finished_at: string | null; duration_min: number | null };

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
  fake.live = null;
  session = { id: ID, created_at: new Date(Date.now() - 3600_000).toISOString(), finished_at: null, duration_min: null };
  fake.client = {
    rpc: async () => ({ data: ID, error: null }),
    from() {
      let patch: Partial<typeof session> | undefined;
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query,
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        is(key: string, value: unknown) { filters.push([key, value]); return query; },
        update(row: Partial<typeof session>) { patch = row; return query; },
        single: async () => filters.every(([k, v]) => session[k as keyof typeof session] === v)
          ? { data: { ...session }, error: null }
          : { data: null, error: { code: "PGRST116", message: "No row visible to this account" } },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          if (patch && filters.every(([k, v]) => session[k as keyof typeof session] === v)) Object.assign(session, patch);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
});

it("two simultaneous finishes keep the first recorded finish and duration", async () => {
  const first = Date.now() - 20 * 60_000;
  await Promise.all([
    finishSession({ sessionId: ID, finishedAt: first, durationMin: 40, navigate: false }),
    finishSession({ sessionId: ID, finishedAt: first + 5 * 60_000, durationMin: 45, navigate: false }),
  ]);
  expect(session).toMatchObject({ finished_at: new Date(first).toISOString(), duration_min: 40 });
});

it("saving a workout opened for editing can change duration without moving its finish", async () => {
  const first = new Date(Date.now() - 10 * 60_000).toISOString();
  session.finished_at = first;
  await finishSession({ sessionId: ID, durationMin: 30, navigate: false });
  expect(session).toMatchObject({ finished_at: first, duration_min: 30 });
});

it("cannot finish a session hidden by the signed-in client's ownership policy", async () => {
  await expect(finishSession({ sessionId: "20000000-0000-4000-8000-000000000002", navigate: false }))
    .rejects.toMatchObject({ code: "PGRST116" });
  expect(session.finished_at).toBeNull();
});

it.each(["start", "repeat"] as const)("refreshes the app layout before redirecting a new %s", async (kind) => {
  const work = kind === "start" ? startSession({ localDate: "2026-11-09" }) : repeatSession({ sessionId: ID, localDate: "2026-11-09" });
  await expect(work).rejects.toThrow(`redirect:/log/${ID}`);
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  expect(vi.mocked(revalidatePath).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(redirect).mock.invocationCallOrder[0]);
});

it.each(["start", "repeat"] as const)("refreshes the app layout before an existing workout wins a %s", async (kind) => {
  fake.live = { id: ID, stale: false };
  const work = kind === "start" ? startSession({}) : repeatSession({ sessionId: ID });
  await expect(work).rejects.toThrow(`redirect:/log/${ID}`);
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  expect(vi.mocked(revalidatePath).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(redirect).mock.invocationCallOrder[0]);
});
