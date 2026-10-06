"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { DayCloseApis, DrawerSessionApis } from "@/lib/api/endpoints";
import {
  formatDayCloseCurrency,
  pickBackendAmount,
} from "@/lib/day-close-format";
import {
  buildDayClosePresentation,
  DAY_CLOSE_TERMS,
  type DayClosePresentation,
  type DayClosePresentationIssue,
  type DayCloseReadinessArea,
} from "@/lib/presentation/day-close";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
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
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { DrawerSessionPanel } from "@/components/day-close/drawer-session-panel";
import {
  DayCloseFinancialDetails,
  FinancialDetailsButton,
} from "@/components/day-close/day-close-financial-details";
import { DayCloseConfirmedDetail } from "@/components/day-close/day-close-confirmed-detail";
import { getAnalyticsUrlForDayClose } from "@/lib/day-close-navigation";
import type {
  BusinessLine,
  DayCloseDetail,
  DayCloseSnapshotData,
  DayCloseValidateResult,
} from "@/types/day-close";
import {
  parseDayCloseCurrent,
  parseDayCloseDetail,
  parseDayCloseSnapshotData,
  parseDayCloseSnapshotResponse,
  parseDayCloseValidateResult,
  unwrapApiData,
} from "@/types/day-close";

type FlowStep = "review" | "cash" | "close" | "complete";

type DayCloseFlowProps = {
  restaurantId: number;
  businessLine: BusinessLine;
  businessDate: string;
  timezone?: string;
  targetDayCloseId?: number | null;
  onBusinessDateChange: (value: string) => void;
};

const READINESS_ORDER: DayCloseReadinessArea[] = [
  "orders",
  "payments",
  "refunds",
  "cash",
  "accounting",
];

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function moneyOrUnavailable(value?: number) {
  return value == null ? "Unavailable" : formatDayCloseCurrency(value);
}

function differenceLabel(value?: number) {
  if (value == null) return "Not counted";
  if (Math.abs(value) <= 0.005) return formatDayCloseCurrency(0);
  return `${formatDayCloseCurrency(Math.abs(value))} ${value < 0 ? "short" : "over"}`;
}

