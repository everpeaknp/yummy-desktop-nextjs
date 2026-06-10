"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { FinanceReportApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
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
};

const reportLinks: Array<{ href: string; label: string; mode: ReportMode }> = [
  { href: "/finance/reports/sales-book", label: "Sales Book", mode: "sales-book" },
  { href: "/finance/reports/invoices", label: "Invoices", mode: "invoices" },
  { href: "/finance/reports/payments", label: "Payments", mode: "payments" },
  { href: "/finance/reports/refunds", label: "Refunds", mode: "refunds" },
  { href: "/finance/reports/vat-sales", label: "VAT Sales", mode: "vat-sales" },
];

const reportMeta: Record<ReportMode, { title: string; description: string }> = {
  "sales-book": {
    title: "Sales Book",
    description: "Completed bills with sales, discount, tax, service charge, settlement, and balance.",
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
    title: "Refunds",
    description: "Refund and reversal payments by refund date, method, customer, and invoice.",
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
  const amountLabel = mode === "payments" ? "Collected" : mode === "refunds" ? "Refunded" : "Grand Total";
  const items = [
    { label: "Rows", value: String(data?.total ?? 0) },
    { label: amountLabel, value: formatMoney(reportTotalAmount(data)) },
    { label: "VAT", value: formatMoney(reportTaxAmount(data)) },
    { label: "Discount", value: formatMoney(reportDiscountAmount(data)) },
    { label: "Balance Due", value: formatMoney(reportBalanceDue(data)) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="border border-border px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
          <div className="mt-1 font-mono text-lg font-semibold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function SalesLikeTable({
  rows,
  mode,
}: {
  rows: Array<SalesBookRow | InvoiceRow | VatSalesRow>;
  mode: ReportMode;
}) {
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No report rows found.</div>;
  }

  const includeSettlement = mode !== "vat-sales";

  return (
    <div className="overflow-x-auto">
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
            <TableRow key={`${row.order_id}-${row.invoice_number}`}>
              <TableCell>{row.business_date}</TableCell>
              <TableCell>
                <div className="font-medium">{row.invoice_number}</div>
                <div className="font-mono text-xs text-muted-foreground">Order #{row.order_id}</div>
              </TableCell>
              <TableCell>{formatDateTime(row.completed_at)}</TableCell>
              <TableCell>
                <div>{row.customer_name ?? "Walk-in"}</div>
                <div className="text-xs text-muted-foreground">Customer {row.customer_id ?? "-"}</div>
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
  );
}

function PaymentTable({
  rows,
  mode,
}: {
  rows: Array<PaymentReportRow | RefundReportRow>;
  mode: "payments" | "refunds";
}) {
  if (rows.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No report rows found.</div>;
  }

  return (
    <div className="overflow-x-auto">
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
              <TableRow key={`${row.payment_id}-${row.order_id}`}>
                <TableCell>{row.business_date}</TableCell>
                <TableCell>{formatDateTime(happenedAt)}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.invoice_number}</div>
                  <div className="font-mono text-xs text-muted-foreground">Order #{row.order_id}</div>
                </TableCell>
                <TableCell className="capitalize">{row.payment_method}</TableCell>
                <TableCell>
                  <div>{row.instrument_name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{row.instrument_type ?? "-"}</div>
                </TableCell>
                <TableCell>
                  <div>{row.customer_name ?? "Walk-in"}</div>
                  <div className="text-xs text-muted-foreground">Customer {row.customer_id ?? "-"}</div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatMoney(row.amount)}</TableCell>
                <TableCell className="font-mono text-xs">{row.reference ?? "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function OperationalFinanceReportClient({ mode }: OperationalFinanceReportClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const pathname = usePathname();
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [billNumber, setBillNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

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
      setReport(res.data?.data ?? null);
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
          Your user does not have finance report access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          {mode === "payments" ? (
            <BadgeDollarSign className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "refunds" ? (
            <RotateCcw className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : mode === "vat-sales" ? (
            <ReceiptText className="hidden h-6 w-6 text-muted-foreground md:block" />
          ) : (
            <FileText className="hidden h-6 w-6 text-muted-foreground md:block" />
          )}
        </div>
        <FinanceSectionTabs />
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {reportLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href === "/finance/reports/sales-book" && pathname === "/finance/reports");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-border bg-muted/20 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="report-date-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="report-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-date-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="report-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px]"
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
              className="h-9 w-[170px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-payment-method" className="text-xs text-muted-foreground">
              Method
            </Label>
            <Input
              id="report-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              placeholder="cash, card, credit"
              className="h-9 w-[170px]"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={loadReport} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportReport} disabled={!report || report.rows.length === 0}>
            <Search className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <SummaryStrip data={report} mode={mode} />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{meta.title}</CardTitle>
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
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No report loaded.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
