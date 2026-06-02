/**
 * Maps `GET /analytics/dashboard` payloads (`data.meta` + `data.tabs`) to UI-ready shapes.
 * Legacy root fields (`overview`, `kpis`, `breakdown`, etc.) are not read.
 */

import type {
  AnalyticsChartSeriesSection,
  AnalyticsDashboardResponse,
  AnalyticsDashboardViewModel,
  AnalyticsInsightItem,
  AnalyticsMenuItemRow,
  AnalyticsPaymentMixSection,
  HourlyChartData,
  PaymentInstrumentRow,
  PaymentMixView,
  PeriodComparisonView,
  PeriodSnapshotMetrics,
} from "@/types/analytics";

export type BreakdownTab = "source" | "payment" | "category";

export type TrendPoint = { date: string; value: number };

export type PieSlice = { name: string; value: number };

export type {
  AnalyticsDashboardResponse,
  AnalyticsDashboardViewModel,
} from "@/types/analytics";

export function preferHourlyTrends(activeRange: string): boolean {
  return activeRange === "today" || activeRange === "yesterday";
}

export function parseAnalyticsDashboardResponse(
  raw: unknown
): AnalyticsDashboardResponse {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }

  const tabsRecord = asRecord(record.tabs);
  return {
    meta: parseMeta(record.meta),
    tabs: tabsRecord
      ? {
          overview: asRecord(tabsRecord.overview) ?? undefined,
          finance: asRecord(tabsRecord.finance) ?? undefined,
          orders: asRecord(tabsRecord.orders) ?? undefined,
          menu: asRecord(tabsRecord.menu) ?? undefined,
          staff: asRecord(tabsRecord.staff) ?? undefined,
        }
      : undefined,
  };
}

/** Primary entry: parse tabs-only contract and derive a frontend view model. */
export function mapAnalyticsDashboard(raw: unknown): AnalyticsDashboardViewModel {
  const parsed = parseAnalyticsDashboardResponse(raw);
  const overview = parsed.tabs?.overview ?? {};
  const finance = parsed.tabs?.finance ?? {};
  const orders = parsed.tabs?.orders ?? {};
  const menu = parsed.tabs?.menu ?? {};
  const staff = parsed.tabs?.staff ?? {};

  const executiveSummary = overview.executive_summary ?? {};
  const outcomeSummary = orders.outcome_summary ?? {};
  const overviewMetrics = metricMap(executiveSummary);
  const outcomeMetrics = metricMap(outcomeSummary);

  const overviewSales = metricValue(overviewMetrics, ["sales", "income"]);
  const overviewIncome = metricValue(overviewMetrics, ["income", "sales"]);
  const overviewExpense = metricValue(overviewMetrics, ["expense"]);
  const overviewProfit = metricValue(overviewMetrics, ["net_profit", "profit"]);
  const overviewOrders = Math.round(metricValue(overviewMetrics, ["orders"]));
  const overviewAvgOrder =
    overviewOrders > 0 ? overviewSales / overviewOrders : 0;
  const overviewProfitMargin =
    overviewSales > 0 ? (overviewProfit / overviewSales) * 100 : 0;

  const periodSnapshot: PeriodSnapshotMetrics = {
    totalIncome: overviewIncome,
    totalExpense: overviewExpense,
    netProfit: overviewProfit,
    grossSales: overviewSales,
    profitMargin: overviewProfitMargin,
    totalOrders: overviewOrders,
    avgOrderValue: overviewAvgOrder,
  };

  const comparison: PeriodComparisonView = {
    current: {
      income: overviewIncome,
      expense: overviewExpense,
      profit: overviewProfit,
    },
    deltas: {
      incomePct: metricDeltaPct(overviewMetrics, ["income", "sales"]),
      expensePct: metricDeltaPct(overviewMetrics, ["expense"]),
      profitPct: metricDeltaPct(overviewMetrics, ["net_profit", "profit"]),
      salesPct: metricDeltaPct(overviewMetrics, ["sales", "income"]),
      ordersPct: metricDeltaPct(overviewMetrics, ["orders"]),
    },
  };

  const todaySnapshot = overview.today_snapshot ?? {};
  const receivablesSection = finance.receivables ?? {};
  const tableUtilization = overview.table_utilization ?? {};
  const paymentMixSection = overview.payment_mix ?? {};
  const paymentSettlementSection = finance.payment_settlement_mix ?? {};
  const sourceMix = orders.source_mix ?? {};
  const expenseByCategory = finance.expense_by_category ?? {};
  const expenseByVendor = finance.expense_by_vendor ?? {};
  const menuTopItems = menu.top_items ?? {};
  const ordersTopItems = orders.top_selling_items ?? {};
  const alertInsights = overview.alert_insights ?? {};

  const paymentMix = mapPaymentMixSection(paymentMixSection);
  const paymentSettlementMix = mapPaymentMixSection(paymentSettlementSection);

  const incomeVsExpense = finance.income_vs_expense ?? {};
  const overviewRevenueTrends = overview.revenue_trends ?? {};
  const cashflowTimeline = finance.cashflow_timeline ?? {};
  const healthTrends = overview.health_trends ?? {};

  const revenueSection = pickRevenueChartSection(
    incomeVsExpense,
    overviewRevenueTrends
  );
  const chartSection = hasChartLabels(cashflowTimeline)
    ? cashflowTimeline
    : revenueSection;

  const revenueTrendPoints = chartSeriesToTrendPoints(chartSection);
  const hourlyChart = buildHourlyChart(revenueSection);

  const sourceRows = mapSourceBreakdown(sourceMix);
  const categoryRows = mapCategoryBreakdown(menu.category_performance);
  const expenseCategoryRows = mapLabelAmountItems(expenseByCategory.items);
  const expenseVendorRows = mapLabelAmountItems(expenseByVendor.items, "supplier");

  const topMenuItems = mapMenuItems(
    menuTopItems.items?.length ? menuTopItems.items : ordersTopItems.items
  );

  return {
    meta: parsed.meta ?? {},
    tabs: {
      overview,
      finance,
      orders,
      menu,
      staff,
    },
    todaySnapshot: {
      income: num(todaySnapshot.income),
      expense: num(todaySnapshot.expense),
    },
    periodSnapshot,
    comparison,
    receivables: {
      creditSales: num(receivablesSection.credit_sales),
      totalOutstanding: num(receivablesSection.total_outstanding),
      creditOrdersCount: Math.round(num(receivablesSection.credit_orders_count)),
    },
    operations: {
      peakHour:
        metricString(outcomeMetrics, ["peak_hour"]) ??
        tableUtilization.peak_hour ??
        null,
      avgServiceTimeMin: metricValue(outcomeMetrics, ["avg_service_time_min"]),
      orderCancellationPct: metricValue(outcomeMetrics, [
        "order_cancellation_pct",
        "cancellation_pct",
        "cancellation_rate",
      ]),
    },
    insights: mapInsights(alertInsights.items),
    paymentMix,
    paymentSettlementMix,
    revenueTrendPoints,
    hourlyChart,
    breakdown: {
      source: sourceRows,
      payment: paymentMix.expandedPieSlices,
      category: categoryRows.length > 0 ? categoryRows : mapMenuCategoryFallback(menu),
      expenseCategory: expenseCategoryRows,
      expenseVendor: expenseVendorRows,
    },
    topMenuItems,
    performanceTrends: healthTrends,
    revenueTrends: revenueSection,
  };
}

