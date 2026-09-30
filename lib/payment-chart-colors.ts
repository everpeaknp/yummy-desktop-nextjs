const KNOWN_COLORS: Record<string, { color: string; hue: number }> = {
  cash: { color: "#2563eb", hue: 221 },
  "bank transfer": { color: "#f97316", hue: 24 },
  credit: { color: "#14b8a6", hue: 171 },
  "room charge": { color: "#8b5cf6", hue: 258 },
  "card unspecified card": { color: "#ec4899", hue: 330 },
  "digital unspecified qr": { color: "#84cc16", hue: 84 },
}

export function paymentInstrumentKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[•·]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function hashName(name: string): number {
  let hash = 2166136261
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360
  return Math.min(distance, 360 - distance)
}

/** Keeps the established colors for common methods and gives extra instruments
 * deterministic, non-repeating hues, independent of the API's display order.
 */
export function assignPaymentChartColors(names: string[]): Record<string, string> {
  const keys = Array.from(new Set(names.map(paymentInstrumentKey).filter(Boolean))).sort()
  const usedHues = keys.flatMap((key) => KNOWN_COLORS[key] ? [KNOWN_COLORS[key].hue] : [])
  const minHueDistance = Math.min(30, 360 / Math.max(keys.length + 1, 1))
  const colors: Record<string, string> = {}

  for (const key of keys) {
    const known = KNOWN_COLORS[key]
    if (known) {
      colors[key] = known.color
      continue
    }

    const startingHue = hashName(key) % 360
    let hue = startingHue
    let foundHue = false
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const candidate = Math.round((startingHue + attempt * 137.508) % 360)
      if (usedHues.every((usedHue) => hueDistance(candidate, usedHue) >= minHueDistance)) {
        hue = candidate
        foundHue = true
        break
      }
    }
    if (!foundHue) {
      hue = Math.round(startingHue)
      while (usedHues.includes(hue)) hue = (hue + 1) % 360
    }
    usedHues.push(hue)
    colors[key] = `hsl(${hue} 72% 55%)`
  }

  return colors
}
