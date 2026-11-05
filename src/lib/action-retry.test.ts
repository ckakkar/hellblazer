import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAgainIfDropped } from "./action-retry";

const dropped = () => Promise.reject(new TypeError("Load failed"));

beforeEach(() => {
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sendAgainIfDropped", () => {
  it("sends an action again when it died at once", async () => {
    const action = vi.fn<() => Promise<string>>().mockImplementationOnce(dropped).mockResolvedValueOnce("ok");
    await expect(sendAgainIfDropped(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("only once", async () => {
    const action = vi.fn(dropped);
    await expect(sendAgainIfDropped(action)).rejects.toBeInstanceOf(TypeError);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("leaves an answer from the server alone: a redirect, or an error it threw", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/log/1;303;" });
    const action = vi.fn(() => Promise.reject(redirect));
    await expect(sendAgainIfDropped(action)).rejects.toBe(redirect);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("doesn't send one again that hung before failing, or offline", async () => {
    vi.useFakeTimers();
    const slow = vi.fn(() => new Promise<never>((_, reject) => setTimeout(() => reject(new TypeError("Load failed")), 10_000)));
    const caught = expect(sendAgainIfDropped(slow)).rejects.toBeInstanceOf(TypeError);
    await vi.advanceTimersByTimeAsync(10_000);
    await caught;
    expect(slow).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    vi.stubGlobal("navigator", { onLine: false });
    const offline = vi.fn(dropped);
    await expect(sendAgainIfDropped(offline)).rejects.toBeInstanceOf(TypeError);
    expect(offline).toHaveBeenCalledTimes(1);
  });
});
