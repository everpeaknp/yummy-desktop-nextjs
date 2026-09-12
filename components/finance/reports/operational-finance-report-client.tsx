"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays } from "date-fns";
import {
  BadgeDollarSign,
  FileText,
  Loader2,
  ReceiptText,
  RotateCcw,
  Download,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { FinanceReportApis } from "@/lib/api/endpoints";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DateRangeDropdown,
  type DateRangePreset,
} from "@/components/ui/date-range-dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceReportNavigation } from "@/components/finance/reports/finance-report-navigation";
import { SalesDocumentDetailSheet } from "@/components/finance/transaction-detail/sales-document-detail-sheet";
import { FinanceWorkspaceNav } from "@/components/finance/workspace/finance-workspace-nav";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import {
  TransactionDetailSheet,
  type TransactionDetailModel,
} from "@/components/finance/transaction-detail/transaction-detail-sheet";
import type {
  FinanceReportTotals,
  InvoiceReportResponse,
  InvoiceRow,
  PaymentReportResponse,
  PaymentReportRow,
  RefundReportResponse,
  RefundReportRow,
  SalesBookReportResponse,
  SalesBookRow,
  VatSalesReportResponse,
  VatSalesRow,
} from "@/types/finance-reports";
import type { FinanceSalesDocument } from "@/types/finance-sales";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type ReportMode = "sales-book" | "invoices" | "payments" | "refunds" | "vat-sales";

type ReportResponse =
  | SalesBookReportResponse
  | InvoiceReportResponse
  | PaymentReportResponse
  | RefundReportResponse
  | VatSalesReportResponse;

type OperationalFinanceReportClientProps = {
  mode: ReportMode;
  showReportNavigation?: boolean;
  workspace?: "sales";
  showHeader?: boolean;
};

