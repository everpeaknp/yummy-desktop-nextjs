import { describe, expect, it } from "vitest"
import { assignPaymentChartColors, paymentInstrumentKey } from "./payment-chart-colors"

describe("payment chart colors", () => {
  it("preserves the existing colors for standard instruments", () => {
    const colors = assignPaymentChartColors([
      "Cash",
      "Bank Transfer",
      "Credit",
      "Room Charge",
      "card • Unspecified Card",
      "digital • Unspecified QR",
    ])

    expect(colors[paymentInstrumentKey("Cash")]).toBe("#2563eb")
    expect(colors[paymentInstrumentKey("Bank Transfer")]).toBe("#f97316")
    expect(colors[paymentInstrumentKey("card • Unspecified Card")]).toBe("#ec4899")
  })

  it("assigns stable distinct colors to additional instruments regardless of input order", () => {
    const instruments = ["Cash", "Bank Transfer", "Credit", "Room Charge", "card • Unspecified Card", "digital • Unspecified QR", "Visa", "Mastercard", "eSewa", "Fonepay"]
    const first = assignPaymentChartColors(instruments)
    const reordered = assignPaymentChartColors([...instruments].reverse())
    const colors = instruments.map((name) => first[paymentInstrumentKey(name)])

    expect(new Set(colors).size).toBe(instruments.length)
    expect(reordered).toEqual(first)
  })

  it("does not reuse colors across the expanded card and QR instruments", () => {
    const instruments = [
      "Cash",
      "Bank Transfer",
      "Credit",
      "Room Charge",
      "card • Unspecified Card",
      "digital • Unspecified QR",
      "card • nabil",
      "digital • nabil",
      "card • dsadsa",
    ]
    const colors = assignPaymentChartColors(instruments)

    expect(new Set(instruments.map((name) => colors[paymentInstrumentKey(name)])).size).toBe(instruments.length)
    const extraInstrumentHue = Number(colors[paymentInstrumentKey("card • dsadsa")].match(/hsl\((\d+)/)?.[1])
    const greenHueDistance = Math.min(Math.abs(extraInstrumentHue - 84), 360 - Math.abs(extraInstrumentHue - 84))
    expect(greenHueDistance).toBeGreaterThanOrEqual(30)
  })
})
