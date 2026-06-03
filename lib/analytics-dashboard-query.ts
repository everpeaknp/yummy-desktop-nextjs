import type { DateRangePreset } from "@/components/ui/date-range-dropdown";
import type { DayCloseSession } from "@/types/day-close-session";
import type { DateRange } from "react-day-picker";

export type AnalyticsDashboardQueryParams = {
  restaurantId: number;
  timezone: string;
  dateFrom?: string;
  dateTo?: string;
  startTime?: string;
  endTime?: string;
  businessLine?: string;
  station?: string;
  include?: string;
};

export type BuildAnalyticsDashboardQueryInput = {
  restaurantId: number;
  timezone: string;
  activeRange: DateRangePreset;
  customDate?: DateRange;
  businessLine?: string;
  station?: string;
  selectedDayCloseSession?: DayCloseSession | null;
  include?: string;
  restaurantEnabled?: boolean;
  hotelEnabled?: boolean;
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolvePresetDateRange(
  activeRange: DateRangePreset,
  customDate?: DateRange
): { dateFrom: string; dateTo: string; startTime?: string; endTime?: string } {
  const now = new Date();
  let dateFrom = formatDate(now);
  let dateTo = formatDate(now);
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (activeRange === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    dateFrom = formatDate(y);
    dateTo = formatDate(y);
  } else if (activeRange === "last7") {
    const l7 = new Date(now);
    l7.setDate(l7.getDate() - 6);
    dateFrom = formatDate(l7);
  } else if (activeRange === "last30") {
    const l30 = new Date(now);
    l30.setDate(l30.getDate() - 29);
    dateFrom = formatDate(l30);
  } else if (activeRange === "month") {
    const m = new Date(now.getFullYear(), now.getMonth(), 1);
    dateFrom = formatDate(m);
  } else if (activeRange === "custom" && customDate?.from) {
    dateFrom = formatDate(customDate.from);
    dateTo = customDate.to ? formatDate(customDate.to) : dateFrom;
    startTime = customDate.from.toISOString();
    endTime = (customDate.to ?? customDate.from).toISOString();
  }

  return { dateFrom, dateTo, startTime, endTime };
}

/**
 * Builds analytics dashboard query params.
 * Session mode uses exact `(period_start_at, period_end_at]` and never mixes date_from/date_to.
 */
export function buildAnalyticsDashboardQuery(
  input: BuildAnalyticsDashboardQueryInput
): AnalyticsDashboardQueryParams {
  const {
    restaurantId,
    timezone,
    activeRange,
    customDate,
    businessLine,
    station,
    selectedDayCloseSession,
    include = "core",
    restaurantEnabled,
    hotelEnabled,
  } = input;

  const lineOpts = { restaurantEnabled, hotelEnabled };
  const resolvedBusinessLine = resolveAnalyticsBusinessLine(
    selectedDayCloseSession?.business_line ?? businessLine,
    lineOpts
  );

  if (selectedDayCloseSession) {
    return {
      restaurantId,
      timezone,
      startTime: selectedDayCloseSession.period_start_at,
      endTime: selectedDayCloseSession.period_end_at,
      businessLine: resolvedBusinessLine,
      include,
    };
  }

  const range = resolvePresetDateRange(activeRange, customDate);
  const useExactWindow =
    activeRange === "custom" && Boolean(range.startTime && range.endTime);

  return {
    restaurantId,
    timezone,
    ...(useExactWindow
      ? {
          startTime: range.startTime,
          endTime: range.endTime,
        }
      : {
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
        }),
    businessLine: resolvedBusinessLine,
    station: resolveAnalyticsStation(station),
    include,
  };
}

/** Matches Flutter: session list defaults to restaurant unless hotel-only outlet. */
export function resolveDayCloseSessionsBusinessLine(
  businessLine?: string,
  opts?: { restaurantEnabled?: boolean; hotelEnabled?: boolean }
): "restaurant" | "hotel" {
  return resolveAnalyticsBusinessLine(businessLine, opts);
}

/**
 * Always sends an explicit business_line — never mixes restaurant + hotel in one query.
 * Restaurant is the default when both modules are enabled.
 */
export function resolveAnalyticsBusinessLine(
  selected: string | undefined,
  opts?: { restaurantEnabled?: boolean; hotelEnabled?: boolean }
): "restaurant" | "hotel" {
  const restaurantOn = opts?.restaurantEnabled !== false;
  const hotelOn = Boolean(opts?.hotelEnabled);

  if (selected === "hotel" && hotelOn) return "hotel";
  if (selected === "restaurant" && restaurantOn) return "restaurant";
  if (hotelOn && !restaurantOn) return "hotel";
  return "restaurant";
}

/** Omit station param when unset or "all". */
export function resolveAnalyticsStation(station?: string): string | undefined {
  if (!station || station === "all") return undefined;
  return station;
}
