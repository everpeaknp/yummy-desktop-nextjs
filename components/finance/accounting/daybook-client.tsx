"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingNav } from "./accounting-nav";
import type { AccountingDaybook, DaybookCashTransaction } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(value: string) {
  return value.replace(/_/g, " ");
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function TransactionTable({
  rows,
  emptyLabel,
}: {
  rows: DaybookCashTransaction[];
  emptyLabel: string;
}) {
  if (rows.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">Time</TableHead>
            <TableHead className="min-w-[180px]">Type</TableHead>
            <TableHead className="min-w-[140px]">Drawer</TableHead>
            <TableHead className="min-w-[120px]">Cashier</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Signed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.drawer_session_id ?? "none"}-${row.source_type}-${row.source_id ?? index}`}>
              <TableCell>{formatDateTime(row.occurred_at)}</TableCell>
              <TableCell>
                <div className="font-medium capitalize">{row.label || sourceLabel(row.source_type)}</div>
                <div className="font-mono text-xs text-muted-foreground">{row.source_type}</div>
              </TableCell>
              <TableCell>{row.drawer_session_id ?? "-"}</TableCell>
              <TableCell>{row.cashier_id ?? "-"}</TableCell>
              <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.signed_amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DaybookClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState(() => yyyyMmDd(new Date()));
  const [businessLine, setBusinessLine] = useState("restaurant");
  const [daybook, setDaybook] = useState<AccountingDaybook | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const canView = hasPermission(user, "finance.accounting.view");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadDaybook = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<AccountingDaybook>>(
        AccountingApis.daybook({
          restaurantId,
          businessDate,
          businessLine,
        })
      );
      setDaybook(res.data?.data ?? null);
      setLoaded(true);
    } catch (error) {
      console.error("Failed to load accounting daybook", error);
      setDaybook(null);
      setLoaded(true);
      toast.error("Failed to load accounting daybook");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, businessDate, businessLine]);

  useEffect(() => {
    void loadDaybook();
  }, [loadDaybook]);

  const summary = useMemo(
    () => [
      {
        label: "Opening balance",
        value: formatMoney(daybook?.cash_control.opening_balance ?? 0),
      },
      {
        label: "Cash sales",
        value: formatMoney(daybook?.cash_control.cash_sales ?? 0),
      },
      {
        label: "Transfers out",
        value: formatMoney(daybook?.cash_control.transfers_out ?? 0),
      },
      {
        label: "Closing balance",
        value: formatMoney(daybook?.cash_control.closing_balance ?? 0),
      },
      {
        label: "Ledger debit",
        value: formatMoney(daybook?.ledger_impact.total_debit ?? 0),
      },
      {
        label: "Ledger credit",
        value: formatMoney(daybook?.ledger_impact.total_credit ?? 0),
      },
    ],
    [daybook]
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
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">Daybook</h1>
        <div className="border border-border p-6 text-sm text-muted-foreground">
          Your user does not have finance access.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 px-0" onClick={() => router.push("/finance/accounting")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Accounting
          </Button>
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Daybook</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Cash control, payment instruments, transfers, ledger impact, and close blockers for one business day.
          </p>
        </div>
        <Button onClick={() => void loadDaybook()} disabled={loading || !restaurantId} className="w-full sm:w-auto">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <AccountingNav />

      <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[180px_180px_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="business-date">Business date</Label>
          <Input
            id="business-date"
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-line">Business line</Label>
          <Input
            id="business-line"
            value={businessLine}
            onChange={(event) => setBusinessLine(event.target.value.trim().toLowerCase() || "restaurant")}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {restaurantId ? `Restaurant #${restaurantId}` : "Restaurant scope unavailable"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {summary.map((item) => (
          <Card key={item.label} className="rounded-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && !loaded ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {!loading && loaded && !daybook ? (
        <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
          No daybook data returned for this date.
        </div>
      ) : null}

      {daybook ? (
        <Tabs defaultValue="cash" className="w-full">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="cash">Cash Control</TabsTrigger>
            <TabsTrigger value="instruments">Payment Instruments</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="ledger">Ledger Impact</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="rounded-md border border-border">
            <TransactionTable
              rows={daybook.cash_control.rows}
              emptyLabel="No drawer cash movements were recorded for this day."
            />
          </TabsContent>

          <TabsContent value="instruments" className="rounded-md border border-border">
            {daybook.payment_instruments.length === 0 ? (
              <EmptyState label="No card or digital instrument transactions were recorded for this day." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment method</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Settled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daybook.payment_instruments.map((row) => (
                      <TableRow key={`${row.payment_method}-${row.instrument ?? "none"}`}>
                        <TableCell className="capitalize">{row.payment_method}</TableCell>
                        <TableCell>{row.instrument || "-"}</TableCell>
                        <TableCell className="capitalize">{row.clearing_status}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.expected_amount)}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.settled_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="transfers" className="rounded-md border border-border">
            <TransactionTable rows={daybook.transfers} emptyLabel="No drawer transfers were recorded for this day." />
          </TabsContent>

          <TabsContent value="ledger" className="rounded-md border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Finance events</div>
                <div className="text-2xl font-semibold">{daybook.ledger_impact.finance_event_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Journals</div>
                <div className="text-2xl font-semibold">{daybook.ledger_impact.journal_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total debit</div>
                <div className="text-2xl font-semibold">{formatMoney(daybook.ledger_impact.total_debit)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total credit</div>
                <div className="text-2xl font-semibold">{formatMoney(daybook.ledger_impact.total_credit)}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exceptions" className="rounded-md border border-border">
            {daybook.exceptions.length === 0 ? (
              <div className="flex items-center gap-2 p-6 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                No blocking accounting exceptions for this day.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exception</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Blocking</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daybook.exceptions.map((row) => (
                      <TableRow key={row.kind}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.blocking ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : null}
                            <span>{row.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.kind}</TableCell>
                        <TableCell>{row.blocking ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
