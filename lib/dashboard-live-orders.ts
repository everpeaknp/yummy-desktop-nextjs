export type LiveOrderFilter = "all" | "kitchen" | "pickup" | "bill"
export type LiveOrderStatusKind = "danger" | "success" | "info" | "warning" | "default"

type LiveOrderRow = Record<string, unknown>

function normalized(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().replaceAll("_", " ").trim() : ""
}

export function getLiveOrderStatusKind(status: string): LiveOrderStatusKind {
  const state = normalized(status)
  if (state.includes("delay") || state.includes("cancel")) return "danger"
  if (state.includes("ready") || state.includes("complete")) return "success"
  if (state.includes("prep") || state.includes("kitchen") || state.includes("kot")) return "info"
  if (state.includes("request") || state.includes("pending")) return "warning"
  return "default"
}

export function formatElapsedMinutes(minutes: number) {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  if (totalMinutes < 60) return `${totalMinutes} min${totalMinutes === 1 ? "" : "s"}`

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function matchesLiveOrderFilter(order: LiveOrderRow, filter: LiveOrderFilter) {
  if (filter === "all") return true

  const status = normalized(order.status)
  const channel = normalized(order.channel ?? order.type)

  if (filter === "kitchen") return status.includes("kot") || status.includes("kitchen") || status.includes("prep")
  if (filter === "pickup") return status.includes("ready") && (status.includes("pickup") || channel.includes("pickup") || channel.includes("takeaway"))
  return status.includes("bill") && status.includes("request")
}
