import { describe, expect, it } from "vitest";

import { getOrderDiscountLabel } from "./order-totals";

describe("getOrderDiscountLabel", () => {
  it("identifies the applied Grow offer by name", () => {
    expect(getOrderDiscountLabel({ growth_offer_name: "Custom audience offer" }))
      .toBe("Grow offer: Custom audience offer");
  });

  it("keeps non-Grow discounts accurately labelled", () => {
    expect(getOrderDiscountLabel({ manual_discount_amount: 100 })).toBe("Manual discount");
    expect(getOrderDiscountLabel({})).toBe("Discount");
  });
});
