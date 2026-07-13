"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  BookOpen,
  CalendarCheck,
  Activity,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, DrawerSessionApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrawerSessionPanel } from "@/components/day-close/drawer-session-panel";
import type {
  CashTransferInput,
  CashTransferResult,
  DrawerCashControlSummary,
} from "@/types/accounting";
import type {
  BusinessLine,
  DrawerActivityLog,
  DrawerSession,
  DrawerSessionHistoryPage,
} from "@/types/day-close";

type BaseResponse<T> = {
  data?: T;
};

function yyyyMmDd(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CashDrawersPage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantId = user?.restaurant_id ?? restaurant?.id;
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [transferMode, setTransferMode] = useState<
    CashTransferInput["transfer_mode"]
  >("pending_bank_deposit");
  const [transferDate, setTransferDate] = useState(() => yyyyMmDd(new Date()));
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferPosting, setTransferPosting] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<CashTransferResult | null>(
    null,
  );
  const [cashSummary, setCashSummary] =
    useState<DrawerCashControlSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const [drawerSummary, setDrawerSummary] = useState({
    activeDrawerCash: 0,
    activeSessionCount: 0,
    unopenedRetainedCash: 0,
  });
  const canTransferCash = hasPermission(user, "finance.cash.transfer.to_bank");
  const canConfirmBankDeposit = hasPermission(
    user,
    "finance.bank_deposit.confirm",
  );
  const canPostSelectedTransfer =
    canTransferCash &&
    (transferMode === "pending_bank_deposit" || canConfirmBankDeposit);
  const showBusinessLinePicker = Boolean(
    restaurant?.hotel_enabled && restaurant?.restaurant_enabled,
  );
  const activeDrawerCash =
    cashSummary?.drawer_cash ??
    drawerSummary.activeDrawerCash + drawerSummary.unopenedRetainedCash;
  const safeBalance = Number(cashSummary?.safe_cash ?? 0);
  const cashInTransit = Number(cashSummary?.cash_in_transit ?? 0);
  const totalControlledCash = Number(
    cashSummary?.total_controlled_cash ??
      activeDrawerCash + safeBalance + cashInTransit,
  );
  const summaryModeLabel = cashSummary?.finance_accounting_enabled
    ? "Accounting cash balances"
    : "Operational cash view";

  const loadCashBalances = useCallback(async () => {
    if (!restaurantId) return;
    setBalanceLoading(true);
    try {
      const response = await apiClient.get<
        BaseResponse<DrawerCashControlSummary>
      >(DrawerSessionApis.cashControlSummary({ restaurantId, businessLine }));
      setCashSummary(response.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load cash control balances", error);
      setCashSummary(null);
      toast.error("Failed to load cash control balances.");
    } finally {
      setBalanceLoading(false);
    }
  }, [businessLine, restaurantId]);

  useEffect(() => {
    void loadCashBalances();
  }, [loadCashBalances, balanceRefreshKey]);

  const refreshCashBalances = () => {
    setBalanceRefreshKey((current) => current + 1);
  };

  const handleDrawerCashSummary = useCallback(
    (summary: typeof drawerSummary) => {
      setDrawerSummary((current) =>
        current.activeDrawerCash === summary.activeDrawerCash &&
        current.activeSessionCount === summary.activeSessionCount &&
        current.unopenedRetainedCash === summary.unopenedRetainedCash
          ? current
          : summary,
      );
      setCashSummary((current) => {
        if (!current) return current;
        const drawerCash =
          summary.activeDrawerCash + summary.unopenedRetainedCash;
        return {
          ...current,
          active_session_count: summary.activeSessionCount,
          active_drawer_cash: summary.activeDrawerCash,
          retained_drawer_cash: summary.unopenedRetainedCash,
          drawer_cash: drawerCash,
          total_controlled_cash:
            drawerCash +
            Number(current.safe_cash || 0) +
            Number(current.cash_in_transit || 0),
        };
      });
    },
    [],
  );

  const submitSafeTransfer = async () => {
    if (!restaurantId) return;
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid transfer amount.");
      return;
    }
    if (transferMode !== "pending_bank_deposit" && !transferReference.trim()) {
      toast.error("Bank deposit reference is required.");
      return;
    }
    setTransferPosting(true);
    try {
      const payload: CashTransferInput = {
        restaurant_id: restaurantId,
        business_line: businessLine,
        transfer_mode: transferMode,
        transfer_date: transferDate,
        amount,
        source:
          transferMode === "confirm_bank_deposit"
            ? "cash_in_transit"
            : "main_cash_safe",
        destination:
          transferMode === "pending_bank_deposit" ? "cash_in_transit" : "bank",
        reference: transferReference.trim() || null,
      };
      const response = await apiClient.post<BaseResponse<CashTransferResult>>(
        AccountingApis.createCashTransfer(),
        payload,
      );
      setLastTransfer(response.data?.data ?? null);
      setTransferAmount("");
      setTransferReference("");
      refreshCashBalances();
      toast.success("Cash transfer posted.");
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : null;
      toast.error(message || "Failed to post cash transfer.");
    } finally {
      setTransferPosting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border bg-background">
              <Banknote className="h-5 w-5 text-emerald-600" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">
                Cash Drawers
              </h1>
              <p className="text-sm text-muted-foreground">
                Open, count, close, settle, and review drawer cash outside
                checkout and day close.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showBusinessLinePicker ? (
            <Select
              value={businessLine}
              onValueChange={(value) => setBusinessLine(value as BusinessLine)}
            >
              <SelectTrigger className="h-10 min-w-[190px]">
                <SelectValue placeholder="Business line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurant drawers</SelectItem>
                <SelectItem value="hotel">Hotel drawers</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Button asChild variant="outline" className="gap-2">
            <Link href="/day-close">
              <CalendarCheck className="h-4 w-4" />
              Day close
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/finance/accounting/daybook">
              <BookOpen className="h-4 w-4" />
              Daybook
            </Link>
          </Button>
        </div>
      </div>

      {!restaurantId ? (
        <Card className="border-border/70">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            Loading restaurant context...
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash in drawers
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {formatMoney(activeDrawerCash)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {cashSummary?.active_session_count ??
                      drawerSummary.activeSessionCount}{" "}
                    active session(s)
                    {(cashSummary?.retained_drawer_cash ??
                      drawerSummary.unopenedRetainedCash) > 0
                      ? ` + ${formatMoney(cashSummary?.retained_drawer_cash ?? drawerSummary.unopenedRetainedCash)} retained unopened`
                      : ""}
                  </div>
                </div>
                <Banknote className="h-5 w-5 text-emerald-600" />
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Main safe available
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {formatMoney(safeBalance)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {cashSummary?.source_accounts?.safe_cash ??
                      "Account 1005 Main Cash / Safe"}
                  </div>
                </div>
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash in transit
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {formatMoney(cashInTransit)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {cashSummary?.source_accounts?.cash_in_transit ??
                      "Pending bank deposit account 1008"}
                  </div>
                </div>
                {balanceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Send className="h-5 w-5 text-amber-600" />
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total controlled cash
                  </div>
                  <div className="mt-1 text-xl font-semibold">
                    {formatMoney(totalControlledCash)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {summaryModeLabel}
                  </div>
                </div>
                <Wallet className="h-5 w-5 text-cyan-600" />
              </CardContent>
            </Card>
          </div>

          <DrawerSessionPanel
            restaurantId={restaurantId}
            businessLine={businessLine}
            title="Drawer workspace"
            description="Use this page for opening float, drawer count, settlement decision, cash movement review, and expected cash checks."
            footerNote="Checkout automatically uses the logged-in cashier's active drawer. Day close only verifies that drawers are closed and settled."
            onCashSummaryChange={handleDrawerCashSummary}
          />

          <DrawerHistoryCard
            restaurantId={restaurantId}
            businessLine={businessLine}
          />

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Safe to bank transfer
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Safe available {formatMoney(safeBalance)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="cash-transfer-mode">Mode</Label>
                  <Select
                    value={transferMode}
                    onValueChange={(value) =>
                      setTransferMode(
                        value as CashTransferInput["transfer_mode"],
                      )
                    }
                  >
                    <SelectTrigger id="cash-transfer-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="immediate_bank_deposit"
                        disabled={!canConfirmBankDeposit}
                      >
                        Safe to bank now
                      </SelectItem>
                      <SelectItem value="pending_bank_deposit">
                        Safe to cash in transit
                      </SelectItem>
                      <SelectItem
                        value="confirm_bank_deposit"
                        disabled={!canConfirmBankDeposit}
                      >
                        Cash in transit to bank
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cash-transfer-date">Date</Label>
                  <Input
                    id="cash-transfer-date"
                    type="date"
                    value={transferDate}
                    onChange={(event) => setTransferDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cash-transfer-amount">Amount</Label>
                  <Input
                    id="cash-transfer-amount"
                    inputMode="decimal"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cash-transfer-reference">Reference</Label>
                  <Input
                    id="cash-transfer-reference"
                    value={transferReference}
                    onChange={(event) =>
                      setTransferReference(event.target.value)
                    }
                    placeholder={
                      transferMode === "pending_bank_deposit"
                        ? "Optional"
                        : "Required"
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className="w-full gap-2"
                    onClick={submitSafeTransfer}
                    disabled={!canPostSelectedTransfer || transferPosting}
                    title={
                      !canTransferCash
                        ? "Cash-to-bank transfer permission is required."
                        : !canConfirmBankDeposit &&
                            transferMode !== "pending_bank_deposit"
                          ? "Bank deposit confirmation permission is required."
                          : undefined
                    }
                  >
                    {transferPosting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Post
                  </Button>
                </div>
              </div>
              {lastTransfer ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Posted {lastTransfer.event_type.replace(/_/g, " ")} for Rs.{" "}
                  {lastTransfer.amount.toFixed(2)}
                  {lastTransfer.journal_entry_id
                    ? ` · Journal #${lastTransfer.journal_entry_id}`
                    : ""}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DrawerHistoryCard({
  restaurantId,
  businessLine,
}: {
  restaurantId: number;
  businessLine: BusinessLine;
}) {
  const [history, setHistory] = useState<DrawerSessionHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [activityBySession, setActivityBySession] = useState<Record<number, DrawerActivityLog[]>>({});
  const [activityLoadingId, setActivityLoadingId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<BaseResponse<DrawerSessionHistoryPage>>(
        DrawerSessionApis.history({ restaurantId, businessLine, limit: 20 }),
      );
      setHistory(response.data?.data ?? { items: [], total: 0, skip: 0, limit: 20 });
    } catch (error) {
      console.error("Failed to load drawer history", error);
      setHistory(null);
      toast.error("Failed to load drawer history.");
    } finally {
      setLoading(false);
    }
  }, [businessLine, restaurantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const toggleActivity = async (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (activityBySession[sessionId]) return;
    setActivityLoadingId(sessionId);
    try {
      const response = await apiClient.get<BaseResponse<DrawerActivityLog[]>>(
        DrawerSessionApis.activity(sessionId),
      );
      setActivityBySession((current) => ({
        ...current,
        [sessionId]: response.data?.data ?? [],
      }));
    } catch (error) {
      console.error("Failed to load drawer activity", error);
      toast.error("Failed to load drawer activity.");
    } finally {
      setActivityLoadingId(null);
    }
  };

  const items = history?.items ?? [];
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Drawer history
          </span>
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={loadHistory} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drawer history...
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No drawer sessions recorded yet.</div>
        ) : (
          <>
            <div className="divide-y rounded-md border">
              {items.map((session) => {
                const activity = activityBySession[session.id] ?? [];
                const expanded = expandedSessionId === session.id;
                return (
                  <div key={session.id} className="px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-medium">
                          {session.station} / {session.drawer_key}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {session.business_date} · {statusLabel(session.status)}
                          {session.cashier_name
                            ? ` · Cashier ${session.cashier_name}`
                            : session.cashier_id
                              ? ` · Cashier #${session.cashier_id}`
                              : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">
                          {formatMoney(Number(session.counted_closing_cash ?? session.counted_opening_cash ?? 0))}
                        </span>
                        {session.cash_variance != null && Number(session.cash_variance) !== 0 ? (
                          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            Variance {formatMoney(Number(session.cash_variance))}
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => void toggleActivity(session.id)}
                        >
                          {activityLoadingId === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Activity className="h-4 w-4" />
                          )}
                          Activity
                        </Button>
                      </div>
                    </div>
                    {expanded ? (
                      <DrawerActivityRows
                        rows={activity}
                        loading={activityLoadingId === session.id}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            {history && history.total > items.length ? (
              <div className="text-xs text-muted-foreground">
                Showing latest {items.length} of {history.total} drawer sessions.
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DrawerActivityRows({
  rows,
  loading,
}: {
  rows: DrawerActivityLog[];
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading activity...
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="mt-3 text-sm text-muted-foreground">No activity logs for this drawer.</div>;
  }
  return (
    <div className="mt-3 space-y-2 rounded-md bg-muted/30 p-3">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-1 text-sm md:grid-cols-[1.2fr_1fr_auto] md:items-center">
          <div className="font-medium">{row.title}</div>
          <div className="text-muted-foreground">
            {formatDateTime(row.occurred_at)}
            {row.actor_name
              ? ` · ${row.actor_name}`
              : row.actor_id
                ? ` · User #${row.actor_id}`
                : ""}
          </div>
          {row.amount == null ? null : (
            <div className={Number(row.amount) < 0 ? "font-semibold text-red-700" : "font-semibold"}>
              {formatMoney(Number(row.amount))}
            </div>
          )}
          {row.description ? (
            <div className="text-xs text-muted-foreground md:col-span-3">{row.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function statusLabel(value: string) {
  return String(value || "unknown").replace(/_/g, " ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
