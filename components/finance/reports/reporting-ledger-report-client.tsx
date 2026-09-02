"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Search,
} from "lucide-react";

import { FinanceReportNavigation } from "@/components/finance/reports/finance-report-navigation";
import { AccountLedgerPanel } from "@/components/finance/reports/account-ledger-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/types/finance-reporting";

export type ReportingLedgerReportMode =
  | "profit-and-loss"
  | "trial-balance"
  | "account-ledger"
  | "custody-reconciliation"
  | "balance-sheet"
  | "party-balances"
  | "cash-flow"
  | "head-activity";

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
    description: "Income and expenses posted to account heads for the selected business period.",
  },
  "trial-balance": {
    title: "Trial Balance",
    description: "Opening, period, and closing debit and credit balances across the reporting hierarchy.",
  },
  "account-ledger": {
    title: "Accounts",
    description: "Every account with its opening, period, and closing balances. Click one to see its full ledger.",
  },
  "custody-reconciliation": {
    title: "Custody Reconciliation",
    description: "Compare live cash and bank balances with their linked reporting-head balances.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity balances as of a selected business date.",
  },
  "party-balances": {
    title: "Party Balances",
    description: "Outstanding customer receivables and supplier or staff payables by party.",
  },
  "cash-flow": {
    title: "Cash Flow",
    description: "Cash inflows and outflows classified by operating, investing, and financing activity.",
  },
  "head-activity": {
    title: "Head Activity",
    description: "A compact activity and balance view for every postable account head.",
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
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    const detail = error.response?.data?.detail ?? error.response?.data?.message;
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
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 font-mono text-xl font-semibold tabular-nums",
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

function ClosureNotice({ closure }: { closure: FinanceReportingClosureSummary }) {
  if (closure.unconfirmed_day_count === 0 && closure.reopened_day_count === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        {closure.confirmed_day_count} confirmed business day(s) in this period
      </div>
    );
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Period is not fully closed</AlertTitle>
      <AlertDescription>
        {closure.unconfirmed_day_count} unconfirmed and {closure.reopened_day_count} reopened business day(s).
        Totals can still change until those days are confirmed.
      </AlertDescription>
    </Alert>
  );
}

