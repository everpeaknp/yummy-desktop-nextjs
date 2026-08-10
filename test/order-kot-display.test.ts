import { describe, expect, it } from "vitest";

import { getKOTHeading, getKOTItemDisplay } from "@/lib/order-kot-display";
import type { KOTItem, KOTUpdate } from "@/types/order";

describe("order KOT display", () => {
  it("uses the current backend item fields", () => {
    const item: KOTItem = {
      id: 1,
      item_id: 55,
      item_name: "Cafe Mocha",
      qty_change: 2,
      qty_ready: 1,
      qty_served: 0,
      item_status: "PARTIAL",
    };

    expect(getKOTItemDisplay(item)).toEqual({
      name: "Cafe Mocha",
      quantity: 2,
      progressLabel: "1/2 ready",
    });
  });

  it("uses the public KOT number instead of the internal database id", () => {
    const kot = {
      id: 78700,
      kot_number: "32011-1",
    } as KOTUpdate;

    expect(getKOTHeading(kot)).toBe("KOT 32011-1");
    expect(getKOTHeading({ ...kot, kot_number: null })).toBe("Kitchen ticket");
  });
});
