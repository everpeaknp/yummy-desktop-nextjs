import { describe, expect, it } from "vitest";

import {
  buildCashExpenseDrawerPayload,
  parseActiveCashDrawers,
} from "./cash-expense-drawer-selection";

describe("cash expense drawer selection", () => {
  it("recognizes disabled drawer controls", () => {
    expect(
      parseActiveCashDrawers({
        message: "Drawer controls are disabled for this restaurant",
        data: [],
      }),
    ).toEqual({ controlsEnabled: false, sessions: [] });
  });

  it("keeps only payment-ready drawer sessions", () => {
    const result = parseActiveCashDrawers({
      data: [
        { id: 1, status: "opened", name: "Main" },
        { id: 2, status: "closing_count_required", name: "Bar" },
        { id: 3, status: "reopened", name: "Patio" },
        { id: 4, status: "closed", name: "Old" },
      ],
    });

    expect(result.controlsEnabled).toBe(true);
    expect(result.sessions.map((session) => session.id)).toEqual([1, 2, 3]);
  });

  it("does not require a drawer for non-cash payments", () => {
    expect(
      buildCashExpenseDrawerPayload({
        paymentMethod: "card",
        controlsEnabled: true,
        selectedDrawerSessionId: "",
      }),
    ).toEqual({});
  });

  it("does not send a drawer when controls are disabled", () => {
    expect(
      buildCashExpenseDrawerPayload({
        paymentMethod: "cash",
        controlsEnabled: false,
        selectedDrawerSessionId: "",
      }),
    ).toEqual({});
  });

  it("blocks cash when controls are enabled and no drawer is selected", () => {
    expect(() =>
      buildCashExpenseDrawerPayload({
        paymentMethod: "cash",
        controlsEnabled: true,
        selectedDrawerSessionId: "",
      }),
    ).toThrow("Select an open cash drawer before recording this cash expense.");
  });

  it("attaches the selected drawer when one drawer is available", () => {
    expect(
      buildCashExpenseDrawerPayload({
        paymentMethod: "cash",
        controlsEnabled: true,
        selectedDrawerSessionId: "41",
      }),
    ).toEqual({ drawer_session_id: 41 });
  });

  it("preserves an explicit selection when multiple drawers are available", () => {
    const parsed = parseActiveCashDrawers({
      data: [
        { id: 41, status: "opened", name: "Main" },
        { id: 52, status: "opened", name: "Bar" },
      ],
    });

    expect(parsed.sessions).toHaveLength(2);
    expect(
      buildCashExpenseDrawerPayload({
        paymentMethod: "cash",
        controlsEnabled: parsed.controlsEnabled,
        selectedDrawerSessionId: "52",
      }),
    ).toEqual({ drawer_session_id: 52 });
  });
});
