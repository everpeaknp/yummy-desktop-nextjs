"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from "date-fns";
import { ArrowLeft, Banknote, ClipboardList, FileText, Loader2, ReceiptText, Truck, Users } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, AccountingReportApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import { AccountingDrilldownDrawer } from "./accounting-drilldown-drawer";
import { BalanceSheetStatement } from "./balance-sheet-statement";
import { FinancialReportFilters } from "./financial-report-filters";
import type { DatePreset } from "./financial-report-filters";
import { ProfitLossStatement } from "./profit-loss-statement";
import type {
  BalanceSheetResponse,
  AccountingDrilldownResponse,
  CashFlowResponse,
  CustomerLedgerResponse,
  FinancialStatementLine,
  GeneralLedgerResponse,
  ProfitLossResponse,
  SupplierLedgerResponse,
  VatSummaryResponse,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type ReportMode =
  | "general-ledger"
  | "customer-ledger"
  | "supplier-ledger"
  | "cash-flow"
  | "profit-loss"
  | "balance-sheet"
  | "vat-summary";

type AccountingReportClientProps = {
  mode: ReportMode;
};

type ReportState = {
  generalLedger: GeneralLedgerResponse | null;
  customerLedger: CustomerLedgerResponse | null;
  supplierLedger: SupplierLedgerResponse | null;
  cashFlow: CashFlowResponse | null;
  profitLoss: ProfitLossResponse | null;
  balanceSheet: BalanceSheetResponse | null;
  vatSummary: VatSummaryResponse | null;
};

const reportMeta: Record<ReportMode, { title: string; description: string }> = {
  "general-ledger": {
    title: "General Ledger",
    description: "Posted journal lines grouped by account and source event.",
  },
  "customer-ledger": {
    title: "Customer Ledger",
    description: "Customer receivable movement from posted sales, collections, refunds, and liabilities.",
  },
  "supplier-ledger": {
    title: "Supplier Ledger",
    description: "Supplier payable and payment movement from posted inventory and supplier finance events.",
  },
  "cash-flow": {
    title: "Cash Flow",
    description: "Cash and cash-equivalent movement grouped by collections, refunds, inventory, suppliers, and variance.",
  },
  "profit-loss": {
    title: "Profit and Loss",
    description: "Revenue, contra-revenue, COGS, expenses, and profit from posted journals.",
  },
  "balance-sheet": {
    title: "Balance Sheet",
    description: "Assets, liabilities, equity, and current earnings from the accounting ledger.",
  },
  "vat-summary": {
    title: "VAT Summary",
    description: "Taxable sales, VAT collected, VAT reversed, and net VAT payable.",
  },
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return yyyyMmDd(date);
}

function presetToRange(preset: DatePreset): DateRange {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (preset === "yesterday") {
    const day = subDays(now, 1);
    return { from: startOfDay(day), to: endOfDay(day) };
  }
  if (preset === "last7") return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
  if (preset === "last30") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function lineLabel(row: FinancialStatementLine) {
  return row.account_code ? `${row.account_code} - ${row.account_name}` : row.account_name;
}

function eventLabel(value: string) {
  return value.replace(/_/g, " ");
}

function canOpenVoucher(sourceType: string) {
  return sourceType === "manual_journal_voucher" || sourceType === "journal_reversal";
}

function GeneralLedgerTable({
  data,
  loading,
  onOpenJournalDrilldown,
}: {
  data: GeneralLedgerResponse | null;
  loading?: boolean;
  onOpenJournalDrilldown?: (journalEntryId: number, title: string) => void;
}) {
  const rows = data?.rows ?? [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading general ledger...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No posted journal lines found for this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Date</TableHead>
            <TableHead className="min-w-[220px]">Account</TableHead>
            <TableHead className="min-w-[180px]">Source</TableHead>
            <TableHead className="min-w-[220px]">Memo</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Trace</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.journal_line_id}>
              <TableCell>{row.entry_date}</TableCell>
              <TableCell>
                <div className="font-medium">{row.account_name}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.account_code}</div>
              </TableCell>
              <TableCell>
                <div className="capitalize">{row.source_type}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.source_key}</div>
                {canOpenVoucher(row.source_type) ? (
                  <Link
                    href={`/finance/accounting/vouchers/${row.journal_entry_id}`}
                    className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    Open voucher
                  </Link>
                ) : null}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.memo ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenJournalDrilldown?.(row.journal_entry_id, `Entry #${row.journal_entry_id}`)}
                >
                  Trace
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell colSpan={4}>Totals</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_debit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_credit ?? 0)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function CustomerLedgerTable({
  data,
  loading,
}: {
  data: CustomerLedgerResponse | null;
  loading?: boolean;
}) {
  const rows = data?.rows ?? [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading customer ledger...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No posted customer ledger movement found for this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Date</TableHead>
            <TableHead className="min-w-[220px]">Customer</TableHead>
            <TableHead className="min-w-[180px]">Source</TableHead>
            <TableHead className="min-w-[220px]">Memo</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.finance_event_id}>
              <TableCell>{row.business_date}</TableCell>
              <TableCell>
                <div className="font-medium">{row.customer_name ?? `Customer #${row.customer_id}`}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {row.invoice_number ?? (row.order_id ? `Order #${row.order_id}` : `Event #${row.finance_event_id}`)}
                </div>
              </TableCell>
              <TableCell className="capitalize">
                <div>{eventLabel(row.event_type)}</div>
                <div className="text-xs text-muted-foreground">{row.payment_method ?? "-"}</div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.memo ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell colSpan={4}>Totals</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_debit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_credit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.closing_balance ?? 0)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SupplierLedgerTable({
  data,
  loading,
}: {
  data: SupplierLedgerResponse | null;
  loading?: boolean;
}) {
  const rows = data?.rows ?? [];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading supplier ledger...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No posted supplier ledger movement found for this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Date</TableHead>
            <TableHead className="min-w-[220px]">Supplier</TableHead>
            <TableHead className="min-w-[180px]">Source</TableHead>
            <TableHead className="min-w-[220px]">Memo</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.finance_event_id}>
              <TableCell>{row.business_date}</TableCell>
              <TableCell>
                <div className="font-medium">{row.supplier_name ?? `Supplier #${row.supplier_id}`}</div>
                <div className="font-mono text-xs text-muted-foreground">Event #{row.finance_event_id}</div>
              </TableCell>
              <TableCell className="capitalize">
                <div>{eventLabel(row.event_type)}</div>
                <div className="text-xs text-muted-foreground">{row.payment_method ?? "-"}</div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.memo ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell colSpan={4}>Totals</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_debit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.total_credit ?? 0)}</TableCell>
            <TableCell className="text-right font-mono">{formatMoney(data?.closing_balance ?? 0)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function CashFlowPanel({
  data,
  loading,
}: {
  data: CashFlowResponse | null;
  loading?: boolean;
}) {
  const rows = data?.rows ?? [];
  const summary = [
    { label: "Operating Inflows", value: data?.operating_inflows ?? 0 },
    { label: "Operating Outflows", value: data?.operating_outflows ?? 0 },
    { label: "Refund Outflows", value: data?.refund_outflows ?? 0 },
    { label: "Inventory Outflows", value: data?.inventory_outflows ?? 0 },
    { label: "Supplier Outflows", value: data?.supplier_outflows ?? 0 },
    { label: "Cash Variance", value: data?.cash_variance ?? 0 },
    { label: "Net Cash Flow", value: data?.net_cash_flow ?? 0 },
  ];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading cash flow...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
            <div className="mt-2 font-mono text-lg font-semibold">{formatMoney(item.value)}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="border-y border-border px-3 py-3 text-sm text-muted-foreground">
          No posted cash movement found for this date range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Date</TableHead>
                <TableHead className="min-w-[180px]">Category</TableHead>
                <TableHead className="min-w-[180px]">Source</TableHead>
                <TableHead className="min-w-[240px]">Memo</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Signed Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.finance_event_id}>
                  <TableCell>{row.business_date}</TableCell>
                  <TableCell className="capitalize">{eventLabel(row.category)}</TableCell>
                  <TableCell>
                    <div className="capitalize">{eventLabel(row.event_type)}</div>
                    <div className="text-xs text-muted-foreground">{row.payment_method ?? "-"}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.memo ?? "-"}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(row.amount)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(row.signed_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function VatSummaryPanel({
  data,
  loading,
  onOpenDrilldown,
}: {
  data: VatSummaryResponse | null;
  loading?: boolean;
  onOpenDrilldown?: (accountId: number, title: string) => void;
}) {
  const summary = [
    { label: "Taxable Sales", value: data?.taxable_sales ?? 0 },
    { label: "VAT Collected", value: data?.tax_collected ?? 0 },
    { label: "VAT Reversed", value: data?.tax_reversed ?? 0 },
    { label: "Net VAT Payable", value: data?.net_tax_payable ?? 0 },
  ];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading VAT summary...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
            <div className="mt-2 font-mono text-lg font-semibold">{formatMoney(item.value)}</div>
          </div>
        ))}
      </div>
      {(data?.rows ?? []).length === 0 ? (
        <div className="border-y border-border px-3 py-3 text-sm text-muted-foreground">
          No VAT ledger rows found for this date range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Code</TableHead>
                <TableHead className="min-w-[260px]">Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Trace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((row) => (
                <TableRow key={row.account_id}>
                  <TableCell className="font-mono text-xs">{row.account_code}</TableCell>
                  <TableCell>{lineLabel(row)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(row.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenDrilldown?.(row.account_id, lineLabel(row))}
                    >
                      Trace
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function AccountingReportClient({ mode }: AccountingReportClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [datePreset, setDatePreset] = useState<DatePreset>("last30");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => presetToRange("last30"));
  const [station, setStation] = useState("");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportState>({
    generalLedger: null,
    customerLedger: null,
    supplierLedger: null,
    cashFlow: null,
    profitLoss: null,
    balanceSheet: null,
    vatSummary: null,
  });
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("Accounting trace");
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<AccountingDrilldownResponse | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const restaurantId = user?.restaurant_id;
  const meta = reportMeta[mode];

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  useEffect(() => {
    if (datePreset === "custom") return;
    const nextRange = presetToRange(datePreset);
    setDateRange(nextRange);
    if (nextRange.from) setDateFrom(format(nextRange.from, "yyyy-MM-dd"));
    if (nextRange.to) setDateTo(format(nextRange.to, "yyyy-MM-dd"));
  }, [datePreset]);

  useEffect(() => {
    if (datePreset !== "custom") return;
    if (!dateRange?.from) return;
    setDateFrom(format(dateRange.from, "yyyy-MM-dd"));
    setDateTo(format(dateRange.to ?? dateRange.from, "yyyy-MM-dd"));
  }, [datePreset, dateRange]);

  const reportParams = useMemo(
    () => ({
      restaurantId: restaurantId ?? 0,
      dateFrom,
      dateTo,
      businessLine: "restaurant",
      timezone: "Asia/Katmandu",
      station: station.trim() || undefined,
    }),
    [restaurantId, dateFrom, dateTo, station]
  );

  const loadReport = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      if (mode === "general-ledger") {
        const res = await apiClient.get<BaseResponse<GeneralLedgerResponse>>(
          AccountingReportApis.generalLedger(reportParams)
        );
        setReports((current) => ({ ...current, generalLedger: res.data?.data ?? null }));
      } else if (mode === "customer-ledger") {
        const res = await apiClient.get<BaseResponse<CustomerLedgerResponse>>(
          AccountingReportApis.customerLedger(reportParams)
        );
        setReports((current) => ({ ...current, customerLedger: res.data?.data ?? null }));
      } else if (mode === "supplier-ledger") {
        const res = await apiClient.get<BaseResponse<SupplierLedgerResponse>>(
          AccountingReportApis.supplierLedger(reportParams)
        );
        setReports((current) => ({ ...current, supplierLedger: res.data?.data ?? null }));
      } else if (mode === "cash-flow") {
        const res = await apiClient.get<BaseResponse<CashFlowResponse>>(
          AccountingReportApis.cashFlow(reportParams)
        );
        setReports((current) => ({ ...current, cashFlow: res.data?.data ?? null }));
      } else if (mode === "profit-loss") {
        const res = await apiClient.get<BaseResponse<ProfitLossResponse>>(
          AccountingReportApis.profitLoss(reportParams)
        );
        setReports((current) => ({ ...current, profitLoss: res.data?.data ?? null }));
      } else if (mode === "balance-sheet") {
        const res = await apiClient.get<BaseResponse<BalanceSheetResponse>>(
          AccountingReportApis.balanceSheet(reportParams)
        );
        setReports((current) => ({ ...current, balanceSheet: res.data?.data ?? null }));
      } else {
        const res = await apiClient.get<BaseResponse<VatSummaryResponse>>(
          AccountingReportApis.vatSummary(reportParams)
        );
        setReports((current) => ({ ...current, vatSummary: res.data?.data ?? null }));
      }
    } catch (error) {
      console.error(`Failed to load ${mode}`, error);
      toast.error(`Failed to load ${meta.title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, mode, meta.title, reportParams]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const openAccountDrilldown = useCallback(
    async (accountId: number, title: string) => {
      if (!restaurantId) return;
      setDrilldownTitle(title);
      setDrilldownOpen(true);
      setDrilldownLoading(true);
      try {
        const res = await apiClient.get<BaseResponse<AccountingDrilldownResponse>>(
          AccountingApis.drilldown({
            restaurantId,
            dateFrom,
            dateTo,
            station: station.trim() || undefined,
            accountId,
          })
        );
        setDrilldownData(res.data?.data ?? null);
      } catch (error) {
        console.error("Failed to load accounting drilldown", error);
        setDrilldownData(null);
        toast.error("Failed to load accounting trace");
      } finally {
        setDrilldownLoading(false);
      }
    },
    [restaurantId, dateFrom, dateTo, station]
  );

  const openJournalDrilldown = useCallback(
    async (journalEntryId: number, title: string) => {
      if (!restaurantId) return;
      setDrilldownTitle(title);
      setDrilldownOpen(true);
      setDrilldownLoading(true);
      try {
        const res = await apiClient.get<BaseResponse<AccountingDrilldownResponse>>(
          AccountingApis.drilldown({
            restaurantId,
            journalEntryId,
            station: station.trim() || undefined,
          })
        );
        setDrilldownData(res.data?.data ?? null);
      } catch (error) {
        console.error("Failed to load journal drilldown", error);
        setDrilldownData(null);
        toast.error("Failed to load journal trace");
      } finally {
        setDrilldownLoading(false);
      }
    },
    [restaurantId, station]
  );

  const exportReport = async () => {
    const XLSX = await import("xlsx");
    let rows: Record<string, string | number | null | undefined>[] = [];
    let sheetName = meta.title;

    if (mode === "general-ledger") {
      rows = (reports.generalLedger?.rows ?? []).map((row) => ({
        Date: row.entry_date,
        Account: `${row.account_code} - ${row.account_name}`,
        Source: row.source_key,
        Memo: row.memo,
        Debit: row.debit,
        Credit: row.credit,
      }));
    } else if (mode === "customer-ledger") {
      rows = (reports.customerLedger?.rows ?? []).map((row) => ({
        Date: row.business_date,
        Customer: row.customer_name ?? `Customer #${row.customer_id}`,
        Source: eventLabel(row.event_type),
        Invoice: row.invoice_number,
        Order: row.order_id,
        PaymentMethod: row.payment_method,
        Memo: row.memo,
        Debit: row.debit,
        Credit: row.credit,
        Balance: row.balance,
      }));
      sheetName = "Customer Ledger";
    } else if (mode === "supplier-ledger") {
      rows = (reports.supplierLedger?.rows ?? []).map((row) => ({
        Date: row.business_date,
        Supplier: row.supplier_name ?? `Supplier #${row.supplier_id}`,
        Source: eventLabel(row.event_type),
        PaymentMethod: row.payment_method,
        Memo: row.memo,
        Debit: row.debit,
        Credit: row.credit,
        Balance: row.balance,
      }));
      sheetName = "Supplier Ledger";
    } else if (mode === "cash-flow") {
      rows = (reports.cashFlow?.rows ?? []).map((row) => ({
        Date: row.business_date,
        Category: eventLabel(row.category),
        Source: eventLabel(row.event_type),
        PaymentMethod: row.payment_method,
        Memo: row.memo,
        Amount: row.amount,
        SignedAmount: row.signed_amount,
      }));
      sheetName = "Cash Flow";
    } else if (mode === "profit-loss") {
      const data = reports.profitLoss;
      rows = [
        ...(data?.revenue ?? []).map((row) => ({ Section: "Revenue", Account: lineLabel(row), Amount: row.amount })),
        ...(data?.contra_revenue ?? []).map((row) => ({
          Section: "Contra Revenue",
          Account: lineLabel(row),
          Amount: row.amount,
        })),
        ...(data?.expenses ?? []).map((row) => ({ Section: "Expense", Account: lineLabel(row), Amount: row.amount })),
        { Section: "Total", Account: "Net Profit", Amount: data?.net_profit ?? 0 },
      ];
      sheetName = "Profit Loss";
    } else if (mode === "balance-sheet") {
      const data = reports.balanceSheet;
      rows = [
        ...(data?.assets ?? []).map((row) => ({ Section: "Assets", Account: lineLabel(row), Amount: row.amount })),
        ...(data?.liabilities ?? []).map((row) => ({
          Section: "Liabilities",
          Account: lineLabel(row),
          Amount: row.amount,
        })),
        ...(data?.equity ?? []).map((row) => ({ Section: "Equity", Account: lineLabel(row), Amount: row.amount })),
        { Section: "Total", Account: "Liabilities + Equity", Amount: data?.total_liabilities_and_equity ?? 0 },
      ];
      sheetName = "Balance Sheet";
    } else {
      const data = reports.vatSummary;
      rows = [
        { Metric: "Taxable Sales", Amount: data?.taxable_sales ?? 0 },
        { Metric: "VAT Collected", Amount: data?.tax_collected ?? 0 },
        { Metric: "VAT Reversed", Amount: data?.tax_reversed ?? 0 },
        { Metric: "Net VAT Payable", Amount: data?.net_tax_payable ?? 0 },
        ...(data?.rows ?? []).map((row) => ({ Metric: lineLabel(row), Amount: row.amount })),
      ];
      sheetName = "VAT Summary";
    }

    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${sheetName.replace(/\s+/g, "_")}_${dateFrom}_${dateTo}.xlsx`);
  };

  const exportDisabled = useMemo(() => {
    if (loading) return true;
    if (mode === "general-ledger") return (reports.generalLedger?.rows.length ?? 0) === 0;
    if (mode === "customer-ledger") return (reports.customerLedger?.rows.length ?? 0) === 0;
    if (mode === "supplier-ledger") return (reports.supplierLedger?.rows.length ?? 0) === 0;
    if (mode === "cash-flow") return (reports.cashFlow?.rows.length ?? 0) === 0;
    if (mode === "profit-loss") return !reports.profitLoss;
    if (mode === "balance-sheet") return !reports.balanceSheet;
    return !reports.vatSummary;
  }, [loading, mode, reports]);

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">{meta.title}</h1>
        <div className="border border-border p-6 text-sm text-muted-foreground">
          Your user does not have finance access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/finance/accounting">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          {mode === "general-ledger" ? (
            <ClipboardList className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "customer-ledger" ? (
            <Users className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "supplier-ledger" ? (
            <Truck className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "cash-flow" ? (
            <Banknote className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "vat-summary" ? (
            <ReceiptText className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : (
            <FileText className="hidden h-6 w-6 text-muted-foreground md:block" />
          )}
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      <FinancialReportFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        dateRange={dateRange}
        datePreset={datePreset}
        station={station}
        onDateRangeChange={(value) => {
          setDatePreset("custom");
          setDateRange(value);
        }}
        onDatePresetChange={setDatePreset}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onStationChange={setStation}
        onRefresh={loadReport}
        refreshing={loading}
        onExport={exportReport}
        exportDisabled={exportDisabled}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{meta.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mode === "general-ledger" && (
            <GeneralLedgerTable
              data={reports.generalLedger}
              loading={loading}
              onOpenJournalDrilldown={openJournalDrilldown}
            />
          )}
          {mode === "customer-ledger" && <CustomerLedgerTable data={reports.customerLedger} loading={loading} />}
          {mode === "supplier-ledger" && <SupplierLedgerTable data={reports.supplierLedger} loading={loading} />}
          {mode === "cash-flow" && <CashFlowPanel data={reports.cashFlow} loading={loading} />}
          {mode === "profit-loss" && (loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading profit and loss...</div>
          ) : (
            <ProfitLossStatement data={reports.profitLoss} onOpenDrilldown={openAccountDrilldown} />
          ))}
          {mode === "balance-sheet" && (loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading balance sheet...</div>
          ) : (
            <BalanceSheetStatement data={reports.balanceSheet} onOpenDrilldown={openAccountDrilldown} />
          ))}
          {mode === "vat-summary" && (
            <VatSummaryPanel
              data={reports.vatSummary}
              loading={loading}
              onOpenDrilldown={openAccountDrilldown}
            />
          )}
        </CardContent>
      </Card>

      <AccountingDrilldownDrawer
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        title={drilldownTitle}
        data={drilldownData}
        loading={drilldownLoading}
      />
    </div>
  );
}
