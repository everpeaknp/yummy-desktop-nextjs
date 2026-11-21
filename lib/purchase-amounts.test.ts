import { describe, expect, it } from "vitest";
import { calculatePurchaseAmounts, purchaseAmountFromUnits, purchaseUnitCost } from "./purchase-amounts";

describe("purchase bill amounts", () => {
  it.each([
    ["1200", "inclusive", "rate", "13", "1061.95", "138.05", "1200.00"],
    ["1200", "exclusive", "rate", "13", "1200.00", "156.00", "1356.00"],
    ["1200", "inclusive", "exact", "138.04", "1061.96", "138.04", "1200.00"],
    ["1200", "exclusive", "exact", "138.05", "1200.00", "138.05", "1338.05"],
    ["100", "inclusive", "rate", "7.5", "93.02", "6.98", "100.00"],
    ["0.05", "exclusive", "rate", "10", "0.05", "0.01", "0.06"],
    ["1200", "inclusive", "none", "", "1200.00", "0.00", "1200.00"],
  ] as const)("calculates %s %s %s %s", (amount, basis, entry, vat, net, tax, total) => {
    expect(calculatePurchaseAmounts(amount, basis, entry, vat)).toEqual({ amounts: { net, vat: tax, total }, error: null });
  });
  it.each([
    ["", "none", ""], ["-1", "none", ""], ["1200.001", "none", ""],
    ["1200", "rate", ""], ["1200", "rate", "-13"], ["1200", "rate", "101"],
    ["1200", "exact", "1200"], ["1200", "exact", "-1"],
  ] as const)("rejects invalid amounts or VAT: %s %s %s", (amount, entry, vat) => {
    expect(calculatePurchaseAmounts(amount, "inclusive", entry, vat).amounts).toBeNull();
  });
  it("calculates quantity without floating point rounding drift", () => {
    expect(purchaseAmountFromUnits("2", "600")).toBe("1200.00");
    expect(purchaseAmountFromUnits(".5", "19.99")).toBe("10.00");
    expect(purchaseAmountFromUnits("0", "600")).toBeNull();
  });
});

it("preserves zero-cost stock and calculates the inventory unit cost at four decimals", () => {
  expect(purchaseUnitCost("1061.95", "3")).toBe("353.9833");
  expect(purchaseUnitCost("100.00", ".5")).toBe("200.0000");
  expect(purchaseUnitCost("100.00", "0.0001")).toBeNull();
  expect(calculatePurchaseAmounts("0", "inclusive", "none", "", true).amounts).toEqual({ net: "0.00", vat: "0.00", total: "0.00" });
});
