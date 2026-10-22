import { describe, expect, it } from "vitest";

import {
  getAccountingDayCloseUrl,
  getAccountingReviewUrlForDayClose,
  getAnalyticsUrlForDayClose,
} from "./day-close-navigation";

describe("day close navigation", () => {
  const close = {
    id: 27,
    business_date: "2026-09-26",
    business_line: "restaurant",
  };

  it("deep-links Analytics to the existing exact close-session filter", () => {
    expect(getAnalyticsUrlForDayClose(close)).toBe(
      "/analytics?business_line=restaurant&day_close_id=27",
    );
  });

  it("deep-links an authorized user to the close-specific finance review", () => {
    expect(getAccountingReviewUrlForDayClose(close)).toBe(
      "/day-close/finance-review?business_line=restaurant&business_date=2026-09-26&day_close_id=27",
    );
  });

  it("keeps the canonical accounting close destination centralized", () => {
    expect(getAccountingDayCloseUrl({ id: 27 })).toBe(
      "/finance/accounting/day-closes?day_close_id=27",
    );
  });
});
