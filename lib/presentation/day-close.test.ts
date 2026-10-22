import { describe, expect, it } from "vitest";

import { buildDayClosePresentation, presentDayCloseHistory } from "./day-close";
import type {
  DayCloseDetail,
  DayCloseSnapshotData,
  DayCloseValidateResult,
} from "@/types/day-close";

const readyValidation: DayCloseValidateResult = {
  can_close: true,
  period_start_at: "2026-09-02T16:29:00.000Z",
  period_end_at: "2026-09-03T19:57:00.000Z",
  drawer_ready: true,
  issues: [],
  drawer_readiness: [
    { name: "Main drawer", state: "ready", message: "Ready." },
  ],
};

const snapshot: DayCloseSnapshotData = {
  net_sales: 1500,
  expense_total: 125,
  expected_cash: 900,
  financial_summary: { collections_total: 1400 },
  refunds: { total: 100 },
  drawer_control: {
    expected_cash: 900,
    counted_cash: 895,
    cash_variance: -5,
  },
};

const capabilities = {
  canView: true,
  canInitiate: true,
  canConfirm: true,
  canCancel: false,
  canReopen: false,
  canAdjust: false,
};

function presentation(
  validation: DayCloseValidateResult = readyValidation,
  overrides: Partial<Parameters<typeof buildDayClosePresentation>[0]> = {},
) {
  return buildDayClosePresentation({
    businessDate: "2026-09-03",
    timezone: "Asia/Katmandu",
    validation,
    snapshot,
    capabilities,
    accounting: { availability: "available", state: "ready" },
    ...overrides,
  });
}

