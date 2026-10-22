import { describe, expect, it } from "vitest"
import { completeRevenueSources, revenueSourceColor } from "./dashboard-source-mix"

describe("dashboard revenue sources", () => {
  it("fills missing standard sources with zero values", () => {
    expect(completeRevenueSources([{ name: "Dine-In Service", value: 100 }])).toEqual([
      { name: "Dine-In", value: 100 },
      { name: "Delivery", value: 0 },
      { name: "Pickup", value: 0 },
      { name: "Quick Billing", value: 0 },
    ])
  })

  it("combines aliases and keeps each standard source color fixed", () => {
    const sources = completeRevenueSources([
      { name: "Takeaway / Counter", value: 40 },
      { name: "Pickup", value: 20 },
      { name: "Online Delivery", value: 60 },
    ])

    expect(sources).toEqual([
      { name: "Dine-In", value: 0 },
      { name: "Delivery", value: 60 },
      { name: "Pickup", value: 60 },
      { name: "Quick Billing", value: 0 },
    ])
    expect(revenueSourceColor("Delivery")).toBe("#f97316")
    expect(revenueSourceColor("Takeaway")).toBe("#14b8a6")
  })
})
