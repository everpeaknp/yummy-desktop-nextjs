import { describe, expect, it } from "vitest";

import {
  CHECKOUT_MULTIPLE_ACTIVE_CASH_DRAWERS_MESSAGE,
  CHECKOUT_OPEN_CASH_DRAWER_MESSAGE,
  resolveCheckoutCashDrawerReadiness,
} from "./checkout-cash-drawer-readiness";

describe("checkout cash drawer readiness", () => {
  it("allows cash when drawer controls are disabled", () => {
    expect(
      resolveCheckoutCashDrawerReadiness({
        message: "Drawer controls are disabled for this restaurant",
        data: [],
      }),
    ).toEqual({
      controlsEnabled: false,
      paymentReadySessions: [],
      ready: true,
      message: "",
    });
  });

  it("uses the accessible payment-ready drawer without requiring cashier ownership", () => {
    const sharedDrawer = {
      id: 41,
      cashier_id: 7,
      status: "opened",
      station: "Counter",
      drawer_key: "main",
    };

    const result = resolveCheckoutCashDrawerReadiness({
      data: [sharedDrawer],
    });

    expect(result.ready).toBe(true);
    expect(result.paymentReadySessions).toEqual([sharedDrawer]);
  });

  it("blocks checkout when multiple payment-ready drawers are accessible", () => {
    expect(
      resolveCheckoutCashDrawerReadiness({
        data: [
          { id: 41, status: "opened" },
          { id: 52, status: "closing_count_required" },
        ],
      }),
    ).toEqual({
      controlsEnabled: true,
      paymentReadySessions: [
        { id: 41, status: "opened" },
        { id: 52, status: "closing_count_required" },
      ],
      ready: false,
      message: CHECKOUT_MULTIPLE_ACTIVE_CASH_DRAWERS_MESSAGE,
    });
  });

  it("blocks checkout when controls are enabled and no payment-ready drawer is accessible", () => {
    expect(
      resolveCheckoutCashDrawerReadiness({
        data: [
          { id: 41, status: "closed" },
          { id: 52, status: "counted" },
        ],
      }),
    ).toEqual({
      controlsEnabled: true,
      paymentReadySessions: [],
      ready: false,
      message: CHECKOUT_OPEN_CASH_DRAWER_MESSAGE,
    });
  });
});
