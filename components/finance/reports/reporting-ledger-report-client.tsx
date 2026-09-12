"use client";

import {
  Suspense,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";

import { FinanceReportNavigation } from "@/components/finance/reports/finance-report-navigation";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { ReportFilters } from "@/components/reports/report-filters";
import { AccountLedgerPanel } from "@/components/finance/reports/account-ledger-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import type {
  FinanceCustodyReconciliationRead,
  FinanceReportingAccountLedgerRead,
  FinanceReportingBalanceSheetRead,
  FinanceReportingCashFlowRead,
  FinanceReportingClosureSummary,
  FinanceReportingHeadAmount,
  FinanceReportingMoney,
  FinanceReportingProfitLossRead,
  FinanceReportingHeadActivityRead,
  FinanceReportingPartyBalancesRead,
  FinanceReportingTrialBalanceRead,
  FinanceReportingTrialBalanceRow,
} from "@/types/finance-reporting";

export type ReportingLedgerReportMode =
  | "profit-and-loss"
  | "trial-balance"
  | "account-ledger"
  | "custody-reconciliation"
  | "balance-sheet"
  | "party-balances"
  | "cash-flow";

type ReportingLedgerReport =
  | FinanceReportingProfitLossRead
  | FinanceReportingTrialBalanceRead
  | FinanceReportingAccountLedgerRead
  | FinanceCustodyReconciliationRead
  | FinanceReportingBalanceSheetRead
  | FinanceReportingPartyBalancesRead
  | FinanceReportingCashFlowRead
  | FinanceReportingHeadActivityRead;

const modeMeta: Record<
  ReportingLedgerReportMode,
  { title: string; description: string }
> = {
  "profit-and-loss": {
    title: "Profit & Loss",
    description:
      "Income and expenses posted to account heads for the selected business period.",
  },
  "trial-balance": {
    title: "Trial Balance",
    description:
      "Opening, period, and closing debit and credit balances across the reporting hierarchy.",
  },
  "account-ledger": {
    title: "Accounts",
    description:
      "Balances grouped by your account structure. Open an account to review the business activity behind it.",
  },
  "custody-reconciliation": {
    title: "Custody Reconciliation",
    description:
      "Compare live cash and bank balances with their linked reporting-head balances.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description:
      "Assets, liabilities, and equity balances as of a selected business date.",
  },
  "party-balances": {
    title: "Party Balances",
    description:
      "Outstanding customer receivables and supplier or staff payables by party.",
  },
  "cash-flow": {
    title: "Cash Flow",
    description:
      "Cash inflows and outflows classified by operating, investing, and financing activity.",
  },
};

function localDate(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const date = new Date();
  date.setDate(1);
  return localDate(date);
}

function periodLabel(dateFrom: string, dateTo: string) {
  const format = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };

  return dateFrom === dateTo
    ? format(dateFrom)
    : `${format(dateFrom)} - ${format(dateTo)}`;
}

