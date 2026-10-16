import { afterEach, describe, expect, it, vi } from "vitest";

import { getWebSocketReconnectDelay, warnWebSocketUnavailableOnce } from "./websocket-reconnect";

describe("getWebSocketReconnectDelay", () => {
  it("backs off after repeated failures and caps the delay", () => {
    expect([1, 2, 3, 4, 5, 6].map(getWebSocketReconnectDelay)).toEqual([
      5_000,
      10_000,
      20_000,
      40_000,
      60_000,
      60_000,
    ]);
  });

  it("uses the first retry delay for an invalid attempt number", () => {
    expect(getWebSocketReconnectDelay(0)).toBe(5_000);
    expect(getWebSocketReconnectDelay(-1)).toBe(5_000);
  });

  it("logs one safe application warning per channel without exposing a socket URL", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const channel = `test channel ${Date.now()}`;

    warnWebSocketUnavailableOnce(channel);
    warnWebSocketUnavailableOnce(channel);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("retrying with backoff");
    expect(warn.mock.calls[0][0]).not.toContain("token=");
    warn.mockRestore();
  });
});
