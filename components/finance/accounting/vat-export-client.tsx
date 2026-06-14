"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
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
import { AccountingNav } from "./accounting-nav";
import type { VatExportRequest, VatExportRun } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function monthStartInputValue() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const local = new Date(start.getTime() - start.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
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

function statusClass(status: string) {
  if (status === "generated") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "validated") return "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300";
  return "border-border bg-background text-muted-foreground";
}

function runLabel(run: VatExportRun | null) {
  if (!run) return "Not validated";
  if (run.status === "generated") return "Generated";
  if (run.can_generate) return "Ready to generate";
  return "Blocked";
}

export function VatExportClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(monthStartInputValue);
  const [dateTo, setDateTo] = useState(todayInputValue);
  const [businessLine, setBusinessLine] = useState("restaurant");
  const [latestRun, setLatestRun] = useState<VatExportRun | null>(null);
  const [runs, setRuns] = useState<VatExportRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadId, setDownloadId] = useState<number | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canExportVat = hasPermission(user, "finance.accounting.vat.export");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const payload = useCallback((): VatExportRequest => {
    if (!restaurantId) {
      throw new Error("Missing restaurant context.");
    }
    return {
      restaurant_id: restaurantId,
      date_from: dateFrom,
      date_to: dateTo,
      business_line: businessLine || "restaurant",
    };
  }, [restaurantId, dateFrom, dateTo, businessLine]);

  const loadRuns = useCallback(async () => {
    if (!restaurantId || !canView || !canExportVat) {
      toast.error("VAT export requires finance.accounting.vat.export permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<VatExportRun[]>>(
        AccountingApis.vatExportRuns({
          restaurantId,
          dateFrom,
          dateTo,
          limit: 25,
        })
      );
      setRuns(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load VAT export runs", error);
      toast.error("Failed to load VAT export runs");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, dateFrom, dateTo]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const validateVat = async () => {
    if (!restaurantId || !canView || !canExportVat) {
      toast.error("VAT export requires finance.accounting.vat.export permission.");
      return;
    }
    setValidating(true);
    try {
      const res = await apiClient.post<BaseResponse<VatExportRun>>(
        AccountingApis.validateVatExport(),
        payload()
      );
      const run = res.data?.data ?? null;
      setLatestRun(run);
      toast[run?.can_generate ? "success" : "error"](
        run?.can_generate ? "VAT export validation passed" : "VAT export validation failed"
      );
      await loadRuns();
    } catch (error) {
      console.error("Failed to validate VAT export", error);
      toast.error("Failed to validate VAT export");
    } finally {
      setValidating(false);
    }
  };

  const generateVatExport = async () => {
    if (!restaurantId || !canView || !canExportVat) {
      toast.error("VAT export requires finance.accounting.vat.export permission.");
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post<BaseResponse<VatExportRun>>(
        AccountingApis.generateVatExport(),
        payload()
      );
      const run = res.data?.data ?? null;
      setLatestRun(run);
      toast.success("Generate export completed");
      await loadRuns();
    } catch (error: any) {
      console.error("Failed to generate VAT export", error);
      toast.error(error?.response?.data?.detail || "VAT export generation failed");
      await loadRuns();
    } finally {
      setGenerating(false);
    }
  };

  const downloadCsv = async (run: VatExportRun) => {
    if (!restaurantId || !canView) return;
    setDownloadId(run.id);
    try {
      const response = await apiClient.get(
        AccountingApis.downloadVatExport(run.id, restaurantId),
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vat-export-${run.id}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download VAT export", error);
      toast.error("Failed to download VAT export");
    } finally {
      setDownloadId(null);
    }
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
        <h1 className="text-2xl font-bold">VAT export</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">VAT materialized export</h1>
              <p className="text-sm text-muted-foreground">
                Validate Sales Book VAT against ledger VAT Summary before generating a CSV export.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadRuns} disabled={loading || validating || generating}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={validateVat}
              disabled={validating || generating || !canExportVat}
              title={!canExportVat ? "VAT export requires finance.accounting.vat.export permission." : undefined}
            >
              {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Validate VAT
            </Button>
            <Button
              onClick={generateVatExport}
              disabled={validating || generating || !canExportVat}
              title={!canExportVat ? "VAT export requires finance.accounting.vat.export permission." : undefined}
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Generate export
            </Button>
          </div>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canExportVat ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          VAT export requires finance.accounting.vat.export permission.
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>VAT export filters</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(latestRun?.status ?? "")}`}>
              {runLabel(latestRun)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Date from</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date to</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Business line</Label>
            <Input value={businessLine} onChange={(event) => setBusinessLine(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sales Book VAT</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(latestRun?.sales_book_total ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ledger VAT Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(latestRun?.vat_summary_total ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Difference</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatMoney(latestRun?.difference ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rows</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{latestRun?.row_count ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Validation errors</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {(latestRun?.validation_errors_json?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">
              No validation errors for the latest run.
            </div>
          ) : (
            <div className="space-y-2">
              {latestRun?.validation_errors_json.map((error, index) => (
                <div key={`${error.code}-${index}`} className="border border-red-500/30 bg-red-500/10 p-3 text-sm">
                  <div className="font-semibold">{error.code}</div>
                  <div className="text-muted-foreground">{error.message}</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <span>Sales Book VAT: {formatMoney(error.sales_book_total ?? 0)}</span>
                    <span>Ledger VAT Summary: {formatMoney(error.vat_summary_total ?? 0)}</span>
                    <span>Difference: {formatMoney(error.difference ?? 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">VAT export runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sales Book VAT</TableHead>
                <TableHead className="text-right">Ledger VAT Summary</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {loading ? "Loading VAT export runs..." : "No VAT export runs found."}
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">#{run.id}</TableCell>
                    <TableCell>{run.date_from} to {run.date_to}</TableCell>
                    <TableCell>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase ${statusClass(run.status)}`}>
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(run.sales_book_total)}</TableCell>
                    <TableCell className="text-right">{formatMoney(run.vat_summary_total)}</TableCell>
                    <TableCell className="text-right">{formatMoney(run.difference)}</TableCell>
                    <TableCell className="text-right">{run.row_count}</TableCell>
                    <TableCell>{formatDateTime(run.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCsv(run)}
                        disabled={run.status !== "generated" || downloadId === run.id || !canExportVat}
                        title={!canExportVat ? "VAT export requires finance.accounting.vat.export permission." : undefined}
                      >
                        {downloadId === run.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
