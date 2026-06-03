/** Maps unified GET /analytics/dashboard payloads to chart/UI shapes. */

export type BreakdownTab = "source" | "payment" | "category";

export type TrendPoint = { date: string; value: number };

export type PieSlice = { name: string; value: number };

export function preferHourlyTrends(activeRange: string): boolean {
  return activeRange === "today" || activeRange === "yesterday";
}

export function mapAnalyticsTrends(
  payload: any,
  useHourly: boolean
): TrendPoint[] {
  if (!payload) return [];

  // Check V2 Tabbed Structure First
  const overviewTab = payload?.tabs?.overview;
  const revenueTrends = overviewTab?.revenue_trends || overviewTab?.health_trends;
  if (revenueTrends?.labels?.length && revenueTrends?.revenue?.length) {
    return revenueTrends.labels.map((label: string, i: number) => ({
      date: label,
      value: revenueTrends.revenue[i] ?? 0,
    }));
  }

  // Legacy Fallback
  const hourly = payload.trends_chart?.hourly;
  if (
    useHourly &&
    hourly?.labels?.length &&
    hourly?.revenue?.length
  ) {
    return hourly.labels.map((label: any, i: number) => ({
      date: String(label),
      value: hourly.revenue?.[i] ?? 0,
    }));
  }

  if (Array.isArray(payload.trends) && payload.trends.length > 0) {
    return payload.trends.map((item: any) => ({
      date: String(item.date),
      value: item.income ?? 0,
    }));
  }

  return [];
}

export function mapBreakdownToPie(
  payload: any,
  type: BreakdownTab
): PieSlice[] {
  if (!payload) return [];

  // Check V2 Tabbed Structure First
  const tabs = payload?.tabs;
  if (tabs) {
    if (type === "category") {
      const catPerformance = tabs.menu?.category_performance?.items || [];
      return catPerformance.map((item: any) => ({
        name: item.category || item.label || item.category_name || "Unknown",
        value: item.revenue || item.amount || item.sales || 0,
      }));
    } else if (type === "source") {
      const sourceMix = tabs.orders?.source_mix?.items || [];
      return sourceMix.map((item: any) => ({
        name: item.channel || item.source || item.label || "Unknown",
        value: item.amount || 0,
      }));
    } else if (type === "payment") {
      const paymentMix = tabs.overview?.payment_mix || tabs.finance?.payment_settlement_mix;
      const byInstrument = paymentMix?.income_by_payment_instrument || [];
      const byMethod = paymentMix?.items || [];

      const methodRows = byMethod.filter((item: any) => {
        const method = String(item?.label || item?.method || "").trim().toLowerCase();
        return method !== "card" && method !== "digital";
      });

      const hasInstrumentRows = byInstrument.length > 0;
      const list = hasInstrumentRows ? [...methodRows, ...byInstrument] : byMethod;

      return list.map((item: any) => ({
        name: item.label || item.method || item.instrument || "Unknown",
        value: item.amount || 0,
      }));
    }
  }

  // Legacy Fallback
  const breakdown = payload?.breakdown || payload;
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
    const byInstrument = (breakdown.income_by_payment_instrument as typeof list) || [];
    const byMethod = (breakdown.income_by_payment_method as typeof list) || [];

    const methodRows = byMethod.filter((item) => {
      const method = String(item?.label || "").trim().toLowerCase();
      return method !== "card" && method !== "digital";
    });

    const hasInstrumentRows = byInstrument.length > 0;
    if (hasInstrumentRows) {
      list = [...methodRows, ...byInstrument];
    } else {
      list = byMethod;
    }
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
        description: "Revenue split by payment methods, with card/QR expanded by instrument.",
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