function apiErrorCode(error: unknown) {
  const response = (error as { response?: { data?: unknown } })?.response?.data;
  if (!response || typeof response !== "object") return undefined;
  const detail = (response as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object") return undefined;
  const code = (detail as { error_code?: unknown }).error_code;
  return typeof code === "string" ? code : undefined;
}

function readinessSupportingText(
  area: DayCloseReadinessArea,
  presentation: DayClosePresentation,
) {
  if (presentation.readiness[area].state === "unavailable")
    return "Unable to check";
  if (area === "orders")
    return (
      presentation.readiness.orders.supportingText ?? "Order check complete"
    );
  if (area === "payments") {
    const amount = moneyOrUnavailable(presentation.summary.paymentsCollected);
    return amount === "Unavailable" ? amount : `${amount} collected`;
  }
  if (area === "refunds")
    return moneyOrUnavailable(presentation.summary.refunds);
  if (area === "cash") {
    if (presentation.readiness.cash.supportingText) {
      const difference = differenceLabel(presentation.cash.difference);
      return presentation.cash.difference != null &&
        Math.abs(presentation.cash.difference) > 0.005
        ? `${presentation.readiness.cash.supportingText} · ${difference}`
        : presentation.readiness.cash.supportingText;
    }
    if (
      presentation.cash.difference != null &&
      Math.abs(presentation.cash.difference) > 0.005
    )
      return differenceLabel(presentation.cash.difference);
    const total = presentation.cash.drawers.length;
    if (!total) return presentation.cash.countSourceLabel;
    const ready = presentation.cash.drawers.filter(
      (drawer) => drawer.state === "ready",
    ).length;
    return `${ready} of ${total} ready`;
  }
  return presentation.readiness.accounting.state === "unavailable"
    ? "Unable to check"
    : "Operational check";
}

function DayCloseProgress({ step }: { step: FlowStep }) {
  const current = step === "review" ? 0 : step === "cash" ? 1 : 2;
  return (
    <div
      className="flex items-center gap-2 border-y border-border py-3"
      aria-label="Day close progress"
    >
      {["Review", "Cash", "Close"].map((label, index) => (
        <div
          key={label}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              index < current && "border-emerald-600 bg-emerald-600 text-white",
              index === current &&
                "border-primary bg-primary text-primary-foreground",
              index > current && "border-border text-muted-foreground",
            )}
          >
            {index < current ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span
            className={cn(
              "truncate",
              index !== current && "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function DayCloseIssueList({
  title,
  issues,
}: {
  title: string;
  issues: DayClosePresentationIssue[];
}) {
  if (!issues.length) return null;
  return (
    <section
      aria-labelledby={`${title.replace(/\s/g, "-").toLowerCase()}-title`}
    >
      <h2
        id={`${title.replace(/\s/g, "-").toLowerCase()}-title`}
        className="text-lg font-semibold"
      >
        {title}
      </h2>
      <div className="mt-2 divide-y rounded-xl border border-border bg-card">
        {issues.map((issue) => {
          const systemOwnedIssue = issue.area === "accounting";
          const visibleTitle = systemOwnedIssue
            ? "Closing is temporarily unavailable"
            : issue.title;
          return (
            <div key={`${issue.code}-${issue.title}`} className="p-4">
              <div className="flex gap-3">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    issue.level === "BLOCKER"
                      ? "text-destructive"
                      : "text-amber-600",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{visibleTitle}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {systemOwnedIssue
                      ? "The system could not finish preparing the financial records for this period. Try the readiness check again shortly, or ask an administrator for help."
                      : issue.description}
                  </p>
                  {issue.actionHref &&
                  issue.actionLabel &&
                  !systemOwnedIssue ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-3 min-h-11"
                    >
                      <Link href={issue.actionHref}>{issue.actionLabel}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DayCloseSummary({
  presentation,
}: {
  presentation: DayClosePresentation;
}) {
  const rows = [
    [DAY_CLOSE_TERMS.sales, moneyOrUnavailable(presentation.summary.sales)],
    [
      DAY_CLOSE_TERMS.paymentsCollected,
      moneyOrUnavailable(presentation.summary.paymentsCollected),
    ],
    ["Credit sales", moneyOrUnavailable(presentation.summary.creditSales)],
    [DAY_CLOSE_TERMS.refunds, moneyOrUnavailable(presentation.summary.refunds)],
    [
      DAY_CLOSE_TERMS.expenses,
      moneyOrUnavailable(presentation.summary.expenses),
    ],
    [
      DAY_CLOSE_TERMS.cashExpected,
      moneyOrUnavailable(presentation.cash.expected),
    ],
    [
      DAY_CLOSE_TERMS.cashCounted,
      presentation.cash.counted == null
        ? "Not counted"
        : formatDayCloseCurrency(presentation.cash.counted),
    ],
    [
      DAY_CLOSE_TERMS.cashDifference,
      differenceLabel(presentation.cash.difference),
    ],
  ] as const;
  return (
    <section>
      <h2 className="text-lg font-semibold">Financial summary</h2>
      <dl className="mt-2 divide-y border-y border-border">
        {rows.map(([label, rowValue]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                label === DAY_CLOSE_TERMS.cashDifference &&
                  presentation.cash.difference != null &&
                  Math.abs(presentation.cash.difference) > 0.005 &&
                  "text-destructive",
              )}
            >
              {rowValue}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DayCloseFlow({
  restaurantId,
  businessLine,
  businessDate,
  timezone,
  targetDayCloseId = null,
  onBusinessDateChange,
}: DayCloseFlowProps) {
  const user = useAuth((state) => state.user);
  const [step, setStep] = useState<FlowStep>("review");
  const [validation, setValidation] = useState<DayCloseValidateResult | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState<DayCloseSnapshotData | null>(null);
  const [confirmed, setConfirmed] = useState<DayCloseDetail | null>(null);
  const [controlsEnabled, setControlsEnabled] = useState<boolean | null>(null);
  const [manualCount, setManualCount] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [drawerTaskOpen, setDrawerTaskOpen] = useState(false);
  const [financialDetailsOpen, setFinancialDetailsOpen] = useState(false);
  const [closeDetailsOpen, setCloseDetailsOpen] = useState(false);

  const capabilities = useMemo(
    () => ({
      canView: hasPermission(user, "reports.dayclose.view"),
      canInitiate: hasPermission(user, "reports.dayclose.initiate"),
      canConfirm: hasPermission(user, "reports.dayclose.confirm"),
      canCancel: hasPermission(user, "reports.dayclose.cancel"),
      canReopen: hasPermission(user, "reports.dayclose.reopen"),
      canAdjust:
        hasPermission(user, "reports.dayclose.adjust.cash") ||
        hasPermission(user, "reports.dayclose.adjust.financial"),
    }),
    [user],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [
        currentResponse,
        validationResponse,
        snapshotResponse,
        controlsResponse,
      ] = await Promise.all([
        apiClient.get(
          DayCloseApis.current({ restaurantId, businessLine, businessDate }),
        ),
        apiClient.get(
          DayCloseApis.validateClose({
            restaurantId,
            businessLine,
            businessDate,
          }),
        ),
        apiClient.get(
          DayCloseApis.generateSnapshot({
            restaurantId,
            businessLine,
            businessDate,
          }),
        ),
        apiClient
          .get(DrawerSessionApis.controls({ restaurantId }))
          .catch(() => null),
      ]);
      const nextCurrent = unwrapApiData(
        currentResponse.data,
        parseDayCloseCurrent,
      );
      // Day Close owns a persisted operational date. A browser can still be
      // open on the just-closed calendar date, so reconcile to the server's
      // active close before displaying or submitting any further work.
      if (
        !targetDayCloseId &&
        nextCurrent?.business_date &&
        nextCurrent.business_date !== businessDate
      ) {
        onBusinessDateChange(nextCurrent.business_date);
        return;
      }
      const nextValidation = unwrapApiData(
        validationResponse.data,
        parseDayCloseValidateResult,
      );
      const nextSnapshot = unwrapApiData(
        snapshotResponse.data,
        parseDayCloseSnapshotData,
      );
      if (!nextValidation || !nextSnapshot) {
        throw new Error("The close readiness response is incomplete.");
      }
      setValidation(nextValidation);
      setSnapshot(nextSnapshot);
      setControlsEnabled(
        typeof controlsResponse?.data?.data?.enabled === "boolean"
          ? controlsResponse.data.data.enabled
          : null,
      );

      if (
        !targetDayCloseId &&
        String(nextCurrent?.status ?? "").toLowerCase() === "confirmed" &&
        nextCurrent?.id
      ) {
        const detailResponse = await apiClient.get(
          DayCloseApis.detail(nextCurrent.id),
        );
        const nextDetail = unwrapApiData(
          detailResponse.data,
          parseDayCloseDetail,
        );
        if (nextDetail) {
          setConfirmed(nextDetail);
          setStep("complete");
        }
      } else {
        setConfirmed(null);
      }
    } catch (error) {
      setValidation(null);
      setSnapshot(null);
      setPageError(
        getApiErrorMessage(
          error,
          "Unable to check whether this day is ready to close.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    businessDate,
    businessLine,
    onBusinessDateChange,
    restaurantId,
    targetDayCloseId,
  ]);

  useEffect(() => {
    setStep("review");
    setManualCount("");
    setClosingNote("");
    void load();
  }, [load]);

  const presentation = useMemo(
    () =>
      buildDayClosePresentation({
        businessDate,
        timezone,
        validation,
        snapshot,
        detail: confirmed,
        capabilities,
        accounting: validation
          ? { availability: "available" }
          : { availability: loading ? "loading" : "unavailable" },
        stage:
          step === "complete"
            ? "confirmed"
            : step === "close"
              ? "review"
              : "overview",
      }),
    [
      businessDate,
      capabilities,
      confirmed,
      loading,
      snapshot,
      step,
      timezone,
      validation,
    ],
  );

  const cashCount = useMemo(() => {
    const entered = manualCount.trim() === "" ? undefined : Number(manualCount);
    if (
      controlsEnabled === false &&
      entered != null &&
      Number.isFinite(entered)
    )
      return entered;
    return presentation.cash.counted;
  }, [controlsEnabled, manualCount, presentation.cash.counted]);
  const cashDifference =
    cashCount != null && presentation.cash.expected != null
      ? cashCount - presentation.cash.expected
      : presentation.cash.difference;
  const drawerActionsRemain = presentation.cash.drawers.some(
    (drawer) => drawer.state !== "ready",
  );
  const cashStepRequired = !(
    controlsEnabled === true &&
    presentation.cash.countSource === "drawer_evidence" &&
    !drawerActionsRemain
  );
  const manualCountValid =
    controlsEnabled !== false ||
    manualCount.trim() === "" ||
    (Number.isFinite(Number(manualCount)) && Number(manualCount) >= 0);
  const cashSatisfied = !drawerActionsRemain && manualCountValid;

  const advanceFromReview = () => {
    if (!presentation.canContinue) return;
    setStep(cashStepRequired ? "cash" : "close");
  };

  const confirmClose = async () => {
    if (!capabilities.canConfirm || !snapshot || !validation) return;
    setSubmitting(true);
    setPageError(null);
    try {
      const initiateResponse = await apiClient.post(DayCloseApis.initiate, {
        restaurant_id: restaurantId,
        business_line: businessLine,
        business_date: businessDate,
        day_close_id: targetDayCloseId ?? undefined,
      });
      const initiated = unwrapApiData(
        initiateResponse.data,
        parseDayCloseDetail,
      );
      if (!initiated?.id)
        throw new Error("The server did not return a day-close record.");

      const latestResponse = await apiClient.get(
        DayCloseApis.generateSnapshot({
          restaurantId,
          businessLine,
          businessDate,
        }),
      );
      const latest =
        unwrapApiData(latestResponse.data, parseDayCloseSnapshotData) ??
        snapshot;
      const drawerCount = latest.drawer_control?.counted_cash;
      const entered =
        manualCount.trim() === "" ? undefined : Number(manualCount);
      const usesManualCount =
        controlsEnabled === false &&
        entered != null &&
        Number.isFinite(entered);
      const actualCash = usesManualCount
        ? entered
        : typeof drawerCount === "number" && Number.isFinite(drawerCount)
          ? drawerCount
          : pickBackendAmount(
              latest.expected_cash,
              latest.drawer_control?.expected_cash,
            );
      if (actualCash == null)
        throw new Error("Cash information is unavailable.");

      const confirmResponse = await apiClient.post(
        DayCloseApis.confirm(initiated.id),
        {
          actual_cash: actualCash,
          confirmation_notes: closingNote.trim() || undefined,
          cash_count_source: usesManualCount
            ? "manual_count"
            : typeof drawerCount === "number" && Number.isFinite(drawerCount)
              ? "drawer_evidence"
              : "not_counted",
        },
      );
      const detail = unwrapApiData(confirmResponse.data, parseDayCloseDetail);
      if (!detail)
        throw new Error("The close was saved but its details are unavailable.");
      let savedSnapshot = latest;
      try {
        const savedResponse = await apiClient.get(
          DayCloseApis.snapshot(detail.id),
        );
        const payload = unwrapApiData(
          savedResponse.data,
          parseDayCloseSnapshotResponse,
        );
        savedSnapshot =
          parseDayCloseSnapshotData(payload?.snapshot_data ?? payload) ??
          latest;
      } catch {
        // The confirmed close remains authoritative while its saved snapshot catches up.
      }
      setSnapshot(savedSnapshot);
      setConfirmed(detail);
      setStep("complete");
      toast.success("Day closed");
    } catch (error) {
      const errorCode = apiErrorCode(error);
      try {
        const currentResponse = await apiClient.get(
          DayCloseApis.current({ restaurantId, businessLine, businessDate }),
        );
        const authoritative = unwrapApiData(
          currentResponse.data,
          parseDayCloseCurrent,
        );
        if (
          String(authoritative?.status ?? "").toLowerCase() === "confirmed" &&
          authoritative?.id
        ) {
          const detailResponse = await apiClient.get(
            DayCloseApis.detail(authoritative.id),
          );
          const detail = unwrapApiData(
            detailResponse.data,
            parseDayCloseDetail,
          );
          if (detail) {
            setConfirmed(detail);
            setStep("complete");
            return;
          }
        }
      } catch {
        // Preserve the original deterministic error below.
      }

      await load();
      setStep("review");
      if (errorCode === "ACCOUNTING_REVIEW_REQUIRED") {
        setValidation((currentValidation) => {
          if (!currentValidation) return currentValidation;
          const alreadyPresent = currentValidation.issues?.some(
            (issue) => issue.code === errorCode,
          );
          return {
            ...currentValidation,
            can_close: false,
            blockers: Array.from(
              new Set([
                ...(currentValidation.blockers ?? []),
                "Financial records could not be finalized automatically.",
              ]),
            ),
            issues: alreadyPresent
              ? currentValidation.issues
              : [
                  ...(currentValidation.issues ?? []),
                  {
                    code: errorCode,
                    severity: "blocker",
                    message:
                      "Financial records could not be finalized automatically.",
                  },
                ],
          };
        });
        setPageError(null);
        toast.error(
          "Financial records are still being prepared. Run the readiness check again or ask an administrator for help.",
        );
        return;
      }
      setPageError(
        getApiErrorMessage(
          error,
          "The close result could not be confirmed. Refresh to check the authoritative status.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !validation)
    return <LoadingState label="Checking day close readiness" />;
  if (pageError && !validation) {
    return (
      <ErrorState
        title="Day close is unavailable"
        description={pageError}
        actionLabel="Retry"
        onAction={() => void load()}
      />
    );
  }

  const completionPresentation = buildDayClosePresentation({
    businessDate,
    timezone,
    validation,
    snapshot,
    detail: confirmed,
    capabilities,
    accounting: { availability: "available" },
    stage: "confirmed",
  });

  return (
    <div className="w-full pb-28 lg:pb-10">
      <header className="space-y-3 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Business date</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {presentation.period.businessDateLabel}
            </h1>
          </div>
          {step === "review" ? (
            <div className="w-[150px]">
              <Label htmlFor="day-close-business-date" className="sr-only">
                Business date
              </Label>
              <Input
                id="day-close-business-date"
                type="date"
                value={businessDate}
                // A confirmed close can advance the operational day before
                // wall-clock midnight. Keep the authoritative active day
                // selectable instead of rendering an invalid stale date.
                max={businessDate > todayIso() ? businessDate : todayIso()}
                onChange={(event) => onBusinessDateChange(event.target.value)}
                className="h-11"
              />
            </div>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {DAY_CLOSE_TERMS.activityIncluded}: {presentation.period.displayRange}
        </p>
        {presentation.period.durationLabel ? (
          <p className="mt-1 text-sm font-medium text-foreground">
            {presentation.period.durationLabel}
          </p>
        ) : null}
        {presentation.period.isMultiDay ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Includes activity since the previous confirmed close.
          </p>
        ) : null}
      </header>

      {step !== "complete" ? <DayCloseProgress step={step} /> : null}

      {step === "review" ? (
        <div className="space-y-7 pt-6">
          <section>
            <h2 className="text-xl font-semibold">Review day</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check that the financial activity is ready to close.
            </p>
          </section>

          <DayCloseIssueList
            title="Needs attention"
            issues={presentation.blockers}
          />
          <DayCloseIssueList
            title="Review suggested"
            issues={presentation.warnings}
          />

          <section>
            <h2 className="text-lg font-semibold">Readiness</h2>
            <div className="mt-2 divide-y border-y border-border">
              {READINESS_ORDER.map((area) => {
                const row = presentation.readiness[area];
                const needsCashAction = area === "cash" && drawerActionsRemain;
                return (
                  <div
                    key={area}
                    className="flex min-h-[68px] items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{row.label}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {readinessSupportingText(area, presentation)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          row.state === "ready" && "text-emerald-700",
                          row.state === "needs_action" && "text-destructive",
                          row.state === "warning" && "text-amber-700",
                          row.state === "unavailable" &&
                            "text-muted-foreground",
                        )}
                      >
                        {row.detail}
                      </div>
                    </div>
                    {needsCashAction ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <DayCloseSummary presentation={presentation} />

          <FinancialDetailsButton
            onClick={() => setFinancialDetailsOpen(true)}
          />
        </div>
      ) : null}

      {step === "cash" ? (
        <div className="space-y-7 pt-6">
          <section>
            <h2 className="text-xl font-semibold">Confirm cash</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm the physical cash evidence for this close.
            </p>
          </section>

          {controlsEnabled === false ? (
            <section className="space-y-2">
              <Label htmlFor="manual-cash-count">Cash counted</Label>
              <Input
                id="manual-cash-count"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={manualCount}
                onChange={(event) => setManualCount(event.target.value)}
                placeholder="Enter the physical cash count"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank when this close does not require a physical count.
              </p>
            </section>
          ) : presentation.cash.drawers.length ? (
            <section>
              <h2 className="text-lg font-semibold">Cash drawers</h2>
              <div className="mt-2 divide-y border-y border-border">
                {presentation.cash.drawers.map((drawer) => (
                  <button
                    type="button"
                    key={`${drawer.configurationId}-${drawer.sessionId}-${drawer.name}`}
                    onClick={() =>
                      drawer.state !== "ready" && setDrawerTaskOpen(true)
                    }
                    className="flex min-h-16 w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                    disabled={drawer.state === "ready"}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{drawer.name}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {drawer.label}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        drawer.state === "ready"
                          ? "text-emerald-700"
                          : "text-primary",
                      )}
                    >
                      {drawer.state === "ready" ? "Ready" : drawer.actionLabel}
                    </span>
                    {drawer.state !== "ready" ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              No drawer action is required for this close.
            </p>
          )}

          <section>
            <h2 className="text-lg font-semibold">Cash summary</h2>
            <dl className="mt-2 divide-y border-y border-border">
              <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">
                  Cash the system expects
                </dt>
                <dd className="font-semibold tabular-nums">
                  {moneyOrUnavailable(presentation.cash.expected)}
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">Cash counted</dt>
                <dd className="font-semibold tabular-nums">
                  {cashCount == null
                    ? "Not counted"
                    : formatDayCloseCurrency(cashCount)}
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">Difference</dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    cashDifference != null &&
                      Math.abs(cashDifference) > 0.005 &&
                      "text-destructive",
                  )}
                >
                  {differenceLabel(cashDifference)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {controlsEnabled === false && manualCount.trim()
                ? "Manually counted"
                : presentation.cash.countSourceLabel}
            </p>
          </section>
        </div>
      ) : null}

      {step === "close" ? (
        <div className="space-y-7 pt-6">
          <section>
            <h2 className="text-xl font-semibold">Review close</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check the final totals before closing this business date.
            </p>
          </section>
          <dl className="divide-y border-y border-border text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Business date</dt>
              <dd className="font-medium">
                {presentation.period.businessDateLabel}
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-muted-foreground">Activity included</dt>
              <dd className="mt-1 font-medium">
                {presentation.period.displayRange}
              </dd>
              {presentation.period.durationLabel ? (
                <dd className="mt-1 text-muted-foreground">
                  {presentation.period.durationLabel}
                </dd>
              ) : null}
              {presentation.period.isMultiDay ? (
                <dd className="mt-1 text-xs text-muted-foreground">
                  Includes activity since the previous confirmed close.
                </dd>
              ) : null}
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Sales</dt>
              <dd className="font-semibold tabular-nums">
                {moneyOrUnavailable(presentation.summary.sales)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Payments collected</dt>
              <dd className="font-semibold tabular-nums">
                {moneyOrUnavailable(presentation.summary.paymentsCollected)}
              </dd>
            </div>
            {Math.abs(presentation.summary.creditSales ?? 0) > 0.005 ? (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Credit sales</dt>
                <dd className="font-semibold tabular-nums">
                  {moneyOrUnavailable(presentation.summary.creditSales)}
                </dd>
              </div>
            ) : null}
            {Math.abs(presentation.summary.refunds ?? 0) > 0.005 ? (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Refunds</dt>
                <dd className="font-semibold tabular-nums">
                  {moneyOrUnavailable(presentation.summary.refunds)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Expenses</dt>
              <dd className="font-semibold tabular-nums">
                {moneyOrUnavailable(presentation.summary.expenses)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Cash counted</dt>
              <dd className="font-semibold tabular-nums">
                {cashCount == null
                  ? "Not counted"
                  : formatDayCloseCurrency(cashCount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">Cash difference</dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  cashDifference != null &&
                    Math.abs(cashDifference) > 0.005 &&
                    "text-destructive",
                )}
              >
                {differenceLabel(cashDifference)}
              </dd>
            </div>
          </dl>
          <DayCloseIssueList
            title="Warnings retained"
            issues={presentation.warnings}
          />
          <section className="space-y-2">
            <Label htmlFor="day-close-note">
              Closing note{" "}
              <span className="font-normal text-muted-foreground">
                Optional
              </span>
            </Label>
            <Textarea
              id="day-close-note"
              value={closingNote}
              onChange={(event) => setClosingNote(event.target.value)}
              placeholder="Add a short handover note"
              rows={3}
            />
          </section>
          <p className="text-sm text-muted-foreground">
            Closing saves this activity as an audited Day Close. Later
            corrections may require a dated correction or reopening the latest
            close.
          </p>
          {!capabilities.canConfirm ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Ready for an authorized manager to close.
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "complete" ? (
        <div className="space-y-7 pt-8">
          <section className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-semibold">Day closed</h2>
            <p className="mt-1 text-muted-foreground">
              {completionPresentation.period.businessDateLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Activity included: {completionPresentation.period.displayRange}
            </p>
            {completionPresentation.period.durationLabel ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {completionPresentation.period.durationLabel}
              </p>
            ) : null}
          </section>
          <dl className="divide-y border-y border-border">
            {[
              [
                "Sales",
                moneyOrUnavailable(completionPresentation.summary.sales),
              ],
              [
                "Payments collected",
                moneyOrUnavailable(
                  completionPresentation.summary.paymentsCollected,
                ),
              ],
              [
                "Cash counted",
                completionPresentation.cash.counted == null
                  ? "Not counted"
                  : formatDayCloseCurrency(completionPresentation.cash.counted),
              ],
              [
                "Cash difference",
                differenceLabel(completionPresentation.cash.difference),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
            <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">Closed by</dt>
              <dd className="font-medium">
                {user?.full_name || user?.email || "Authorized manager"}
              </dd>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">Closed at</dt>
              <dd className="font-medium">
                {confirmed?.confirmed_at
                  ? new Date(confirmed.confirmed_at).toLocaleString()
                  : "Recorded"}
              </dd>
            </div>
          </dl>
          <div className="space-y-3">
            {confirmed?.id ? (
              <Button
                type="button"
                className="h-12 w-full"
                onClick={() => setCloseDetailsOpen(true)}
              >
                View close details
              </Button>
            ) : null}
            {confirmed?.id ? (
              <Button asChild variant="outline" className="h-11 w-full">
                <Link href={getAnalyticsUrlForDayClose(confirmed)}>
                  View in Analytics
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="h-11 w-full">
              <Link href="/dashboard">Return to dashboard</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {pageError && validation ? (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{pageError}</span>
        </div>
      ) : null}

      {step !== "complete" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:sticky lg:mt-8 lg:px-0">
          <div className="flex w-full items-center gap-3">
            {step !== "review" ? (
              <Button
                variant="outline"
                className="h-12"
                onClick={() =>
                  setStep(
                    step === "close" && cashStepRequired ? "cash" : "review",
                  )
                }
                disabled={submitting}
              >
                Back
              </Button>
            ) : null}
            {step === "review" ? (
              presentation.blockers.length || !presentation.canContinue ? (
                <p className="flex-1 text-sm text-muted-foreground">
                  Resolve the blockers above to continue.
                </p>
              ) : capabilities.canInitiate ? (
                <Button className="h-12 flex-1" onClick={advanceFromReview}>
                  Continue
                </Button>
              ) : (
                <p className="flex-1 text-sm text-muted-foreground">
                  You can review this close, but you cannot start it.
                </p>
              )
            ) : step === "cash" ? (
              cashSatisfied ? (
                <Button
                  className="h-12 flex-1"
                  onClick={() => setStep("close")}
                >
                  Review close
                </Button>
              ) : (
                <p className="flex-1 text-sm text-muted-foreground">
                  Finish the required cash action to continue.
                </p>
              )
            ) : capabilities.canConfirm ? (
              <Button
                className="h-12 flex-1"
                onClick={() => void confirmClose()}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {submitting ? "Closing day…" : "Close day"}
              </Button>
            ) : (
              <p className="flex-1 text-sm text-muted-foreground">
                Ready for an authorized manager to close.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <DayCloseFinancialDetails
        open={financialDetailsOpen}
        onOpenChange={setFinancialDetailsOpen}
        snapshot={snapshot}
        detail={confirmed}
      />

      <Dialog open={closeDetailsOpen} onOpenChange={setCloseDetailsOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle>Close details</DialogTitle>
            <DialogDescription>
              Final financial results and cash reconciliation.
            </DialogDescription>
          </DialogHeader>
          {confirmed ? (
            <DayCloseConfirmedDetail
              detail={confirmed}
              snapshot={snapshot}
              timezone={timezone}
              closedBy={user?.full_name || user?.email}
              canAdjust={false}
              canReopen={false}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={drawerTaskOpen}
        onOpenChange={(open) => {
          setDrawerTaskOpen(open);
          if (!open) void load();
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="border-b p-5 text-left">
            <DialogTitle>Finish cash drawer work</DialogTitle>
            <DialogDescription>
              Complete only the drawer task required for this day close.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-5">
            <DrawerSessionPanel
              restaurantId={restaurantId}
              businessLine={
                businessLine === "combined" ? "shared" : businessLine
              }
              businessDate={businessDate}
              includeAllActiveSessions
              presentation="flat"
              title="Cash drawers"
              description="Count, review a difference, or choose where counted cash goes."
              footerNote="Close this window when every required drawer is ready."
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
