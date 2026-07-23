import { describe, expect, it } from "vitest";
import { RefreshRequestQueue } from "./refresh-request-queue";

describe("RefreshRequestQueue", () => {
  it("resolves every request waiting for a refreshed token", async () => {
    const queue = new RefreshRequestQueue<string>();
    const first = queue.wait();
    const second = queue.wait();

    queue.resolve("new-token");

    await expect(first).resolves.toBe("new-token");
    await expect(second).resolves.toBe("new-token");
    expect(queue.size).toBe(0);
  });

  it("rejects every waiter when token refresh fails", async () => {
    const queue = new RefreshRequestQueue<string>();
    const first = queue.wait();
    const second = queue.wait();
    const error = new Error("refresh failed");

    queue.reject(error);

    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(queue.size).toBe(0);
  });
});
