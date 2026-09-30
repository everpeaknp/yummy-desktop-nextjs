import type { BusinessLine } from "@/types/day-close";

interface DayCloseNavigationSource {
  id?: number | null;
  business_date?: string | null;
  business_line?: string | null;
}

function normalizedBusinessLine(value?: string | null): BusinessLine {
  if (value === "hotel" || value === "combined") return value;
  return "restaurant";
}

export function getAnalyticsUrlForDayClose(
  close: DayCloseNavigationSource,
): string {
  const params = new URLSearchParams({
    business_line: normalizedBusinessLine(close.business_line),
  });
  if (close.id) params.set("day_close_id", String(close.id));
  return `/analytics?${params.toString()}`;
}

export function getAccountingReviewUrlForDayClose(
  close: DayCloseNavigationSource,
): string {
  const params = new URLSearchParams({
    business_line: normalizedBusinessLine(close.business_line),
  });
  if (close.business_date) params.set("business_date", close.business_date);
  if (close.id) params.set("day_close_id", String(close.id));
  return `/day-close/finance-review?${params.toString()}`;
}

export function getAccountingDayCloseUrl(
  close: Required<Pick<DayCloseNavigationSource, "id">>,
): string {
  return `/finance/accounting/day-closes?day_close_id=${encodeURIComponent(String(close.id))}`;
}
