import { describe, expect, it } from "vitest";
import {
  customerPanValidationMessage,
  optionalCustomerText,
} from "./customer-fiscal";

describe("customer fiscal fields", () => {
  it("accepts an empty or exactly nine-digit PAN", () => {
    expect(customerPanValidationMessage("")).toBeNull();
    expect(customerPanValidationMessage("123456789")).toBeNull();
  });

  it("rejects partial and non-numeric PAN values", () => {
    expect(customerPanValidationMessage("12345678")).toContain("9 digits");
    expect(customerPanValidationMessage("12345A789")).toContain("9 digits");
  });

  it("normalizes empty optional customer text", () => {
    expect(optionalCustomerText("  ")).toBeUndefined();
    expect(optionalCustomerText("  Acme Pvt. Ltd. ")).toBe(
      "Acme Pvt. Ltd.",
    );
  });
});
