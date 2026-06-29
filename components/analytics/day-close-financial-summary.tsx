"use client";

import {
  Building2,
  Landmark,
  ReceiptIndianRupee,
  Receipt,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DayCloseDetail, DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import {
  financialSummarySnapshotTab,
  snapshotFinancialSummaryRows,
  type DayCloseSnapshotTab,
} from "@/lib/day-close-snapshot-view";
import {
  DayCloseMetricCard,
  DC_METRIC_ACCENT_IN,
  DC_METRIC_ACCENT_OUT,
  DC_METRIC_ICON_IN,
  DC_METRIC_ICON_OUT,
  DC_METRIC_VALUE_IN,
  DC_METRIC_VALUE_OUT,
} from "@/components/analytics/day-close-metric-card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

type CashFlow = "in" | "out";

const FINANCIAL_SUMMARY_CARD: Record<
  string,
  { icon: typeof TrendingUp; flow: CashFlow }
> = {
  "Gross Sales": { icon: TrendingUp, flow: "in" },
  "Net Sales": { icon: Wallet, flow: "in" },
  "Total Income": { icon: TrendingUp, flow: "in" },
  Refunds: { icon: RotateCcw, flow: "out" },
  Expenses: { icon: Wallet, flow: "out" },
  "Opening Balance": { icon: Landmark, flow: "in" },
  "Credit Sales": { icon: Receipt, flow: "in" },
  "Credit Collection": { icon: TrendingUp, flow: "in" },
  "Outstanding Receivables": { icon: Building2, flow: "in" },
  "Expected Drawer": { icon: Landmark, flow: "in" },
  "Drawer (Actual)": { icon: Landmark, flow: "in" },
};

const FINANCIAL_SUMMARY_COPY: Record<
  string,
  {
    title: string;
    description: string;
    detail: string;
  }
> = {
  "Gross Sales": {
    title: "Gross Sales",
    description: "Detailed insights",
    detail: "Full billed sales before discounts, refunds, and cash-drawer reconciliation.",
  },
  "Net Sales": {
    title: "Net Sales",
    description: "Detailed insights",
    detail: "Order-side revenue after discounts, taxes, service charge, and refunds are applied.",
  },
  "Total Income": {
    title: "Total Income",
    description: "Detailed insights",
    detail: "Recognized income for the close window after net sales and manual income are combined.",
  },
  Refunds: {
    title: "Refunds",
    description: "Detailed insights",
    detail: "This shows how much money was refunded during this close window.",
  },
  Expenses: {
    title: "Expenses",
    description: "Detailed insights",
    detail: "This is the total of expense adjustments recorded against this day close.",
  },
  "Opening Balance": {
    title: "Opening Balance",
    description: "Detailed insights",
    detail:
      "This is the backend drawer opening cash for this close window. With drawer controls enabled, it comes from drawer evidence or the retained-float opening suggestion.",
  },
  "Credit Sales": {
    title: "Credit Sales",
    description: "Detailed insights",
    detail: "This is the order value moved to customer credit instead of being collected immediately.",
  },
  "Credit Collection": {
    title: "Credit Collection",
    description: "Detailed insights",
    detail: "This is money collected during this window against customer credit created earlier.",
  },
  "Outstanding Receivables": {
    title: "Outstanding Receivables",
    description: "Detailed insights",
    detail: "This is the unpaid amount still expected from chargeable or credit-based orders.",
  },
  "Expected Drawer": {
    title: "Expected Drawer",
    description: "Detailed insights",
    detail: "This is the cash the backend expects to be physically in the drawer for this business day.",
  },
  "Drawer (Actual)": {
    title: "Drawer (Actual)",
    description: "Detailed insights",
    detail: "This is the final drawer-counted cash recorded by the drawer workflow.",
  },
};

function amount(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function formulaMoney(value: number) {
  return formatDayCloseCurrency(value);
}

function namedFormula(parts: Array<{ label: string; value: number; sign?: "+" | "-" }>) {
  return parts
    .map((part, index) => {
      const prefix = index === 0 ? "" : ` ${part.sign ?? "+"} `;
      return `${prefix}${part.label} (${formulaMoney(part.value)})`;
    })
    .join("");
}

function buildFormula(
  label: string,
  snapshot: DayCloseSnapshotData,
  detail?: DayCloseDetail | null,
) {
  const grossSales = amount(snapshot.gross_sales, detail?.gross_sales);
  const discountTotal = amount(snapshot.discount_total, detail?.discount_total);
  const taxTotal = amount(snapshot.tax_total, detail?.tax_total);
  const serviceChargeTotal = amount(
    snapshot.service_charge_total,
    detail?.service_charge_total,
  );
  const refundTotal = amount(snapshot.refunds?.total, detail?.refund_total);
  const netSales = amount(snapshot.net_sales, detail?.net_sales);
  const manualIncomeTotal = amount(
    snapshot.manual_income_total,
    detail?.manual_cash_income,
  );
  const expenseTotal = amount(snapshot.expense_total, detail?.expense_total);
  const drawerControl =
    snapshot.drawer_control && typeof snapshot.drawer_control === "object"
      ? (snapshot.drawer_control as Record<string, unknown>)
      : null;
  const openingBalance = amount(
    drawerControl?.opening_cash,
    snapshot.opening_balance,
    detail?.opening_balance,
  );
  const creditSales = amount(
    snapshot.receivables?.credit_sales,
    detail?.credit_sales,
  );
  const creditCollections = amount(
    snapshot.receivables?.credit_collections,
    detail?.credit_collections,
  );
  const outstandingReceivables = amount(
    snapshot.receivables?.outstanding_receivables,
    detail?.outstanding_receivables,
  );
  const cashSales = amount(snapshot.cash_sales, detail?.cash_sales);
  const cashRefunds = amount(snapshot.refunds?.cash_refunds);
  const cashCreditCollections = amount(snapshot.receivables?.cash_credit_collections);
  const manualCashIncome = amount(
    snapshot.manual_cash_income,
    detail?.manual_cash_income,
  );
  const cashExpenseTotal = amount(snapshot.cash_expense_total);
  const expectedCash = amount(
    drawerControl?.expected_cash,
    snapshot.expected_cash,
    detail?.expected_cash,
  );
  const actualCash = amount(detail?.actual_cash);

  switch (label) {
    case "Gross Sales":
      return `Gross Sales = ${formulaMoney(grossSales)}`;
    case "Net Sales":
      return `${namedFormula([
        { label: "Gross Sales", value: grossSales },
        { label: "Discount", value: discountTotal, sign: "-" },
        { label: "Tax", value: taxTotal, sign: "+" },
        { label: "Service Charge", value: serviceChargeTotal, sign: "+" },
        { label: "Refunds", value: refundTotal, sign: "-" },
      ])} = Net Sales (${formulaMoney(netSales)})`;
    case "Total Income":
      return `${namedFormula([
        { label: "Net Sales", value: netSales },
        { label: "Manual Income", value: manualIncomeTotal, sign: "+" },
      ])} = Total Income (${formulaMoney(amount(snapshot.total_income, detail?.total_income))})`;
    case "Refunds":
      return `Refunds = ${formulaMoney(refundTotal)}`;
    case "Expenses":
      return `Expenses = ${formulaMoney(expenseTotal)}`;
    case "Opening Balance":
      if (drawerControl?.opening_required === true) {
        return `Suggested drawer opening float = ${formulaMoney(openingBalance)}`;
      }
      return `Opening Drawer Cash = ${formulaMoney(openingBalance)}`;
    case "Credit Sales":
      return `Credit Sales = ${formulaMoney(creditSales)}`;
    case "Credit Collection":
      return `Credit Collection = ${formulaMoney(creditCollections)}`;
    case "Outstanding Receivables":
      return `Outstanding Receivables = ${formulaMoney(outstandingReceivables)}`;
    case "Expected Drawer":
      if (drawerControl && drawerControl.expected_cash != null) {
        return `Current drawer sessions expected cash = ${formulaMoney(expectedCash)}`;
      }
      return `${namedFormula([
        { label: "Opening Balance", value: openingBalance },
        { label: "Cash Sales", value: cashSales, sign: "+" },
        { label: "Cash Refunds", value: cashRefunds, sign: "-" },
        { label: "Cash Credit Collections", value: cashCreditCollections, sign: "+" },
        { label: "Manual Cash Income", value: manualCashIncome, sign: "+" },
        { label: "Cash Expenses", value: cashExpenseTotal, sign: "-" },
      ])} = Expected Drawer (${formulaMoney(expectedCash)})`;
    case "Drawer (Actual)":
      return `Drawer (Actual) = ${formulaMoney(actualCash)}`;
    default:
      return null;
  }
}

function drawerSummaryHelper(label: string, snapshot: DayCloseSnapshotData) {
  const rows = Array.isArray(snapshot.drawer_control?.drawers)
    ? snapshot.drawer_control?.drawers ?? []
    : [];
  if (rows.length <= 1) return undefined;
  if (!["Opening Balance", "Expected Drawer", "Drawer (Actual)"].includes(label)) {
    return undefined;
  }
  const currentRows = rows.filter((row) => row?.is_current_session !== false);
  const drawerCount = currentRows.length > 0 ? currentRows.length : rows.length;
  return `${drawerCount} drawers combined`;
}

const FINANCIAL_SUMMARY_PRIMARY = new Set([
  "Gross Sales",
  "Net Sales",
  "Total Income",
  "Refunds",
]);

const FINANCIAL_SUMMARY_SECONDARY = new Set([
  "Expenses",
  "Opening Balance",
  "Credit Sales",
  "Credit Collection",
  "Outstanding Receivables",
  "Expected Drawer",
  "Drawer (Actual)",
]);

function FinancialSummaryCard({
  label,
  value,
  dense = false,
  onNavigate,
  snapshot,
  detail,
}: {
  label: string;
  value: number;
  dense?: boolean;
  onNavigate?: (tab: DayCloseSnapshotTab) => void;
  snapshot: DayCloseSnapshotData;
  detail?: DayCloseDetail | null;
}) {
  const config = FINANCIAL_SUMMARY_CARD[label];
  const copy = FINANCIAL_SUMMARY_COPY[label];
  const Icon = config?.icon;
  const isOut = config?.flow === "out";
  const targetTab = onNavigate ? financialSummarySnapshotTab(label) : null;
  const formula = buildFormula(label, snapshot, detail);
  const card = (
    <DayCloseMetricCard
      compact
      dense={dense}
      label={label}
      value={formatDayCloseCurrency(value)}
      helperText={drawerSummaryHelper(label, snapshot)}
      icon={Icon ? <Icon className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} /> : undefined}
      iconPosition="top-right"
      iconClassName={isOut ? DC_METRIC_ICON_OUT : DC_METRIC_ICON_IN}
      accent={isOut ? DC_METRIC_ACCENT_OUT : DC_METRIC_ACCENT_IN}
      valueClassName={isOut ? DC_METRIC_VALUE_OUT : DC_METRIC_VALUE_IN}
      className="h-full min-w-0"
      onClick={targetTab && onNavigate ? () => onNavigate(targetTab) : undefined}
    />
  );

  if (!copy || !Icon) return card;

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div className="group block">{card}</div>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="z-[80] w-[max(320px,var(--radix-hover-card-trigger-width))] overflow-hidden rounded-2xl border-border/40 bg-card p-0 shadow-xl"
      >
        <div className="flex items-start gap-4 border-b border-border/40 p-5">
          <div
            className={cn(
              "rounded-full bg-muted/30 p-2.5",
              isOut ? "text-destructive" : "text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-foreground">
              {copy.title}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {copy.description}
            </p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {copy.detail}
          </p>
          {formula ? (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[12px] uppercase tracking-[0.2em] text-muted-foreground">
                Live Formula
              </p>
              <p className="mt-1.5 font-mono text-[12.5px] leading-relaxed text-foreground/90">
                {formula}
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-border/40 bg-card px-5 py-4">
          <span className="text-[13px] text-muted-foreground">Current value</span>
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[13px] font-medium",
              isOut ? "text-destructive" : "text-foreground",
            )}
          >
            <ReceiptIndianRupee className="h-4 w-4" />
            {formatDayCloseCurrency(value)}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

type DayCloseFinancialSummaryProps = {
  snapshot: DayCloseSnapshotData;
  detail?: DayCloseDetail | null;
  showTitle?: boolean;
  /** Tighter grid for day-close dialog minimized view */
  compact?: boolean;
  /** Opens the matching snapshot breakdown tab when a card is clicked. */
  onMetricNavigate?: (tab: DayCloseSnapshotTab) => void;
};

export function DayCloseFinancialSummary({
  snapshot,
  detail,
  showTitle = true,
  compact = false,
  onMetricNavigate,
}: DayCloseFinancialSummaryProps) {
  const rows = snapshotFinancialSummaryRows(snapshot, detail);
  if (rows.length === 0) return null;

  const primaryRows = rows.filter((row) => FINANCIAL_SUMMARY_PRIMARY.has(row.label));
  const secondaryRows = rows.filter((row) => FINANCIAL_SUMMARY_SECONDARY.has(row.label));

  if (compact) {
    return (
      <section className="space-y-3">
        {showTitle ? <h4 className="dc-section-title">Financial Summary</h4> : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-stretch pt-1">
          {rows.map((row) => (
            <FinancialSummaryCard
              key={row.label}
              label={row.label}
              value={row.value!}
              dense
              onNavigate={onMetricNavigate}
              snapshot={snapshot}
              detail={detail}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {showTitle ? <h4 className="dc-section-title">Financial Summary</h4> : null}
      <div className="space-y-4">
        {primaryRows.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch pt-1">
            {primaryRows.map((row) => (
              <FinancialSummaryCard
                key={row.label}
                label={row.label}
                value={row.value!}
                onNavigate={onMetricNavigate}
                snapshot={snapshot}
                detail={detail}
              />
            ))}
          </div>
        ) : null}
        {secondaryRows.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-stretch pt-1">
            {secondaryRows.map((row) => (
              <FinancialSummaryCard
                key={row.label}
                label={row.label}
                value={row.value!}
                dense
                onNavigate={onMetricNavigate}
                snapshot={snapshot}
                detail={detail}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
