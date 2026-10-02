import {
  formatDayCloseBusinessDate,
  formatDayClosePeriod,
  getDayClosePeriodContext,
  pickBackendAmount,
} from "@/lib/day-close-format";
import type {
  DayCloseDetail,
  DayCloseListItem,
  DayCloseSnapshotData,
  DayCloseValidateResult,
} from "@/types/day-close";

export const DAY_CLOSE_TERMS = {
  title: "Day close",
  activityIncluded: "Activity included",
  orders: "Orders",
  sales: "Sales",
  paymentsCollected: "Payments collected",
  refunds: "Refunds",
  expenses: "Expenses",
  cashDrawer: "Cash drawer",
  cashExpected: "Cash the system expects",
  cashCounted: "Cash counted",
  cashDifference: "Cash difference",
  financeReviewRequired: "Finance review required",
  closeDay: "Close day",
  addCorrection: "Add correction",
  reopenDay: "Reopen day",
} as const;

export type DayCloseAvailability = "loading" | "available" | "unavailable";
export type DayCloseReadinessState =
  "ready" | "needs_action" | "warning" | "unavailable";
export type DayCloseIssueLevel = "BLOCKER" | "WARNING" | "INFO";
export type DayCloseReadinessArea =
  "orders" | "payments" | "refunds" | "cash" | "accounting";
export type DayCloseNextAction =
  | "FIX_BLOCKERS"
  | "RESOLVE_CASH"
  | "CONTINUE"
  | "REVIEW_CLOSE"
  | "CLOSE_DAY"
  | "VIEW_RESULT";

export interface DayCloseCapabilities {
  canView: boolean;
  canInitiate: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  canReopen: boolean;
  canAdjust: boolean;
}

export interface DayClosePresentationIssue {
  code: string;
  level: DayCloseIssueLevel;
  area: DayCloseReadinessArea;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  count?: number | null;
  diagnosticMessage?: string;
}

export interface DayCloseReadinessPresentation {
  area: DayCloseReadinessArea;
  label: string;
  state: DayCloseReadinessState;
  detail: string;
  supportingText?: string;
}

