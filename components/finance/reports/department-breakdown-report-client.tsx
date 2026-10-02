"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Building2, Loader2, RefreshCw } from "lucide-react";

import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { ReportFilters } from "@/components/reports/report-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatCurrency } from "@/lib/utils";
import type { FinanceReportingDepartmentBreakdownRead } from "@/types/finance-reporting";

function localIso(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function todayIso(): string {
  return localIso(new Date());
}

function monthStartIso(): string {
  const date = new Date();
  date.setDate(1);
  return localIso(date);
}

function departmentName(value: string): string {
  if (value === "unassigned") return "Unassigned";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportError(error: unknown) {
  const candidate = error as {
    response?: { data?: { detail?: string } };
    message?: string;
  };
  return (
    candidate.response?.data?.detail ||
    candidate.message ||
    "Failed to load report"
  );
}

export function DepartmentBreakdownReportClient() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] =
    useState<FinanceReportingDepartmentBreakdownRead | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(
        await financeReportingApi.getDepartmentBreakdown({
          date_from: dateFrom,
          date_to: dateTo,
        }),
      );
    } catch (requestError: unknown) {
      setError(reportError(requestError));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return (
    <AppPage width="report">
      <PageHeader
        title="Performance by Department"
        description="Revenue, expenses, and net result by reporting department. Activity without a department remains Unassigned."
      />

      <ReportFilters
        title="Report filters"
        responsiveAt="lg"
        actions={
          <Button onClick={() => void fetchReport()} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Apply
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
          <div className="grid gap-1.5">
            <Label
              htmlFor="date_from"
              className="text-xs text-muted-foreground"
            >
              From
            </Label>
            <Input
              id="date_from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-11 rounded-xl lg:w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date_to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="date_to"
              type="date"
              min={dateFrom}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-11 rounded-xl lg:w-40"
            />
          </div>
        </div>
      </ReportFilters>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load report</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : report && report.departments.length > 0 ? (
            <>
              <DataList className="rounded-none border-0 lg:hidden">
                {report.departments.map((department) => (
                  <ListRow
                    key={department.station}
                    leading={<Building2 className="h-4 w-4 text-primary" />}
                    title={departmentName(department.station)}
                    description={`Revenue ${formatCurrency(department.total_income)} · Expenses ${formatCurrency(department.total_expenses)}`}
                    meta={
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatCurrency(department.net_profit)}
                      </span>
                    }
                  />
                ))}
              </DataList>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.departments.map((department) => (
                      <TableRow key={department.station}>
                        <TableCell className="font-medium">
                          {departmentName(department.station)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(department.total_income)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(department.total_expenses)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(department.net_profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : !error ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No department activity in this period. Try a wider date range.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </AppPage>
  );
}
