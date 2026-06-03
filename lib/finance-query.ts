import { endOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";

export type FinanceBusinessLine = "all" | "restaurant" | "hotel";

export type FinanceDateFilter =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "custom"
  | "all";

export type FinanceDateRange = {
  start: string;
  end: string;
};

export function resolveBusinessLineParam(
  line: FinanceBusinessLine
): "restaurant" | "hotel" | undefined {
  if (line === "all") return undefined;
  return line;
}

export function getFinanceDateRange(
  dateFilter: FinanceDateFilter,
  custom?: { startDate?: string; endDate?: string }
): FinanceDateRange {
  const now = new Date();
  let start = "";
  let end = endOfDay(now).toISOString().split("T")[0];

  if (dateFilter === "today") {
    start = now.toISOString().split("T")[0];
  } else if (dateFilter === "yesterday") {
    const yesterday = subDays(now, 1);
    start = yesterday.toISOString().split("T")[0];
    end = endOfDay(yesterday).toISOString().split("T")[0];
  } else if (dateFilter === "this_week") {
    start = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split("T")[0];
  } else if (dateFilter === "this_month") {
    start = startOfMonth(now).toISOString().split("T")[0];
  } else if (dateFilter === "custom") {
    start = custom?.startDate || now.toISOString().split("T")[0];
    end = custom?.endDate || now.toISOString().split("T")[0];
  } else {
    start = subDays(now, 365).toISOString().split("T")[0];
  }

  return { start, end };
}

export function getClientTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function resolveStationParam(
  selectedStation: string
): string | undefined {
  return selectedStation === "all" ? undefined : selectedStation;
}