function LoadingReport() {
  return (
    <div className="space-y-4" aria-label="Loading finance report">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
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
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} posted.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Account head</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
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
                      style={{ paddingLeft: `${Math.max(0, row.depth - 1) * 12}px` }}
                    >
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{row.code}</span>
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(row.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ProfitAndLossView({
  report,
  onSelectHead,
}: {
  report: FinanceReportingProfitLossRead;
  onSelectHead: (headId: number) => void;
}) {
  const netRevenue = asNumber(report.total_income) - asNumber(report.total_contra_income);
  const netProfit = asNumber(report.net_profit);
  const inventory = report.inventory_reconciliation;
  const otherReductions = asNumber(inventory?.other_inventory_reductions);
  const hasRows = report.income.length + report.contra_income.length + report.expenses.length > 0;

  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Gross income" value={money(report.total_income)} />
        <MetricCard label="Contra income" value={money(report.total_contra_income)} />
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
            <CardTitle className="text-base">How inventory cost was calculated</CardTitle>
            <CardDescription>
              Automatic perpetual inventory: stock purchases increase inventory, and recorded usage reduces it and recognizes cost of goods sold.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Opening inventory" value={money(inventory.opening_inventory)} />
              <MetricCard label="+ Stock added" value={money(inventory.stock_additions)} />
              <MetricCard label="− Closing inventory" value={money(inventory.closing_inventory)} />
              <MetricCard label="= Stock used / reduced" value={money(inventory.calculated_stock_used)} />
              <MetricCard label="Recognized COGS" value={money(inventory.recognized_cogs)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock added includes purchases and positive corrections. Stock used/reduced is calculated automatically; no manual closing-stock journal is required.
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
          <HeadAmountTable title="Income" rows={report.income} onSelectHead={onSelectHead} />
          <HeadAmountTable title="Contra income" rows={report.contra_income} onSelectHead={onSelectHead} />
          <div className="xl:col-span-2">
            <HeadAmountTable title="Expenses" rows={report.expenses} onSelectHead={onSelectHead} />
          </div>
        </div>
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
  const difference = Math.abs(asNumber(report.total_closing_debit) - asNumber(report.total_closing_credit));
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Period debits" value={money(report.total_period_debit)} />
        <MetricCard label="Period credits" value={money(report.total_period_credit)} />
        <MetricCard label="Closing debits" value={money(report.total_closing_debit)} />
        <MetricCard
          label={report.is_balanced ? "Balanced" : "Difference"}
          value={report.is_balanced ? money(report.total_closing_credit) : money(difference)}
          tone={report.is_balanced ? "positive" : "negative"}
        />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No account-head balances match these filters." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
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
                    onClick={() => row.is_postable && onSelectHead(row.head_id)}
                    onKeyDown={(event) => {
                      if (row.is_postable && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onSelectHead(row.head_id);
                      }
                    }}
                    className={cn(row.is_postable && "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none", !row.is_postable && "bg-muted/30 font-semibold")}
                  >
                    <TableCell>
                      <div style={{ paddingLeft: `${row.depth * 14}px` }}>
                        {row.is_postable ? (
                          <span className="hover:text-primary hover:underline">
                            <span className="mr-2 font-mono text-xs text-muted-foreground">{row.code}</span>{row.name}
                          </span>
                        ) : (
                          <><span className="mr-2 font-mono text-xs text-muted-foreground">{row.code}</span>{row.name}</>
                        )}
                        <span className="ml-2 text-[11px] font-normal uppercase text-muted-foreground">{row.head_type}</span>
                      </div>
                    </TableCell>
                    {[row.opening_debit, row.opening_credit, row.period_debit, row.period_credit, row.closing_debit, row.closing_credit].map((value, index) => (
                      <TableCell key={index} className="text-right font-mono tabular-nums">{money(value)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  {[report.total_opening_debit, report.total_opening_credit, report.total_period_debit, report.total_period_credit, report.total_closing_debit, report.total_closing_credit].map((value, index) => (
                    <TableCell key={index} className="text-right font-mono tabular-nums">{money(value)}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
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
    ? report.rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(query))
    : report.rows;
  const postableRows = rows.filter((row) => row.is_postable);

  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <p className="text-sm text-muted-foreground">
        {postableRows.length} account{postableRows.length === 1 ? "" : "s"}
        {query ? ` matching "${search.trim()}"` : ""}
      </p>
      {postableRows.length === 0 ? (
        <EmptyReport message="No accounts match your search or filters." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
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
                {postableRows.map((row) => {
                  const opening = asNumber(row.opening_debit) - asNumber(row.opening_credit);
                  const closing = asNumber(row.closing_debit) - asNumber(row.closing_credit);
                  return (
                    <TableRow
                      key={row.head_id}
                      className="cursor-pointer"
                      onClick={() => onSelectHead(row.head_id)}
                    >
                      <TableCell>
                        <span className="font-medium hover:text-primary hover:underline">
                          <span className="mr-2 font-mono text-xs text-muted-foreground">{row.code}</span>
                          {row.name}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline">{humanize(row.head_type)}</Badge></TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{money(opening)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-emerald-600">{row.period_debit && asNumber(row.period_debit) ? money(row.period_debit) : "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-rose-600">{row.period_credit && asNumber(row.period_credit) ? money(row.period_credit) : "—"}</TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">{money(closing)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CustodyReconciliationView({ report, onSelectHead }: {
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
        <MetricCard label="Custody balances" value={money(report.total_custody_balance)} />
        <MetricCard label="Reporting balances" value={money(report.total_reporting_balance)} />
        <MetricCard label="Difference" value={money(report.total_difference)} tone={report.balanced ? "positive" : "negative"} />
        <MetricCard label="Unlinked accounts" value={String(report.unlinked_count)} tone={report.unlinked_count ? "warning" : "positive"} />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No cash drawers, bank accounts, or custom custody accounts are configured." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-52">Custody account</TableHead>
                <TableHead className="min-w-52">Reporting head</TableHead>
                <TableHead className="text-right">Custody balance</TableHead>
                <TableHead className="text-right">Reporting balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.account_type}:${row.account_id}`}>
                    <TableCell><div className="font-medium">{row.account_name}</div><div className="text-xs text-muted-foreground">{humanize(row.account_type)} · {humanize(row.account_subtype)}</div></TableCell>
                    <TableCell>
                      {row.reporting_head_id ? (
                        <button type="button" onClick={() => onSelectHead(row.reporting_head_id!)} className="font-medium hover:text-primary hover:underline">
                          {row.reporting_head_name || `Head #${row.reporting_head_id}`}
                        </button>
                      ) : <span className="text-amber-600">Not linked</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.custody_balance)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{money(row.reporting_balance)}</TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold tabular-nums", Math.abs(asNumber(row.difference)) > 0.005 && "text-rose-600")}>{money(row.difference)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "balanced" ? "success" : row.status === "unlinked" ? "warning" : "destructive"}>{humanize(row.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BalanceSheetView({ report, dateTo, onSelectHead }: {
  report: FinanceReportingBalanceSheetRead;
  dateTo: string;
  onSelectHead: (headId: number) => void;
}) {
  const hasRows = report.assets.length + report.liabilities.length + report.equity.length > 0;
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <p className="text-sm text-muted-foreground">Balances as of {report.as_of_date || dateTo}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Assets" value={money(report.total_assets)} />
        <MetricCard label="Liabilities" value={money(report.total_liabilities)} />
        <MetricCard label="Equity" value={money(report.total_equity)} />
        <MetricCard label="Current earnings" value={money(report.current_earnings)} />
        <MetricCard
          label={report.is_balanced ? "Balanced total" : "Difference"}
          value={report.is_balanced ? money(report.total_liabilities_and_equity) : money(report.difference)}
          tone={report.is_balanced ? "positive" : "negative"}
        />
      </div>
      {!hasRows ? (
        <EmptyReport message="No asset, liability, or equity balances exist as of this date." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <HeadAmountTable title="Assets" rows={report.assets} onSelectHead={onSelectHead} />
          <div className="space-y-4">
            <HeadAmountTable title="Liabilities" rows={report.liabilities} onSelectHead={onSelectHead} />
            <HeadAmountTable title="Equity" rows={report.equity} onSelectHead={onSelectHead} />
          </div>
        </div>
      )}
    </div>
  );
}

function PartyBalancesView({ report, dateTo, onSelectHead }: {
  report: FinanceReportingPartyBalancesRead;
  dateTo: string;
  onSelectHead: (headId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Outstanding balances as of {report.as_of_date || dateTo}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Receivables" value={money(report.total_receivables)} tone="positive" />
        <MetricCard label="Payables" value={money(report.total_payables)} tone="warning" />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No outstanding party receivables or payables match these filters." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-56">Party</TableHead>
                <TableHead>Balance type</TableHead>
                <TableHead className="min-w-52">Account head</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.party_type}:${row.party_id}:${row.reporting_head_id}`}>
                    <TableCell><div className="font-medium">{row.party_name || `${humanize(row.party_type)} #${row.party_id}`}</div><div className="text-xs text-muted-foreground">{humanize(row.party_type)} · ID {row.party_id}</div></TableCell>
                    <TableCell><Badge variant={row.balance_type === "receivable" ? "info" : "warning"}>{humanize(row.balance_type)}</Badge></TableCell>
                    <TableCell><button type="button" onClick={() => onSelectHead(row.reporting_head_id)} className="font-medium hover:text-primary hover:underline">{row.reporting_head_name}</button></TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{money(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        <MetricCard label="Net cash flow" value={money(report.net_cash_flow)} tone={net >= 0 ? "positive" : "negative"} />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No custody-linked inflows or outflows match this period." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-56">Source</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="text-right">Inflows</TableHead>
                <TableHead className="text-right">Outflows</TableHead>
                <TableHead className="text-right">Net cash flow</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.activity_type}:${row.source_type}`}>
                    <TableCell className="font-medium">{humanize(row.source_type)}</TableCell>
                    <TableCell><Badge variant="outline">{humanize(row.activity_type)}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 tabular-nums">{money(row.inflow)}</TableCell>
                    <TableCell className="text-right font-mono text-rose-600 tabular-nums">{money(row.outflow)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{money(row.net_cash_flow)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HeadActivityView({ report, onSelectHead }: {
  report: FinanceReportingHeadActivityRead;
  onSelectHead: (headId: number) => void;
}) {
  const periodDebit = report.rows.reduce((total, row) => total + asNumber(row.period_debit), 0);
  const periodCredit = report.rows.reduce((total, row) => total + asNumber(row.period_credit), 0);
  const activeCount = report.rows.filter((row) => asNumber(row.period_debit) || asNumber(row.period_credit)).length;
  return (
    <div className="space-y-4">
      <ClosureNotice closure={report.closure} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Active heads" value={String(activeCount)} />
        <MetricCard label="Period debits" value={money(periodDebit)} />
        <MetricCard label="Period credits" value={money(periodCredit)} />
      </div>
      {report.rows.length === 0 ? (
        <EmptyReport message="No postable account-head activity matches these filters." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-64">Account head</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Period debit</TableHead>
                <TableHead className="text-right">Period credit</TableHead>
                <TableHead className="text-right">Closing debit</TableHead>
                <TableHead className="text-right">Closing credit</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.head_id} role="button" tabIndex={0} onClick={() => onSelectHead(row.head_id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectHead(row.head_id); } }} className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none">
                    <TableCell><span className="font-medium hover:text-primary hover:underline"><span className="mr-2 font-mono text-xs text-muted-foreground">{row.code}</span>{row.name}</span></TableCell>
                    <TableCell><Badge variant="outline">{humanize(row.head_type)}</Badge></TableCell>
                    {[row.period_debit, row.period_credit, row.closing_debit, row.closing_credit].map((value, index) => <TableCell key={index} className="text-right font-mono tabular-nums">{money(value)}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportingLedgerReportContent({ mode }: { mode: ReportingLedgerReportMode }) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = modeMeta[mode];
  const canView = hasPermission(user, "finance.coa.view");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("date_from") || firstDayOfMonth());
  const [dateTo, setDateTo] = useState(() => searchParams.get("date_to") || localDate(new Date()));
  const [businessLine, setBusinessLine] = useState(
    searchParams.get("business_line") || (mode === "custody-reconciliation" ? "restaurant" : "all"),
  );
  const [includeZero, setIncludeZero] = useState(false);
  const [partyType, setPartyType] = useState(searchParams.get("party_type") || "all");
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
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void restore();
  }, [me, router, user]);

  const params = useMemo(() => ({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    business_line: businessLine === "all" ? undefined : businessLine,
  }), [businessLine, dateFrom, dateTo]);

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
        data = await financeReportingApi.getTrialBalance({ ...params, include_zero: includeZero });
      } else if (mode === "account-ledger") {
        // "Account Ledger" is now the accounts list -- every postable head's
        // opening/period/closing balances in one bulk call. Opening a single
        // account's entry-by-entry activity happens in the shared panel.
        data = await financeReportingApi.getHeadActivity({ ...params, include_zero: true });
      } else if (mode === "custody-reconciliation") {
        data = await financeReportingApi.getCustodyReconciliation({ business_line: params.business_line });
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
        data = await financeReportingApi.getHeadActivity({ ...params, include_zero: includeZero });
      }
      setReport(data);
    } catch (requestError: unknown) {
      setReport(null);
      setError(readError(requestError));
    } finally {
      setLoading(false);
    }
  }, [canView, dateTo, includeZero, mode, params, partyType, user]);

  useEffect(() => { void load(); }, [load]);

  if (!user) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">{meta.title}</h1>
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Access restricted</AlertTitle><AlertDescription>You need Finance Account Heads view permission to open independent ledger reports.</AlertDescription></Alert>
      </div>
    );
  }

  const showPeriodDates = ["profit-and-loss", "trial-balance", "account-ledger", "cash-flow", "head-activity"].includes(mode);
  const showAsOfDate = mode === "balance-sheet" || mode === "party-balances";

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
      </div>
      <FinanceReportNavigation />

      <div className="flex flex-col gap-3 border-y bg-muted/20 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          {showPeriodDates ? (
            <>
              <div className="space-y-1.5"><Label htmlFor="report-date-from" className="text-xs text-muted-foreground">From</Label><Input id="report-date-from" type="date" value={dateFrom} onChange={(event) => { const value = event.target.value; setDateFrom(value); if (value && value > dateTo) setDateTo(value); }} className="w-40 bg-background" /></div>
              <div className="space-y-1.5"><Label htmlFor="report-date-to" className="text-xs text-muted-foreground">To</Label><Input id="report-date-to" type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} className="w-40 bg-background" /></div>
            </>
          ) : null}
          {showAsOfDate ? (
            <div className="space-y-1.5"><Label htmlFor="report-as-of-date" className="text-xs text-muted-foreground">As of</Label><Input id="report-as-of-date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40 bg-background" /></div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Business line</Label>
            <Select value={businessLine} onValueChange={setBusinessLine}>
              <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{mode !== "custody-reconciliation" ? <SelectItem value="all">All business lines</SelectItem> : null}<SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent>
            </Select>
          </div>
          {mode === "trial-balance" || mode === "head-activity" ? (
            <div className="flex h-10 items-center gap-2"><Switch id="include-zero" checked={includeZero} onCheckedChange={setIncludeZero} /><Label htmlFor="include-zero" className="text-sm">Show zero balances</Label></div>
          ) : null}
          {mode === "party-balances" ? (
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Party type</Label><Select value={partyType} onValueChange={setPartyType}><SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All parties</SelectItem><SelectItem value="customer">Customers</SelectItem><SelectItem value="supplier">Suppliers</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent></Select></div>
          ) : null}
          {mode === "account-ledger" ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Find account</Label>
              <Input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Code or name"
                className="w-56 bg-background"
              />
            </div>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>
      </div>

      {error ? (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Could not load {meta.title.toLowerCase()}</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></AlertDescription></Alert>
      ) : null}
      {loading && !report ? <LoadingReport /> : null}

      {report && mode === "profit-and-loss" ? <ProfitAndLossView report={report as FinanceReportingProfitLossRead} onSelectHead={setSelectedHeadId} /> : null}
      {report && mode === "trial-balance" ? <TrialBalanceView report={report as FinanceReportingTrialBalanceRead} onSelectHead={setSelectedHeadId} /> : null}
      {report && mode === "account-ledger" ? (
        <AccountLedgerListView
          report={report as FinanceReportingHeadActivityRead}
          search={accountSearch}
          onSelectHead={setSelectedHeadId}
        />
      ) : null}
      {report && mode === "custody-reconciliation" ? <CustodyReconciliationView report={report as FinanceCustodyReconciliationRead} onSelectHead={setSelectedHeadId} /> : null}
      {report && mode === "balance-sheet" ? <BalanceSheetView report={report as FinanceReportingBalanceSheetRead} dateTo={dateTo} onSelectHead={setSelectedHeadId} /> : null}
      {report && mode === "party-balances" ? <PartyBalancesView report={report as FinanceReportingPartyBalancesRead} dateTo={dateTo} onSelectHead={setSelectedHeadId} /> : null}
      {report && mode === "cash-flow" ? <CashFlowView report={report as FinanceReportingCashFlowRead} /> : null}
      {report && mode === "head-activity" ? <HeadActivityView report={report as FinanceReportingHeadActivityRead} onSelectHead={setSelectedHeadId} /> : null}

      <div className="flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" />Independent reporting ledger</span>
        <span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" />Balanced debit and credit postings</span>
        <span className="flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /><ArrowDownRight className="h-3.5 w-3.5" />Drill down from statements to entries</span>
      </div>

      <AccountLedgerPanel headId={selectedHeadId} onOpenChange={(open) => !open && setSelectedHeadId(null)} />
    </div>
  );
}

export function ReportingLedgerReportClient({ mode }: { mode: ReportingLedgerReportMode }) {
  return (
    <Suspense fallback={<div className="p-6"><LoadingReport /></div>}>
      <ReportingLedgerReportContent mode={mode} />
    </Suspense>
  );
}
