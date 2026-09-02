"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  resolveCashDrawerBusinessLine,
  safeCashDrawerReturnPath,
} from "@/lib/cash-drawer-business-line";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrawerSessionPanel } from "@/components/day-close/drawer-session-panel";
import { DrawerHistoryDialog } from "@/components/cash-drawers/drawer-history-dialog";
import type {
  BusinessLine,
  DrawerSession,
  DrawerSessionHistoryPage,
} from "@/types/day-close";

type BaseResponse<T> = {
  data?: T;
};

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CashDrawersPage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restaurantId = user?.restaurant_id ?? restaurant?.id;
  const requestedBusinessLine = searchParams.get("business_line");
  const returnTo = safeCashDrawerReturnPath(searchParams.get("return_to"));
  const [businessLine, setBusinessLine] = useState<BusinessLine>(() =>
    resolveCashDrawerBusinessLine({
      requested: requestedBusinessLine,
      restaurantEnabled: restaurant?.restaurant_enabled,
      hotelEnabled: restaurant?.hotel_enabled,
    }),
  );
  const [drawerWorkspaceKey, setDrawerWorkspaceKey] = useState(0);
  const [drawerSummary, setDrawerSummary] = useState({
    activeDrawerCash: 0,
    activeSessionCount: 0,
    unopenedRetainedCash: 0,
  });
  const canReopenDrawer = hasPermission(user, "day_close.drawer.reopen");
  const showBusinessLinePicker = Boolean(
    restaurant?.hotel_enabled && restaurant?.restaurant_enabled,
  );
  const businessLineLabel =
    businessLine === "hotel" ? "Hotel Cash Drawers" : "Restaurant Cash Drawers";
  const activeDrawerCash =
    drawerSummary.activeDrawerCash + drawerSummary.unopenedRetainedCash;

  useEffect(() => {
    if (!restaurant) return;
    const resolved = resolveCashDrawerBusinessLine({
      requested: requestedBusinessLine,
      restaurantEnabled: restaurant.restaurant_enabled,
      hotelEnabled: restaurant.hotel_enabled,
    });
    setBusinessLine((current) => (current === resolved ? current : resolved));
  }, [requestedBusinessLine, restaurant]);

  const changeBusinessLine = (value: BusinessLine) => {
    setBusinessLine(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("business_line", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
    },
    [],
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
            <Banknote className="h-6 w-6 text-emerald-600" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {businessLineLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              Open, count, close, and settle {businessLine} drawers
              independently from the other business line.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showBusinessLinePicker ? (
            <Select
              value={businessLine}
              onValueChange={(value) =>
                changeBusinessLine(value as BusinessLine)
              }
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
          {returnTo ? (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={returnTo}>
                <ArrowLeft className="h-4 w-4" />
                Return to hotel
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" className="gap-2">
            <Link href="/finance/operations?tab=cash-drawers">
              <Settings2 className="h-4 w-4" />
              Configure drawers
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
          <Card className="overflow-hidden border-border/70">
            <CardContent className="flex flex-col gap-5 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
                  <Wallet className="h-7 w-7 text-emerald-600" />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash currently in drawers
                  </div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">
                    {formatMoney(activeDrawerCash)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {drawerSummary.activeSessionCount} active session
                  {drawerSummary.activeSessionCount === 1 ? "" : "s"}
                </span>
                {drawerSummary.unopenedRetainedCash > 0 ? (
                  <span className="rounded-full border border-amber-300/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700">
                    {formatMoney(drawerSummary.unopenedRetainedCash)} retained,
                    unopened
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <DrawerSessionPanel
            key={drawerWorkspaceKey}
            restaurantId={restaurantId}
            businessLine={businessLine}
            title={
              businessLine === "hotel"
                ? "Hotel drawer workspace"
                : "Restaurant drawer workspace"
            }
            description={`Use this workspace for ${businessLine} opening float, drawer count, settlement, cash movement review, and expected cash checks.`}
            footerNote="Checkout automatically uses the logged-in cashier's active drawer. Day close only verifies that drawers are closed and settled."
            includeAllActiveSessions
            onCashSummaryChange={handleDrawerCashSummary}
          />

          <DrawerHistoryCard
            restaurantId={restaurantId}
            businessLine={businessLine}
            canReopen={canReopenDrawer}
            onReopened={() => {
              setDrawerWorkspaceKey((current) => current + 1);
            }}
          />
        </>
      )}
    </div>
  );
}

function DrawerHistoryCard({
  restaurantId,
  businessLine,
  canReopen,
  onReopened,
}: {
  restaurantId: number;
  businessLine: BusinessLine;
  canReopen: boolean;
  onReopened: () => void;
}) {
  const [history, setHistory] = useState<DrawerSessionHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DrawerSession | null>(
    null,
  );
  const [reopenSession, setReopenSession] = useState<DrawerSession | null>(
    null,
  );
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  const submitReopen = async () => {
    if (!reopenSession) return;
    const reason = reopenReason.trim();
    if (reason.length < 5) {
      toast.error("Enter a correction reason of at least 5 characters.");
      return;
    }
    setReopening(true);
    try {
      const transferSettlement = [
        "safe_transfer",
        "pending_bank_deposit",
        "immediate_bank_deposit",
        "multi_account_transfer",
      ].includes(String(reopenSession.settlement_mode || ""));
      await apiClient.post(
        transferSettlement
          ? DrawerSessionApis.reopenForCorrection(reopenSession.id)
          : DrawerSessionApis.reopen(reopenSession.id),
        { reason },
      );
      toast.success(
        transferSettlement
          ? "Settlement transfer reversed. Recount and settle this drawer again."
          : "Drawer reopened. Recount and settle it again.",
      );
      setReopenSession(null);
      setReopenReason("");
      await loadHistory();
      onReopened();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to reopen drawer."));
    } finally {
      setReopening(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<
        BaseResponse<DrawerSessionHistoryPage>
      >(DrawerSessionApis.history({ restaurantId, businessLine, limit: 20 }));
      setHistory(
        response.data?.data ?? { items: [], total: 0, skip: 0, limit: 20 },
      );
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

  const items = history?.items ?? [];
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Drawer history
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={loadHistory}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
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
          <div className="text-sm text-muted-foreground">
            No drawer sessions recorded yet.
          </div>
        ) : (
          <>
            <div className="divide-y rounded-md border">
              {items.map((session) => {
                const hasLaterSameDaySession = items.some(
                  (candidate) =>
                    candidate.id > session.id &&
                    candidate.business_date === session.business_date &&
                    candidate.business_line === session.business_line &&
                    candidate.station === session.station &&
                    candidate.drawer_key === session.drawer_key,
                );
                return (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    className="group cursor-pointer px-4 py-3 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    onClick={() => setSelectedSession(session)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSession(session);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-medium">
                          {session.station} / {session.drawer_key}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {session.business_date} ·{" "}
                          {statusLabel(session.status)}
                          {session.cashier_name
                            ? ` · Cashier ${session.cashier_name}`
                            : session.cashier_id
                              ? ` · Cashier #${session.cashier_id}`
                              : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <div className="rounded-lg border border-border/70 bg-background px-3 py-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Opening
                          </div>
                          <div className="font-semibold tabular-nums">
                            {formatMoney(
                              Number(session.counted_opening_cash ?? 0),
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-background px-3 py-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Closing
                          </div>
                          <div className="font-semibold tabular-nums">
                            {formatMoney(
                              Number(
                                session.counted_closing_cash ??
                                  session.expected_closing_cash ??
                                  0,
                              ),
                            )}
                          </div>
                        </div>
                        {session.cash_variance != null &&
                        Number(session.cash_variance) !== 0 ? (
                          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            Variance{" "}
                            {formatMoney(Number(session.cash_variance))}
                          </span>
                        ) : null}
                        {hasLaterSameDaySession ? (
                          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            Earlier session - correct latest session
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                          View details
                          <ChevronRight className="h-4 w-4" />
                        </span>
                        {canReopen &&
                        !hasLaterSameDaySession &&
                        (session.status === "closed" ||
                          session.status === "approved") ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              setReopenSession(session);
                              setReopenReason("");
                            }}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Correct / Reopen
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {history && history.total > items.length ? (
              <div className="text-xs text-muted-foreground">
                Showing latest {items.length} of {history.total} drawer
                sessions.
              </div>
            ) : null}
          </>
        )}
      </CardContent>
      <DrawerHistoryDialog
        session={selectedSession}
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
      />
      <Dialog
        open={Boolean(reopenSession)}
        onOpenChange={(open) => {
          if (!open && !reopening) {
            setReopenSession(null);
            setReopenReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen drawer for correction?</DialogTitle>
            <DialogDescription>
              {reopenSession?.settlement_mode &&
              reopenSession.settlement_mode !== "retain_all"
                ? "This creates a compensating reversal for the recorded safe or bank transfer, keeps the original audit trail, and reopens this same session."
                : "This keeps the original activity and records who reopened it. Recount and settle the drawer again after reopening."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="drawer-reopen-reason">Correction reason</Label>
            <Textarea
              id="drawer-reopen-reason"
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              placeholder="Example: Closing cash was entered incorrectly"
              disabled={reopening}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReopenSession(null)}
              disabled={reopening}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitReopen()}
              disabled={reopening}
            >
              {reopening ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reopen drawer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function statusLabel(value: string) {
  return String(value || "unknown").replace(/_/g, " ");
}
