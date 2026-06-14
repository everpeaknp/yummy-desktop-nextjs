"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { AccountingNav } from "./accounting-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountingDayClose, AccountingDayClosePostingStatus } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthStart() {
  const now = new Date();
  return yyyyMmDd(new Date(now.getFullYear(), now.getMonth(), 1));
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
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

function statusClass(status: string) {
  if (status === "posted" || status === "soft_closed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (status === "blocked") return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function DayCloseReviewClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const restaurantId = user?.restaurant_id;
  const canView = hasPermission(user, "finance.accounting.view");
  const canPost = hasPermission(user, "finance.ledger.backfill");
  const canSoftClose = hasPermission(user, "finance.accounting.periods.close");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [rows, setRows] = useState<AccountingDayClose[]>([]);
  const [selected, setSelected] = useState<AccountingDayClose | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const load = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<AccountingDayClose[]>>(
        AccountingApis.dayCloses({
          restaurantId,
          dateFrom,
          dateTo,
          businessLine: "restaurant",
          timezone: "Asia/Katmandu",
          limit: 100,
        })
      );
      const nextRows = res.data?.data ?? [];
      setRows(nextRows);
      setSelected((current) => {
        if (!current) return nextRows[0] ?? null;
        return nextRows.find((row) => row.id === current.id) ?? nextRows[0] ?? null;
      });
    } catch (error) {
      console.error("Failed to load accounting day closes", error);
      toast.error("Failed to load accounting day closes");
      setRows([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const status = row.accounting_status;
        acc.cashVariance += Number(status.cash_variance || 0);
        acc.suspense += Number(status.suspense_amount || 0);
        acc.unposted += Number(status.unposted_finance_events || 0);
        if (status.status === "blocked") acc.blocked += 1;
        if (status.status === "soft_closed") acc.softClosed += 1;
        if (status.status === "posted") acc.posted += 1;
        return acc;
      },
      { posted: 0, blocked: 0, softClosed: 0, unposted: 0, suspense: 0, cashVariance: 0 }
    );
  }, [rows]);

  const refreshOne = async (dayCloseId: number) => {
    if (!restaurantId) return;
    const res = await apiClient.get<BaseResponse<AccountingDayClose>>(
      AccountingApis.dayClose(dayCloseId, restaurantId)
    );
    const updated = res.data?.data;
    if (!updated) return;
    setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    setSelected(updated);
  };

  const postMissingEvents = async (row: AccountingDayClose) => {
    if (!restaurantId) return;
    setActionId(row.id);
    try {
      const res = await apiClient.post<BaseResponse<AccountingDayClosePostingStatus>>(
        AccountingApis.postDayCloseMissingEvents(row.id, restaurantId),
        {}
      );
      toast.success(`Posted ${res.data?.data?.finance_events_posted ?? 0} finance event(s)`);
      await refreshOne(row.id);
    } catch (error) {
      console.error("Failed to post missing day-close events", error);
      toast.error("Failed to post missing day-close events");
    } finally {
      setActionId(null);
    }
  };

  const softClose = async (row: AccountingDayClose) => {
    if (!restaurantId) return;
    setActionId(row.id);
    try {
      await apiClient.post<BaseResponse<AccountingDayClosePostingStatus>>(
        AccountingApis.softCloseDayClose(row.id, restaurantId),
        {}
      );
      toast.success("Day close soft-closed for accounting");
      await refreshOne(row.id);
    } catch (error) {
      console.error("Failed to soft-close accounting day close", error);
      toast.error("Cannot soft-close while accounting checks are blocked");
    } finally {
      setActionId(null);
    }
  };

  if (!canView) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Accounting permission required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You need accounting view permission to review day closes.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 gap-2">
              <Link href="/finance/accounting">
                <ArrowLeft className="h-4 w-4" />
                Accounting
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight">Day Close Review</h1>
            <p className="text-sm text-muted-foreground">
              Daily evidence packet for accounting checks, journal posting, and cash variance review.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <AccountingNav />

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[repeat(2,180px)_1fr]">
            <label className="grid gap-1 text-sm font-medium">
              From
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              To
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Posted" value={summary.posted.toLocaleString()} />
              <Metric label="Blocked" value={summary.blocked.toLocaleString()} tone={summary.blocked ? "danger" : "default"} />
              <Metric label="Soft closed" value={summary.softClosed.toLocaleString()} />
              <Metric label="Unposted" value={summary.unposted.toLocaleString()} tone={summary.unposted ? "danger" : "default"} />
              <Metric label="Suspense" value={formatMoney(summary.suspense)} tone={summary.suspense ? "danger" : "default"} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Confirmed day closes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Journals</TableHead>
                    <TableHead className="text-right">Suspense</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const status = row.accounting_status;
                    const busy = actionId === row.id;
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <TableCell>
                          <div className="font-medium">{row.business_date}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(row.confirmed_at)}</div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${statusClass(status.status)}`}>
                            {statusLabel(status.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatMoney(status.cash_expected)}</TableCell>
                        <TableCell className="text-right">{formatMoney(status.cash_actual)}</TableCell>
                        <TableCell className="text-right">{formatMoney(status.cash_variance)}</TableCell>
                        <TableCell className="text-right">{status.journal_count}</TableCell>
                        <TableCell className="text-right">{formatMoney(status.suspense_amount)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canPost || busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                void postMissingEvents(row);
                              }}
                            >
                              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                              Post missing
                            </Button>
                            <Button
                              size="sm"
                              disabled={!canSoftClose || busy || Boolean(status.blockers.length)}
                              onClick={(event) => {
                                event.stopPropagation();
                                void softClose(row);
                              }}
                            >
                              Soft-close
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!rows.length && !loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No confirmed day closes found for this period.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounting Checks</CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-4">
                  <div className={`rounded-md border p-4 ${statusClass(selected.accounting_status.status)}`}>
                    <div className="flex items-center gap-2 font-semibold capitalize">
                      {selected.accounting_status.blockers.length ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                      {statusLabel(selected.accounting_status.status)}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                      {selected.accounting_status.blockers.length
                        ? "This day cannot be treated as accounting-clean yet."
                        : "Finance events, journals, trial balance, and suspense checks are clean."}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Unposted events" value={selected.accounting_status.unposted_finance_events.toLocaleString()} />
                    <Metric label="Journal count" value={selected.accounting_status.journal_count.toLocaleString()} />
                    <Metric label="Trial balance diff" value={formatMoney(selected.accounting_status.trial_balance_difference)} />
                    <Metric label="Cash variance" value={formatMoney(selected.accounting_status.cash_variance)} />
                  </div>

                  {selected.accounting_status.blockers.length ? (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
                      <div className="mb-2 flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
                        <AlertTriangle className="h-4 w-4" />
                        Blockers
                      </div>
                      <ul className="space-y-2 text-sm text-red-900 dark:text-red-200">
                        {selected.accounting_status.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                      <ShieldCheck className="mr-2 inline h-4 w-4" />
                      This daily evidence packet is ready for accounting review.
                    </div>
                  )}

                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Window</div>
                    <div>{formatDate(selected.period_start_at)} to {formatDate(selected.period_end_at)}</div>
                    <div className="mt-2 font-medium text-foreground">Cash variance journal</div>
                    <div>{selected.accounting_status.cash_variance_journal_entry_id ?? "No variance journal"}</div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  Select a day close to review accounting checks.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className={`rounded-md border p-3 ${tone === "danger" ? "border-red-500/30 bg-red-500/10" : "bg-muted/30"}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
