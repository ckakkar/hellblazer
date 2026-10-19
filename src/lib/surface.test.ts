import { describe, expect, it } from "vitest";
import { appearanceLockedAgent, isIPadAppAgent } from "./surface";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ipad = "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

describe("isIPadAppAgent", () => {
  it("is the iPad app only", () => {
    expect(isIPadAppAgent(`${ipad} Fatty`)).toBe(true);
    expect(isIPadAppAgent(`${ipad} Fatty Fatty-appearance`)).toBe(true);
    expect(isIPadAppAgent(`${iphone} Fatty`)).toBe(false);
    expect(isIPadAppAgent(ipad)).toBe(false);
  });
});

describe("appearanceLockedAgent", () => {
  it("locks app builds that can't follow light and dark", () => {
    expect(appearanceLockedAgent(`${iphone} Fatty`)).toBe(true);
    expect(appearanceLockedAgent(`${iphone} Fatty Fatty-appearance`)).toBe(false);
  });
  it("never locks the website", () => {
    expect(appearanceLockedAgent(iphone)).toBe(false);
  });
});
