"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
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
import type {
  AgingBucketSummary,
  APAgingResponse,
  APAgingRow,
  ARAgingResponse,
  ARAgingRow,
  CustomerStatementResponse,
  StatementMovementRow,
  SupplierStatementResponse,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type AgingReportClientProps = {
  mode: "ar" | "ap";
};

type AgingRow = (ARAgingRow | APAgingRow) & AgingBucketSummary;
type Statement = CustomerStatementResponse | SupplierStatementResponse;

const bucketLabels: Array<[keyof AgingBucketSummary, string]> = [
  ["current", "Current"],
  ["bucket_1_7", "1-7"],
  ["bucket_8_15", "8-15"],
  ["bucket_16_30", "16-30"],
  ["bucket_31_60", "31-60"],
  ["bucket_61_90", "61-90"],
  ["over_90", "Over 90"],
];

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

function eventLabel(value: string) {
  return value.replace(/_/g, " ");
}

function partyId(row: AgingRow, mode: "ar" | "ap") {
  return mode === "ar" ? (row as ARAgingRow).customer_id : (row as APAgingRow).supplier_id;
}

function partyName(row: AgingRow, mode: "ar" | "ap") {
  return mode === "ar"
    ? (row as ARAgingRow).customer_name || `Customer #${(row as ARAgingRow).customer_id}`
    : (row as APAgingRow).supplier_name || `Supplier #${(row as APAgingRow).supplier_id}`;
}

function bridgeItems(statement: Statement | null, mode: "ar" | "ap") {
  if (!statement) return [];
  if (mode === "ar") {
    const data = statement as CustomerStatementResponse;
    return [
      ["Opening balance", data.opening_balance],
      ["New invoices", data.new_invoices],
      ["Receipts", -data.receipts],
      ["Refunds", -data.refunds],
      ["Adjustments", data.adjustments],
      ["Closing balance", data.closing_balance],
    ];
  }
  const data = statement as SupplierStatementResponse;
  return [
    ["Opening balance", data.opening_balance],
    ["New payables", data.new_payables],
    ["Payments", -data.payments],
    ["Returns", -data.returns],
    ["Adjustments", data.adjustments],
    ["Closing balance", data.closing_balance],
  ];
}

export function AgingReportClient({ mode }: AgingReportClientProps) {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [asOf, setAsOf] = useState(todayInputValue);
  const [dateFrom, setDateFrom] = useState(monthStartInputValue);
  const [dateTo, setDateTo] = useState(todayInputValue);
  const [report, setReport] = useState<ARAgingResponse | APAgingResponse | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);

  const canView = hasPermission(user, "finance.accounting.view");
  const restaurantId = user?.restaurant_id;
  const title = mode === "ar" ? "AR Aging" : "AP Aging";
  const subtitle =
    mode === "ar"
      ? "Customer receivables by unpaid balance age."
      : "Supplier payables by unpaid balance age.";
  const rows = useMemo(() => ((report?.rows ?? []) as AgingRow[]), [report]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadStatement = useCallback(
    async (id: number) => {
      if (!restaurantId || !canView) return;
      setStatementLoading(true);
      try {
        const endpoint =
          mode === "ar"
            ? AccountingApis.customerStatement({ restaurantId, customerId: id, dateFrom, dateTo })
            : AccountingApis.supplierStatement({ restaurantId, supplierId: id, dateFrom, dateTo });
        const res = await apiClient.get<BaseResponse<Statement>>(endpoint);
        setSelectedPartyId(id);
        setStatement(res.data?.data ?? null);
      } catch (error) {
        console.error("Failed to load aging statement", error);
        toast.error("Failed to load statement");
      } finally {
        setStatementLoading(false);
      }
    },
    [restaurantId, canView, mode, dateFrom, dateTo]
  );

  const loadAging = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const endpoint =
        mode === "ar"
          ? AccountingApis.arAging({ restaurantId, asOf })
          : AccountingApis.apAging({ restaurantId, asOf });
      const res = await apiClient.get<BaseResponse<ARAgingResponse | APAgingResponse>>(endpoint);
      const nextReport = res.data?.data ?? null;
      setReport(nextReport);
      const firstRow = nextReport?.rows?.[0] as AgingRow | undefined;
      if (firstRow) {
        await loadStatement(partyId(firstRow, mode));
      } else {
        setSelectedPartyId(null);
        setStatement(null);
      }
    } catch (error) {
      console.error("Failed to load aging report", error);
      toast.error("Failed to load aging report");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, mode, asOf, loadStatement]);

  useEffect(() => {
    void loadAging();
  }, [loadAging]);

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
        <h1 className="text-2xl font-bold">{title}</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadAging} disabled={loading || statementLoading}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{title} controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="aging-as-of" className="text-xs text-muted-foreground">
              As of
            </Label>
            <Input
              id="aging-as-of"
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="statement-date-from" className="text-xs text-muted-foreground">
              Statement from
            </Label>
            <Input
              id="statement-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="statement-date-to" className="text-xs text-muted-foreground">
              Statement to
            </Label>
            <Input
              id="statement-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(report?.total_outstanding ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(report?.current ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1-30 days</div>
            <div className="mt-2 text-2xl font-bold">
              {formatMoney(
                Number(report?.bucket_1_7 || 0) +
                  Number(report?.bucket_8_15 || 0) +
                  Number(report?.bucket_16_30 || 0)
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Over 90</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(report?.over_90 ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">{mode === "ar" ? "Customer balances" : "Supplier balances"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading aging report...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No open balances found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">{mode === "ar" ? "Customer" : "Supplier"}</TableHead>
                    {bucketLabels.map(([key, label]) => (
                      <TableHead key={key} className="text-right">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Statement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const id = partyId(row, mode);
                    return (
                      <TableRow key={id} className={selectedPartyId === id ? "bg-muted/40" : ""}>
                        <TableCell>
                          <div className="font-medium">{partyName(row, mode)}</div>
                          <div className="text-xs text-muted-foreground">
                            Oldest: {row.oldest_unpaid_date || "-"}
                          </div>
                        </TableCell>
                        {bucketLabels.map(([key]) => (
                          <TableCell key={key} className="text-right font-mono">
                            {formatMoney(Number(row[key] || 0))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono font-semibold">
                          {formatMoney(row.total_outstanding)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadStatement(id)}
                            disabled={statementLoading && selectedPartyId === id}
                          >
                            {statementLoading && selectedPartyId === id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Statement
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Why balance changed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {!statement ? (
            <div className="text-sm text-muted-foreground">Select a row to view its statement bridge.</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-6">
                {bridgeItems(statement, mode).map(([label, value]) => (
                  <div key={label} className="border border-border p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="mt-2 text-lg font-bold">{formatMoney(Number(value))}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statement.rows as StatementMovementRow[]).map((row) => (
                      <TableRow key={row.finance_event_id}>
                        <TableCell>{row.business_date}</TableCell>
                        <TableCell className="capitalize">{eventLabel(row.event_type)}</TableCell>
                        <TableCell>{row.reference || row.memo || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatMoney(row.balance)}
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
    </div>
  );
}
