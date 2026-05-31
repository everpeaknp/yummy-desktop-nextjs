/** Maps unified GET /analytics/dashboard payloads to chart/UI shapes. */

export type BreakdownTab = "source" | "payment" | "category";

export type TrendPoint = { date: string; value: number };

export type PieSlice = { name: string; value: number };

export function preferHourlyTrends(activeRange: string): boolean {
  return activeRange === "today" || activeRange === "yesterday";
}

export function mapAnalyticsTrends(
  payload: {
    trends?: Array<{ date: string; income?: number }>;
    trends_chart?: { hourly?: { labels?: string[]; revenue?: number[] } };
  } | null | undefined,
  useHourly: boolean
): TrendPoint[] {
  if (!payload) return [];

  const hourly = payload.trends_chart?.hourly;
  if (
    useHourly &&
    hourly?.labels?.length &&
    hourly?.revenue?.length
  ) {
    return hourly.labels.map((label, i) => ({
      date: label,
      value: hourly.revenue?.[i] ?? 0,
    }));
  }

  if (Array.isArray(payload.trends) && payload.trends.length > 0) {
    return payload.trends.map((item) => ({
      date: String(item.date),
      value: item.income ?? 0,
    }));
  }

  return [];
}

export function mapBreakdownToPie(
  breakdown: Record<string, unknown> | undefined,
  type: BreakdownTab
): PieSlice[] {
  if (!breakdown) return [];

  let list: Array<{ label?: string; amount?: number }> = [];
  if (type === "category") {
    list =
      (breakdown.income_by_menu_category as typeof list) ||
      (breakdown.income_by_category as typeof list) ||
      [];
  } else if (type === "source") {
    list = (breakdown.income_by_source as typeof list) || [];
  } else if (type === "payment") {
    list = (breakdown.income_by_payment_method as typeof list) || [];
  }

  return list.map((item) => ({
    name: item.label || "Unknown",
    value: item.amount || 0,
  }));
}

export function breakdownPieCopy(type: BreakdownTab): {
  title: string;
  description: string;
} {
  switch (type) {
    case "payment":
      return {
        title: "Sales by Payment Method",
        description: "Revenue split by payment method in the selected period.",
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
  operations: { order_cancellation_pct?: number } | null | undefined
): string {
  const pct = operations?.order_cancellation_pct;
  if (pct === undefined || pct === null) return "0%";
  return `${Number(pct).toFixed(1)}%`;
}

export function topItemQuantitySold(item: {
  quantity_sold?: number;
  quantity?: number;
}): number {
  return item.quantity_sold ?? item.quantity ?? 0;
}
