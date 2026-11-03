import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { input: unknown; init?: RequestInit }[] = [];
let outcomes: (() => Promise<Response>)[] = [];

const fakeFetch = (input: unknown, init?: RequestInit) => {
  calls.push({ input, init });
  const next = outcomes.shift();
  return next ? next() : Promise.resolve(new Response("ok"));
};

const window = { fetch: fakeFetch } as unknown as Window & typeof globalThis;
vi.stubGlobal("window", window);
vi.stubGlobal("navigator", { onLine: true });

const { resendDroppedActions } = await import("./action-retry");
resendDroppedActions();

const action: RequestInit = { method: "POST", headers: { "next-action": "abc123" }, body: '["x"]' };
const dropped = () => Promise.reject(new TypeError("Load failed"));

beforeEach(() => {
  calls.length = 0;
  outcomes = [];
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("resendDroppedActions", () => {
  it("sends a server action again when it died at once", async () => {
    outcomes = [dropped];
    const res = await window.fetch("/log", action);
    expect(await res.text()).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("only once", async () => {
    outcomes = [dropped, dropped];
    await expect(window.fetch("/log", action)).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(2);
  });

  it("leaves everything that isn't a server action alone", async () => {
    outcomes = [dropped];
    await expect(window.fetch("/api/report", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(1);
  });

  it("doesn't send one again that hung before failing, or offline", async () => {
    vi.useFakeTimers();
    outcomes = [() => new Promise((_, reject) => setTimeout(() => reject(new TypeError("Load failed")), 10_000))];
    const slow = window.fetch("/log", action);
    const caught = expect(slow).rejects.toBeInstanceOf(TypeError);
    await vi.advanceTimersByTimeAsync(10_000);
    await caught;
    expect(calls).toHaveLength(1);

    vi.useRealTimers();
    vi.stubGlobal("navigator", { onLine: false });
    outcomes = [dropped];
    await expect(window.fetch("/log", action)).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(2);
  });

  it("doesn't send one again that the page cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    outcomes = [dropped];
    await expect(window.fetch("/log", { ...action, signal: controller.signal })).rejects.toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(1);
  });
});