const reportMeta: Record<ReportMode, { title: string; description: string }> = {
  "sales-book": {
    title: "Sales report",
    description: "Date-filtered sales, tax, discount, settlement, and balance for review or export.",
  },
  invoices: {
    title: "Invoices",
    description: "Invoice-level view for bill lookup, customer settlement, and receivable checks.",
  },
  payments: {
    title: "Payments",
    description: "Successful payment collections by business date, method, instrument, and invoice.",
  },
  refunds: {
    title: "Sales returns & refunds",
    description: "Refunds created from completed orders, with the original invoice and settlement method.",
  },
  "vat-sales": {
    title: "VAT Sales",
    description: "Taxable sales and VAT amounts for sales materialized reporting.",
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

function presetToRange(preset: DateRangePreset): DateRange {
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

function formatMoney(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function settlementLabel(row: SalesBookRow | InvoiceRow) {
  return row.settlement_status.replace(/_/g, " ");
}

function isPaymentReport(data: ReportResponse | null): data is PaymentReportResponse {
  return !!data && "paid_amount" in data.totals && !("grand_total" in data.totals);
}

function isRefundReport(data: ReportResponse | null): data is RefundReportResponse {
  return !!data && "refund_amount" in data.totals && !("grand_total" in data.totals);
}

function isSalesLikeReport(
  data: ReportResponse | null
): data is SalesBookReportResponse | InvoiceReportResponse | VatSalesReportResponse {
  return !!data && "grand_total" in data.totals;
}

function reportTotalAmount(data: ReportResponse | null) {
  if (!data) return 0;
  if (isPaymentReport(data)) return data.totals.paid_amount;
  if (isRefundReport(data)) return data.totals.refund_amount;
  return data.totals.grand_total;
}

function reportTaxAmount(data: ReportResponse | null) {
  return isSalesLikeReport(data) ? data.totals.tax_amount : 0;
}

function reportDiscountAmount(data: ReportResponse | null) {
  return isSalesLikeReport(data) ? data.totals.discount : 0;
}

function reportBalanceDue(data: ReportResponse | null) {
  return isSalesLikeReport(data) ? data.totals.balance_due : 0;
}

function SummaryStrip({ data, mode }: { data: ReportResponse | null; mode: ReportMode }) {
  if (mode === "payments" || mode === "refunds") {
    const isPayments = mode === "payments";
    const count = Number(data?.total ?? 0);
    return (
      <section className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {isPayments ? "Collected" : "Refunded"}
            </p>
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {formatMoney(reportTotalAmount(data))}
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">
            {count} {count === 1 ? "record" : "records"}
          </p>
        </div>
      </section>
    );
  }

  const amountLabel = mode === "payments" ? "Collected" : mode === "refunds" ? "Refunded" : "Grand Total";
  const items = [
    { label: amountLabel, value: formatMoney(reportTotalAmount(data)) },
    { label: "VAT", value: formatMoney(reportTaxAmount(data)) },
    { label: "Discount", value: formatMoney(reportDiscountAmount(data)) },
    { label: "Balance Due", value: formatMoney(reportBalanceDue(data)) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border bg-card px-3 py-3 shadow-sm sm:px-4">
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function SalesLikeTable({
  rows,
  mode,
  onSelectSale,
}: {
  rows: Array<SalesBookRow | InvoiceRow | VatSalesRow>;
  mode: ReportMode;
  onSelectSale: (orderId: number) => void;
}) {
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No report rows found.</div>;
  }

  const includeSettlement = mode !== "vat-sales";

  return (
    <>
    <DataList className="rounded-none border-x-0 border-y-0 md:hidden">
      {rows.map((row) => (
        <ListRow
          key={`${row.order_id}-${row.invoice_number}`}
          leading={<FileText className="h-4 w-4 text-primary" />}
          title={row.invoice_number}
          description={`${row.customer_name ?? "Walk-in"} · ${row.business_date}${includeSettlement && "settlement_status" in row ? ` · ${settlementLabel(row)}` : ""}`}
          meta={<span className="font-semibold tabular-nums text-foreground">{formatMoney(row.grand_total)}</span>}
          interactive
          role="button"
          tabIndex={0}
          onClick={() => onSelectSale(row.order_id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSale(row.order_id);
            }
          }}
        />
      ))}
    </DataList>
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">Business Date</TableHead>
            <TableHead className="min-w-[160px]">Invoice</TableHead>
            <TableHead className="min-w-[190px]">Completed</TableHead>
            <TableHead className="min-w-[190px]">Customer</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">VAT</TableHead>
            <TableHead className="text-right">Grand Total</TableHead>
            {includeSettlement && <TableHead className="text-right">Paid</TableHead>}
            {includeSettlement && <TableHead className="text-right">Balance</TableHead>}
            {includeSettlement && <TableHead className="min-w-[130px]">Settlement</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={`${row.order_id}-${row.invoice_number}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSale(row.order_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSale(row.order_id);
                }
              }}
              className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <TableCell>{row.business_date}</TableCell>
              <TableCell>
                <div className="font-medium">{row.invoice_number}</div>
              </TableCell>
              <TableCell>{formatDateTime(row.completed_at)}</TableCell>
              <TableCell>
                <div>{row.customer_name ?? "Walk-in"}</div>
              </TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.taxable_sales)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.tax_amount)}</TableCell>
              <TableCell className="text-right font-mono">{formatMoney(row.grand_total)}</TableCell>
              {includeSettlement && "paid_amount" in row && (
                <TableCell className="text-right font-mono">{formatMoney(row.paid_amount)}</TableCell>
              )}
              {includeSettlement && "balance_due" in row && (
                <TableCell className="text-right font-mono">{formatMoney(row.balance_due)}</TableCell>
              )}
              {includeSettlement && "settlement_status" in row && (
                <TableCell className="capitalize">{settlementLabel(row)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}

function PaymentTable({
  rows,
  mode,
}: {
  rows: Array<PaymentReportRow | RefundReportRow>;
  mode: "payments" | "refunds";
}) {
  const [selected, setSelected] = useState<PaymentReportRow | RefundReportRow | null>(null);
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No report rows found.</div>;
  }

  const selectedAt = selected
    ? "paid_at" in selected
      ? selected.paid_at
      : selected.refunded_at
    : null;
  const selectedDetail: TransactionDetailModel | null = selected
    ? {
        eyebrow: mode === "payments" ? "Payment received" : "Refund paid",
        title: selected.invoice_number,
        reference: selected.reference || selected.invoice_number,
        subtitle:
          selected.customer_name ||
          (mode === "payments" ? "Walk-in customer payment" : "Customer refund"),
        occurredAt: selectedAt,
        status: mode === "payments" ? "successful" : "refunded",
        amount: selected.amount,
        amountLabel: mode === "payments" ? "Amount collected" : "Amount refunded",
        amountTone: mode === "payments" ? "in" : "out",
        badges: [selected.payment_method, selected.instrument_type].filter(Boolean) as string[],
        sections: [
          {
            title: "Payment overview",
            fields: [
              { label: "Invoice", value: selected.invoice_number },
              { label: "Customer", value: selected.customer_name || "Walk-in customer" },
              { label: "Business date", value: selected.business_date },
              { label: mode === "payments" ? "Paid at" : "Refunded at", value: formatDateTime(selectedAt) },
              { label: "Reference", value: selected.reference || "Not provided", fullWidth: true },
            ],
          },
          {
            title: "Settlement",
            fields: [
              { label: "Payment method", value: selected.payment_method.replaceAll("_", " ") },
              { label: "Instrument type", value: selected.instrument_type?.replaceAll("_", " ") || "Not specified" },
              { label: "Instrument", value: selected.instrument_name || "Not specified" },
              { label: "Amount", value: formatMoney(selected.amount) },
            ],
          },
        ],
      }
    : null;

  return (
    <>
    <DataList className="rounded-none border-x-0 border-y-0 md:hidden">
      {rows.map((row) => {
        const happenedAt = "paid_at" in row ? row.paid_at : row.refunded_at;
        return (
          <ListRow
            key={`${row.payment_id}-${row.order_id}`}
            leading={<BadgeDollarSign className="h-4 w-4 text-primary" />}
            title={row.invoice_number}
            description={`${row.customer_name ?? "Walk-in"} · ${String(row.payment_method).replaceAll("_", " ")} · ${formatDateTime(happenedAt)}`}
            meta={<span className="font-semibold tabular-nums text-foreground">{formatMoney(row.amount)}</span>}
            interactive
            role="button"
            tabIndex={0}
            onClick={() => setSelected(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(row);
              }
            }}
          />
        );
      })}
    </DataList>
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">Business Date</TableHead>
            <TableHead className="min-w-[180px]">{mode === "payments" ? "Paid At" : "Refunded At"}</TableHead>
            <TableHead className="min-w-[160px]">Invoice</TableHead>
            <TableHead className="min-w-[150px]">Method</TableHead>
            <TableHead className="min-w-[180px]">Instrument</TableHead>
            <TableHead className="min-w-[180px]">Customer</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="min-w-[180px]">Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const happenedAt = "paid_at" in row ? row.paid_at : row.refunded_at;
            return (
              <TableRow
                key={`${row.payment_id}-${row.order_id}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(row);
                  }
                }}
                className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <TableCell>{row.business_date}</TableCell>
                <TableCell>{formatDateTime(happenedAt)}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.invoice_number}</div>
                </TableCell>
                <TableCell className="capitalize">{row.payment_method}</TableCell>
                <TableCell>
                  <div>{row.instrument_name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{row.instrument_type ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div>{row.customer_name ?? "Walk-in"}</div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatMoney(row.amount)}</TableCell>
                <TableCell className="font-mono text-xs">{row.reference ?? "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    <TransactionDetailSheet
      open={selected != null}
      onOpenChange={(open) => !open && setSelected(null)}
      detail={selectedDetail}
      actionHref={selected ? `/orders/${selected.order_id}` : null}
      actionLabel="Open invoice"
    />
    </>
  );
}

export function OperationalFinanceReportClient({
  mode,
  showReportNavigation = true,
  workspace,
  showHeader = true,
}: OperationalFinanceReportClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [datePreset, setDatePreset] = useState<DateRangePreset>("last30");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => presetToRange("last30"));
  const [billNumber, setBillNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [selectedSale, setSelectedSale] = useState<FinanceSalesDocument | null>(null);

  const canView = hasPermission(user, "finance.income.view");
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
      billNumber: billNumber.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
      limit: 100,
      offset: 0,
    }),
    [restaurantId, dateFrom, dateTo, billNumber, paymentMethod]
  );

  const loadReport = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const endpoint =
        mode === "sales-book"
          ? FinanceReportApis.salesBook(reportParams)
          : mode === "invoices"
            ? FinanceReportApis.invoices(reportParams)
            : mode === "payments"
              ? FinanceReportApis.payments(reportParams)
              : mode === "refunds"
                ? FinanceReportApis.refunds(reportParams)
                : FinanceReportApis.vatSales(reportParams);

      const res = await apiClient.get<BaseResponse<ReportResponse>>(endpoint);
      const nextReport = res.data?.data ?? null;
      setReport(nextReport);
      if (nextReport && (mode === "payments" || mode === "refunds")) {
        const methods = (nextReport.rows as Array<PaymentReportRow | RefundReportRow>)
          .map((row) => String(row.payment_method || "").trim())
          .filter(Boolean);
        setAvailablePaymentMethods((current) =>
          Array.from(new Set([...current, ...methods])).sort(),
        );
      }
    } catch (error) {
      console.error(`Failed to load ${mode} report`, error);
      toast.error(`Failed to load ${meta.title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, mode, meta.title, reportParams]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const exportReport = async () => {
    if (!report || report.rows.length === 0) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(report.rows as Array<Record<string, unknown>>);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta.title.slice(0, 31));
    XLSX.writeFile(wb, `${meta.title.replace(/\s+/g, "_")}_${dateFrom}_${dateTo}.xlsx`);
  };

  const clearFilters = () => {
    setBillNumber("");
    setPaymentMethod("");
  };

  const openSaleDetail = useCallback(
    async (orderId: number) => {
      if (!restaurantId) return;
      try {
        setSelectedSale(
          await financeSalesApi.getByOrder(Number(restaurantId), orderId),
        );
      } catch (error) {
        console.error("Failed to load sale detail from report", error);
        toast.error("Could not load this sale.");
      }
    },
    [restaurantId],
  );

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <AppPage width="reading">
        <PageHeader title={meta.title} description={meta.description} />
        <div className="border border-border p-6 text-sm text-muted-foreground">
          Your user does not have finance report access.
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage width="wide">
      {showHeader || showReportNavigation || workspace === "sales" ? (
      <div className="flex flex-col gap-4">
        {showHeader ? (
        <PageHeader
          title={meta.title}
          description={meta.description}
          leading={mode === "payments" ? (
            <BadgeDollarSign className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "refunds" ? (
            <RotateCcw className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "vat-sales" ? (
            <ReceiptText className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : (
            <FileText className="hidden h-6 w-6 text-muted-foreground md:block" />
          )}
        />
        ) : null}
        {showReportNavigation ? <FinanceReportNavigation /> : null}
        {workspace === "sales" ? (
          <FinanceWorkspaceNav
            links={[
              { label: "Invoices", href: "/finance/sales" },
              { label: "Sales returns", href: "/finance/sales/returns" },
            ]}
            action={
              mode === "refunds"
                ? { label: "Select invoice", href: "/finance/sales" }
                : { label: "New sale", href: "/orders/new" }
            }
          />
        ) : null}
      </div>
      ) : null}

      <ReportFilters
        title="Report filters"
        activeCount={Number(Boolean(billNumber)) + Number(Boolean(paymentMethod))}
      >
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 md:flex md:flex-wrap md:items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Date range
            </Label>
            <DateRangeDropdown
              activeRange={datePreset}
              setActiveRange={setDatePreset}
              date={dateRange}
              className="h-11 w-full rounded-xl md:w-auto"
              setDate={(value) => {
                setDatePreset("custom");
                setDateRange(value);
                const from = value?.from;
                const to = value?.to;
                if (from) {
                  setDateFrom(format(from, "yyyy-MM-dd"));
                }
                if (to) {
                  setDateTo(format(to, "yyyy-MM-dd"));
                } else if (from) {
                  setDateTo(format(from, "yyyy-MM-dd"));
                }
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-bill-number" className="text-xs text-muted-foreground">
              Bill
            </Label>
            <Input
              id="report-bill-number"
              value={billNumber}
              onChange={(event) => setBillNumber(event.target.value)}
              placeholder="Bill number"
              className="h-11 w-full rounded-xl md:w-[170px]"
            />
          </div>
          {(mode === "payments" || mode === "refunds") ? (
          <div className="grid gap-1.5">
            <Label htmlFor="report-payment-method" className="text-xs text-muted-foreground">
              Method
            </Label>
            <Select value={paymentMethod || "all"} onValueChange={(value) => setPaymentMethod(value === "all" ? "" : value)}>
              <SelectTrigger
              id="report-payment-method"
              className="h-11 w-full rounded-xl md:w-[170px]"
              >
                <SelectValue placeholder="All methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {availablePaymentMethods.map((method) => (
                  <SelectItem key={method} value={method} className="capitalize">
                    {method.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>
      </ReportFilters>

      <SummaryStrip data={report} mode={mode} />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{meta.title}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={exportReport}
              disabled={!report || report.rows.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading {meta.title.toLowerCase()}...</div>
          ) : mode === "payments" && report ? (
            <PaymentTable rows={(report as PaymentReportResponse).rows} mode="payments" />
          ) : mode === "refunds" && report ? (
            <PaymentTable rows={(report as RefundReportResponse).rows} mode="refunds" />
          ) : report ? (
            <SalesLikeTable
              rows={
                report.rows as Array<SalesBookRow | InvoiceRow | VatSalesRow>
              }
              mode={mode}
              onSelectSale={openSaleDetail}
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No report loaded.</div>
          )}
        </CardContent>
      </Card>
      <SalesDocumentDetailSheet
        open={selectedSale != null}
        onOpenChange={(open) => !open && setSelectedSale(null)}
        document={selectedSale}
      />
    </AppPage>
  );
}
