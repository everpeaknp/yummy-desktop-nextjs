import { describe, expect, it } from "vitest";

import { shouldUseFinanceMetrics } from "./finance-metric-authority";

describe("finance metric authority", () => {
  it("preserves an authoritative all-zero ledger", () => {
    expect(shouldUseFinanceMetrics(true, [0, 0, 0])).toBe(true);
  });

  it("uses event metrics with activity during transition", () => {
    expect(shouldUseFinanceMetrics(false, [0, 12.5, 0])).toBe(true);
  });

  it("allows a transitional empty event set to fall back", () => {
    expect(shouldUseFinanceMetrics(false, [0, 0, 0])).toBe(false);
    expect(shouldUseFinanceMetrics(true, null)).toBe(false);
  });
});
