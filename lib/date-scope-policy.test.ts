import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { validateHistoryDateRange } from "./date-scope-policy";

describe("subscription history scope", () => {
  const range = { from: subDays(new Date(), 60), to: new Date() };

  it("uses the backend history-days entitlement when provided", () => {
    const result = validateHistoryDateRange(range, {
      role: "admin",
      effectivePlan: "pro",
      historyDays: 30,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.kind).toBe("plan_date_limit");
      expect(result.maxDays).toBe(30);
    }
  });

  it("treats a null history-days entitlement as unlimited", () => {
    expect(validateHistoryDateRange(range, {
      role: "admin",
      effectivePlan: "free",
      historyDays: null,
    })).toEqual({ allowed: true });
  });
});
