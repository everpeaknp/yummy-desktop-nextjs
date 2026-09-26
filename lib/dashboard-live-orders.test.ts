import { describe, expect, it } from "vitest"
import { formatElapsedMinutes, getLiveOrderStatusKind, matchesLiveOrderFilter } from "./dashboard-live-orders"

describe("matchesLiveOrderFilter", () => {
  it("groups kitchen tickets, ready pickups, and bill requests from live order status", () => {
    expect(matchesLiveOrderFilter({ status: "Delayed KOT" }, "kitchen")).toBe(true)
    expect(matchesLiveOrderFilter({ status: "In Kitchen Prep" }, "kitchen")).toBe(true)
    expect(matchesLiveOrderFilter({ status: "Ready for Pickup", channel: "takeaway" }, "pickup")).toBe(true)
    expect(matchesLiveOrderFilter({ status: "Bill Requested" }, "bill")).toBe(true)
  })

  it("does not include unrelated statuses in a filtered tab", () => {
    expect(matchesLiveOrderFilter({ status: "Running", channel: "dine_in" }, "pickup")).toBe(false)
    expect(matchesLiveOrderFilter({ status: "Ready", channel: "dine_in" }, "pickup")).toBe(false)
    expect(matchesLiveOrderFilter({ status: "In Kitchen Prep" }, "bill")).toBe(false)
  })

  it("keeps all rows visible for the all-running tab", () => {
    expect(matchesLiveOrderFilter({ status: "Running" }, "all")).toBe(true)
  })

  it("uses consistent semantic status categories for row markers and badges", () => {
    expect(getLiveOrderStatusKind("Delayed KOT")).toBe("danger")
    expect(getLiveOrderStatusKind("Ready for Pickup")).toBe("success")
    expect(getLiveOrderStatusKind("In Kitchen Prep")).toBe("info")
    expect(getLiveOrderStatusKind("Bill Requested")).toBe("warning")
  })

  it("formats long elapsed times as hours and minutes", () => {
    expect(formatElapsedMinutes(22)).toBe("22 mins")
    expect(formatElapsedMinutes(60)).toBe("1h")
    expect(formatElapsedMinutes(774)).toBe("12h 54m")
  })
})
