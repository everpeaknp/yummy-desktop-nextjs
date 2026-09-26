export type DashboardSource = { name: string; value: number }

export const STANDARD_REVENUE_SOURCES = [
  { name: "Dine-In", color: "#2563eb" },
  { name: "Delivery", color: "#f97316" },
  { name: "Pickup", color: "#14b8a6" },
  { name: "Quick Billing", color: "#8b5cf6" },
] as const

function normalizeSourceName(name: string): string {
  return name.toLowerCase().replace(/[_/•-]+/g, " ").replace(/\s+/g, " ").trim()
}

function standardSource(name: string): string | undefined {
  const normalized = normalizeSourceName(name)
  if (normalized.includes("dine") || normalized.includes("table")) return "Dine-In"
  if (normalized.includes("delivery")) return "Delivery"
  if (normalized.includes("pickup") || normalized.includes("takeaway") || normalized.includes("counter")) return "Pickup"
  if (normalized.includes("quick bill")) return "Quick Billing"
  return undefined
}

/** Completes known order sources with zero values while preserving extra channels. */
export function completeRevenueSources(rows: DashboardSource[]): DashboardSource[] {
  const totals = new Map<string, number>(STANDARD_REVENUE_SOURCES.map(({ name }) => [name, 0]))
  const extraSources = new Map<string, DashboardSource>()

  for (const row of rows) {
    const sourceName = String(row.name || "Other").trim() || "Other"
    const value = Math.max(0, Number(row.value) || 0)
    const standardName = standardSource(sourceName)
    if (standardName) {
      totals.set(standardName, (totals.get(standardName) || 0) + value)
      continue
    }

    const key = normalizeSourceName(sourceName)
    const previous = extraSources.get(key)
    extraSources.set(key, { name: previous?.name ?? sourceName, value: (previous?.value ?? 0) + value })
  }

  return [
    ...STANDARD_REVENUE_SOURCES.map(({ name }) => ({ name, value: totals.get(name) || 0 })),
    ...Array.from(extraSources.values()),
  ]
}

export function revenueSourceColor(name: string): string {
  const standardName = standardSource(name)
  return STANDARD_REVENUE_SOURCES.find((source) => source.name === standardName)?.color ?? "#64748b"
}