export function mapRevenueTrendPoints(
  viewModel: AnalyticsDashboardViewModel,
  useHourly: boolean
): TrendPoint[] {
  if (useHourly && viewModel.hourlyChart) {
    return viewModel.hourlyChart.labels.map((label, i) => ({
      date: label,
      value: viewModel.hourlyChart!.revenue[i] ?? 0,
    }));
  }
  return viewModel.revenueTrendPoints;
}

export function getBreakdownPieSlices(
  viewModel: AnalyticsDashboardViewModel,
  type: BreakdownTab
): PieSlice[] {
  switch (type) {
    case "payment":
      return viewModel.breakdown.payment;
    case "category":
      return viewModel.breakdown.category;
    default:
      return viewModel.breakdown.source;
  }
}

/** Maps payment mix / settlement mix with hierarchical instrument breakdown. */
export function mapPaymentMixSection(
  section: AnalyticsPaymentMixSection | null | undefined
): PaymentMixView {
  if (!section?.available) {
    return { available: false, methods: [], expandedPieSlices: [] };
  }

  const methodRows = (section.items ?? []).map((item) => ({
    method: String(item.label ?? item.method ?? "Unknown").trim(),
    amount: num(item.amount),
  }));

  const instrumentRows = parsePaymentInstruments(
    firstNonEmptyArray([
      section.income_by_payment_instrument,
      section.by_payment_instrument,
    ])
  );

  const grouped = groupInstrumentsByMethod(instrumentRows);
  const methods = buildPaymentMethodGroups(methodRows, grouped);
  const expandedPieSlices = expandPaymentMethodsForPie(methodRows, grouped);

  return {
    available: true,
    methods,
    expandedPieSlices,
  };
}

