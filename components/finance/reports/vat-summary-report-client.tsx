"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { hasPermission } from "@/lib/role-permissions";
import { formatCurrency } from "@/lib/utils";
import type { FinanceReportingVatSummaryRead } from "@/types/finance-reporting";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { AccountLedgerPanel } from "@/components/finance/reports/account-ledger-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingState, EmptyState } from "@/components/patterns/feedback/feedback-state";

export function VatSummaryReportClient() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const canView = hasPermission(user, "finance.reports.tax.view");
  const canOpenAccounts = hasPermission(user, "finance.coa.view");
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [businessLine, setBusinessLine] = useState("all");
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<FinanceReportingVatSummaryRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [headId, setHeadId] = useState<number | null>(null);
  const invalid = !from || !to || from > to;

  useEffect(() => {
    if (!user?.restaurant_id || !canView || invalid) return;
    let active = true;
    setLoading(true);
    setData(null);
    setError(null);
    financeReportingApi.getVatSummary({ date_from: from, date_to: to, business_line: businessLine === "all" ? undefined : businessLine })
      .then((report) => { if (active) setData(report); })
      .catch((failure) => { if (active) setError(getApiErrorMessage(failure, "Could not load VAT summary. Try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.restaurant_id, canView, from, to, businessLine, reload, invalid]);

  async function exportSummary() {
    if (!data || loading || invalid || !hasPermission(user, "reports.export")) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = [
        ["VAT Summary", "Working summary of posted entries; not a tax return"],
        ["From", from], ["To", to], ["Business", businessLine],
        ["Output VAT", Number(data.output_vat)], ["Input VAT claimed", Number(data.input_vat)],
        ["Net VAT balance (negative means credit)", Number(data.net_vat_payable)],
        ["Unclassified purchases to review", data.unclassified_purchase_count],
        ["Older stock VAT bills to review", data.legacy_inventory_vat_count],
        [], ["Account code", "Account", "Amount"],
        ...data.rows.map((row) => [row.account_code, row.account_name, Number(row.amount)]),
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "VAT Summary");
      XLSX.writeFile(workbook, `vat-summary-${from}-${to}.xlsx`);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Could not export the VAT summary. Try again."));
    } finally { setExporting(false); }
  }

  if (!canView) return <AppPage><EmptyState title="VAT report access required" description="Ask an administrator for permission to view tax reports." /></AppPage>;
  const summary = data ? [
    { label: "VAT on sales", value: data.output_vat, detail: "Output VAT, including posted adjustments." },
    { label: "Purchase VAT claimed", value: data.input_vat, detail: "Input VAT claimed, after return adjustments." },
    { label: Number(data.net_vat_payable) < 0 ? "VAT credit balance" : "Net VAT payable", value: Math.abs(Number(data.net_vat_payable)), detail: "Output VAT minus input VAT claimed for this period." },
  ] : [];

  return <AppPage width="report">
    <PageHeader title="VAT Summary" description="VAT on sales, purchase VAT claimed, and the net balance for the selected period." actions={hasPermission(user, "reports.export") ? <Button variant="outline" onClick={() => void exportSummary()} disabled={!data || loading || invalid || exporting || !!error}><Download aria-hidden="true" className="mr-2 h-4 w-4" />{exporting ? "Exporting…" : "Export summary"}</Button> : undefined} />
    <div className="flex flex-wrap gap-4 text-sm"><Link className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href="/finance/reports">All reports</Link><Link className="inline-flex min-h-11 items-center font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href="/finance/reports/vat-sales">VAT Sales</Link></div>
    <ReportFilters title="VAT filters" variant="flat" responsiveAt="lg" activeCount={Number(businessLine !== "all")}>
      <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="space-y-1.5"><Label htmlFor="vat-from">From</Label><Input id="vat-from" name="date_from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-11 lg:w-44" /></div>
        <div className="space-y-1.5"><Label htmlFor="vat-to">To</Label><Input id="vat-to" name="date_to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-11 lg:w-44" /></div>
        {restaurant?.hotel_enabled && restaurant?.restaurant_enabled ? <div className="space-y-1.5"><Label htmlFor="vat-business">Business</Label><Select value={businessLine} onValueChange={setBusinessLine}><SelectTrigger id="vat-business" className="h-11 lg:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All businesses</SelectItem><SelectItem value="restaurant">Restaurant</SelectItem><SelectItem value="hotel">Hotel</SelectItem></SelectContent></Select></div> : null}
        <Button variant="outline" className="h-11" disabled={loading || invalid} onClick={() => setReload((value) => value + 1)}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
    </ReportFilters>
    <div aria-live="polite">
      {invalid ? <Alert variant="destructive"><AlertTitle>Check the date range</AlertTitle><AlertDescription>Enter both dates, with the start date before or equal to the end date.</AlertDescription></Alert> : error ? <Alert variant="destructive"><AlertTitle>VAT summary unavailable</AlertTitle><AlertDescription>{error}</AlertDescription><Button className="mt-3" variant="outline" onClick={() => setReload((value) => value + 1)}>Try again</Button></Alert> : loading ? <LoadingState label="Loading VAT summary…" /> : data ? <div className="space-y-5">
        <dl className="grid gap-3 md:grid-cols-3">{summary.map((item) => <div key={item.label} className="min-w-0 rounded-2xl border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">{item.label}</dt><dd className="mt-1 break-words text-xl font-semibold tabular-nums">{formatCurrency(item.value)}</dd><p className="mt-2 text-xs text-muted-foreground">{item.detail}</p></div>)}</dl>
        <p className="text-sm text-muted-foreground">This summary uses posted entries, including returns and corrections. It does not show VAT from draft bills or VAT included in costs without a claim. It is a working summary, not a filing-ready tax return.</p>
        {data.unclassified_purchase_count > 0 || data.legacy_inventory_vat_count > 0 ? <Alert><AlertTitle>Historical purchases need review</AlertTitle><AlertDescription>{data.unclassified_purchase_count} unclassified cost/equipment bills and {data.legacy_inventory_vat_count} older stock bills with VAT are in this period. Their VAT was not automatically claimed.<div className="mt-2 flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center font-medium text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href="/finance/purchases">Review purchases</Link></div></AlertDescription></Alert> : null}
        <section className="space-y-3"><h2 className="text-base font-semibold">VAT account balances</h2>
          {!data.rows.length ? <EmptyState title="No VAT entries in this period" description="Recorded sales VAT and claimed purchase VAT will appear here after posting." /> : <div className="divide-y overflow-hidden rounded-2xl border border-border bg-card">{data.rows.map((row) => <div key={row.account_id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{row.account_name}</p><p className="text-xs text-muted-foreground">{row.account_code}</p></div><div className="flex flex-wrap items-center gap-3"><span className="break-words text-sm font-semibold tabular-nums">{formatCurrency(row.amount)}</span>{canOpenAccounts ? <Button variant="outline" className="min-h-11" onClick={() => setHeadId(row.account_id)} aria-label={`View entries for ${row.account_name}`}>View entries</Button> : null}</div></div>)}</div>}
        </section>
      </div> : null}
    </div>
    {canOpenAccounts ? <AccountLedgerPanel key={`${headId}-${from}-${to}-${businessLine}`} headId={headId} onOpenChange={(open) => { if (!open) setHeadId(null); }} presentation="operational" initialDateFrom={from} initialDateTo={to} businessLine={businessLine === "all" ? undefined : businessLine} /> : null}
  </AppPage>;
}
