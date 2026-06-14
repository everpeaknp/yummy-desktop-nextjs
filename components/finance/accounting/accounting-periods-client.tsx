"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Lock, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import type {
  AccountingPeriod,
  AccountingPeriodGenerateInput,
  AccountingPeriodPreflight,
} from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultYearLabel() {
  return `FY${new Date().getFullYear()}`;
}

function defaultStartDate() {
  const now = new Date();
  return yyyyMmDd(new Date(now.getFullYear(), 0, 1));
}

function defaultEndDate() {
  const now = new Date();
  return yyyyMmDd(new Date(now.getFullYear(), 11, 31));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function statusClass(status: string) {
  if (status === "locked") return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300";
  if (status === "soft_closed") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (status === "reopened") return "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AccountingPeriodsClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [preflightById, setPreflightById] = useState<Record<number, AccountingPeriodPreflight>>({});
  const [yearLabel, setYearLabel] = useState(defaultYearLabel);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [preflightId, setPreflightId] = useState<number | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canClosePeriods = hasPermission(user, "finance.accounting.periods.close");
  const canLockPeriods = hasPermission(user, "finance.accounting.periods.lock");
  const canReopenPeriods = hasPermission(user, "finance.accounting.periods.reopen");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadPeriods = useCallback(async () => {
    if (!restaurantId || !canView || !canClosePeriods) {
      toast.error("Period generation and soft close require finance.accounting.periods.close permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<AccountingPeriod[]>>(
        AccountingApis.periods({ restaurantId })
      );
      setPeriods(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load accounting periods", error);
      toast.error("Failed to load accounting periods");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const periodStats = useMemo(() => {
    const locked = periods.filter((period) => period.status === "locked").length;
    const open = periods.filter((period) => period.status === "open" || period.status === "reopened").length;
    const softClosed = periods.filter((period) => period.status === "soft_closed").length;
    return { locked, open, softClosed, total: periods.length };
  }, [periods]);

  const generatePeriods = async () => {
    if (!restaurantId || !canView) return;
    setGenerating(true);
    try {
      const payload: AccountingPeriodGenerateInput = {
        restaurant_id: restaurantId,
        year_label: yearLabel,
        start_date: startDate,
        end_date: endDate,
      };
      const res = await apiClient.post<BaseResponse<AccountingPeriod[]>>(
        AccountingApis.generatePeriods(),
        payload
      );
      setPeriods(res.data?.data ?? []);
      toast.success("Accounting periods generated.");
    } catch (error) {
      console.error("Failed to generate accounting periods", error);
      toast.error("Failed to generate accounting periods");
    } finally {
      setGenerating(false);
    }
  };

  const runPreflight = async (periodId: number) => {
    setPreflightId(periodId);
    try {
      const res = await apiClient.get<BaseResponse<AccountingPeriodPreflight>>(
        AccountingApis.periodPreflight(periodId)
      );
      const result = res.data?.data;
      if (result) {
        setPreflightById((current) => ({ ...current, [periodId]: result }));
        toast[result.can_lock ? "success" : "warning"](
          result.can_lock ? "Period preflight passed." : "Period preflight has blockers."
        );
      }
    } catch (error) {
      console.error("Failed to run period preflight", error);
      toast.error("Failed to run period preflight");
    } finally {
      setPreflightId(null);
    }
  };

  const softClosePeriod = async (periodId: number) => {
    if (!canClosePeriods) {
      toast.error("Period generation and soft close require finance.accounting.periods.close permission.");
      return;
    }
    setActionId(periodId);
    try {
      await apiClient.post<BaseResponse<AccountingPeriod>>(AccountingApis.softClosePeriod(periodId));
      toast.success("Accounting period soft closed.");
      await loadPeriods();
    } catch (error) {
      console.error("Failed to soft close accounting period", error);
      toast.error("Failed to soft close accounting period");
    } finally {
      setActionId(null);
    }
  };

  const lockPeriod = async (periodId: number) => {
    if (!canLockPeriods) {
      toast.error("Period lock requires finance.accounting.periods.lock permission.");
      return;
    }
    setActionId(periodId);
    try {
      await apiClient.post<BaseResponse<AccountingPeriod>>(AccountingApis.lockPeriod(periodId));
      toast.success("Accounting period locked.");
      await loadPeriods();
      await runPreflight(periodId);
    } catch (error) {
      console.error("Failed to lock accounting period", error);
      toast.error("Failed to lock accounting period. Run Period preflight and clear blockers first.");
    } finally {
      setActionId(null);
    }
  };

  const reopenPeriod = async (periodId: number) => {
    if (!canReopenPeriods) {
      toast.error("Period reopen requires finance.accounting.periods.reopen permission.");
      return;
    }
    setActionId(periodId);
    try {
      await apiClient.post<BaseResponse<AccountingPeriod>>(AccountingApis.reopenPeriod(periodId));
      toast.success("Accounting period reopened.");
      await loadPeriods();
    } catch (error) {
      console.error("Failed to reopen accounting period", error);
      toast.error("Failed to reopen accounting period");
    } finally {
      setActionId(null);
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
        <h1 className="text-2xl font-bold">Accounting periods</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">Accounting periods</h1>
              <p className="text-sm text-muted-foreground">
                Generate fiscal months, run period preflight, and lock closed accounting windows.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={loadPeriods} disabled={loading || generating}>
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canClosePeriods || !canLockPeriods || !canReopenPeriods ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Period generation and soft close require finance.accounting.periods.close permission. Lock and reopen use separate period permissions.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total periods", periodStats.total],
          ["Open", periodStats.open],
          ["Soft closed", periodStats.softClosed],
          ["Locked", periodStats.locked],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Generate periods</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fiscal label
            </label>
            <Input value={yearLabel} onChange={(event) => setYearLabel(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Start date
            </label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              End date
            </label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={generatePeriods}
              disabled={generating || loading || !canClosePeriods}
              title={!canClosePeriods ? "Period generation and soft close require finance.accounting.periods.close permission." : undefined}
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Generate periods
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Period preflight and locks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && periods.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading periods...
            </div>
          ) : periods.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No accounting periods exist yet. Generate periods before month close.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Period</th>
                    <th className="px-4 py-3 text-left">Date range</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Period preflight</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => {
                    const preflight = preflightById[period.id];
                    const busy = actionId === period.id || preflightId === period.id;
                    return (
                      <tr key={period.id} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{period.period_label}</div>
                          <div className="text-xs text-muted-foreground">{period.period_type}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(period.start_date)} to {formatDate(period.end_date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(period.status)}`}>
                            {period.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {preflight ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {preflight.can_lock ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                                )}
                                <span className="font-medium">
                                  {preflight.can_lock ? "Ready to lock" : `${preflight.blockers.length} blocker(s)`}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Unposted: {preflight.unposted_finance_events} | Difference: {formatMoney(preflight.trial_balance_difference)} | Suspense: {formatMoney(preflight.suspense_amount)}
                              </div>
                              {preflight.blockers.length > 0 ? (
                                <div className="text-xs text-amber-700 dark:text-amber-300">
                                  {preflight.blockers.map((blocker) => blocker.message).join(" ")}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not checked</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runPreflight(period.id)}
                              disabled={busy}
                            >
                              {preflightId === period.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Preflight
                            </Button>
                            {period.status !== "locked" ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => softClosePeriod(period.id)}
                                  disabled={busy || period.status === "soft_closed" || !canClosePeriods}
                                  title={!canClosePeriods ? "Period generation and soft close require finance.accounting.periods.close permission." : undefined}
                                >
                                  Soft close
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => lockPeriod(period.id)}
                                  disabled={busy || !canLockPeriods}
                                  title={!canLockPeriods ? "Period lock requires finance.accounting.periods.lock permission." : undefined}
                                >
                                  {actionId === period.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                                  Lock period
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => reopenPeriod(period.id)}
                                disabled={busy || !canReopenPeriods}
                                title={!canReopenPeriods ? "Period reopen requires finance.accounting.periods.reopen permission." : undefined}
                              >
                                {actionId === period.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                Reopen
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
