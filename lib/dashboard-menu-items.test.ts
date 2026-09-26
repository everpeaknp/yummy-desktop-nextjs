import { describe, expect, it } from "vitest"
import { getTopMenuItemsWithPhotos } from "./dashboard-menu-items"

describe("getTopMenuItemsWithPhotos", () => {
  it("joins catalog photos, deduplicates API rows, and excludes items without photos", () => {
    const rows = getTopMenuItemsWithPhotos({
      rankedRows: [
        { id: 1, name: "Momo", revenue: 80 },
        { id: 2, name: "Tea", revenue: 20 },
        { id: 1, name: "Momo", revenue: 80 },
      ],
      catalog: [{ id: 1, image: "asset:momo.png" }, { id: 2, image: "" }],
    })

    expect(rows).toEqual([{ id: 1, name: "Momo", revenue: 80, image: "asset:momo.png" }])
  })

  it("returns at most six items sorted by revenue", () => {
    const rows = getTopMenuItemsWithPhotos({
      rankedRows: Array.from({ length: 8 }, (_, id) => ({ id, revenue: id })),
      catalog: Array.from({ length: 8 }, (_, id) => ({ id, image: `/item-${id}.png` })),
    })

    expect(rows.map((row) => row.id)).toEqual([7, 6, 5, 4, 3, 2])
  })
})
