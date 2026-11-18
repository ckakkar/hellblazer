import { beforeEach, expect, it, vi } from "vitest";

// From QA (R3-03, R3-04): an action whose read or delete failed must fail,
// so useAction says what didn't happen, never report it done.

const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/auth", () => ({ getAuthedContext: async () => ({ supabase: fake.client, user: { id: "owner" } }) }));
vi.mock("@/lib/settings", () => ({ getToday: async () => "2026-11-18", getTimeZone: async () => "Asia/Kolkata" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/widget-push", () => ({ nudgeWidgets: vi.fn(), widgetDevices: async () => [], refreshWidgets: vi.fn() }));
vi.mock("@/lib/data/sessions", () => ({ getActiveSession: async () => null }));

const { pauseProgram, resumeProgram } = await import("./programs");
const { clearHistory } = await import("./sessions");

const ID = "40000000-0000-4000-8000-000000000001";
const failure = { code: "57014", message: "statement timeout" };

beforeEach(() => {
  // Every read fails; of the deletes, only program_skip's does.
  fake.client = {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        delete: () => q,
        maybeSingle: async () => ({ data: null, error: failure }),
        then: (ok: (x: unknown) => unknown) =>
          Promise.resolve({ data: null, error: table === "program_skip" ? failure : null }).then(ok),
      };
      return q;
    },
  };
});

it("doesn't report a pause after its read of the program failed", async () => {
  await expect(pauseProgram({ id: ID })).rejects.toMatchObject(failure);
});

it("doesn't report a resume after its read of the program failed", async () => {
  await expect(resumeProgram({ id: ID })).rejects.toMatchObject(failure);
});

it("doesn't report the history wiped when the program's skips weren't", async () => {
  await expect(clearHistory()).rejects.toMatchObject(failure);
});
