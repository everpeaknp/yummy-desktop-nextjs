"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, BookOpen, CalendarCheck, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, AccountingReportApis } from "@/lib/api/endpoints";
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
import type { CashTransferInput, CashTransferResult, TrialBalanceResponse } from "@/types/accounting";
import type { BusinessLine } from "@/types/day-close";

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

function accountBalance(report: TrialBalanceResponse | null, code: string) {
  const row = report?.rows.find((item) => item.account_code === code);
  return Number(row?.balance ?? 0);
}

export default function CashDrawersPage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const restaurantId = user?.restaurant_id ?? restaurant?.id;
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [transferMode, setTransferMode] = useState<CashTransferInput["transfer_mode"]>("pending_bank_deposit");
  const [transferDate, setTransferDate] = useState(() => yyyyMmDd(new Date()));
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferPosting, setTransferPosting] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<CashTransferResult | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const [drawerSummary, setDrawerSummary] = useState({
    activeDrawerCash: 0,
    activeSessionCount: 0,
    unopenedRetainedCash: 0,
  });
  const canTransferCash = hasPermission(user, "finance.cash.transfer.to_bank");
  const canConfirmBankDeposit = hasPermission(user, "finance.bank_deposit.confirm");
  const canPostSelectedTransfer =
    canTransferCash &&
    (transferMode === "pending_bank_deposit" || canConfirmBankDeposit);
  const showBusinessLinePicker = Boolean(
    restaurant?.hotel_enabled && restaurant?.restaurant_enabled,
  );
  const activeDrawerCash = drawerSummary.activeDrawerCash + drawerSummary.unopenedRetainedCash;
  const safeBalance = useMemo(() => accountBalance(trialBalance, "1005"), [trialBalance]);
  const cashInTransit = useMemo(() => accountBalance(trialBalance, "1008"), [trialBalance]);

  const loadCashBalances = useCallback(async () => {
    if (!restaurantId) return;
    setBalanceLoading(true);
    try {
      const response = await apiClient.get<BaseResponse<TrialBalanceResponse>>(
        AccountingReportApis.trialBalance({ restaurantId }),
      );
      setTrialBalance(response.data?.data ?? null);
    } catch (error) {
      console.error("Failed to load cash control balances", error);
      setTrialBalance(null);
      toast.error("Failed to load cash control balances.");
    } finally {
      setBalanceLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadCashBalances();
  }, [loadCashBalances, balanceRefreshKey]);

  const refreshCashBalances = () => {
    setBalanceRefreshKey((current) => current + 1);
  };

  const handleDrawerCashSummary = useCallback((summary: typeof drawerSummary) => {
    setDrawerSummary((current) =>
      current.activeDrawerCash === summary.activeDrawerCash &&
      current.activeSessionCount === summary.activeSessionCount &&
      current.unopenedRetainedCash === summary.unopenedRetainedCash
        ? current
        : summary,
    );
  }, []);

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
        source: transferMode === "confirm_bank_deposit" ? "cash_in_transit" : "main_cash_safe",
        destination: transferMode === "pending_bank_deposit" ? "cash_in_transit" : "bank",
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
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
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
                Open, count, close, settle, and review drawer cash outside checkout and day close.
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
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-border/70">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash in drawers
                  </div>
                  <div className="mt-1 text-xl font-semibold">{formatMoney(activeDrawerCash)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {drawerSummary.activeSessionCount} active session(s)
                    {drawerSummary.unopenedRetainedCash > 0
                      ? ` + ${formatMoney(drawerSummary.unopenedRetainedCash)} retained unopened`
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
                  <div className="mt-1 text-xl font-semibold">{formatMoney(safeBalance)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Account 1005 Main Cash / Safe</div>
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
                  <div className="mt-1 text-xl font-semibold">{formatMoney(cashInTransit)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Pending bank deposit account 1008</div>
                </div>
                {balanceLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Send className="h-5 w-5 text-amber-600" />
                )}
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
                  <Select value={transferMode} onValueChange={(value) => setTransferMode(value as CashTransferInput["transfer_mode"])}>
                    <SelectTrigger id="cash-transfer-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate_bank_deposit" disabled={!canConfirmBankDeposit}>Safe to bank now</SelectItem>
                      <SelectItem value="pending_bank_deposit">Safe to cash in transit</SelectItem>
                      <SelectItem value="confirm_bank_deposit" disabled={!canConfirmBankDeposit}>Cash in transit to bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cash-transfer-date">Date</Label>
                  <Input id="cash-transfer-date" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
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
                    onChange={(event) => setTransferReference(event.target.value)}
                    placeholder={transferMode === "pending_bank_deposit" ? "Optional" : "Required"}
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
                        : !canConfirmBankDeposit && transferMode !== "pending_bank_deposit"
                          ? "Bank deposit confirmation permission is required."
                          : undefined
                    }
                  >
                    {transferPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Post
                  </Button>
                </div>
              </div>
              {lastTransfer ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Posted {lastTransfer.event_type.replace(/_/g, " ")} for Rs. {lastTransfer.amount.toFixed(2)}
                  {lastTransfer.journal_entry_id ? ` · Journal #${lastTransfer.journal_entry_id}` : ""}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
