export type DashboardHealth = "live" | "degraded" | "offline"

export function getDashboardHealth(
  error: string | null,
  analyticsError: string | null,
  hasData: boolean
): DashboardHealth {
  if (error && !hasData) return "offline"
  if (error || analyticsError) return "degraded"
  return "live"
}

export function formatDashboardTimestamp(date: Date | null): string {
  if (!date) return "—"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatDateYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "month"
  | "lastMonth"
  | "custom"

export function resolveDateRange(
  activeRange: DateRangePreset,
  customRange?: { from?: Date; to?: Date }
): { dateFrom: string; dateTo: string; startTime?: string; endTime?: string } {
  const now = new Date()
  let dateFrom = formatDateYmd(now)
  let dateTo = formatDateYmd(now)

  if (activeRange === "yesterday") {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    dateFrom = formatDateYmd(y)
    dateTo = formatDateYmd(y)
  } else if (activeRange === "last7") {
    const l7 = new Date(now)
    l7.setDate(l7.getDate() - 6)
    dateFrom = formatDateYmd(l7)
  } else if (activeRange === "last30") {
    const l30 = new Date(now)
    l30.setDate(l30.getDate() - 29)
    dateFrom = formatDateYmd(l30)
  } else if (activeRange === "month") {
    const m = new Date(now.getFullYear(), now.getMonth(), 1)
    dateFrom = formatDateYmd(m)
  } else if (activeRange === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    dateFrom = formatDateYmd(start)
    dateTo = formatDateYmd(end)
  } else if (activeRange === "custom" && customRange?.from) {
    dateFrom = formatDateYmd(customRange.from)
    dateTo = customRange.to ? formatDateYmd(customRange.to) : dateFrom
  }

  let startTime: string | undefined
  let endTime: string | undefined
  if (activeRange === "custom" && customRange?.from) {
    startTime = customRange.from.toISOString()
    endTime = customRange.to
      ? customRange.to.toISOString()
      : customRange.from.toISOString()
  }

  return { dateFrom, dateTo, startTime, endTime }
}

export function getPeriodLabel(activeRange: DateRangePreset): string {
  switch (activeRange) {
    case "today":
      return "Today"
    case "yesterday":
      return "Yesterday"
    case "last7":
      return "Last 7 days"
    case "last30":
      return "Last 30 days"
    case "month":
      return "This month"
    case "lastMonth":
      return "Last month"
    case "custom":
      return "Custom range"
    default:
      return "Selected period"
  }
}

export function getCompareLabel(activeRange: DateRangePreset): string {
  if (activeRange === "today") return "yesterday (full day)"
  if (activeRange === "yesterday") return "the day before yesterday"
  if (activeRange === "last7") return "the previous 7 days"
  if (activeRange === "last30") return "the previous 30 days"
  if (activeRange === "month") return "the previous month"
  if (activeRange === "lastMonth") return "the month before last"
  return "previous period"
}

export type MergedInsight = {
  message: string
  suggested_action?: string
  level?: string
  type?: string
  route?: string
  source: "ai" | "quick"
}

export function mergeDashboardInsights(
  quickInsights: any[],
  aiInsights: any[]
): MergedInsight[] {
  const seen = new Set<string>()
  const result: MergedInsight[] = []

  const add = (item: any, source: "ai" | "quick") => {
    const message = String(item?.message || item?.title || "").trim()
    if (!message) return
    const key = message.toLowerCase().slice(0, 100)
    if (seen.has(key)) return
    seen.add(key)
    result.push({
      message,
      suggested_action: item?.suggested_action || item?.action_hint,
      level: item?.level || item?.type,
      type: item?.type,
      route: item?.route,
      source,
    })
  }

  aiInsights.forEach((item) => add(item, "ai"))
  quickInsights.forEach((item) => add(item, "quick"))

  return result.slice(0, 6)
}

export function buildExportFilename(
  activeRange: DateRangePreset,
  dateFrom: string,
  dateTo: string
): string {
  const range =
    activeRange === "custom" || dateFrom !== dateTo
      ? `${dateFrom}_to_${dateTo}`
      : dateFrom
  return `Dashboard_Summary_${range}.xlsx`
}