describe("day close presentation", () => {
  it("presents a ready close using backend totals only", () => {
    const result = presentation();

    expect(result.readiness.orders).toMatchObject({
      state: "ready",
      detail: "Ready",
    });
    expect(result.readiness.payments.state).toBe("ready");
    expect(result.readiness.accounting.state).toBe("ready");
    expect(result.summary).toEqual({
      sales: 1500,
      paymentsCollected: 1400,
      creditSales: undefined,
      creditCollections: undefined,
      refunds: 100,
      expenses: 125,
      expectedCash: 900,
    });
    expect(result.nextAction).toBe("CONTINUE");
  });

  it.each([
    [
      "ORDER_OPEN",
      "Orders still open",
      "orders",
      "Finish or cancel the open orders before closing.",
    ],
    [
      "PAYMENT_UNEXPLAINED_SHORTFALL",
      "A payment is incomplete",
      "payments",
      "A completed order has an unpaid amount that is not recorded as credit or another valid settlement.",
    ],
    [
      "REFUND_PENDING",
      "Refund still processing",
      "refunds",
      "A refund must finish before the day can close.",
    ],
    [
      "ACCOUNTING_REVIEW_REQUIRED",
      "Finance review required",
      "accounting",
      "The accounting check found an issue that an authorized finance user must review.",
    ],
  ])("maps %s to manager copy", (code, title, area, description) => {
    const result = presentation({
      ...readyValidation,
      can_close: false,
      issues: [
        {
          code,
          severity: "blocker",
          message: "Technical diagnostic details",
        },
      ],
    });

    expect(result.blockers[0]).toMatchObject({ title, area, description });
    expect(result.blockers[0].diagnosticMessage).toBe(
      "Technical diagnostic details",
    );
    expect(result.nextAction).toBe("FIX_BLOCKERS");
  });

  it("keeps a valid credit sale ready when no payment issue exists", () => {
    const result = presentation(readyValidation, {
      snapshot: {
        ...snapshot,
        payment_distribution: { credit: { amount: 500 } },
      },
    });

    expect(result.readiness.payments.state).toBe("ready");
    expect(result.blockers).toHaveLength(0);
  });

  it.each([
    ["needs_count", "Count cash"],
    ["needs_recount", "Count again"],
    ["needs_variance_approval", "Review cash difference"],
    ["needs_settlement", "Choose where the cash goes"],
  ] as const)("maps drawer state %s", (state, label) => {
    const result = presentation({
      ...readyValidation,
      can_close: false,
      drawer_ready: false,
      drawer_readiness: [
        { name: "Main drawer", state, message: "Backend drawer detail" },
      ],
    });

    expect(result.cash.drawers[0]).toMatchObject({ state, label });
    expect(result.readiness.cash.state).toBe("needs_action");
    expect(result.nextAction).toBe("RESOLVE_CASH");
  });

  it("uses the authoritative open-order count for order readiness", () => {
    const result = presentation({
      ...readyValidation,
      can_close: false,
      active_orders_count: 2,
      issues: [
        {
          code: "ORDER_OPEN",
          severity: "blocker",
          message: "Two orders remain open",
          count: 2,
        },
      ],
    });

    expect(result.readiness.orders).toMatchObject({
      state: "needs_action",
      detail: "2 to finish",
      supportingText: "2 open",
    });
  });

  it("does not present order readiness when its authority is unavailable", () => {
    const result = presentation(readyValidation, {
      availability: { orders: "unavailable" },
    });

    expect(result.readiness.orders).toMatchObject({
      state: "unavailable",
      detail: "Unavailable",
    });
  });

  it("explains a non-zero cash difference when drawer variance is resolved", () => {
    const result = presentation();

    expect(result.readiness.cash).toMatchObject({
      state: "ready",
      detail: "Ready · variance approved",
    });
    expect(result.cash.difference).toBe(-5);
  });

  it("keeps unresolved drawer variance action-oriented", () => {
    const result = presentation({
      ...readyValidation,
      can_close: false,
      drawer_ready: false,
      drawer_readiness: [
        {
          name: "Main drawer",
          state: "needs_variance_approval",
          message: "Variance needs approval",
        },
      ],
    });

    expect(result.readiness.cash).toMatchObject({
      state: "needs_action",
      detail: "Action required",
      supportingText: "Review cash difference",
    });
    expect(result.cash.difference).toBe(-5);
  });

  it("presents a missing payment instrument as a warning", () => {
    const result = presentation({
      ...readyValidation,
      issues: [
        {
          code: "PAYMENT_INSTRUMENT_MISSING",
          severity: "warning",
          message: "Instrument id is null",
        },
      ],
    });

    expect(result.warnings[0].title).toBe("Payment method needs review");
    expect(result.readiness.payments.state).toBe("warning");
    expect(result.canContinue).toBe(true);
  });

  it("preserves drawer-evidence counted cash and backend difference", () => {
    const result = presentation();

    expect(result.cash).toMatchObject({
      counted: 895,
      difference: -5,
      countSource: "drawer_evidence",
      countSourceLabel: "Counted from cash drawers",
    });
  });

  it("preserves manual counted cash", () => {
    const result = presentation(readyValidation, {
      snapshot: { ...snapshot, drawer_control: { expected_cash: 900 } },
      detail: {
        id: 1,
        restaurant_id: 1,
        status: "pending",
        counted_cash: 910,
        cash_discrepancy: 10,
        cash_count_source: "manual_count",
      },
    });

    expect(result.cash).toMatchObject({
      counted: 910,
      difference: 10,
      countSourceLabel: "Manually counted",
    });
  });

  it("does not turn absent counted cash into zero", () => {
    const result = presentation(readyValidation, {
      snapshot: { ...snapshot, drawer_control: { expected_cash: 900 } },
    });

    expect(result.cash.counted).toBeUndefined();
    expect(result.cash.countSourceLabel).toBe("Not counted");
  });

  it("marks partial sections unavailable instead of ready or zero", () => {
    const result = presentation(readyValidation, {
      snapshot: null,
      accounting: { availability: "unavailable" },
      availability: { payments: "unavailable" },
    });

    expect(result.readiness.payments).toMatchObject({
      state: "unavailable",
      detail: "Unavailable",
    });
    expect(result.readiness.accounting.state).toBe("unavailable");
    expect(result.summary.paymentsCollected).toBeUndefined();
  });

  it("keeps view and mutation capabilities separate", () => {
    const result = presentation(readyValidation, {
      capabilities: { canView: true, canConfirm: false },
      stage: "review",
    });

    expect(result.capabilities.canView).toBe(true);
    expect(result.capabilities.canConfirm).toBe(false);
    expect(result.nextAction).toBe("REVIEW_CLOSE");
  });

  it("presents confirmed close completion without accounting internals", () => {
    const detail: DayCloseDetail = {
      id: 3,
      restaurant_id: 1,
      business_date: "2026-09-03",
      status: "confirmed",
      confirmed_at: "2026-09-03T20:00:00Z",
    };
    const result = presentation(readyValidation, { detail });

    expect(result.nextAction).toBe("VIEW_RESULT");
    expect(result.period.businessDateLabel).toBe("Sep 3, 2026");
    expect(JSON.stringify(result)).not.toMatch(
      /journal|suspense|finance-event/i,
    );
  });

  it("formats the exact covered range and history fields", () => {
    const result = presentation();
    const history = presentDayCloseHistory(
      {
        id: 9,
        business_date: "2026-09-03",
        business_line: "restaurant",
        status: "confirmed",
        period_start_at: readyValidation.period_start_at,
        period_end_at: readyValidation.period_end_at,
        net_sales: 1500,
        cash_discrepancy: -5,
      },
      { timezone: "Asia/Katmandu", reopenedCount: 1 },
    );

    expect(result.period.displayRange).not.toBe("—");
    expect(result.period).toMatchObject({
      durationLabel: "1 day 3 hrs 28 mins",
      isMultiDay: true,
    });
    expect(history).toMatchObject({
      businessDate: "Sep 3, 2026",
      sales: 1500,
      cashDifference: -5,
      hasChanges: true,
    });
  });
});
