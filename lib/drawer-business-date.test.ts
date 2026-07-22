import { describe, expect, it } from "vitest";

import { nextDrawerBusinessDate } from "./drawer-business-date";

describe("nextDrawerBusinessDate", () => {
  it("advances the settled drawer to the next business date", () => {
    expect(nextDrawerBusinessDate("2026-07-20")).toBe("2026-07-21");
  });

  it("handles month boundaries without local timezone drift", () => {
    expect(nextDrawerBusinessDate("2026-07-31")).toBe("2026-08-01");
  });
});
