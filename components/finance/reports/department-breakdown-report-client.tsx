"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { FinanceReportNavigation } from "@/components/finance/reports/finance-report-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import type { FinanceReportingDepartmentBreakdownRead } from "@/types/finance-reporting";

function formatMoney(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DepartmentBreakdownReportClient() {
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinanceReportingDepartmentBreakdownRead | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await financeReportingApi.getDepartmentBreakdown({
        date_from: dateFrom,
        date_to: dateTo,
      });
      setReport(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <FinanceReportNavigation />

      <Card>
        <CardHeader>
          <CardTitle>Performance by Department</CardTitle>
          <CardDescription>
            Revenue, cost, and margin per station (Kitchen, Bar, Cafe, or any custom department) for the
            selected period. This slices the same Food/Beverage/Rooms accounts you already see in Profit
            &amp; Loss by station — it does not add new ledger accounts, so totals here reconcile to the
            standard Chart of Accounts. Note: every row also includes any unattributed/global entries for
            the period (e.g. opening balances), so rows share that baseline rather than summing to the
            period&apos;s grand total.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="date_from">From</Label>
              <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date_to">To</Label>
              <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load report</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : report && report.departments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.departments.map((dept) => (
                  <TableRow key={dept.station}>
                    <TableCell className="font-medium capitalize">{dept.station}</TableCell>
                    <TableCell className="text-right">{formatMoney(dept.total_income)}</TableCell>
                    <TableCell className="text-right">{formatMoney(dept.total_expenses)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${Number(dept.net_profit) < 0 ? "text-destructive" : ""}`}
                    >
                      {formatMoney(dept.net_profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !error && <p className="text-sm text-muted-foreground py-8 text-center">No department activity for this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
