export type AnalyticsMetricRow = {
  key?: string;
  value?: unknown;
  delta?: {
    vs_previous_period_pct?: unknown;
  };
};

export function analyticsMetricValue(
  rows: AnalyticsMetricRow[] | null | undefined,
  keys: string[],
): number | undefined {
  if (!Array.isArray(rows)) return undefined;

  for (const key of keys) {
    const row = rows.find((candidate) => candidate?.key === key);
    if (!row) continue;

    const value =
      typeof row.value === "number"
        ? row.value
        : typeof row.value === "string" && row.value.trim()
          ? Number(row.value)
          : Number.NaN;
    if (Number.isFinite(value)) return value;
  }

  return undefined;
}

export function analyticsMetricDelta(
  rows: AnalyticsMetricRow[] | null | undefined,
  keys: string[],
): number {
  if (!Array.isArray(rows)) return 0;

  for (const key of keys) {
    const row = rows.find((candidate) => candidate?.key === key);
    if (!row) continue;
    const value = Number(row.delta?.vs_previous_period_pct);
    return Number.isFinite(value) ? value : 0;
  }

  return 0;
}

export function mapAnalyticsFinanceMetrics({
  financeMetrics,
  overviewMetrics,
  fallbackIncome,
  fallbackProfit,
  fallbackExpense,
  fallbackDiscount,
}: {
  financeMetrics: AnalyticsMetricRow[] | null | undefined;
  overviewMetrics: AnalyticsMetricRow[] | null | undefined;
  fallbackIncome: number;
  fallbackProfit: number;
  fallbackExpense: number;
  fallbackDiscount: number;
}) {
  const value = (keys: string[]) => analyticsMetricValue(financeMetrics, keys);

  const ledgerCompleteValue = value(["ledger_complete"]);
  const financeAccountingEnabledValue = value(["finance_accounting_enabled"]);
  const accountingV2EnabledValue = value(["accounting_v2_enabled"]);

  return {
    grossIncome: value(["gross_income", "income", "sales"]) ?? fallbackIncome,
    // The finance ledger currently calculates operating result, before any
    // non-operating, interest, or tax layer. Prefer its canonical name while
    // retaining legacy aliases during the API transition.
    netProfit:
      value(["operating_profit", "net_profit", "profit"]) ?? fallbackProfit,
    totalExpense: value(["expenses", "expense"]) ?? fallbackExpense,
    expenseSpend: value(["expense_spend"]) ?? fallbackExpense,
    discount:
      value(["discount", "discounts", "total_discount"]) ?? fallbackDiscount,
    netSales:
      value(["net_sales"]) ??
      analyticsMetricValue(overviewMetrics, ["net_sales"]),
    collectionsTotal: value(["collections_total"]),
    creditSales: value(["credit_sales"]),
    refundTotal: value(["refund_total", "refunds"]),
    refundLiabilities: value(["refund_liabilities"]),
    discountTotal: value([
      "discount_total",
      "discount",
      "discounts",
      "total_discount",
    ]),
    manualIncomeTotal: value(["manual_income_total"]) ?? 0,
    manualOperatingExpense: value(["manual_operating_expense"]) ?? 0,
    inventoryDirectExpense: value(["inventory_direct_expense"]) ?? 0,
    inventoryCashOutflow: value(["inventory_cash_outflow"]) ?? 0,
    inventoryCogs: value(["inventory_cogs"]) ?? 0,
    inventoryWastage: value(["inventory_wastage"]) ?? 0,
    inventoryVariance: value(["inventory_variance"]) ?? 0,
    cashExpected: value(["cash_expected"]),
    currentPeriodSalesCollected: value(["current_period_sales_collected"]),
    priorPeriodPaymentsApplied: value(["prior_period_payments_applied"]),
    postPeriodPaymentsApplied: value(["post_period_payments_applied"]),
    collectionsForOtherPeriodSales: value([
      "collections_for_other_period_sales",
    ]),
    uncollectedSalesBalance: value(["uncollected_sales_balance"]),
    salesCollectionGap: value(["sales_collection_gap"]),
    paidOpenOrdersCount: value(["paid_open_orders_count"]),
    paidOpenOrdersAmount: value(["paid_open_orders_amount"]),
    ledgerComplete:
      ledgerCompleteValue == null ? undefined : ledgerCompleteValue > 0,
    financeAccountingEnabled:
      financeAccountingEnabledValue == null
        ? undefined
        : financeAccountingEnabledValue > 0,
    accountingV2Enabled:
      accountingV2EnabledValue == null
        ? undefined
        : accountingV2EnabledValue > 0,
  };
}
