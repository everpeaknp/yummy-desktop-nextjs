"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hotel,
  Loader2,
  RefreshCw,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { AccountingApis, DayCloseApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DrawerSessionPanel } from "@/components/day-close/drawer-session-panel";
import { OperationalCloseStatus } from "@/components/day-close/operational-close-status";
import { DayCloseSnapshotPanel } from "@/components/analytics/day-close-snapshot-panel";
import { DaybookReport } from "@/components/finance/accounting/daybook-report";
import type { AccountingDaybook } from "@/types/accounting";
import {
  parseDayCloseDetail,
  parseDayCloseSnapshotData,
  parseDayCloseSnapshotResponse,
  parseDayCloseValidateResult,
  unwrapApiData,
  type BusinessLine,
  type DayCloseDetail,
  type DayCloseSnapshotData,
  type DayCloseValidateResult,
} from "@/types/day-close";

interface DayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  businessLine?: BusinessLine;
  targetDayCloseId?: number | null;
  targetBusinessDate?: string | null;
}

type Step = "drawers" | "daybook" | "success";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

function isAccountingFeatureLocked(error: unknown) {
  const response = error as {
    response?: {
      status?: number;
      data?: { errors?: Array<{ code?: string; entitlement_key?: string }> };
    };
  };
  return (
    response.response?.status === 403 &&
    response.response.data?.errors?.some(
      (item) =>
        item.code === "PLAN_FEATURE_LOCKED" &&
        item.entitlement_key === "finance.accounting.enabled",
    ) === true
  );
}

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function periodText(validation: DayCloseValidateResult | null) {
  if (!validation?.period_start_at || !validation.period_end_at) return null;
  return `${new Date(validation.period_start_at).toLocaleString()} – ${new Date(validation.period_end_at).toLocaleString()}`;
}

