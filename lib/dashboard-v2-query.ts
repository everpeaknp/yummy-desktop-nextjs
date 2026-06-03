import type { DateRange } from "react-day-picker";
import type { DateRangePreset } from "@/components/ui/date-range-dropdown";
import type { DashboardV2QueryContext } from "@/types/dashboard-v2";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function buildDashboardV2QueryContext(input: {
  restaurantId: number;
  timezone: string;
  businessLine?: string;
  activeRange: DateRangePreset;
  date?: DateRange;
}): DashboardV2QueryContext {
  const now = new Date();

  if (input.activeRange === "custom" && input.date?.from) {
    const from = input.date.from;
    const to = input.date.to ?? input.date.from;
    const sameDay = formatDate(from) === formatDate(to);
    return {
      restaurantId: input.restaurantId,
      timezone: input.timezone,
      businessLine: input.businessLine,
      date: sameDay ? formatDate(from) : undefined,
      startTime: sameDay ? undefined : startOfDay(from).toISOString(),
      endTime: sameDay ? undefined : endOfDay(to).toISOString(),
    };
  }

  if (input.activeRange === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return {
      restaurantId: input.restaurantId,
      timezone: input.timezone,
      businessLine: input.businessLine,
      date: formatDate(y),
    };
  }

  if (input.activeRange === "last7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return {
      restaurantId: input.restaurantId,
      timezone: input.timezone,
      businessLine: input.businessLine,
      startTime: startOfDay(from).toISOString(),
      endTime: endOfDay(now).toISOString(),
    };
  }

  if (input.activeRange === "last30") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return {
      restaurantId: input.restaurantId,
      timezone: input.timezone,
      businessLine: input.businessLine,
      startTime: startOfDay(from).toISOString(),
      endTime: endOfDay(now).toISOString(),
    };
  }

  if (input.activeRange === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      restaurantId: input.restaurantId,
      timezone: input.timezone,
      businessLine: input.businessLine,
      startTime: startOfDay(from).toISOString(),
      endTime: endOfDay(now).toISOString(),
    };
  }

  return {
    restaurantId: input.restaurantId,
    timezone: input.timezone,
    businessLine: input.businessLine,
    date: formatDate(now),
  };
}

export function formatDashboardCurrency(value: number | null | undefined, currency = "NPR"): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function throughputToChartData(
  points: Array<{ timestamp?: string | null; orders_completed: number; sales_collected: number }>,
): Array<{ date: string; revenue: number; orders: number }> {
  return points.map((point) => {
    const label = point.timestamp
      ? new Date(point.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "—";
    return {
      date: label,
      revenue: point.sales_collected,
      orders: point.orders_completed,
    };
  });
}
