import { describe, expect, it } from "vitest";

import {
  configuredProductCurrency,
  formatMoney,
  formatProductDate,
} from "./presentation-format";

describe("product presentation formatters", () => {
  it("uses the configured currency code for ordinary UI money", () => {
    expect(formatMoney(1234.5)).toBe(`${configuredProductCurrency} 1,234.50`);
  });

  it("formats business dates without shifting date-only values", () => {
    expect(formatProductDate("2026-09-03")).toBe("3 Sep 2026");
  });

  it("separates timestamps with the product middle dot", () => {
    expect(formatProductDate(new Date(2026, 8, 3, 17, 45), "timestamp")).toBe(
      "3 Sep 2026 · 17:45",
    );
  });
});