function asNumber(value: FinanceReportingMoney | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: FinanceReportingMoney | null | undefined) {
  return `NPR ${asNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail =
      error.response?.data?.detail ?? error.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "The report could not be loaded. Please try again.";
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 truncate text-lg font-semibold tabular-nums sm:text-xl",
            tone === "positive" && "text-emerald-600",
            tone === "negative" && "text-rose-600",
            tone === "warning" && "text-amber-600",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ClosureNotice({
  closure,
}: {
  closure: FinanceReportingClosureSummary;
}) {
  if (closure.unconfirmed_day_count === 0 && closure.reopened_day_count === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        This period is confirmed. Figures are final.
      </div>
    );
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Figures may still change</AlertTitle>
      <AlertDescription>
        Some business days are still open. Confirm day close to finalise this
        report.
      </AlertDescription>
    </Alert>
  );
}

function LoadingReport() {
  return (
    <div className="space-y-4" aria-label="Loading finance report">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function EmptyReport({ message }: { message: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-2 border border-dashed p-8 text-center">
      <Search className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">No report activity</p>
      <p className="max-w-lg text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function HeadAmountTable({
  title,
  rows,
  onSelectHead,
}: {
  title: string;
  rows: FinanceReportingHeadAmount[];
  onSelectHead: (headId: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} posted.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <button
                  key={row.head_id}
                  type="button"
                  onClick={() => onSelectHead(row.head_id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {row.code}
                    </span>
                    <span className="font-medium">{row.name}</span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold tabular-nums">
                    {money(row.amount)}
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account head</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.head_id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                      onClick={() => onSelectHead(row.head_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectHead(row.head_id);
                        }
                      }}
                    >
                      <TableCell>
                        <span
                          className="font-medium hover:text-primary hover:underline"
                          style={{
                            paddingLeft: `${Math.max(0, row.depth - 1) * 12}px`,
                          }}
                        >
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            {row.code}
                          </span>
                          {row.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LegacyProfitAndLossView({
  report,
  onSelectHead,
}: {
  report: FinanceReportingProfitLossRead;
  onSelectHead: (headId: number) => void;
}) {
  const netRevenue =
    asNumber(report.total_income) - asNumber(report.total_contra_income);
  const netProfit = asNumber(report.net_profit);
  const inventory = report.inventory_reconciliation;
  const otherReductions = asNumber(inventory?.other_inventory_reductions);
  const hasRows =
    report.income.length +
      report.contra_income.length +
      report.expenses.length >
    0;

  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Gross income" value={money(report.total_income)} />
        <MetricCard
          label="Contra income"
          value={money(report.total_contra_income)}
        />
        <MetricCard label="Net income" value={money(netRevenue)} />
        <MetricCard label="Expenses" value={money(report.total_expenses)} />
        <MetricCard
          label={netProfit >= 0 ? "Net profit" : "Net loss"}
          value={money(Math.abs(netProfit))}
          tone={netProfit >= 0 ? "positive" : "negative"}
        />
      </div>
      {inventory ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              How inventory cost was calculated
            </CardTitle>
            <CardDescription>
              Automatic perpetual inventory: stock purchases increase inventory,
              and recorded usage reduces it and recognizes cost of goods sold.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Opening inventory"
                value={money(inventory.opening_inventory)}
              />
              <MetricCard
                label="+ Stock added"
                value={money(inventory.stock_additions)}
              />
              <MetricCard
                label="− Closing inventory"
                value={money(inventory.closing_inventory)}
              />
              <MetricCard
                label="= Stock used / reduced"
                value={money(inventory.calculated_stock_used)}
              />
              <MetricCard
                label="Recognized COGS"
                value={money(inventory.recognized_cogs)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock added includes purchases and positive corrections. Stock
              used/reduced is calculated automatically; no manual closing-stock
              journal is required.
              {Math.abs(otherReductions) >= 0.005
                ? ` The ${money(Math.abs(otherReductions))} difference from COGS is from returns, wastage, reversals, or stock-count adjustments.`
                : " It matches the COGS recognized from recorded consumption."}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {!hasRows ? (
        <EmptyReport message="No posted income or expense lines match this period and business line." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <HeadAmountTable
            title="Income"
            rows={report.income}
            onSelectHead={onSelectHead}
          />
          <HeadAmountTable
            title="Contra income"
            rows={report.contra_income}
            onSelectHead={onSelectHead}
          />
          <div className="xl:col-span-2">
            <HeadAmountTable
              title="Expenses"
              rows={report.expenses}
              onSelectHead={onSelectHead}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfitAndLossView({
  report,
  onSelectHead,
}: {
  report: FinanceReportingProfitLossRead;
  onSelectHead: (headId: number) => void;
}) {
  const netRevenue =
    asNumber(report.total_income) - asNumber(report.total_contra_income);
  const netProfit = asNumber(report.net_profit);
  const inventory = report.inventory_reconciliation;
  const recognizedCogs = asNumber(inventory?.recognized_cogs);
  const grossProfit = netRevenue - recognizedCogs;
  const grossMargin =
    netRevenue === 0 ? null : (grossProfit / netRevenue) * 100;
  const operatingExpenses = asNumber(report.total_expenses) - recognizedCogs;
  const hasRows =
    report.income.length +
      report.contra_income.length +
      report.expenses.length >
    0;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    income: true,
    contra: true,
    cogs: true,
    expenses: true,
    accounts: true,
  });
  const [inventoryDetailsOpen, setInventoryDetailsOpen] = useState(false);

  const toggle = (id: string) =>
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  const accountRows = (
    rows: FinanceReportingHeadAmount[],
    hierarchy: "income" | "contra" | "expense",
  ) => {
    const rowsById = new Map(rows.map((row) => [row.head_id, row]));
    const childrenByParent = new Map<number, FinanceReportingHeadAmount[]>();
    const roots: FinanceReportingHeadAmount[] = [];

    for (const row of rows) {
      if (row.parent_id && rowsById.has(row.parent_id)) {
        childrenByParent.set(row.parent_id, [
          ...(childrenByParent.get(row.parent_id) || []),
          row,
        ]);
      } else {
        roots.push(row);
      }
    }

    const suppressedCodes = new Set(
      hierarchy === "income"
        ? ["INCOME", "INC-REV"]
        : hierarchy === "contra"
          ? ["INC-ADJ"]
          : ["EXPENSES"],
    );
    const visibleRows: Array<{
      row: FinanceReportingHeadAmount;
      depth: number;
      hasChildren: boolean;
    }> = [];
    const visit = (
      row: FinanceReportingHeadAmount,
      depth: number,
      seen: Set<number>,
    ) => {
      if (seen.has(row.head_id)) return;
      seen.add(row.head_id);
      const children = childrenByParent.get(row.head_id) || [];
      const suppress = suppressedCodes.has(row.code);
      if (!suppress)
        visibleRows.push({ row, depth, hasChildren: children.length > 0 });
      for (const child of children)
        visit(child, suppress ? depth : depth + 1, seen);
    };

    const seen = new Set<number>();
    for (const root of roots) visit(root, 0, seen);
    for (const row of rows) visit(row, 0, seen);

    return (
      <div className="divide-y divide-border/70">
        {visibleRows.map(({ row, depth, hasChildren }) => (
          <button
            key={row.head_id}
            type="button"
            onClick={() => onSelectHead(row.head_id)}
            className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/45 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-4"
            style={{ paddingLeft: `${28 + depth * 16}px` }}
          >
            <span className="min-w-0">
              <span
                className={cn(
                  "block break-words text-sm leading-5 text-foreground",
                  hasChildren ? "font-semibold" : "font-medium",
                )}
              >
                {row.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {row.code}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
              {money(row.amount)}
            </span>
          </button>
        ))}
      </div>
    );
  };
  const section = ({
    id,
    label,
    amount,
    rows,
    hierarchy,
    description,
    children,
  }: {
    id: string;
    label: string;
    amount: number;
    rows?: FinanceReportingHeadAmount[];
    hierarchy?: "income" | "contra" | "expense";
    description?: string;
    children?: ReactNode;
  }) => {
    const canExpand = Boolean((rows && rows.length) || children);
    const contentId = `profit-loss-${id}`;
    return (
      <section className="border-b border-border last:border-b-0">
        <button
          type="button"
          onClick={() => canExpand && toggle(id)}
          aria-expanded={canExpand ? expanded[id] : undefined}
          aria-controls={canExpand ? contentId : undefined}
          disabled={!canExpand}
          className={cn(
            "grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left sm:px-4",
            canExpand &&
              "cursor-pointer hover:bg-muted/45 focus-visible:bg-muted/50 focus-visible:outline-none",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {canExpand ? (
              expanded[id] ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {label}
              </span>
              {description ? (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
            {money(amount)}
          </span>
        </button>
        {canExpand && expanded[id] ? (
          <div id={contentId} className="bg-muted/20">
            {rows ? accountRows(rows, hierarchy || "expense") : children}
          </div>
        ) : null}
      </section>
    );
  };
  const subtotal = ({
    label,
    amount,
    detail,
    final = false,
  }: {
    label: string;
    amount: number;
    detail?: string;
    final?: boolean;
  }) => (
    <div
      className={cn(
        "grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y px-3 py-3 sm:px-4",
        final
          ? amount >= 0
            ? "border-emerald-500/25 bg-emerald-500/10"
            : "border-destructive/25 bg-destructive/10"
          : "border-border bg-muted/45",
      )}
    >
      <span className="min-w-0">
        <span
          className={cn("block text-sm font-semibold", final && "text-base")}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-sm font-semibold tabular-nums",
          final && "text-base",
          final && amount < 0 && "text-destructive",
          final && amount >= 0 && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {money(amount)}
      </span>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
        <CardHeader className="border-b bg-muted/25 px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-semibold">
            Financial summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div className="flex items-baseline justify-between gap-3 lg:block">
            <span className="text-xs text-muted-foreground">Net revenue</span>
            <span className="text-sm font-semibold tabular-nums lg:mt-1 lg:block">
              {money(netRevenue)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 lg:block">
            <span className="text-xs text-muted-foreground">Gross profit</span>
            <span className="text-sm font-semibold tabular-nums lg:mt-1 lg:block">
              {money(grossProfit)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 lg:block">
            <span className="text-xs text-muted-foreground">Expenses</span>
            <span className="text-sm font-semibold tabular-nums lg:mt-1 lg:block">
              {money(report.total_expenses)}
            </span>
          </div>
          <div className="col-span-full grid gap-2 border-t border-border pt-3 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <span className="text-xs text-muted-foreground">
              {netProfit >= 0 ? "Net profit" : "Net loss"}
            </span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums lg:mt-1 lg:block",
                netProfit >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {money(netProfit)}
            </span>
            {grossMargin !== null ? (
              <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground lg:block">
                <span>Gross margin</span>
                <span className="font-medium tabular-nums text-foreground lg:mt-0.5 lg:block">
                  {grossMargin.toFixed(1)}%
                </span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {!hasRows ? (
        <EmptyReport message="No posted income or expense lines match this period and business line." />
      ) : (
        <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b bg-muted/25 px-4 py-3 sm:px-5">
            <div>
              <CardTitle className="text-base">Statement</CardTitle>
              <CardDescription className="mt-0.5 hidden text-xs md:block">
                Select an account to review its activity.
              </CardDescription>
            </div>
            <span className="hidden text-xs font-medium text-muted-foreground md:block">
              Amount
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {section({
              id: "income",
              label: "Revenue",
              amount: asNumber(report.total_income),
              rows: report.income,
              hierarchy: "income",
            })}
            {report.contra_income.length > 0 ||
            Math.abs(asNumber(report.total_contra_income)) > 0.004
              ? section({
                  id: "contra",
                  label: "Contra revenue",
                  amount: asNumber(report.total_contra_income),
                  rows: report.contra_income,
                  hierarchy: "contra",
                })
              : null}
            {subtotal({
              label: "Net revenue",
              amount: netRevenue,
              detail: "Revenue less returns and adjustments",
            })}
            {section({
              id: "cogs",
              label: "Cost of goods sold",
              amount: recognizedCogs,
              description: "Recognised from recorded inventory consumption",
              children: inventory ? (
                <div className="px-3 py-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setInventoryDetailsOpen((open) => !open)}
                    aria-expanded={inventoryDetailsOpen}
                    aria-controls="inventory-cost-details"
                    className="flex min-h-10 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {inventoryDetailsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Inventory cost details
                  </button>
                  {inventoryDetailsOpen ? (
                    <div
                      id="inventory-cost-details"
                      className="mt-2 divide-y rounded-xl border bg-background"
                    >
                      {[
                        ["Opening inventory", inventory.opening_inventory],
                        ["Stock added", inventory.stock_additions],
                        ["Closing inventory", inventory.closing_inventory],
                        [
                          "Stock used / reduced",
                          inventory.calculated_stock_used,
                        ],
                        ["Recognised COGS", inventory.recognized_cogs],
                      ].map(([label, value], index) => (
                        <div
                          key={String(label)}
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-sm",
                            index === 4 && "border-t-2 font-semibold",
                          )}
                        >
                          <span>{label}</span>
                          <span className="text-right tabular-nums">
                            {money(value as FinanceReportingMoney)}
                          </span>
                        </div>
                      ))}
                      <p className="px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                        This is a perpetual-inventory reconciliation. Stock
                        additions include purchases and positive corrections;
                        other reductions remain recognised through the existing
                        accounting engine.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null,
            })}
            {subtotal({
              label: "Gross profit",
              amount: grossProfit,
              detail:
                grossMargin !== null
                  ? `Gross margin ${grossMargin.toFixed(1)}%`
                  : undefined,
            })}
            {section({
              id: "expenses",
              label: "Expenses excluding recognised COGS",
              amount: operatingExpenses,
              description: "Total expenses excluding recognised COGS",
            })}
            <div className="border-b border-border bg-muted/20 px-3 py-2.5 text-xs leading-5 text-muted-foreground sm:px-4">
              Detailed expense accounts include Cost of Goods Sold for audit.
            </div>
            {section({
              id: "accounts",
              label: "Expense account hierarchy",
              amount: asNumber(report.total_expenses),
              rows: report.expenses,
              hierarchy: "expense",
              description: "Includes Cost of Goods Sold",
            })}
            {subtotal({
              label: netProfit >= 0 ? "Net profit" : "Net loss",
              amount: netProfit,
              final: true,
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TrialBalanceView({
  report,
  onSelectHead,
}: {
  report: FinanceReportingTrialBalanceRead;
  onSelectHead: (headId: number) => void;
}) {
  const difference = Math.abs(
    asNumber(report.total_closing_debit) -
      asNumber(report.total_closing_credit),
  );
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Period debits"
          value={money(report.total_period_debit)}
        />
        <MetricCard
          label="Period credits"
          value={money(report.total_period_credit)}
        />
        <MetricCard
          label="Closing debits"
          value={money(report.total_closing_debit)}
        />
        <MetricCard
          label={report.is_balanced ? "Balanced" : "Difference"}
          value={
            report.is_balanced
              ? money(report.total_closing_credit)
              : money(difference)
          }
          tone={report.is_balanced ? "positive" : "negative"}
        />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No account-head balances match these filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {report.rows.map((row) => (
                <button
                  key={row.head_id}
                  type="button"
                  disabled={!row.is_postable}
                  onClick={() => row.is_postable && onSelectHead(row.head_id)}
                  className={cn(
                    "w-full px-4 py-3 text-left",
                    row.is_postable
                      ? "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      : "bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {row.code}
                        </span>
                        {row.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Opening {money(row.opening_debit)} Dr ·{" "}
                        {money(row.opening_credit)} Cr
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {money(
                        asNumber(row.closing_debit) -
                          asNumber(row.closing_credit),
                      )}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>
                      Period Dr{" "}
                      <b className="ml-1 text-foreground">
                        {money(row.period_debit)}
                      </b>
                    </span>
                    <span>
                      Period Cr{" "}
                      <b className="ml-1 text-foreground">
                        {money(row.period_credit)}
                      </b>
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Account head</TableHead>
                    <TableHead className="text-right">Opening Dr</TableHead>
                    <TableHead className="text-right">Opening Cr</TableHead>
                    <TableHead className="text-right">Period Dr</TableHead>
                    <TableHead className="text-right">Period Cr</TableHead>
                    <TableHead className="text-right">Closing Dr</TableHead>
                    <TableHead className="text-right">Closing Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow
                      key={row.head_id}
                      role={row.is_postable ? "button" : undefined}
                      tabIndex={row.is_postable ? 0 : undefined}
                      onClick={() =>
                        row.is_postable && onSelectHead(row.head_id)
                      }
                      onKeyDown={(event) => {
                        if (
                          row.is_postable &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          onSelectHead(row.head_id);
                        }
                      }}
                      className={cn(
                        row.is_postable &&
                          "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none",
                        !row.is_postable && "bg-muted/30 font-semibold",
                      )}
                    >
                      <TableCell>
                        <div style={{ paddingLeft: `${row.depth * 14}px` }}>
                          {row.is_postable ? (
                            <span className="hover:text-primary hover:underline">
                              <span className="mr-2 font-mono text-xs text-muted-foreground">
                                {row.code}
                              </span>
                              {row.name}
                            </span>
                          ) : (
                            <>
                              <span className="mr-2 font-mono text-xs text-muted-foreground">
                                {row.code}
                              </span>
                              {row.name}
                            </>
                          )}
                          <span className="ml-2 text-[11px] font-normal uppercase text-muted-foreground">
                            {row.head_type}
                          </span>
                        </div>
                      </TableCell>
                      {[
                        row.opening_debit,
                        row.opening_credit,
                        row.period_debit,
                        row.period_credit,
                        row.closing_debit,
                        row.closing_credit,
                      ].map((value, index) => (
                        <TableCell
                          key={index}
                          className="text-right font-mono tabular-nums"
                        >
                          {money(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total</TableCell>
                    {[
                      report.total_opening_debit,
                      report.total_opening_credit,
                      report.total_period_debit,
                      report.total_period_credit,
                      report.total_closing_debit,
                      report.total_closing_credit,
                    ].map((value, index) => (
                      <TableCell
                        key={index}
                        className="text-right font-mono tabular-nums"
                      >
                        {money(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountLedgerListView({
  report,
  search,
  onSelectHead,
}: {
  report: FinanceReportingHeadActivityRead;
  search: string;
  onSelectHead: (headId: number) => void;
}) {
  const query = search.trim().toLowerCase();
  const rows = query
    ? report.rows.filter((row) =>
        `${row.code} ${row.name}`.toLowerCase().includes(query),
      )
    : report.rows;
  const allRowsById = new Map(report.rows.map((row) => [row.head_id, row]));
  const hasMovement = (row: FinanceReportingTrialBalanceRow) =>
    [
      row.opening_debit,
      row.opening_credit,
      row.period_debit,
      row.period_credit,
      row.closing_debit,
      row.closing_credit,
    ].some((value) => Math.abs(asNumber(value)) > 0.004);
  const isTechnical = (row: FinanceReportingTrialBalanceRow) =>
    /^(SYS-|EQ-|ADV-|COGS-|COMP-|DEPOSITS|DISC|INV-|PAYROLL|TAX-|TEST-|VARIANCE|WASTAGE)/i.test(
      row.code,
    ) ||
    /retained earnings|owner equity|suspense|cash over|cash short|cash in transit|complimentary/i.test(
      row.name,
    );
  const ancestorsFor = (row: FinanceReportingTrialBalanceRow) => {
    const ancestors: FinanceReportingTrialBalanceRow[] = [];
    const seen = new Set<number>();
    let parentId = row.parent_id;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = allRowsById.get(parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      parentId = parent.parent_id;
    }
    return ancestors;
  };
  const groupFor = (row: FinanceReportingTrialBalanceRow) => {
    const hierarchy = [...ancestorsFor(row), row];
    const nonRoot = hierarchy.filter(
      (candidate) =>
        candidate.name.toLowerCase() !== row.head_type.toLowerCase(),
    );
    return {
      group: nonRoot[0]?.name || humanize(row.head_type),
      context: nonRoot
        .slice(1, -1)
        .map((candidate) => candidate.name)
        .join(" / "),
    };
  };
  const postableRows = rows.filter(
    (row) =>
      row.is_postable &&
      (Boolean(query) || (!isTechnical(row) && hasMovement(row))),
  );
  const groupedRows = Array.from(
    postableRows.reduce<
      Map<string, { row: FinanceReportingTrialBalanceRow; context: string }[]>
    >((result, row) => {
      const { group, context } = groupFor(row);
      result.set(group, [...(result.get(group) || []), { row, context }]);
      return result;
    }, new Map()),
  ).flatMap(([group, accounts]) => [
    { kind: "group" as const, group },
    ...accounts.map((account) => ({ kind: "account" as const, ...account })),
  ]);

  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Operational accounts</p>
        <p className="mt-0.5">
          {postableRows.length} active account
          {postableRows.length === 1 ? "" : "s"}
          {query
            ? ` matching "${search.trim()}"`
            : ". Zero-balance and technical system accounts stay in Chart of accounts."}
        </p>
      </div>
      {postableRows.length === 0 ? (
        <EmptyReport message="No accounts match your search or filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {groupedRows.map((item) => {
                if (item.kind === "group") {
                  return (
                    <div
                      key={`mobile-group:${item.group}`}
                      className="bg-muted/35 px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      {item.group}
                    </div>
                  );
                }
                const { row, context } = item;
                const closing =
                  asNumber(row.closing_debit) - asNumber(row.closing_credit);
                return (
                  <button
                    key={row.head_id}
                    type="button"
                    onClick={() => onSelectHead(row.head_id)}
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {context || `${row.code} · ${humanize(row.head_type)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs text-muted-foreground">
                        Closing
                      </span>
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {money(closing)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-64">Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRows.map((item) => {
                    if (item.kind === "group") {
                      return (
                        <TableRow
                          key={`group:${item.group}`}
                          className="bg-muted/35 hover:bg-muted/35"
                        >
                          <TableCell
                            colSpan={6}
                            className="py-2 text-xs font-semibold text-muted-foreground"
                          >
                            {item.group}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const { row, context } = item;
                    const opening =
                      asNumber(row.opening_debit) -
                      asNumber(row.opening_credit);
                    const closing =
                      asNumber(row.closing_debit) -
                      asNumber(row.closing_credit);
                    return (
                      <TableRow
                        key={row.head_id}
                        className="cursor-pointer"
                        onClick={() => onSelectHead(row.head_id)}
                      >
                        <TableCell>
                          <div className="font-medium hover:text-primary hover:underline">
                            {row.name}
                          </div>
                          {context ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {context}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {humanize(row.head_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {money(opening)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-emerald-600">
                          {row.period_debit && asNumber(row.period_debit)
                            ? money(row.period_debit)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-rose-600">
                          {row.period_credit && asNumber(row.period_credit)
                            ? money(row.period_credit)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {money(closing)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CustodyReconciliationView({
  report,
  onSelectHead,
}: {
  report: FinanceCustodyReconciliationRead;
  onSelectHead: (headId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Live custody snapshot for business date {report.as_of_date}</span>
        <span>Generated {dateTime(report.snapshot_at)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Custody balances"
          value={money(report.total_custody_balance)}
        />
        <MetricCard
          label="Reporting balances"
          value={money(report.total_reporting_balance)}
        />
        <MetricCard
          label="Difference"
          value={money(report.total_difference)}
          tone={report.balanced ? "positive" : "negative"}
        />
        <MetricCard
          label="Unlinked accounts"
          value={String(report.unlinked_count)}
          tone={report.unlinked_count ? "warning" : "positive"}
        />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No cash drawers, bank accounts, or custom custody accounts are configured." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {report.rows.map((row) => (
                <button
                  key={`${row.account_type}:${row.account_id}`}
                  type="button"
                  disabled={!row.reporting_head_id}
                  onClick={() =>
                    row.reporting_head_id && onSelectHead(row.reporting_head_id)
                  }
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-default focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {row.account_name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {row.reporting_head_name || "Not linked"} ·{" "}
                      {humanize(row.status)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-sm font-semibold tabular-nums",
                      Math.abs(asNumber(row.difference)) > 0.005 &&
                        "text-rose-600",
                    )}
                  >
                    {money(row.difference)}
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-52">Custody account</TableHead>
                    <TableHead className="min-w-52">Reporting head</TableHead>
                    <TableHead className="text-right">
                      Custody balance
                    </TableHead>
                    <TableHead className="text-right">
                      Reporting balance
                    </TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={`${row.account_type}:${row.account_id}`}>
                      <TableCell>
                        <div className="font-medium">{row.account_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {humanize(row.account_type)} ·{" "}
                          {humanize(row.account_subtype)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.reporting_head_id ? (
                          <button
                            type="button"
                            onClick={() => onSelectHead(row.reporting_head_id!)}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {row.reporting_head_name ||
                              `Head #${row.reporting_head_id}`}
                          </button>
                        ) : (
                          <span className="text-amber-600">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(row.custody_balance)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {money(row.reporting_balance)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono font-semibold tabular-nums",
                          Math.abs(asNumber(row.difference)) > 0.005 &&
                            "text-rose-600",
                        )}
                      >
                        {money(row.difference)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "balanced"
                              ? "success"
                              : row.status === "unlinked"
                                ? "warning"
                                : "destructive"
                          }
                        >
                          {humanize(row.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BalanceSheetView({
  report,
  dateTo,
  onSelectHead,
}: {
  report: FinanceReportingBalanceSheetRead;
  dateTo: string;
  onSelectHead: (headId: number) => void;
}) {
  const hasRows =
    report.assets.length + report.liabilities.length + report.equity.length > 0;
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <p className="text-sm text-muted-foreground">
        Balances as of {report.as_of_date || dateTo}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Assets" value={money(report.total_assets)} />
        <MetricCard
          label="Liabilities"
          value={money(report.total_liabilities)}
        />
        <MetricCard label="Equity" value={money(report.total_equity)} />
        <MetricCard
          label="Current earnings"
          value={money(report.current_earnings)}
        />
        <MetricCard
          label={report.is_balanced ? "Balanced total" : "Difference"}
          value={
            report.is_balanced
              ? money(report.total_liabilities_and_equity)
              : money(report.difference)
          }
          tone={report.is_balanced ? "positive" : "negative"}
        />
      </div>
      {!hasRows ? (
        <EmptyReport message="No asset, liability, or equity balances exist as of this date." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <HeadAmountTable
            title="Assets"
            rows={report.assets}
            onSelectHead={onSelectHead}
          />
          <div className="space-y-4">
            <HeadAmountTable
              title="Liabilities"
              rows={report.liabilities}
              onSelectHead={onSelectHead}
            />
            <HeadAmountTable
              title="Equity"
              rows={report.equity}
              onSelectHead={onSelectHead}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PartyBalancesView({
  report,
  dateTo,
  onSelectHead,
}: {
  report: FinanceReportingPartyBalancesRead;
  dateTo: string;
  onSelectHead: (headId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Outstanding balances as of {report.as_of_date || dateTo}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Receivables"
          value={money(report.total_receivables)}
          tone="positive"
        />
        <MetricCard
          label="Payables"
          value={money(report.total_payables)}
          tone="warning"
        />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No outstanding party receivables or payables match these filters." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {report.rows.map((row) => (
                <button
                  key={`${row.party_type}:${row.party_id}:${row.reporting_head_id}`}
                  type="button"
                  onClick={() => onSelectHead(row.reporting_head_id)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {row.party_name ||
                        `${humanize(row.party_type)} #${row.party_id}`}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {humanize(row.balance_type)} · {row.reporting_head_name}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {money(row.balance)}
                  </span>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">Party</TableHead>
                    <TableHead>Balance type</TableHead>
                    <TableHead className="min-w-52">Account head</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow
                      key={`${row.party_type}:${row.party_id}:${row.reporting_head_id}`}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {row.party_name ||
                            `${humanize(row.party_type)} #${row.party_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {humanize(row.party_type)} · ID {row.party_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.balance_type === "receivable"
                              ? "info"
                              : "warning"
                          }
                        >
                          {humanize(row.balance_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onSelectHead(row.reporting_head_id)}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {row.reporting_head_name}
                        </button>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {money(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CashFlowView({ report }: { report: FinanceReportingCashFlowRead }) {
  const net = asNumber(report.net_cash_flow);
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Operating" value={money(report.operating_net)} />
        <MetricCard label="Investing" value={money(report.investing_net)} />
        <MetricCard label="Financing" value={money(report.financing_net)} />
        <MetricCard
          label="Net cash flow"
          value={money(report.net_cash_flow)}
          tone={net >= 0 ? "positive" : "negative"}
        />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No custody-linked inflows or outflows match this period." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border md:hidden">
              {report.rows.map((row) => (
                <div
                  key={`${row.activity_type}:${row.source_type}`}
                  className="flex min-h-16 items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {humanize(row.source_type)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {humanize(row.activity_type)} · In {money(row.inflow)} ·
                      Out {money(row.outflow)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {money(row.net_cash_flow)}
                  </span>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">Source</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Inflows</TableHead>
                    <TableHead className="text-right">Outflows</TableHead>
                    <TableHead className="text-right">Net cash flow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row) => (
                    <TableRow key={`${row.activity_type}:${row.source_type}`}>
                      <TableCell className="font-medium">
                        {humanize(row.source_type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {humanize(row.activity_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 tabular-nums">
                        {money(row.inflow)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-600 tabular-nums">
                        {money(row.outflow)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {money(row.net_cash_flow)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportingLedgerReportContent({
  mode,
}: {
  mode: ReportingLedgerReportMode;
}) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = modeMeta[mode];
  const canView = hasPermission(user, "finance.coa.view");
  const [dateFrom, setDateFrom] = useState(
    () => searchParams.get("date_from") || firstDayOfMonth(),
  );
  const [dateTo, setDateTo] = useState(
    () => searchParams.get("date_to") || localDate(new Date()),
  );
  const [businessLine, setBusinessLine] = useState(
    searchParams.get("business_line") ||
      (mode === "custody-reconciliation" ? "restaurant" : "all"),
  );
  const [includeZero, setIncludeZero] = useState(false);
  const [partyType, setPartyType] = useState(
    searchParams.get("party_type") || "all",
  );
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState<number | null>(() => {
    const value = Number(searchParams.get("head_id"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [report, setReport] = useState<ReportingLedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restore = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void restore();
  }, [me, router, user]);

  const params = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      business_line: businessLine === "all" ? undefined : businessLine,
    }),
    [businessLine, dateFrom, dateTo],
  );

  const load = useCallback(async () => {
    if (!user || !canView) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      let data: ReportingLedgerReport;
      if (mode === "profit-and-loss") {
        data = await financeReportingApi.getProfitAndLoss(params);
      } else if (mode === "trial-balance") {
        data = await financeReportingApi.getTrialBalance({
          ...params,
          include_zero: includeZero,
        });
      } else if (mode === "account-ledger") {
        // Accounts is the operational view. Chart of accounts retains the
        // complete zero-balance and system tree for finance administrators.
        data = await financeReportingApi.getHeadActivity({
          ...params,
          include_zero: true,
        });
      } else if (mode === "custody-reconciliation") {
        data = await financeReportingApi.getCustodyReconciliation({
          business_line: params.business_line,
        });
      } else if (mode === "balance-sheet") {
        data = await financeReportingApi.getBalanceSheet({
          as_of_date: dateTo || undefined,
          business_line: params.business_line,
        });
      } else if (mode === "party-balances") {
        data = await financeReportingApi.getPartyBalances({
          as_of_date: dateTo || undefined,
          party_type: partyType === "all" ? undefined : partyType,
          business_line: params.business_line,
        });
      } else if (mode === "cash-flow") {
        data = await financeReportingApi.getCashFlow(params);
      } else {
        data = await financeReportingApi.getHeadActivity({
          ...params,
          include_zero: includeZero,
        });
      }
      setReport(data);
    } catch (requestError: unknown) {
      setReport(null);
      setError(readError(requestError));
    } finally {
      setLoading(false);
    }
  }, [canView, dateTo, includeZero, mode, params, partyType, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <AppPage width="reading">
        <PageHeader title={meta.title} description={meta.description} />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>
            You need Finance Account Heads view permission to open independent
            ledger reports.
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  const showPeriodDates = [
    "profit-and-loss",
    "trial-balance",
    "account-ledger",
    "cash-flow",
  ].includes(mode);
  const showAsOfDate = mode === "balance-sheet" || mode === "party-balances";
  const isProfitLoss = mode === "profit-and-loss";
  const FilterSurface = isProfitLoss ? FilterBar : ReportFilters;

  return (
    <AppPage width="wide">
      <PageHeader
        title={meta.title}
        description={
          isProfitLoss
            ? "Income and expenses for the selected period."
            : meta.description
        }
        className={isProfitLoss ? "hidden md:flex" : undefined}
      />
      {!isProfitLoss ? <FinanceReportNavigation /> : null}

      <FilterSurface
        title={isProfitLoss ? "Filters" : "Report filters"}
        activeCount={
          Number(businessLine !== "all") +
          Number(includeZero) +
          Number(partyType !== "all") +
          Number(Boolean(accountSearch))
        }
        actions={
          isProfitLoss ? (
            <div
              className="flex h-11 min-w-0 max-w-[calc(100vw-9rem)] items-center truncate rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground md:hidden"
              aria-label={`Selected period: ${periodLabel(dateFrom, dateTo)}`}
            >
              {periodLabel(dateFrom, dateTo)}
            </div>
          ) : undefined
        }
        mobileActionsPosition="before"
      >
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-end">
            {showPeriodDates ? (
              <>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="report-date-from"
                    className="text-xs text-muted-foreground"
                  >
                    From
                  </Label>
                  <Input
                    id="report-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDateFrom(value);
                      if (value && value > dateTo) setDateTo(value);
                    }}
                    className="h-11 w-full rounded-xl bg-background md:w-40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="report-date-to"
                    className="text-xs text-muted-foreground"
                  >
                    To
                  </Label>
                  <Input
                    id="report-date-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-11 w-full rounded-xl bg-background md:w-40"
                  />
                </div>
              </>
            ) : null}
            {showAsOfDate ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="report-as-of-date"
                  className="text-xs text-muted-foreground"
                >
                  As of
                </Label>
                <Input
                  id="report-as-of-date"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="h-11 w-full rounded-xl bg-background md:w-40"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Business line
              </Label>
              <Select value={businessLine} onValueChange={setBusinessLine}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background md:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mode !== "custody-reconciliation" ? (
                    <SelectItem value="all">All business lines</SelectItem>
                  ) : null}
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "trial-balance" ? (
              <div className="flex min-h-11 items-center gap-2">
                <Switch
                  id="include-zero"
                  checked={includeZero}
                  onCheckedChange={setIncludeZero}
                />
                <Label htmlFor="include-zero" className="text-sm">
                  Show zero balances
                </Label>
              </div>
            ) : null}
            {mode === "party-balances" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Party type
                </Label>
                <Select value={partyType} onValueChange={setPartyType}>
                  <SelectTrigger className="h-11 w-full rounded-xl bg-background md:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All parties</SelectItem>
                    <SelectItem value="customer">Customers</SelectItem>
                    <SelectItem value="supplier">Suppliers</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {mode === "account-ledger" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Find account
                </Label>
                <Input
                  value={accountSearch}
                  onChange={(event) => setAccountSearch(event.target.value)}
                  placeholder="Account name"
                  className="h-11 w-full rounded-xl bg-background md:w-56"
                />
              </div>
            ) : null}
          </div>
        </div>
      </FilterSurface>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load {meta.title.toLowerCase()}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {loading && !report ? <LoadingReport /> : null}

      {report && mode === "profit-and-loss" ? (
        <ProfitAndLossView
          report={report as FinanceReportingProfitLossRead}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "trial-balance" ? (
        <TrialBalanceView
          report={report as FinanceReportingTrialBalanceRead}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "account-ledger" ? (
        <AccountLedgerListView
          report={report as FinanceReportingHeadActivityRead}
          search={accountSearch}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "custody-reconciliation" ? (
        <CustodyReconciliationView
          report={report as FinanceCustodyReconciliationRead}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "balance-sheet" ? (
        <BalanceSheetView
          report={report as FinanceReportingBalanceSheetRead}
          dateTo={dateTo}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "party-balances" ? (
        <PartyBalancesView
          report={report as FinanceReportingPartyBalancesRead}
          dateTo={dateTo}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "cash-flow" ? (
        <CashFlowView report={report as FinanceReportingCashFlowRead} />
      ) : null}

      <AccountLedgerPanel
        headId={selectedHeadId}
        presentation="operational"
        onOpenChange={(open) => !open && setSelectedHeadId(null)}
      />
    </AppPage>
  );
}

export function ReportingLedgerReportClient({
  mode,
}: {
  mode: ReportingLedgerReportMode;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingReport />
        </div>
      }
    >
      <ReportingLedgerReportContent mode={mode} />
    </Suspense>
  );
}
