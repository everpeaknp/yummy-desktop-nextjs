"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronRight,
  Calculator,
  AlertTriangle,
  Receipt,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  resizableDialogContentClass,
  useResizableDialogStyle,
} from "@/lib/resizable-dialog";
import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import { DayCloseSnapshotPanel } from "@/components/analytics/day-close-snapshot-panel";
import {
  formatDayCloseCloseName,
  formatDayCloseCurrency,
  formatDayCloseCoveredRange,
} from "@/lib/day-close-format";
import {
  parseDayCloseCurrent,
  parseDayCloseDetail,
  parseDayCloseSnapshotData,
  parseDayCloseSnapshotResponse,
  parseDayCloseValidateResult,
  unwrapApiData,
  type DayCloseDetail,
  type DayCloseSnapshotData,
  type BusinessLine,
} from "@/types/day-close";

interface DayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: number;
  businessLine?: BusinessLine;
}

type Step = "health-check" | "financial-snapshot" | "cash-reconciliation" | "success";

export function DayCloseModal({
  isOpen,
  onClose,
  restaurantId,
  businessLine = "restaurant",
}: DayCloseModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>("health-check");
  const [snapshotData, setSnapshotData] = useState<DayCloseSnapshotData | null>(null);
  const [dayCloseId, setDayCloseId] = useState<number | null>(null);
  const [confirmedData, setConfirmedData] = useState<DayCloseDetail | null>(null);
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<DayCloseSnapshotData | null>(null);
  const [currentClose, setCurrentClose] = useState<ReturnType<typeof parseDayCloseCurrent>>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [modalMaximized, setModalMaximized] = useState(false);
  const modalDialogStyle = useResizableDialogStyle(modalMaximized, "wizard");

  const handleClose = () => {
    setCurrentStep("health-check");
    setSnapshotData(null);
    setDayCloseId(null);
    setConfirmedData(null);
    setConfirmedSnapshot(null);
    setModalMaximized(false);
    onClose();
  };

  const loadCurrent = useCallback(async () => {
    setLoadingCurrent(true);
    try {
      const res = await apiClient.get(
        DayCloseApis.current({ restaurantId, businessLine })
      );
      setCurrentClose(unwrapApiData(res.data, parseDayCloseCurrent));
    } catch {
      setCurrentClose(null);
    } finally {
      setLoadingCurrent(false);
    }
  }, [restaurantId, businessLine]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep("health-check");
    setSnapshotData(null);
    setDayCloseId(null);
    setConfirmedData(null);
    setConfirmedSnapshot(null);
    void loadCurrent();
  }, [isOpen, loadCurrent]);

  const closeName = formatDayCloseCloseName(businessLine);
  const coveredRange = formatDayCloseCoveredRange(
    currentClose?.period_start_at,
    currentClose?.period_end_at,
  );

  const steps = [
    { id: "health-check", label: "Health Check" },
    { id: "financial-snapshot", label: "Snapshot" },
    { id: "cash-reconciliation", label: "Reconciliation" },
    { id: "success", label: "Complete" },
  ] as const;

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={resizableDialogContentClass(
          modalMaximized,
          "p-0 gap-0 overflow-hidden flex flex-col",
        )}
        style={modalDialogStyle}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>End of Day Close</DialogTitle>
          <DialogDescription>
            Review system health, backend financial snapshot, and reconcile cash to close the day.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 dark:bg-slate-900 border-b p-6 pr-14 sm:pr-16 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">End of Day Close</h2>
              <p className="text-muted-foreground text-sm font-semibold">{closeName}</p>
              {loadingCurrent ? (
                <p className="text-xs text-muted-foreground mt-1">Loading close window…</p>
              ) : coveredRange ? (
                <p className="text-xs font-medium text-foreground mt-1 break-words">{coveredRange}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Close window not loaded</p>
              )}
              {currentClose?.action_label ? (
                <p className="text-xs font-semibold text-orange-600 mt-1">
                  {currentClose.action_label}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs font-semibold border border-orange-200 dark:border-orange-900/50 whitespace-nowrap">
                Step {currentStepIndex + 1} of 4
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setModalMaximized((v) => !v)}
                aria-label={modalMaximized ? "Minimize window" : "Maximize window"}
                title={modalMaximized ? "Minimize" : "Maximize"}
              >
                {modalMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isActive = index === currentStepIndex;
              return (
                <div
                  key={step.id}
                  className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800"
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-500 ease-in-out",
                      isActive || isCompleted ? "bg-orange-500 w-full" : "w-0"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-6", modalMaximized ? "min-h-0" : "min-h-[400px]")}>
          {currentStep === "health-check" ? (
            <HealthCheckStep
              restaurantId={restaurantId}
              businessLine={businessLine}
              onNext={() => setCurrentStep("financial-snapshot")}
            />
          ) : null}
          {currentStep === "financial-snapshot" ? (
            <FinancialSnapshotStep
              restaurantId={restaurantId}
              businessLine={businessLine}
              snapshotPreview={currentClose?.snapshot_preview ?? null}
              onNext={(data, id) => {
                setSnapshotData(data);
                setDayCloseId(id);
                setCurrentStep("cash-reconciliation");
              }}
            />
          ) : null}
          {currentStep === "cash-reconciliation" ? (
            <CashReconciliationStep
              snapshot={snapshotData}
              dayCloseId={dayCloseId}
              onNext={(data, finalizedSnapshot) => {
                setConfirmedData(data);
                setConfirmedSnapshot(finalizedSnapshot);
                setCurrentStep("success");
              }}
            />
          ) : null}
          {currentStep === "success" ? (
            <SuccessStep
              data={confirmedData}
              snapshot={confirmedSnapshot}
              onClose={handleClose}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HealthCheckStep({
  onNext,
  restaurantId,
  businessLine,
}: {
  onNext: () => void;
  restaurantId: number;
  businessLine: BusinessLine;
}) {
  const [checks, setChecks] = useState<
    Array<{ label: string; status: "pass" | "fail"; message?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await apiClient.get(
          DayCloseApis.validateClose({ restaurantId, businessLine })
        );
        const data = unwrapApiData(res.data, parseDayCloseValidateResult);
        if (!data) {
          setChecks([{ label: "Validation Failed", status: "fail", message: "Invalid response" }]);
          return;
        }

        const newChecks: Array<{ label: string; status: "pass" | "fail"; message?: string }> = [];

        if ((data.active_orders_count ?? 0) > 0) {
          newChecks.push({
            label: "Active Orders",
            status: "fail",
            message: `${data.active_orders_count} active orders need attention`,
          });
        } else {
          newChecks.push({
            label: "Active Orders",
            status: "pass",
            message: "All orders completed",
          });
        }

        if ((data.pending_refunds_count ?? 0) > 0) {
          newChecks.push({
            label: "Pending Refunds",
            status: "fail",
            message: `${data.pending_refunds_count} refunds pending processing`,
          });
        } else {
          newChecks.push({
            label: "Pending Refunds",
            status: "pass",
            message: "No pending refunds",
          });
        }

        if (data.blockers?.length) {
          data.blockers
            .filter(
              (b) => !b.includes("active order") && !b.includes("pending refund")
            )
            .forEach((b) => {
              newChecks.push({ label: "System Validation", status: "fail", message: b });
            });
        }

        setChecks(newChecks);
        setCanProceed(data.can_close);
      } catch {
        setChecks([
          { label: "System Connection", status: "fail", message: "Failed to connect to server" },
        ]);
      } finally {
        setLoading(false);
      }
    };
    void validate();
  }, [restaurantId, businessLine]);

  return (
    <div className="space-y-6">
      <StepBanner
        icon={<ActivityIcon className="w-5 h-5" />}
        title="System Health Check"
        subtitle="Verifying pending orders and unpaid bills from the server…"
        tone="blue"
      />
      <div className="grid gap-4">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Running checks…</div>
        ) : (
          checks.map((check, i) => <CheckItem key={i} {...check} />)
        )}
      </div>
      <div className="pt-4 flex justify-end">
        <Button onClick={onNext} disabled={!canProceed} className="gap-2">
          Continue to Snapshot <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function FinancialSnapshotStep({
  onNext,
  restaurantId,
  businessLine,
  snapshotPreview,
}: {
  onNext: (data: DayCloseSnapshotData, id: number) => void;
  restaurantId: number;
  businessLine: BusinessLine;
  snapshotPreview: DayCloseSnapshotData | null;
}) {
  const [snapshot, setSnapshot] = useState<DayCloseSnapshotData | null>(snapshotPreview);
  const [loading, setLoading] = useState(!snapshotPreview);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (snapshotPreview) {
      setSnapshot(snapshotPreview);
      setLoading(false);
      setError(null);
      return;
    }

    const generate = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(
          DayCloseApis.generateSnapshot({ restaurantId, businessLine })
        );
        const parsed = unwrapApiData(res.data, parseDayCloseSnapshotData);
        if (!parsed) {
          setError("Snapshot data is missing from the server response.");
          setSnapshot(null);
          return;
        }
        setSnapshot(parsed);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to load snapshot from server.";
        setError(message);
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    };
    void generate();
  }, [restaurantId, businessLine, snapshotPreview]);

  const handleContinue = async () => {
    if (!snapshot) return;
    setInitiating(true);
    setError(null);
    try {
      const res = await apiClient.post(DayCloseApis.initiate, {
        restaurant_id: restaurantId,
        business_line: businessLine,
      });
      const detail = unwrapApiData(res.data, parseDayCloseDetail);
      if (detail?.id) {
        onNext(snapshot, detail.id);
      } else {
        setError(
          (res.data as { message?: string })?.message ?? "Failed to initiate day close"
        );
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to proceed. Please try again.";
      setError(message);
    } finally {
      setInitiating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading financial snapshot from server…</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400">Snapshot Unavailable</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{error}</p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <EmptySnapshotNotice message="No snapshot returned by the server for this close window." />
    );
  }

  return (
    <div className="space-y-6">
      <StepBanner
        icon={<Calculator className="w-5 h-5" />}
        title="Financial Snapshot"
        subtitle="All totals below are loaded from the backend snapshot — not calculated in the browser."
        tone="purple"
      />
      <DayCloseSnapshotPanel snapshot={snapshot} />
      {error ? (
        <div className="p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : null}
      <div className="pt-4 flex justify-end">
        <Button onClick={handleContinue} disabled={initiating} className="gap-2">
          {initiating ? "Starting…" : "Confirm & Reconcile"} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function CashReconciliationStep({
  onNext,
  snapshot,
  dayCloseId,
}: {
  onNext: (data: DayCloseDetail, finalizedSnapshot: DayCloseSnapshotData | null) => void;
  snapshot: DayCloseSnapshotData | null;
  dayCloseId: number | null;
}) {
  const [actualCash, setActualCash] = useState("");
  const [confirmationNotes, setConfirmationNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedCash = snapshot?.expected_cash;

  const handleSubmit = async () => {
    if (!dayCloseId) {
      setError("Missing Day Close ID. Please restart the process.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post(DayCloseApis.confirm(dayCloseId), {
        actual_cash: Number(actualCash),
        confirmation_notes: confirmationNotes || undefined,
      });
      const detail = unwrapApiData(res.data, parseDayCloseDetail);
      if (detail) {
        let finalizedSnapshot: DayCloseSnapshotData | null = snapshot;
        try {
          const snapRes = await apiClient.get(DayCloseApis.snapshot(detail.id));
          const snapPayload = unwrapApiData(snapRes.data, parseDayCloseSnapshotResponse);
          const parsed = parseDayCloseSnapshotData(
            snapPayload?.snapshot_data ?? snapPayload,
          );
          if (parsed) finalizedSnapshot = parsed;
        } catch {
          // Keep preview snapshot if saved snapshot is not yet available.
        }
        onNext(detail, finalizedSnapshot);
      } else {
        setError(
          (res.data as { message?: string })?.message ?? "Failed to submit day close."
        );
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to submit day close.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepBanner
        icon={<Receipt className="w-5 h-5" />}
        title="Cash Reconciliation"
        subtitle="Verify physical cash on hand against the backend expected cash."
        tone="emerald"
      />
      <div className="space-y-4">
        <div className="p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
          <p className="text-sm font-medium mb-2">Expected Cash (from snapshot)</p>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {formatDayCloseCurrency(expectedCash)}
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Actual Cash Count</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
              Rs.
            </span>
            <input
              type="number"
              className="w-full text-2xl p-4 pl-12 rounded-xl border bg-background"
              placeholder="0.00"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (Optional)</label>
          <textarea
            className="w-full p-3 rounded-xl border bg-background text-sm"
            placeholder="Any discrepancies or comments…"
            rows={3}
            value={confirmationNotes}
            onChange={(e) => setConfirmationNotes(e.target.value)}
          />
        </div>
        {error ? (
          <div className="p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : null}
      </div>
      <div className="pt-4 flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !actualCash || expectedCash == null}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          {submitting ? "Closing…" : "Submit Day Close"} <CheckCircle2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({
  onClose,
  data,
  snapshot,
}: {
  onClose: () => void;
  data: DayCloseDetail | null;
  snapshot: DayCloseSnapshotData | null;
}) {
  const [showSnapshot, setShowSnapshot] = useState(false);
  const discrepancy = data?.cash_discrepancy;
  const isMatched =
    discrepancy == null ? true : Math.abs(discrepancy) < 0.01;
  const isOverage = discrepancy != null && discrepancy > 0;
  const coveredRange = formatDayCloseCoveredRange(
    data?.period_start_at ?? snapshot?.period_start_at,
    data?.period_end_at ?? snapshot?.period_end_at,
  );

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-6">
      <div
        className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center border-4",
          isMatched
            ? "bg-green-100 text-green-600 border-green-200"
            : isOverage
              ? "bg-blue-100 text-blue-600 border-blue-200"
              : "bg-red-100 text-red-600 border-red-200"
        )}
      >
        {isMatched ? (
          <CheckCircle2 className="w-10 h-10" />
        ) : (
          <AlertTriangle className="w-10 h-10" />
        )}
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          {isMatched ? "Day Closed Successfully!" : "Day Closed with Discrepancy"}
        </h2>
        <p className="text-muted-foreground max-w-xs mx-auto text-sm">
          The frozen financial snapshot is saved on the server. Totals below are display-only.
        </p>
        {coveredRange ? (
          <p className="text-xs font-medium text-foreground">{coveredRange}</p>
        ) : null}
      </div>
      {!isMatched && data ? (
        <div
          className={cn(
            "p-4 rounded-xl border w-full max-w-sm mx-auto text-left",
            isOverage
              ? "bg-blue-50 border-blue-100 dark:bg-blue-900/20"
              : "bg-red-50 border-red-100 dark:bg-red-900/20"
          )}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Expected:</span>
            <span className="font-mono text-right font-medium">
              {formatDayCloseCurrency(data.expected_cash)}
            </span>
            <span className="text-muted-foreground">Actual:</span>
            <span className="font-mono text-right font-medium">
              {formatDayCloseCurrency(data.actual_cash)}
            </span>
            <div className="col-span-2 h-px bg-slate-200 dark:bg-slate-700 my-1" />
            <span className="font-semibold">{isOverage ? "Overage:" : "Shortage:"}</span>
            <span
              className={cn(
                "font-mono text-right font-bold",
                isOverage ? "text-blue-600" : "text-red-600"
              )}
            >
              {discrepancy != null
                ? `${isOverage ? "+" : ""}${formatDayCloseCurrency(discrepancy)}`
                : "—"}
            </span>
          </div>
        </div>
      ) : null}
      {snapshot ? (
        <div className="w-full max-w-2xl mx-auto text-left space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl font-semibold"
            onClick={() => setShowSnapshot((v) => !v)}
          >
            {showSnapshot ? "Hide Snapshot" : "View Snapshot"}
          </Button>
          {showSnapshot ? <DayCloseSnapshotPanel snapshot={snapshot} /> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground max-w-sm">
          Saved snapshot could not be loaded. Open Day Close History to retry.
        </p>
      )}
      <Button onClick={onClose} size="lg" className="min-w-[200px]">
        Done
      </Button>
    </div>
  );
}

function CheckItem({
  label,
  status,
  message,
}: {
  label: string;
  status: "pass" | "fail";
  message?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-slate-950">
      <div>
        <span className="font-medium text-sm block">{label}</span>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
          status === "pass" ? "text-green-600" : "text-red-500"
        )}
      >
        {status === "pass" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
        {status === "pass" ? "Passed" : "Action Needed"}
      </div>
    </div>
  );
}

function StepBanner({
  icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "blue" | "purple" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50"
      : tone === "purple"
        ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/50"
        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50";

  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl border", toneClass)}>
      <div className="p-2 bg-white dark:bg-slate-950 rounded-lg">{icon}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptySnapshotNotice({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center">
      {message}
    </p>
  );
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