export function breakdownPieCopy(type: BreakdownTab): {
  title: string;
  description: string;
} {
  switch (type) {
    case "payment":
      return {
        title: "Sales by Payment Method",
        description:
          "Revenue split by payment methods, with card/digital expanded by instrument.",
      };
    case "category":
      return {
        title: "Sales by Menu Category",
        description: "Revenue grouped by menu item category.",
      };
    default:
      return {
        title: "Sales by Channel",
        description: "Revenue split by order channel (dine-in, takeaway, etc.).",
      };
  }
}

export function formatCancellationRate(
  operations: { orderCancellationPct?: number } | null | undefined
): string {
  const pct = operations?.orderCancellationPct;
  if (pct === undefined || pct === null) return "0%";
  return `${Number(pct).toFixed(1)}%`;
}

export function topItemQuantitySold(item: {
  quantity_sold?: number;
  quantity?: number;
}): number {
  return item.quantity_sold ?? item.quantity ?? 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseMeta(raw: unknown): AnalyticsDashboardViewModel["meta"] {
  const record = asRecord(raw);
  if (!record) return {};
  const dateRange = asRecord(record.date_range);
  return {
    restaurant_id:
      typeof record.restaurant_id === "number"
        ? record.restaurant_id
        : undefined,
    timezone:
      typeof record.timezone === "string" ? record.timezone : undefined,
    generated_at:
      typeof record.generated_at === "string" ? record.generated_at : undefined,
    currency: typeof record.currency === "string" ? record.currency : undefined,
    outlet_name:
      typeof record.outlet_name === "string" ? record.outlet_name : undefined,
    date_range: dateRange
      ? {
          from: typeof dateRange.from === "string" ? dateRange.from : undefined,
          to: typeof dateRange.to === "string" ? dateRange.to : undefined,
        }
      : undefined,
  };
}

function metricMap(section: { metrics?: unknown }): Record<string, Record<string, unknown>> {
  const metrics: Record<string, Record<string, unknown>> = {};
  if (!Array.isArray(section.metrics)) return metrics;
  for (const item of section.metrics) {
    const row = asRecord(item);
    if (!row) continue;
    const key = String(row.key ?? "").trim();
    if (!key) continue;
    metrics[key] = row;
  }
  return metrics;
}

function metricValue(
  metrics: Record<string, Record<string, unknown>>,
  keys: string[]
): number {
  for (const key of keys) {
    const row = metrics[key];
    if (!row) continue;
    return num(row.value);
  }
  return 0;
}

function metricString(
  metrics: Record<string, Record<string, unknown>>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const row = metrics[key];
    if (!row) continue;
    const value = row.value ?? row.label;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metricDeltaPct(
  metrics: Record<string, Record<string, unknown>>,
  keys: string[]
): number {
  for (const key of keys) {
    const row = metrics[key];
    if (!row) continue;
    const delta = asRecord(row.delta);
    if (!delta) continue;
    const value = delta.vs_previous_period_pct;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function hasChartLabels(section: AnalyticsChartSeriesSection): boolean {
  return (section.labels?.length ?? 0) > 0;
}

function pickRevenueChartSection(
  incomeVsExpense: AnalyticsChartSeriesSection,
  overviewRevenueTrends: AnalyticsChartSeriesSection
): AnalyticsChartSeriesSection {
  const incomeLabels = incomeVsExpense.labels?.length ?? 0;
  const overviewLabels = overviewRevenueTrends.labels?.length ?? 0;
  if (incomeLabels >= overviewLabels && incomeLabels > 0) {
    return incomeVsExpense;
  }
  return overviewRevenueTrends;
}

function chartSeriesToTrendPoints(
  section: AnalyticsChartSeriesSection
): TrendPoint[] {
  const labels = section.labels ?? [];
  const revenue = section.revenue ?? [];
  if (!labels.length) return [];
  return labels.map((label, i) => ({
    date: String(label),
    value: revenue[i] ?? 0,
  }));
}

function isHourlyLabels(labels: string[]): boolean {
  return labels.length > 0 && labels.every((label) => /^\d{1,2}:\d{2}/.test(label));
}

function buildHourlyChart(
  section: AnalyticsChartSeriesSection
): HourlyChartData | null {
  const labels = section.labels ?? [];
  if (!section.available || !labels.length || !isHourlyLabels(labels)) {
    return null;
  }
  return {
    labels,
    revenue: section.revenue ?? [],
    orders: section.orders ?? [],
  };
}

function mapSourceBreakdown(
  sourceMix: { items?: AnalyticsPaymentMixSection["items"] }
): PieSlice[] {
  return (sourceMix.items ?? []).map((item) => ({
    name: String(item?.channel ?? item?.label ?? "Unknown"),
    value: num(item?.amount),
  }));
}

function mapCategoryBreakdown(
  section: { items?: Array<{ label?: string; category?: string; amount?: number }> } | undefined
): PieSlice[] {
  return (section?.items ?? []).map((item) => ({
    name: String(item.category ?? item.label ?? "Unknown"),
    value: num(item.amount),
  }));
}

function mapLabelAmountItems(
  items: Array<{ label?: string; category?: string; supplier?: string; amount?: number }> | undefined,
  labelKey: "label" | "category" | "supplier" = "label"
): PieSlice[] {
  return (items ?? []).map((item) => ({
    name: String(item[labelKey] ?? item.label ?? item.category ?? "Unknown"),
    value: num(item.amount),
  }));
}

function mapMenuCategoryFallback(menu: {
  category_performance?: { items?: Array<{ label?: string; amount?: number }> };
}): PieSlice[] {
  return mapCategoryBreakdown(menu.category_performance);
}

function mapMenuItems(items: AnalyticsMenuItemRow[] | undefined): AnalyticsMenuItemRow[] {
  return items ?? [];
}

function mapInsights(items: AnalyticsInsightItem[] | undefined): AnalyticsInsightItem[] {
  return items ?? [];
}

function firstNonEmptyArray<T>(candidates: Array<T[] | undefined>): T[] {
  for (const candidate of candidates) {
    if (candidate && candidate.length > 0) return candidate;
  }
  return [];
}

function normalizePaymentMethod(method: string): string {
  return method.trim().toLowerCase();
}

function parsePaymentInstruments(
  items: Array<{ label?: string; amount?: number; method?: string; instrument?: string }>
): PaymentInstrumentRow[] {
  return items.map((json) => {
    let method = String(json.method ?? "").trim();
    let instrument = String(json.instrument ?? "").trim();

    if (!method || !instrument) {
      const label = String(json.label ?? "").trim();
      if (label) {
        const normalized = label.replace(/[•·]/g, "|").replace(/-/g, "|");
        const parts = normalized
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length > 0) {
          method = method || parts[0];
          if (!instrument && parts.length > 1) {
            instrument = parts.slice(1).join(" • ");
          }
        }
      }
    }

    return {
      method,
      instrument,
      amount: num(json.amount),
    };
  });
}

function groupInstrumentsByMethod(
  instruments: PaymentInstrumentRow[]
): Record<string, PaymentInstrumentRow[]> {
  const grouped: Record<string, PaymentInstrumentRow[]> = {};
  for (const row of instruments) {
    const methodKey = normalizePaymentMethod(row.method);
    if (methodKey !== "card" && methodKey !== "digital") continue;
    grouped[methodKey] ??= [];
    grouped[methodKey].push(row);
  }
  return grouped;
}

function buildPaymentMethodGroups(
  methodRows: Array<{ method: string; amount: number }>,
  grouped: Record<string, PaymentInstrumentRow[]>
): PaymentMixView["methods"] {
  return methodRows.map((row) => {
    const methodKey = normalizePaymentMethod(row.method);
    const instrumentRows = grouped[methodKey] ?? [];
    const instruments =
      methodKey === "card" || methodKey === "digital"
        ? instrumentRows
            .slice()
            .sort((a, b) => b.amount - a.amount)
            .map((inst) => ({
              name: inst.instrument.trim() || "Unspecified",
              amount: inst.amount,
            }))
        : [];

    return {
      method: row.method,
      amount: row.amount,
      instruments,
    };
  });
}

function expandPaymentMethodsForPie(
  methodRows: Array<{ method: string; amount: number }>,
  grouped: Record<string, PaymentInstrumentRow[]>
): PieSlice[] {
  if (!Object.keys(grouped).length) {
    return methodRows.map((row) => ({ name: row.method, value: row.amount }));
  }

  const hasCard = (grouped.card?.length ?? 0) > 0;
  const hasDigital = (grouped.digital?.length ?? 0) > 0;
  const expanded: PieSlice[] = [];

  for (const method of methodRows) {
    const methodKey = normalizePaymentMethod(method.method);
    const replaceWithInstruments =
      (methodKey === "card" && hasCard) || (methodKey === "digital" && hasDigital);
    if (!replaceWithInstruments) {
      expanded.push({ name: method.method, value: method.amount });
    }
  }

  const appendInstrumentRows = (methodKey: string, methodLabel: string) => {
    const rows = grouped[methodKey];
    if (!rows?.length) return;
    for (const row of rows.slice().sort((a, b) => b.amount - a.amount)) {
      const instrumentName = row.instrument.trim();
      const label = instrumentName
        ? `${methodLabel} • ${instrumentName}`
        : `${methodLabel} • Unspecified`;
      expanded.push({ name: label, value: row.amount });
    }
  };

  appendInstrumentRows("card", "Card");
  appendInstrumentRows("digital", "Digital");

  if (expanded.length === 0) {
    return methodRows.map((row) => ({ name: row.method, value: row.amount }));
  }

  return expanded;
}
