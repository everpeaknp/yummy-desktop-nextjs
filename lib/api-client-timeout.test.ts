import { describe, expect, it } from "vitest";
import apiClient, { API_REQUEST_TIMEOUT_MS } from "./api-client";

describe("api client timeout", () => {
  it("bounds requests so startup loaders can recover from stalled calls", () => {
    expect(API_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(apiClient.defaults.timeout).toBe(API_REQUEST_TIMEOUT_MS);
  });
});
