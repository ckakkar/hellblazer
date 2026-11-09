import { beforeEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/auth", () => ({ getAuthedContext: async () => ({ supabase: fake.client, user: { id: "a" } }) }));
vi.mock("@/lib/settings", () => ({ getToday: async () => "2026-11-09" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/widget-push", () => ({ nudgeWidgets: vi.fn() }));

const { setActiveProgram } = await import("./programs");
const OWN = "40000000-0000-4000-8000-000000000001";
const OTHER = "40000000-0000-4000-8000-000000000002";
let programs: { id: string; user_id: string; is_active: boolean }[];
let readError: unknown;
const rpc = vi.fn();

beforeEach(() => {
  programs = [ { id: OWN, user_id: "a", is_active: true }, { id: OTHER, user_id: "b", is_active: true } ];
  readError = null;
  rpc.mockReset().mockImplementation(async (_name, args) => {
    // The current invoker RPC scopes writes, but an unknown target still
    // deactivates every other program belonging to the caller.
    for (const p of programs) if (p.user_id === "a") p.is_active = p.id === args.p_id && args.p_active;
    return { data: null, error: null };
  });
  fake.client = {
    rpc,
    from() {
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query,
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        maybeSingle: async () => ({
          data: readError ? null : programs.find((p) => p.user_id === "a" && filters.every(([k, v]) => p[k as keyof typeof p] === v)) ?? null,
          error: readError,
        }),
      };
      return query;
    },
  };
});

it("refuses another account's program without deactivating the caller's program", async () => {
  await expect(setActiveProgram({ id: OTHER, active: true })).rejects.toThrow("Program not found");
  expect(programs.map((p) => p.is_active)).toEqual([true, true]);
  expect(rpc).not.toHaveBeenCalled();
});

it("does not deactivate anything after a failed ownership read", async () => {
  readError = { code: "57014", message: "timeout" };
  await expect(setActiveProgram({ id: OWN, active: true })).rejects.toMatchObject({ code: "57014" });
  expect(programs[0].is_active).toBe(true);
  expect(rpc).not.toHaveBeenCalled();
});

it("still allows changing the signed-in lifter's own program", async () => {
  await setActiveProgram({ id: OWN, active: false });
  expect(programs.map((p) => p.is_active)).toEqual([false, true]);
  expect(rpc).toHaveBeenCalledWith("set_active_program", { p_id: OWN, p_active: false, p_today: "2026-11-09" });
});
