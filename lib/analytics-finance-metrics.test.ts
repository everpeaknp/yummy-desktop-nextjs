import { describe, expect, it } from "vitest";

import {
  analyticsMetricValue,
  mapAnalyticsFinanceMetrics,
} from "./analytics-finance-metrics";

describe("analytics finance metric mapping", () => {
  it("preserves a canonical zero instead of replacing it with a fallback", () => {
    const mapped = mapAnalyticsFinanceMetrics({
      financeMetrics: [
        { key: "operating_profit", value: 0 },
        { key: "expense_spend", value: 0 },
        { key: "discount_total", value: 0 },
      ],
      overviewMetrics: [],
      fallbackIncome: 100,
      fallbackProfit: 100,
      fallbackExpense: 50,
      fallbackDiscount: 25,
    });

    expect(mapped.netProfit).toBe(0);
    expect(mapped.expenseSpend).toBe(0);
    expect(mapped.discountTotal).toBe(0);
  });

  it("prefers the correctly named operating result over the legacy alias", () => {
    const mapped = mapAnalyticsFinanceMetrics({
      financeMetrics: [
        { key: "operating_profit", value: 125 },
        { key: "net_profit", value: 999 },
      ],
      overviewMetrics: [],
      fallbackIncome: 0,
      fallbackProfit: 0,
      fallbackExpense: 0,
      fallbackDiscount: 0,
    });

    expect(mapped.netProfit).toBe(125);
  });

  it("keeps backend precision and does not add or round station values", () => {
    const precise = 107459.6251;
    expect(
      analyticsMetricValue(
        [{ key: "net_sales", value: precise }],
        ["net_sales"],
      ),
    ).toBe(precise);
  });

  it("reports ledger flags without treating a missing flag as false", () => {
    const missing = mapAnalyticsFinanceMetrics({
      financeMetrics: [],
      overviewMetrics: [],
      fallbackIncome: 0,
      fallbackProfit: 0,
      fallbackExpense: 0,
      fallbackDiscount: 0,
    });
    const transitional = mapAnalyticsFinanceMetrics({
      financeMetrics: [{ key: "ledger_complete", value: 0 }],
      overviewMetrics: [],
      fallbackIncome: 0,
      fallbackProfit: 0,
      fallbackExpense: 0,
      fallbackDiscount: 0,
    });

    expect(missing.ledgerComplete).toBeUndefined();
    expect(transitional.ledgerComplete).toBe(false);
  });
});
