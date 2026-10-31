import { describe, expect, it } from "vitest";
import { resolveAuthorizedReceiptTerminalId } from "./receipt-print-terminal";

describe("resolveAuthorizedReceiptTerminalId", () => {
  it("uses the terminal resolved by the print authorization when UI selection is empty", () => {
    expect(resolveAuthorizedReceiptTerminalId(52, null)).toBe(52);
  });

  it("falls back to the selected terminal for older authorization responses", () => {
    expect(resolveAuthorizedReceiptTerminalId(undefined, 37)).toBe(37);
  });

  it("uses the only assigned terminal when older APIs omit it and none was selected", () => {
    expect(resolveAuthorizedReceiptTerminalId(undefined, null, 52)).toBe(52);
  });
});
