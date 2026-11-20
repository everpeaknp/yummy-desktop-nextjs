import type { DateRange } from "react-day-picker";
import { getAnalyticsPresetRange, type AnalyticsPreset } from "./date-scope-policy";
import { formatDateYmd } from "./dashboard-utils";

type DayCloseSelection = {
  period_start_at: string;
  period_end_at: string;
  business_line?: string;
};

/** Calendar presets never inherit the rolling Day Close window implicitly. */
export function analyticsDateRange({ preset, customRange, selectedSession, businessLine, timezone, now = new Date() }: {
  preset: AnalyticsPreset;
  customRange?: DateRange;
  selectedSession?: DayCloseSelection | null;
  businessLine?: string;
  timezone: string;
  now?: Date;
}) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find(item => item.type === name)!.value);
  // Date picker values are calendar dates in the browser. Anchor presets to the
  // restaurant's date, then let the backend resolve its actual day boundaries.
  const calendarNow = new Date(part("year"), part("month") - 1, part("day"), 12);
  const range = getAnalyticsPresetRange(preset, customRange, calendarNow);
  return {
    range,
    dateFrom: formatDateYmd(range?.from ?? calendarNow),
    dateTo: formatDateYmd(range?.to ?? range?.from ?? calendarNow),
    startTime: selectedSession?.period_start_at ?? (preset === "custom" ? customRange?.from?.toISOString() : undefined),
    endTime: selectedSession?.period_end_at ?? (preset === "custom" ? (customRange?.to ?? customRange?.from)?.toISOString() : undefined),
    businessLine: selectedSession?.business_line ?? businessLine,
    timezone,
  };
}
