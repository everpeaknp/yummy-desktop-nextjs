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

export type ServiceEfficiencySnapshot = {
  peak_hour: string | null;
  avg_service_time_min: number | null;
  order_cancellation_pct: number | null;
  completed_orders: number | null;
};

function readMetricValue(
  metrics: Array<{ key?: string; value?: number }> | null | undefined,
  keys: string[]
): number | undefined {
  if (!Array.isArray(metrics)) return undefined;
  for (const key of keys) {
    const found = metrics.find((metric) => metric?.key === key);
    if (found && typeof found.value === "number") return found.value;
  }
  return undefined;
}

/** Maps tabbed GET /analytics/dashboard payloads to Service Efficiency card fields. */
export function mapServiceEfficiency(payload: any): ServiceEfficiencySnapshot {
  if (!payload) {
    return {
      peak_hour: null,
      avg_service_time_min: null,
      order_cancellation_pct: null,
      completed_orders: null,
    };
  }

  const legacy = payload.operations;
  const tableUtil = payload?.tabs?.overview?.table_utilization;
  const ordersMetrics = payload?.tabs?.orders?.outcome_summary?.metrics || [];
  const executiveMetrics =
    payload?.tabs?.overview?.executive_summary?.metrics || [];
  const legacyOverview = payload?.overview || {};

  const completedOrders = readMetricValue(ordersMetrics, ["completed_orders"]);
  const canceledOrders = readMetricValue(ordersMetrics, ["canceled_orders"]);
  const delayedOrders = readMetricValue(ordersMetrics, ["delayed_orders"]) ?? 0;

  const peak_hour =
    (tableUtil?.peak_hour as string | undefined) ??
    (legacy?.peak_hour as string | undefined) ??
    null;

  const avgRaw =
    readMetricValue(ordersMetrics, ["avg_service_time_min"]) ??
    (typeof legacy?.avg_service_time_min === "number"
      ? legacy.avg_service_time_min
      : undefined);

  const avg_service_time_min =
    avgRaw !== undefined && avgRaw !== null ? Number(avgRaw) : null;

  let order_cancellation_pct: number | null =
    typeof legacy?.order_cancellation_pct === "number"
      ? legacy.order_cancellation_pct
      : null;

  if (order_cancellation_pct === null) {
    const explicitPct = readMetricValue(ordersMetrics, [
      "order_cancellation_pct",
    ]);
    if (explicitPct !== undefined) {
      order_cancellation_pct = explicitPct;
    } else if (canceledOrders !== undefined) {
      const totalOrders =
        readMetricValue(executiveMetrics, ["orders"]) ??
        (typeof legacyOverview.orders_count === "number"
          ? legacyOverview.orders_count
          : completedOrders !== undefined
            ? completedOrders + canceledOrders + delayedOrders
            : undefined);

      if (totalOrders && totalOrders > 0) {
        order_cancellation_pct = Number(
          ((canceledOrders / totalOrders) * 100).toFixed(1)
        );
      }
    }
  }

  return {
    peak_hour,
    avg_service_time_min,
    order_cancellation_pct,
    completed_orders: completedOrders ?? null,
  };
}

export function topItemQuantitySold(item: {
  quantity_sold?: number;
  quantity?: number;
  qty?: number;
}): number {
  // Prefer analytics + V2 sold-count fields before legacy `quantity`
  const raw = item.quantity_sold ?? item.qty ?? item.quantity;
  return raw === undefined || raw === null ? 0 : Number(raw);
}

export function sortTopItemsByUnitsSold<T extends { quantity_sold?: number; quantity?: number; qty?: number }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => topItemQuantitySold(b) - topItemQuantitySold(a)
  );
}
