import { describe, expect, it } from "vitest";
import { getKotTableType } from "./kot-print-context";

describe("getKotTableType", () => {
  it("reads the KOT snapshot and falls back to the order table", () => {
    expect(getKotTableType({ kot: { table_category: "Garden" } })).toBe("Garden");
    expect(getKotTableType({ order: { table: { table_type_name: "Patio" } } })).toBe("Patio");
    expect(getKotTableType({ kot: { order: { table: { table_category: "Rooftop" } } } })).toBe("Rooftop");
    expect(getKotTableType({ kot: {} })).toBe("");
  });
});
