"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Database, History, Loader2, PlayCircle, Scale } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, AccountingReportApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import { AccountingDrilldownDrawer } from "./accounting-drilldown-drawer";
import { FinancialReportFilters } from "./financial-report-filters";
import { MappingExceptionBanner } from "./mapping-exception-banner";
import { TrialBalanceTable } from "./trial-balance-table";
import type {
  AccountingBackfillRequest,
  AccountingBackfillRun,
  AccountingDrilldownResponse,
  AccountingHealthItem,
  AccountingHealthResponse,
  AccountingPostResult,
  MappingExceptionReportResponse,
  TrialBalanceResponse,
} from "@/types/accounting";

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return yyyyMmDd(date);
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatRunTime(value?: string | null) {
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

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function metricDifference(data: TrialBalanceResponse | null) {
  return Math.abs(Number(data?.total_debit ?? 0) - Number(data?.total_credit ?? 0));
}

function healthStatusClasses(status?: string) {
  if (status === "ok") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (status === "blocked") return "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300";
  if (status === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function formatHealthValue(item: AccountingHealthItem) {
  if (item.value === null || item.value === undefined || item.value === "") return "-";
  if (typeof item.value === "boolean") return item.value ? "Yes" : "No";
  if (typeof item.value === "number") return Number(item.value).toLocaleString();
  return String(item.value);
}

export function AccountingOverviewClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(defaultStartDate);
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [station, setStation] = useState("");
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [mappingExceptions, setMappingExceptions] = useState<MappingExceptionReportResponse | null>(null);
  const [accountingHealth, setAccountingHealth] = useState<AccountingHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<AccountingPostResult | null>(null);
  const [backfillRuns, setBackfillRuns] = useState<AccountingBackfillRun[]>([]);
  const [dryRunResult, setDryRunResult] = useState<AccountingBackfillRun | null>(null);
  const [commitResult, setCommitResult] = useState<AccountingBackfillRun | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("Accounting trace");
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<AccountingDrilldownResponse | null>(null);

  const canView = hasPermission(user, "finance.accounting.view");
  const canRunBackfill = hasPermission(user, "finance.ledger.backfill");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadTrialBalance = useCallback(async () => {
    if (!restaurantId || !canView) return;
    setLoading(true);
    try {
      const params = {
        restaurantId,
        dateFrom,
        dateTo,
        businessLine: "restaurant",
        timezone: "Asia/Katmandu",
        station: station.trim() || undefined,
      };
      const [healthRes, trialBalanceRes, mappingExceptionRes] = await Promise.all([
        apiClient.get<BaseResponse<AccountingHealthResponse>>(AccountingApis.health(params)),
        apiClient.get<BaseResponse<TrialBalanceResponse>>(AccountingReportApis.trialBalance(params)),
        apiClient.get<BaseResponse<MappingExceptionReportResponse>>(
          AccountingReportApis.mappingExceptions(params)
        ),
      ]);
      setAccountingHealth(healthRes.data?.data ?? null);
      setTrialBalance(trialBalanceRes.data?.data ?? null);
      setMappingExceptions(mappingExceptionRes.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load trial balance", error);
      setAccountingHealth(null);
      setTrialBalance(null);
      setMappingExceptions(null);
      toast.error("Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView, dateFrom, dateTo, station]);

  useEffect(() => {
    void loadTrialBalance();
  }, [loadTrialBalance]);

  const loadBackfillRuns = useCallback(async () => {
    if (!restaurantId || !canView) return;
    try {
      const res = await apiClient.get<BaseResponse<AccountingBackfillRun[]>>(
        AccountingApis.backfillRuns({ restaurantId, limit: 5 })
      );
      setBackfillRuns(res.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load accounting backfill runs", error);
      setBackfillRuns([]);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadBackfillRuns();
  }, [loadBackfillRuns]);

  const openAccountDrilldown = useCallback(
    async (accountId: number, title: string) => {
      if (!restaurantId) return;
      setDrilldownTitle(title);
      setDrilldownOpen(true);
      setDrilldownLoading(true);
      try {
        const res = await apiClient.get<BaseResponse<AccountingDrilldownResponse>>(
          AccountingApis.drilldown({
            restaurantId,
            dateFrom,
            dateTo,
            station: station.trim() || undefined,
            accountId,
          })
        );
        setDrilldownData(res.data?.data ?? null);
      } catch (error) {
        console.error("Failed to load accounting drilldown", error);
        setDrilldownData(null);
        toast.error("Failed to load accounting trace");
      } finally {
        setDrilldownLoading(false);
      }
    },
    [restaurantId, dateFrom, dateTo, station]
  );

  const postFinanceEvents = async () => {
    if (!restaurantId || !canView || !canRunBackfill) {
      toast.error("Accounting posting requires finance.ledger.backfill permission.");
      return;
    }
    setPosting(true);
    try {
      const res = await apiClient.post<BaseResponse<AccountingPostResult>>(
        AccountingApis.postFinanceEvents({
          restaurantId,
          dateFrom,
          dateTo,
        })
      );
      const result = res.data?.data ?? null;
      setPostResult(result);
      toast.success(
        `Posted ${result?.posted_count ?? 0} journal entries, skipped ${result?.skipped_count ?? 0}.`
      );
      await loadTrialBalance();
    } catch (error) {
      console.error("Failed to post finance events", error);
      toast.error("Failed to post finance events");
    } finally {
      setPosting(false);
    }
  };

  const runBackfillDryRun = async () => {
    if (!restaurantId || !canView || !canRunBackfill) {
      toast.error("Accounting backfill requires finance.ledger.backfill permission.");
      return;
    }
    setBackfillLoading(true);
    setCommitResult(null);
    try {
      const payload: AccountingBackfillRequest = {
        restaurant_id: restaurantId,
        date_from: dateFrom,
        date_to: dateTo,
        business_line: "restaurant",
      };
      const res = await apiClient.post<BaseResponse<AccountingBackfillRun>>(
        AccountingApis.backfillDryRun(),
        payload
      );
      const result = res.data?.data ?? null;
      setDryRunResult(result);
      toast.success(`Dry run found ${result?.expected_journal_count ?? 0} expected journals.`);
      await loadBackfillRuns();
    } catch (error) {
      console.error("Failed to dry-run accounting backfill", error);
      toast.error("Failed to dry-run accounting backfill");
    } finally {
      setBackfillLoading(false);
    }
  };

  const commitBackfill = async () => {
    if (!dryRunResult?.id) {
      toast.error("Run a dry run before committing backfill.");
      return;
    }
    if (!canRunBackfill) {
      toast.error("Accounting backfill requires finance.ledger.backfill permission.");
      return;
    }
    setCommitLoading(true);
    try {
      const res = await apiClient.post<BaseResponse<AccountingBackfillRun>>(
        AccountingApis.backfillCommit(dryRunResult.id)
      );
      const result = res.data?.data ?? null;
      setCommitResult(result);
      toast.success(`Committed backfill: ${result?.journals_posted ?? 0} journals posted.`);
      await Promise.all([loadTrialBalance(), loadBackfillRuns()]);
    } catch (error) {
      console.error("Failed to commit accounting backfill", error);
      toast.error("Failed to commit accounting backfill");
    } finally {
      setCommitLoading(false);
    }
  };

  const exportTrialBalance = async () => {
    if (!trialBalance?.rows.length) return;
    const XLSX = await import("xlsx");
    const rows = trialBalance.rows.map((row) => ({
      Code: row.account_code,
      Account: row.account_name,
      Type: row.account_type,
      Debit: row.debit,
      Credit: row.credit,
      Balance: row.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
    XLSX.writeFile(wb, `Trial_Balance_${dateFrom}_${dateTo}.xlsx`);
  };

  const summary = useMemo(
    () => [
      { label: "Total Debit", value: formatMoney(trialBalance?.total_debit ?? 0) },
      { label: "Total Credit", value: formatMoney(trialBalance?.total_credit ?? 0) },
      { label: "Difference", value: formatMoney(metricDifference(trialBalance)) },
      { label: "Accounts Posted", value: String(trialBalance?.rows.length ?? 0) },
    ],
    [trialBalance]
  );

  const healthItems = useMemo<AccountingHealthItem[]>(() => {
    if (!accountingHealth) return [];
    return [
      accountingHealth.accounts_seeded,
      accountingHealth.mappings_seeded,
      accountingHealth.opening_balances_posted,
      accountingHealth.latest_backfill_status,
      accountingHealth.unposted_finance_events,
      accountingHealth.trial_balance_difference,
      accountingHealth.missing_mapping_count,
      accountingHealth.suspense_amount,
      accountingHealth.open_period,
      accountingHealth.locked_period_violations,
      accountingHealth.vat_sales_difference,
      accountingHealth.payment_settlement_variance,
    ];
  }, [accountingHealth]);

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
        <h1 className="text-2xl font-bold">Accounting</h1>
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
            <Link href="/finance/income">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
              <p className="text-sm text-muted-foreground">Journals, ledger mappings, and financial statements.</p>
            </div>
          </div>
          <Button
            onClick={postFinanceEvents}
            disabled={posting || loading || !canRunBackfill}
            title={!canRunBackfill ? "Accounting posting requires finance.ledger.backfill permission." : undefined}
          >
            {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Post Finance Events
          </Button>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      <FinancialReportFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        station={station}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onStationChange={setStation}
        onRefresh={loadTrialBalance}
        refreshing={loading}
        onExport={exportTrialBalance}
        exportDisabled={!trialBalance?.rows.length}
      />

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              {accountingHealth?.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              Accounting Health
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${healthStatusClasses(accountingHealth?.status)}`}>
              {accountingHealth?.status ?? "loading"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {loading && healthItems.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading accounting health...
            </div>
          ) : healthItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Accounting health is not available.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {healthItems.map((item) => (
                <div key={item.key} className={`border p-3 ${healthStatusClasses(item.status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</div>
                      <div className="mt-1 text-xl font-bold">{formatHealthValue(item)}</div>
                    </div>
                    <span className="text-xs font-semibold uppercase">{item.status}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 opacity-90">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {postResult && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          Posted {postResult.posted_count} journal entries and skipped {postResult.skipped_count}.
        </div>
      )}

      <MappingExceptionBanner
        missingCount={mappingExceptions?.missing_mapping_count ?? 0}
        suspenseAmount={mappingExceptions?.suspense_amount ?? 0}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Trial Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TrialBalanceTable data={trialBalance} loading={loading} onOpenDrilldown={openAccountDrilldown} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Historical Backfill
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={runBackfillDryRun}
                  disabled={backfillLoading || commitLoading || !canRunBackfill}
                  title={!canRunBackfill ? "Accounting backfill requires finance.ledger.backfill permission." : undefined}
                >
                  {backfillLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Dry Run Backfill
                </Button>
                <Button
                  onClick={commitBackfill}
                  disabled={!dryRunResult || backfillLoading || commitLoading || !canRunBackfill}
                  title={!canRunBackfill ? "Accounting backfill requires finance.ledger.backfill permission." : undefined}
                >
                  {commitLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Commit Backfill
                </Button>
              </div>

              <div className="grid gap-2 border-y border-border py-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expected journals</span>
                  <span className="font-semibold">{dryRunResult?.expected_journal_count ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Missing mappings</span>
                  <span className="font-semibold">{dryRunResult?.missing_mapping_count ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Suspense amount</span>
                  <span className="font-semibold">{formatMoney(dryRunResult?.suspense_amount ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Journals posted</span>
                  <span className="font-semibold">{commitResult?.journals_posted ?? 0}</span>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <History className="h-4 w-4" />
                  Backfill Runs
                </div>
                {backfillRuns.length === 0 ? (
                  <div className="text-muted-foreground">No backfill runs recorded.</div>
                ) : (
                  <div className="space-y-2">
                    {backfillRuns.map((run) => (
                      <div key={run.id} className="border border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium capitalize">{run.mode.replace(/_/g, " ")}</span>
                          <span className="text-xs text-muted-foreground">{formatRunTime(run.created_at)}</span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Status: {run.status}</span>
                          <span>Posted: {run.journals_posted}</span>
                          <span>Missing: {run.missing_mapping_count}</span>
                          <span>Skipped: {run.journals_skipped}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Accounting Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Finance events</span>
                <span className="font-semibold">Source</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Journal entries</span>
                <span className="font-semibold">Posted</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trial balance</span>
                <span className="font-semibold">Report</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-2 p-4">
              <Link href="/finance/accounting/chart-of-accounts">
                <Button variant="outline" className="w-full justify-start">
                  Chart of Accounts
                </Button>
              </Link>
              <Link href="/finance/accounting/ledger-mapping">
                <Button variant="outline" className="w-full justify-start">
                  Ledger Mapping
                </Button>
              </Link>
              <Link href="/finance/accounting/trial-balance">
                <Button variant="outline" className="w-full justify-start">
                  Trial Balance Report
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <AccountingDrilldownDrawer
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        title={drilldownTitle}
        data={drilldownData}
        loading={drilldownLoading}
      />
    </div>
  );
}
