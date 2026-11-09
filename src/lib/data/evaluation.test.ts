import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake.client }));
vi.mock("@/lib/settings", () => ({ getToday: async () => "2026-11-09" }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => fake.client }));
vi.mock("@/lib/auth", () => ({ getAuthedContext: async () => ({ user: { id: "lifter-a" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { getEvalGate, getTrainingProfile } = await import("./evaluation");
const { evaluateTier } = await import("@/lib/actions/evaluation");
const timeout = { code: "57014", message: "timeout", details: "", hint: "" };
let failedTable: string | null;
let failedCount: number;
const writes = vi.fn();

beforeEach(() => {
  failedTable = null;
  failedCount = -1;
  writes.mockClear();
  let counts = 0;
  fake.client = {
    rpc: async () => ({ data: [], error: null }),
    from(table: string) {
      let head = false;
      const result = (single = false) => {
        const fail = failedTable === table || (head && counts++ === failedCount);
        const data = single
          ? table === "profile" ? { evaluation_run_at: new Date().toISOString(), tier: null } : null
          : [];
        return { data: fail ? null : data, count: fail ? null : 2, error: fail ? timeout : null };
      };
      const query = {
        select(_columns: string, options?: { head?: boolean }) { head = options?.head ?? false; return query; },
        not: () => query,
        gt: () => query,
        or: () => query,
        order: () => query,
        eq: () => query,
        limit: () => query,
        range: () => query,
        maybeSingle: async () => result(true),
        upsert() { writes(); return query; },
        update() { writes(); return query; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return query;
    },
  };
});
afterEach(() => vi.unstubAllEnvs());

describe("the judge's authoritative reads", () => {
  it("the evaluation action does not claim a run after failing to read its cooldown", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    failedTable = "profile";
    await expect(evaluateTier()).rejects.toMatchObject({ code: "57014" });
    expect(writes).not.toHaveBeenCalled();
  });
  it("does not open the cooldown gate when the profile read fails", async () => {
    failedTable = "profile";
    await expect(getEvalGate()).rejects.toMatchObject({ code: "57014" });
  });

  it.each([0, 1])("does not claim there are no workouts when count %i failed", async (i) => {
    failedCount = i;
    await expect(getEvalGate()).rejects.toMatchObject({ code: "57014" });
  });

  it("keeps a successfully read recent verdict on cooldown", async () => {
    expect(await getEvalGate()).toMatchObject({ canRun: false, reason: "cooldown", totalWorkouts: 2 });
  });

  it.each(["profile", "bodyweight_log", "program"])("does not judge an incomplete snapshot after a failed %s read", async (table) => {
    failedTable = table;
    await expect(getTrainingProfile()).rejects.toMatchObject({ code: "57014" });
  });
});
