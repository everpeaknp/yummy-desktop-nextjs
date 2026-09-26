export type RankedMenuRow = Record<string, unknown>

export function getTopMenuItemsWithPhotos({
  rankedRows,
  catalog,
}: {
  rankedRows: RankedMenuRow[]
  catalog: RankedMenuRow[]
}) {
  const catalogById = new Map(catalog.map((item) => [String(item.id), item]))
  const seen = new Set<string>()

  return rankedRows
    .filter((item) => {
      const id = String(item.id ?? item.item_id ?? item.name ?? "")
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
    .map((item) => {
      const catalogItem = catalogById.get(String(item.id ?? item.item_id ?? ""))
      return { ...item, image: item.image || catalogItem?.image }
    })
    .filter((item) => typeof item.image === "string" && item.image.trim())
    .slice(0, 6) as (RankedMenuRow & { image: string })[]
}