export interface DayCloseDrawerPresentation {
  configurationId?: number | null;
  sessionId?: number | null;
  name: string;
  state: DayCloseValidateResult["drawer_readiness"] extends Array<infer T>
    ? T extends { state: infer S }
      ? S
      : never
    : string;
  label: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface DayClosePresentation {
  period: {
    businessDateLabel: string;
    startAt?: string;
    endAt?: string;
    displayRange: string;
    durationLabel?: string;
    isMultiDay: boolean;
  };
  readiness: Record<DayCloseReadinessArea, DayCloseReadinessPresentation>;
  summary: {
    sales?: number;
    paymentsCollected?: number;
    creditSales?: number;
    creditCollections?: number;
    refunds?: number;
    expenses?: number;
    expectedCash?: number;
  };
  cash: {
    expected?: number;
    counted?: number;
    difference?: number;
    countSource: "drawer_evidence" | "manual_count" | "not_counted";
    countSourceLabel: string;
    drawers: DayCloseDrawerPresentation[];
  };
  blockers: DayClosePresentationIssue[];
  warnings: DayClosePresentationIssue[];
  information: DayClosePresentationIssue[];
  capabilities: DayCloseCapabilities;
  nextAction: DayCloseNextAction;
  canContinue: boolean;
}

export interface BuildDayClosePresentationInput {
  businessDate?: string | null;
  timezone?: string;
  validation?: DayCloseValidateResult | null;
  snapshot?: DayCloseSnapshotData | null;
  detail?: DayCloseDetail | null;
  capabilities?: Partial<DayCloseCapabilities>;
  availability?: Partial<Record<DayCloseReadinessArea, DayCloseAvailability>>;
  accounting?: {
    availability: DayCloseAvailability;
    state?: Exclude<DayCloseReadinessState, "unavailable">;
  };
  stage?: "overview" | "review" | "confirmed";
}

const DEFAULT_CAPABILITIES: DayCloseCapabilities = {
  canView: false,
  canInitiate: false,
  canConfirm: false,
  canCancel: false,
  canReopen: false,
  canAdjust: false,
};

const AREA_LABELS: Record<DayCloseReadinessArea, string> = {
  orders: DAY_CLOSE_TERMS.orders,
  payments: DAY_CLOSE_TERMS.paymentsCollected,
  refunds: DAY_CLOSE_TERMS.refunds,
  cash: DAY_CLOSE_TERMS.cashDrawer,
  accounting: "Finance check",
};

const ISSUE_COPY: Record<
  string,
  Omit<
    DayClosePresentationIssue,
    "code" | "level" | "count" | "diagnosticMessage"
  >
> = {
  ORDER_OPEN: {
    area: "orders",
    title: "Orders still open",
    description: "Finish or cancel the open orders before closing.",
    actionLabel: "View orders",
    actionHref: "/orders",
  },
  PAYMENT_OVERPAID: {
    area: "payments",
    title: "A payment needs review",
    description:
      "A completed order has more successful payment recorded than its total.",
    actionLabel: "Review order",
    actionHref: "/orders",
  },
  PAYMENT_UNEXPLAINED_SHORTFALL: {
    area: "payments",
    title: "A payment is incomplete",
    description:
      "A completed order has an unpaid amount that is not recorded as credit or another valid settlement.",
    actionLabel: "Review order",
    actionHref: "/orders",
  },
  REFUND_PENDING: {
    area: "refunds",
    title: "Refund still processing",
    description: "A refund must finish before the day can close.",
  },
  DRAWER_NOT_READY: {
    area: "cash",
    title: "Cash drawer needs attention",
    description: "Finish this drawer before closing.",
    actionLabel: "Open cash drawers",
    actionHref: "/cash-drawers",
  },
  DRAWER_RECOUNT_REQUIRED: {
    area: "cash",
    title: "Cash drawer needs another count",
    description: "Cash activity occurred after the last count.",
    actionLabel: "Count cash",
    actionHref: "/cash-drawers",
  },
  ACCOUNTING_REVIEW_REQUIRED: {
    area: "accounting",
    title: DAY_CLOSE_TERMS.financeReviewRequired,
    description:
      "The system could not finish preparing the financial records for this close period.",
  },
  PAYMENT_INSTRUMENT_MISSING: {
    area: "payments",
    title: "Payment method needs review",
    description:
      "A payment method is missing the information needed for a complete close record.",
  },
  PAYMENT_INSTRUMENT_UNMAPPED: {
    area: "payments",
    title: "Payment method needs review",
    description:
      "A payment method is missing the information needed for a complete close record.",
  },
  EXPENSE_DOCUMENTATION_MISSING: {
    area: "accounting",
    title: "Expense documents are missing",
    description: "Some expenses do not have supporting documents yet.",
  },
};

function issueLevel(severity: string): DayCloseIssueLevel {
  if (severity === "blocker") return "BLOCKER";
  if (severity === "warning") return "WARNING";
  return "INFO";
}

function fallbackArea(code: string): DayCloseReadinessArea {
  if (code.startsWith("ORDER_")) return "orders";
  if (code.startsWith("PAYMENT_")) return "payments";
  if (code.startsWith("REFUND_")) return "refunds";
  if (code.startsWith("DRAWER_") || code.startsWith("CASH_")) return "cash";
  return "accounting";
}

export function presentDayCloseIssue(
  issue: NonNullable<DayCloseValidateResult["issues"]>[number],
): DayClosePresentationIssue {
  const known = ISSUE_COPY[issue.code];
  return {
    code: issue.code,
    level: issueLevel(issue.severity),
    area: known?.area ?? fallbackArea(issue.code),
    title: known?.title ?? "Review required",
    description:
      known?.description ??
      "This check needs attention before the day close can continue.",
    actionLabel: known?.actionLabel,
    actionHref: known?.actionHref,
    count: issue.count,
    diagnosticMessage: issue.message,
  };
}

const DRAWER_COPY: Record<string, { label: string; actionLabel?: string }> = {
  ready: { label: "Ready" },
  needs_open: {
    label: "Drawer has not been opened",
    actionLabel: "Open drawer",
  },
  needs_count: { label: "Count cash", actionLabel: "Count cash" },
  needs_recount: { label: "Count again", actionLabel: "Count again" },
  needs_variance_approval: {
    label: "Review cash difference",
    actionLabel: "Review cash difference",
  },
  needs_settlement: {
    label: "Choose where the cash goes",
    actionLabel: "Settle drawer",
  },
};

function presentDrawers(
  validation?: DayCloseValidateResult | null,
): DayCloseDrawerPresentation[] {
  return (validation?.drawer_readiness ?? []).map((drawer) => ({
    configurationId: drawer.configuration_id,
    sessionId: drawer.session_id,
    name: drawer.name,
    state: drawer.state,
    label: DRAWER_COPY[drawer.state]?.label ?? "Needs attention",
    actionLabel: DRAWER_COPY[drawer.state]?.actionLabel,
    actionHref: drawer.state === "ready" ? undefined : "/cash-drawers",
  }));
}

function availabilityFor(
  area: DayCloseReadinessArea,
  input: BuildDayClosePresentationInput,
): DayCloseAvailability {
  const explicit = input.availability?.[area];
  if (explicit) return explicit;
  if (area === "accounting") {
    if (input.accounting) return input.accounting.availability;
    if (input.detail?.accounting_review || input.detail?.accounting_status)
      return "available";
    return "unavailable";
  }
  return input.validation ? "available" : "unavailable";
}

function readinessState(
  area: DayCloseReadinessArea,
  issues: DayClosePresentationIssue[],
  availability: DayCloseAvailability,
  accountingState?: Exclude<DayCloseReadinessState, "unavailable">,
): DayCloseReadinessState {
  if (availability !== "available") return "unavailable";
  if (area === "accounting" && accountingState) return accountingState;
  const relevant = issues.filter((issue) => issue.area === area);
  if (relevant.some((issue) => issue.level === "BLOCKER"))
    return "needs_action";
  if (relevant.some((issue) => issue.level === "WARNING")) return "warning";
  return "ready";
}

function readinessDetail(state: DayCloseReadinessState): string {
  if (state === "ready") return "Ready";
  if (state === "needs_action") return "Action required";
  if (state === "warning") return "Review recommended";
  return "Unavailable";
}

function countSourceLabel(
  source: DayClosePresentation["cash"]["countSource"],
): string {
  if (source === "drawer_evidence") return "Counted from cash drawers";
  if (source === "manual_count") return "Manually counted";
  return "Not counted";
}

function accountingStateFromDetail(
  detail?: DayCloseDetail | null,
): Exclude<DayCloseReadinessState, "unavailable"> | undefined {
  const status = String(
    detail?.accounting_review?.status ??
      detail?.accounting_status?.status ??
      "",
  ).toLowerCase();
  const blockerRows =
    detail?.accounting_review?.blockers ?? detail?.accounting_status?.blockers;
  if (Array.isArray(blockerRows) && blockerRows.length > 0)
    return "needs_action";
  if (["ready", "reviewed", "posted"].includes(status)) return "ready";
  if (status) return "warning";
  return undefined;
}

export function buildDayClosePresentation(
  input: BuildDayClosePresentationInput,
): DayClosePresentation {
  const capabilities: DayCloseCapabilities = {
    ...DEFAULT_CAPABILITIES,
    ...input.capabilities,
  };
  const rawIssues = input.validation?.issues ?? [];
  const issues = rawIssues.map(presentDayCloseIssue);
  const blockers = issues.filter((issue) => issue.level === "BLOCKER");
  const warnings = issues.filter((issue) => issue.level === "WARNING");
  const information = issues.filter((issue) => issue.level === "INFO");
  const drawers = presentDrawers(input.validation);
  const accountingState =
    input.accounting?.state ?? accountingStateFromDetail(input.detail);
  const orderIssue = issues.find((issue) => issue.code === "ORDER_OPEN");
  const openOrders =
    input.validation?.active_orders_count ?? orderIssue?.count ?? undefined;
  const orderSummary = input.snapshot?.evidence?.operational.orders.summary;

  const readiness = Object.fromEntries(
    (Object.keys(AREA_LABELS) as DayCloseReadinessArea[]).map((area) => {
      const state = readinessState(
        area,
        issues,
        availabilityFor(area, input),
        area === "accounting" ? accountingState : undefined,
      );
      return [
        area,
        {
          area,
          label: AREA_LABELS[area],
          state,
          detail: readinessDetail(state),
        },
      ];
    }),
  ) as Record<DayCloseReadinessArea, DayCloseReadinessPresentation>;

  if (readiness.orders.state !== "unavailable") {
    readiness.orders = {
      ...readiness.orders,
      detail:
        openOrders != null && openOrders > 0
          ? `${openOrders} to finish`
          : "Ready",
      supportingText:
        orderSummary != null
          ? `${orderSummary.completed_orders} completed · ${orderSummary.open_blocking_orders_at_period_end} open`
          : input.detail?.completed_orders != null
            ? `${input.detail.completed_orders} completed${
                openOrders != null ? ` · ${openOrders} open` : ""
              }`
            : openOrders != null
              ? `${openOrders} open`
              : undefined,
    };
  }

  if (drawers.some((drawer) => drawer.state !== "ready")) {
    readiness.cash = {
      ...readiness.cash,
      state: "needs_action",
      detail: "Action required",
    };
  }

  const snapshot = input.snapshot;
  const detail = input.detail;
  const source =
    snapshot?.drawer_control?.counted_cash != null
      ? "drawer_evidence"
      : (detail?.cash_count_source ?? "not_counted");
  const countSource =
    source === "manual_count"
      ? source
      : source === "drawer_evidence"
        ? source
        : "not_counted";
  const cashDifference = pickBackendAmount(
    snapshot?.drawer_control?.cash_variance,
    detail?.cash_discrepancy,
  );
  const unresolvedDrawer = drawers.find((drawer) => drawer.state !== "ready");
  const resolvedDrawerVariance =
    cashDifference != null &&
    Math.abs(cashDifference) > 0.005 &&
    drawers.length > 0 &&
    !unresolvedDrawer;

  if (unresolvedDrawer) {
    readiness.cash = {
      ...readiness.cash,
      state: "needs_action",
      detail: "Action required",
      supportingText: unresolvedDrawer.actionLabel ?? unresolvedDrawer.label,
    };
  } else if (resolvedDrawerVariance) {
    readiness.cash = {
      ...readiness.cash,
      state: "ready",
      detail: "Ready · variance approved",
    };
  }
  const status = String(detail?.status ?? "").toLowerCase();
  const confirmed = input.stage === "confirmed" || status === "confirmed";
  const hasDrawerAction = drawers.some((drawer) => drawer.state !== "ready");
  const canContinue =
    Boolean(input.validation?.can_close) && blockers.length === 0;

  let nextAction: DayCloseNextAction;
  if (confirmed) nextAction = "VIEW_RESULT";
  else if (blockers.length > 0) nextAction = "FIX_BLOCKERS";
  else if (hasDrawerAction) nextAction = "RESOLVE_CASH";
  else if (input.stage === "review" && capabilities.canConfirm)
    nextAction = "CLOSE_DAY";
  else if (input.stage === "review") nextAction = "REVIEW_CLOSE";
  else nextAction = "CONTINUE";

  const startAt =
    input.validation?.period_start_at ??
    detail?.period_start_at ??
    snapshot?.period_start_at ??
    undefined;
  const endAt =
    input.validation?.period_end_at ??
    detail?.period_end_at ??
    snapshot?.period_end_at ??
    undefined;
  const periodContext = getDayClosePeriodContext(startAt, endAt);

  return {
    period: {
      businessDateLabel: formatDayCloseBusinessDate(
        input.businessDate ?? detail?.business_date ?? snapshot?.business_date,
        input.timezone,
      ),
      startAt,
      endAt,
      displayRange: formatDayClosePeriod(startAt, endAt, input.timezone),
      durationLabel: periodContext.durationLabel,
      isMultiDay: periodContext.isMultiDay,
    },
    readiness,
    summary: {
      sales: pickBackendAmount(
        snapshot?.evidence?.financial?.net_sales,
        snapshot?.financial_summary?.net_sales,
        snapshot?.net_sales,
        detail?.net_sales,
      ),
      paymentsCollected: pickBackendAmount(
        snapshot?.evidence?.financial?.collections_total,
        snapshot?.financial_summary?.collections_total,
        snapshot?.cash_collected,
      ),
      creditSales: pickBackendAmount(
        snapshot?.evidence?.financial?.credit_sales,
        snapshot?.financial_summary?.credit_sales,
        detail?.credit_sales,
      ),
      creditCollections: pickBackendAmount(
        snapshot?.evidence?.financial?.credit_collections,
        snapshot?.financial_summary?.credit_collections,
        detail?.credit_collections,
      ),
      refunds: pickBackendAmount(
        snapshot?.evidence?.financial?.refund_total,
        snapshot?.refunds?.total,
        detail?.refund_total,
      ),
      expenses: pickBackendAmount(
        snapshot?.evidence?.financial?.expense_total,
        snapshot?.expense_total,
        detail?.expense_total,
      ),
      expectedCash: pickBackendAmount(
        snapshot?.drawer_control?.expected_cash,
        snapshot?.expected_cash,
        detail?.expected_cash,
      ),
    },
    cash: {
      expected: pickBackendAmount(
        snapshot?.drawer_control?.expected_cash,
        snapshot?.expected_cash,
        detail?.expected_cash,
      ),
      counted: pickBackendAmount(
        snapshot?.drawer_control?.counted_cash,
        detail?.counted_cash,
      ),
      difference: cashDifference,
      countSource,
      countSourceLabel: countSourceLabel(countSource),
      drawers,
    },
    blockers,
    warnings,
    information,
    capabilities,
    nextAction,
    canContinue,
  };
}

export interface DayCloseHistoryPresentation {
  id: number;
  businessDate: string;
  coveredRange: string;
  businessLine: string;
  status: string;
  sales?: number;
  cashDifference?: number;
  closedBy?: string;
  closedAt?: string;
  hasChanges: boolean;
}

export function presentDayCloseHistory(
  item: DayCloseListItem,
  options: {
    timezone?: string;
    closedBy?: string;
    closedAt?: string;
    reopenedCount?: number;
    adjustmentCount?: number;
  } = {},
): DayCloseHistoryPresentation {
  return {
    id: item.id,
    businessDate: formatDayCloseBusinessDate(
      item.business_date,
      options.timezone ?? item.timezone,
    ),
    coveredRange: formatDayClosePeriod(
      item.period_start_at,
      item.period_end_at,
      options.timezone ?? item.timezone,
    ),
    businessLine: String(item.business_line ?? "restaurant"),
    status: String(item.status),
    sales: item.net_sales,
    cashDifference: pickBackendAmount(item.cash_discrepancy),
    closedBy: options.closedBy,
    closedAt: options.closedAt,
    hasChanges:
      (options.reopenedCount ?? 0) > 0 || (options.adjustmentCount ?? 0) > 0,
  };
}
