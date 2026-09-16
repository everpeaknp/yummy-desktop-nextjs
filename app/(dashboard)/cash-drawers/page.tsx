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
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { hasPermission } from "@/lib/role-permissions";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  resolveCashDrawerBusinessLine,
  safeCashDrawerReturnPath,
} from "@/lib/cash-drawer-business-line";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
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
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import type {
  BusinessLine,
  DrawerSession,
  DrawerSessionHistoryPage,
} from "@/types/day-close";

type BaseResponse<T> = {
  data?: T;
};

const formatMoney = formatCurrency;

function activeDrawerCountLabel(count: number) {
  return `${count} active ${count === 1 ? "drawer" : "drawers"}`;
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

  const workspaceActions = (
    <>
      {showBusinessLinePicker ? (
        <Select
          value={businessLine}
          onValueChange={(value) => changeBusinessLine(value as BusinessLine)}
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
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link href="/finance/operations?tab=cash-drawers">
          <Settings2 className="h-4 w-4" />
          Configure drawers
        </Link>
      </Button>
    </>
  );

  return (
    <AppPage width="wide" className="pb-20">
      <PageHeader
        className="hidden md:flex"
        title={businessLineLabel}
        leading={
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Banknote className="h-6 w-6 text-emerald-600" />
          </span>
        }
        description={`Open, count, close, and settle ${businessLine} drawers independently from the other business line.`}
        actions={workspaceActions}
      />

      {showBusinessLinePicker || returnTo ? (
        <div className="flex items-center gap-2 md:hidden">
          {showBusinessLinePicker ? (
            <div className="min-w-0 flex-1">
              <Select
                value={businessLine}
                onValueChange={(value) =>
                  changeBusinessLine(value as BusinessLine)
                }
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Business line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant drawers</SelectItem>
                  <SelectItem value="hotel">Hotel drawers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {returnTo ? (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Return to hotel"
            >
              <Link href={returnTo}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {!restaurantId ? (
        <div className="flex items-center gap-3 border-y border-border/70 py-5 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          Loading restaurant context...
        </div>
      ) : (
        <>
          <section
            aria-label="Current drawer cash"
            className="flex items-end justify-between gap-4 border-b border-border/70 pb-4"
          >
            <div>
              <p className="text-sm text-muted-foreground">Cash in drawers</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                {formatMoney(activeDrawerCash)}
              </p>
            </div>
            <div className="max-w-[11rem] pb-0.5 text-right text-xs text-muted-foreground">
              <p>{activeDrawerCountLabel(drawerSummary.activeSessionCount)}</p>
              {drawerSummary.unopenedRetainedCash > 0 ? (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  {formatMoney(drawerSummary.unopenedRetainedCash)} retained
                </p>
              ) : null}
            </div>
          </section>

          <DrawerSessionPanel
            key={drawerWorkspaceKey}
            restaurantId={restaurantId}
            businessLine={businessLine}
            title="Active drawer"
            presentation="flat"
            footerNote="Checkout uses the logged-in cashier's active drawer. Day close verifies closure and settlement."
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
    </AppPage>
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
    <section className="space-y-3 border-t border-border/70 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-h-11 items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4" />
          Drawer history
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-2"
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
      </div>
      <div className="space-y-3">
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
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
              <div className="hidden grid-cols-[150px_minmax(160px,1fr)_150px_120px_120px_auto] gap-4 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
                <span>Drawer</span>
                <span>Date</span>
                <span>Cashier</span>
                <span className="text-right">Opening</span>
                <span className="text-right">Closing</span>
                <span className="text-right">Status / actions</span>
              </div>
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
                    className="group cursor-pointer px-4 py-3.5 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    onClick={() => setSelectedSession(session)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSession(session);
                      }
                    }}
                  >
                    <div className="grid gap-3 lg:grid-cols-[150px_minmax(160px,1fr)_150px_120px_120px_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3 lg:block">
                          <div className="font-medium">
                            {session.station} / {session.drawer_key}
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground lg:hidden">
                            {statusLabel(session.status)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground lg:hidden">
                          {session.opened_at
                            ? formatDateTime(session.opened_at)
                            : formatDate(session.business_date)}
                          {session.cashier_name
                            ? ` · ${session.cashier_name}`
                            : session.cashier_id
                              ? ` · Cashier #${session.cashier_id}`
                              : ""}
                        </div>
                      </div>
                      <div className="hidden text-sm text-muted-foreground lg:block">
                        {session.opened_at
                          ? formatDateTime(session.opened_at)
                          : formatDate(session.business_date)}
                      </div>
                      <div className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
                        {session.cashier_name ||
                          (session.cashier_id
                            ? `Cashier #${session.cashier_id}`
                            : "—")}
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm lg:contents">
                        <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                          <dt className="text-xs text-muted-foreground lg:sr-only">
                            Opening
                          </dt>
                          <dd className="font-medium tabular-nums lg:mt-0.5">
                            {formatMoney(
                              Number(session.counted_opening_cash ?? 0),
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                          <dt className="text-xs text-muted-foreground lg:sr-only">
                            Closing
                          </dt>
                          <dd className="font-medium tabular-nums lg:mt-0.5">
                            {formatMoney(
                              Number(
                                session.counted_closing_cash ??
                                  session.expected_closing_cash ??
                                  0,
                              ),
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground lg:inline-flex">
                          {statusLabel(session.status)}
                        </span>
                        {session.cash_variance != null &&
                        Number(session.cash_variance) !== 0 ? (
                          <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                            Variance{" "}
                            {formatMoney(Number(session.cash_variance))}
                          </span>
                        ) : null}
                        {hasLaterSameDaySession ? (
                          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
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
      </div>
    </section>
  );
}

function statusLabel(value: string) {
  return String(value || "unknown").replace(/_/g, " ");
}
