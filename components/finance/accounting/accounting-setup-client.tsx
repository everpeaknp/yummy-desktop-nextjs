"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Settings, Wrench } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import { AccountingNav } from "./accounting-nav";
import type { AccountingSetupStatus } from "@/types/accounting";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

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

function setupStatusClasses(ready?: boolean) {
  if (ready) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function fiscalStartLabel(status: AccountingSetupStatus | null) {
  const settings = status?.settings;
  if (!settings) return "-";
  return `${settings.fiscal_year_start_month}/${settings.fiscal_year_start_day}`;
}

export function AccountingSetupClient() {
  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();
  const [status, setStatus] = useState<AccountingSetupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const canView = hasPermission(user, "finance.accounting.view");
  const canRepairSetup = hasPermission(user, "finance.accounting.setup");
  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    void checkAuth();
  }, [user, me, router]);

  const loadSetupStatus = useCallback(async () => {
    if (!restaurantId || !canView || !canRepairSetup) {
      toast.error("Setup repair requires finance.accounting.setup permission.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<BaseResponse<AccountingSetupStatus>>(
        AccountingApis.setupStatus({ restaurantId })
      );
      setStatus(res.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load accounting setup status", error);
      setStatus(null);
      toast.error("Failed to load accounting setup status");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, canView]);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  const repairSetup = async () => {
    if (!restaurantId || !canView) return;
    setRepairing(true);
    try {
      const res = await apiClient.post<BaseResponse<AccountingSetupStatus>>(
        AccountingApis.repairSetup({ restaurantId })
      );
      const result = res.data?.data ?? null;
      setStatus(result);
      toast.success(
        `Repair setup completed: ${result?.accounts_created ?? 0} accounts and ${result?.mappings_created ?? 0} mappings added.`
      );
    } catch (error) {
      console.error("Failed to repair accounting setup", error);
      toast.error("Failed to repair accounting setup");
    } finally {
      setRepairing(false);
    }
  };

  const cards = useMemo(
    () => [
      {
        label: "Setup status",
        value: status?.ready ? "Ready" : "Needs repair",
        tone: status?.ready ? "ok" : "warning",
      },
      {
        label: "Accounts",
        value: String(status?.account_count ?? 0),
        tone: (status?.missing_account_codes?.length ?? 0) === 0 ? "ok" : "warning",
      },
      {
        label: "Mappings",
        value: String(status?.mapping_count ?? 0),
        tone: (status?.missing_mapping_count ?? 0) === 0 ? "ok" : "warning",
      },
      {
        label: "Base currency",
        value: status?.settings?.base_currency ?? "NPR",
        tone: "neutral",
      },
      {
        label: "Fiscal year start",
        value: fiscalStartLabel(status),
        tone: "neutral",
      },
      {
        label: "IRD sync",
        value: status?.settings?.ird_sync_enabled ? "Enabled" : "Disabled",
        tone: "neutral",
      },
    ],
    [status]
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
        <h1 className="text-2xl font-bold">Accounting setup</h1>
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
              <h1 className="text-2xl font-bold tracking-tight">Accounting setup</h1>
              <p className="text-sm text-muted-foreground">
                Default chart, ledger mappings, and setup repair for this restaurant.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadSetupStatus} disabled={loading || repairing}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Button
              onClick={repairSetup}
              disabled={loading || repairing || !canRepairSetup}
              title={!canRepairSetup ? "Setup repair requires finance.accounting.setup permission." : undefined}
            >
              {repairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Repair setup
            </Button>
          </div>
        </div>
        <FinanceSectionTabs />
        <AccountingNav />
      </div>

      {!canRepairSetup ? (
        <div className="border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Setup repair requires finance.accounting.setup permission.
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              {status?.ready ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
              Accounting setup
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${setupStatusClasses(status?.ready)}`}>
              {loading ? "loading" : status?.ready ? "ready" : "needs repair"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {loading && !status ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading setup status...
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {cards.map((card) => (
                  <div
                    key={card.label}
                    className={`border p-3 ${
                      card.tone === "ok"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : card.tone === "warning"
                          ? "border-amber-500/30 bg-amber-500/10"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </div>
                    <div className="mt-2 text-xl font-bold">{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-border p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Settings className="h-4 w-4" />
                    Setup details
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Missing account codes</span>
                      <span className="font-semibold">{status?.missing_account_codes?.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Missing mapping count</span>
                      <span className="font-semibold">{status?.missing_mapping_count ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                      <span className="text-muted-foreground">Latest run</span>
                      <span className="font-semibold">{status?.latest_run?.status ?? "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Latest run time</span>
                      <span className="font-semibold">{formatDateTime(status?.latest_run?.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-border p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Repair notes
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      Repair setup creates missing default accounts and mappings only. It does not delete existing accounts,
                      rewrite journals, or reset historical balances.
                    </p>
                    {(status?.warnings?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        {status?.warnings.map((warning) => (
                          <div key={warning} className="border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-300">
                        No setup warnings returned.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(status?.missing_account_codes?.length ?? 0) > 0 && (
                <div className="border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Missing account codes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status?.missing_account_codes.map((code) => (
                      <span key={code} className="border border-amber-500/40 bg-background px-2 py-1 text-xs font-semibold">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
