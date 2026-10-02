import { describe, expect, it, vi } from "vitest";
import {
  PAYMENT_AMOUNT_STEP,
  preventPaymentAmountWheelChange,
} from "@/lib/payment-composer-config";
import { SIDEBAR_ROLE_MAP } from "@/lib/role-permissions";

describe("shared payment and navigation configuration", () => {
  it("moves payment number controls in ten-rupee increments", () => {
    expect(PAYMENT_AMOUNT_STEP).toBe(10);
  });

  it("removes focus when the wheel reaches a payment amount", () => {
    const input = { blur: vi.fn() };

    preventPaymentAmountWheelChange(input);

    expect(input.blur).toHaveBeenCalledOnce();
  });

  it("does not expose the retired Rooms sidebar entry", () => {
    expect(SIDEBAR_ROLE_MAP.some((item) => item.href === "/rooms")).toBe(false);
  });
});