export function DayCloseModal({
  isOpen,
  onClose,
  restaurantId,
  businessLine = "restaurant",
  targetDayCloseId = null,
  targetBusinessDate = null,
}: DayCloseModalProps) {
  const isHotelDaybook = businessLine === "hotel";
  const isCombinedClose = businessLine === "combined";
  const isOperationalDaybook = isHotelDaybook || isCombinedClose;
  const [step, setStep] = useState<Step>("drawers");
  const [selectedDate, setSelectedDate] = useState(targetBusinessDate || todayIso());
  const [validation, setValidation] = useState<DayCloseValidateResult | null>(null);
  const [daybook, setDaybook] = useState<AccountingDaybook | null>(null);
  const [snapshot, setSnapshot] = useState<DayCloseSnapshotData | null>(null);
  const [accountingDaybookLocked, setAccountingDaybookLocked] = useState(false);
  const [confirmed, setConfirmed] = useState<DayCloseDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("drawers");
    setSelectedDate(targetBusinessDate || todayIso());
    setValidation(null);
    setDaybook(null);
    setSnapshot(null);
    setAccountingDaybookLocked(false);
    setConfirmed(null);
    setNotes("");
    setError(null);
  }, [targetBusinessDate]);

  const refreshValidation = useCallback(async () => {
    setLoadingValidation(true);
    setError(null);
    try {
      const response = await apiClient.get(
        DayCloseApis.validateClose({
          restaurantId,
          businessLine,
          businessDate: selectedDate,
        }),
      );
      const parsed = unwrapApiData(response.data, parseDayCloseValidateResult);
      if (!parsed) throw new Error("The server returned an invalid close-readiness response.");
      setValidation(parsed);
      return parsed;
    } catch (requestError) {
      setValidation(null);
      setError(getApiErrorMessage(requestError, "Failed to check close readiness."));
      return null;
    } finally {
      setLoadingValidation(false);
    }
  }, [businessLine, restaurantId, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen || step !== "drawers") return;
    void refreshValidation();
  }, [isOpen, refreshValidation, step]);

  const loadReview = useCallback(
    async (readiness: DayCloseValidateResult) => {
      setLoadingReview(true);
      setError(null);
      try {
        const snapshotResponse = await apiClient.get(
          DayCloseApis.generateSnapshot({
            restaurantId,
            businessLine,
            businessDate: selectedDate,
          }),
        );
        const nextSnapshot = unwrapApiData(
          snapshotResponse.data,
          parseDayCloseSnapshotData,
        );
        if (!nextSnapshot) {
          throw new Error("The financial snapshot data is missing.");
        }

        let nextDaybook: AccountingDaybook | null = null;
        let accountingLocked = false;
        // Combined close is an operational aggregation. The legacy
        // accounting-daybook endpoint is source-line scoped, so requesting a
        // combined GL daybook would imply that events lost their dimension.
        if (!isCombinedClose) {
          try {
            const daybookResponse = await apiClient.get<BaseResponse<AccountingDaybook>>(
              AccountingApis.daybook({
                restaurantId,
                businessLine,
                businessDate: selectedDate,
                periodStartAt: readiness.period_start_at,
                periodEndAt: readiness.period_end_at,
              }),
            );
            nextDaybook = daybookResponse.data?.data ?? null;
          } catch (requestError) {
            if (!isOperationalDaybook || !isAccountingFeatureLocked(requestError)) {
              throw requestError;
            }
            accountingLocked = true;
          }
        }

        if (!isOperationalDaybook && !nextDaybook) {
          throw new Error("The accounting daybook data is missing.");
        }
        setDaybook(nextDaybook);
        setSnapshot(nextSnapshot);
        setAccountingDaybookLocked(accountingLocked);
        setStep("daybook");
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, "Failed to load the close review."));
      } finally {
        setLoadingReview(false);
      }
    },
    [businessLine, isCombinedClose, isOperationalDaybook, restaurantId, selectedDate],
  );

  const continueFromDrawers = async () => {
    const readiness = await refreshValidation();
    if (!readiness?.can_close) {
      setError("Resolve every blocker before reviewing the daybook.");
      return;
    }
    await loadReview(readiness);
  };

  const closeDay = async () => {
    if (!snapshot || (!isOperationalDaybook && !daybook)) return;
    const accountingBlockers = daybook?.exceptions.filter((item) => item.blocking) ?? [];
    if (accountingBlockers.length > 0) {
      setError("Resolve the blocking daybook exceptions before closing this period.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const initiateResponse = await apiClient.post(DayCloseApis.initiate, {
        restaurant_id: restaurantId,
        business_line: businessLine,
        business_date: selectedDate,
        day_close_id: targetDayCloseId ?? undefined,
      });
      const initiated = unwrapApiData(initiateResponse.data, parseDayCloseDetail);
      if (!initiated?.id) throw new Error("The server did not return a day-close record.");

      const latestSnapshotResponse = await apiClient.get(
        DayCloseApis.generateSnapshot({
          restaurantId,
          businessLine,
          businessDate: selectedDate,
        }),
      );
      const latestSnapshot =
        unwrapApiData(latestSnapshotResponse.data, parseDayCloseSnapshotData) ?? snapshot;
      const countedCash = latestSnapshot.drawer_control?.counted_cash;
      const actualCash = typeof countedCash === "number" && Number.isFinite(countedCash)
          ? countedCash
          : latestSnapshot.expected_cash;
      if (typeof actualCash !== "number" || !Number.isFinite(actualCash)) {
        throw new Error("Drawer counted cash is not available.");
      }

      const confirmResponse = await apiClient.post(DayCloseApis.confirm(initiated.id), {
        actual_cash: actualCash,
        confirmation_notes: notes.trim() || undefined,
      });
      const detail = unwrapApiData(confirmResponse.data, parseDayCloseDetail);
      if (!detail) throw new Error("The close was confirmed but its record is missing.");

      let savedSnapshot = latestSnapshot;
      try {
        const savedResponse = await apiClient.get(DayCloseApis.snapshot(detail.id));
        const savedPayload = unwrapApiData(
          savedResponse.data,
          parseDayCloseSnapshotResponse,
        );
        savedSnapshot =
          parseDayCloseSnapshotData(savedPayload?.snapshot_data ?? savedPayload) ??
          latestSnapshot;
      } catch {
        // The confirmed detail remains authoritative if snapshot re-fetch is delayed.
      }
      setSnapshot(savedSnapshot);
      setConfirmed(detail);
      setStep("success");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Failed to close this period."));
    } finally {
      setSubmitting(false);
    }
  };

  const steps = useMemo(
    () => [
      { id: "drawers" as const, label: "Cash drawers", icon: Banknote },
      { id: "daybook" as const, label: "Daybook & snapshot", icon: BookOpen },
      { id: "success" as const, label: "Complete", icon: CheckCircle2 },
    ],
    [],
  );
  const stepIndex = steps.findIndex((item) => item.id === step);
  const coveredPeriod = periodText(validation);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {targetDayCloseId
              ? "Re-confirm daybook"
              : isCombinedClose
                ? "Close combined financial period"
                : isHotelDaybook
                ? "Close hotel daybook"
                : "Close financial period"}
          </DialogTitle>
          <DialogDescription>
            {isCombinedClose
              ? "Settle the shared drawers, then record one audited close while preserving Hotel and Restaurant reporting separately."
              : isHotelDaybook
              ? "Settle hotel drawers, review the hotel's structured daybook and snapshot, then record one audited daily close."
              : "Settle drawers, review the structured daybook and snapshot, then confirm one audited close."}
          </DialogDescription>
          <div className="grid gap-3 pt-3 sm:grid-cols-[220px_1fr] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="day-close-date">Close date</Label>
              <Input
                id="day-close-date"
                type="date"
                value={selectedDate}
                max={todayIso()}
                disabled={Boolean(targetDayCloseId) || step === "success"}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setValidation(null);
                  setDaybook(null);
                  setSnapshot(null);
                  setStep("drawers");
                }}
              />
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-medium">{displayDate(selectedDate)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {coveredPeriod
                  ? `Open period: ${coveredPeriod}`
                  : "The server will resolve the open period ending now."}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="border-b border-border/70 bg-muted/20 px-6 py-3">
          <div className="grid grid-cols-3 gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === stepIndex;
              const complete = index < stepIndex;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                    active && "bg-background text-foreground shadow-sm",
                    !active && !complete && "text-muted-foreground",
                    complete && "text-emerald-700",
                  )}
                >
                  {complete ? <Check className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {step === "drawers" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">
                    {isCombinedClose ? "1. Close and settle shared drawers" : isHotelDaybook ? "1. Close and settle hotel drawers" : "1. Close and settle every drawer"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isCombinedClose
                      ? "The shared drawer is reconciled once. Hotel and Restaurant transactions remain separately attributed in reports."
                      : "Multi-day sessions remain visible. The selected date labels the close; timestamps determine which activity is included."}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void refreshValidation()} disabled={loadingValidation}>
                  {loadingValidation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Recheck
                </Button>
              </div>

              <DrawerSessionPanel
                restaurantId={restaurantId}
                businessLine={isCombinedClose ? "shared" : businessLine}
                businessDate={selectedDate}
                includeAllActiveSessions
                title={isCombinedClose ? "Shared drawer settlement" : "Drawer settlement"}
                description="Count, close, approve variance where required, and submit the final settlement here."
                footerNote="The daybook unlocks only after backend validation confirms every required drawer is settled."
              />

              {validation ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={cn("rounded-xl border p-4", validation.can_close ? "border-emerald-300 bg-emerald-500/10" : "border-amber-300 bg-amber-500/10")}>
                    <div className="font-semibold">
                      {validation.can_close ? "Ready for daybook review" : "Close blockers remain"}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {(validation.blockers ?? []).length === 0 ? (
                        <p>{isCombinedClose ? "Hotel and Restaurant activity, payments, refunds, and shared drawers are ready." : isHotelDaybook ? "Hotel charges, payments, refunds, and drawers are ready." : "Orders, refunds, payments, and drawers are ready."}</p>
                      ) : (
                        validation.blockers?.map((blocker) => <p key={blocker}>• {blocker}</p>)
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <div className="font-semibold">Operational checks</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>Active orders: {validation.active_orders_count ?? 0}</p>
                      <p>Pending refunds: {validation.pending_refunds_count ?? 0}</p>
                      <p>{`Drawer settlement: ${validation.drawer_ready === false ? "Incomplete" : "Ready"}`}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "daybook" ? (
            <div className="space-y-5">
              {loadingReview ? (
                <div className="flex min-h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : snapshot && (daybook || isOperationalDaybook) ? (
                <>
                  {daybook ? (
                    <DaybookReport
                      daybook={daybook}
                      outstandingReceivables={
                        snapshot.receivables?.outstanding_receivables ?? 0
                      }
                      title={`${displayDate(selectedDate)} Day Book`}
                    />
                  ) : (
                    <section className="rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Hotel className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{displayDate(selectedDate)} {isCombinedClose ? "Combined Daybook" : "Hotel Daybook"}</h3>
                            <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground">
                              Operational report
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {isCombinedClose
                              ? "This close shares physical cash custody only. Hotel and Restaurant revenue, expenses, analytics, and accounting dimensions stay separate."
                              : "This daily record covers hotel activity, receipts, expenses, refunds, and outstanding balances for the selected period."}
                          </p>
                          {accountingDaybookLocked ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              General-ledger daybook checks are not included in this plan. They are not required to mark this hotel daybook closed.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  )}
                  <section className="space-y-3 rounded-2xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">Financial snapshot</h3>
                      <p className="text-sm text-muted-foreground">
                        Supporting sales, payments, expenses, refunds, receivables, and operational evidence for this close.
                      </p>
                    </div>
                    <DayCloseSnapshotPanel snapshot={snapshot} />
                  </section>
                  <div className="space-y-2 rounded-2xl border border-border/70 p-4">
                    <Label htmlFor="day-close-notes">Close notes (optional)</Label>
                    <Textarea
                      id="day-close-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add a short handover note or exception reference."
                      rows={3}
                    />
                  </div>
                  {daybook?.exceptions.some((item) => item.blocking) ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-4 text-sm text-amber-800">
                      <AlertTriangle className="mr-2 inline h-4 w-4" />
                      Blocking daybook exceptions must be resolved before final close.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === "success" ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">Period closed successfully</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {displayDate(selectedDate)} now owns the frozen period, structured daybook, and financial snapshot.
                </p>
              </div>
              <OperationalCloseStatus detail={confirmed} />
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-background px-6 py-4">
          {step === "daybook" ? (
            <Button variant="ghost" onClick={() => setStep("drawers")} disabled={submitting}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Drawers
            </Button>
          ) : (
            <div />
          )}
          {step === "drawers" ? (
            <Button onClick={() => void continueFromDrawers()} disabled={loadingValidation || loadingReview}>
              {loadingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isCombinedClose ? "Review combined daybook" : isHotelDaybook ? "Review hotel daybook" : "Review daybook"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : step === "daybook" ? (
            <Button
              onClick={() => void closeDay()}
              disabled={
                submitting ||
                !snapshot ||
                (!isOperationalDaybook && !daybook) ||
                (!isOperationalDaybook && (daybook?.exceptions.some((item) => item.blocking) ?? false))
              }
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {submitting ? "Closing period…" : isCombinedClose ? "Confirm combined close" : isHotelDaybook ? "Mark hotel daybook closed" : "Confirm final close"}
            </Button>
          ) : (
            <Button onClick={onClose}>Done</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
