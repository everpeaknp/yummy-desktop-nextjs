"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import { hasPermission } from "@/lib/role-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  DrawerClosingCountInput,
  DrawerClosingPrompt,
  DrawerSession,
  DrawerSettlementDecisionInput,
} from "@/types/day-close";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type DrawerCountDialogProps = {
  session: DrawerSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (session: DrawerSession) => void;
};

export function DrawerCountDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
}: DrawerCountDialogProps) {
  const user = useAuth((state) => state.user);
  const [prompt, setPrompt] = useState<DrawerClosingPrompt | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [reason, setReason] = useState("");
  const [retainedFloat, setRetainedFloat] = useState("");
  const [settlementMode, setSettlementMode] = useState("safe_transfer");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDestination, setSettlementDestination] = useState("");
  const [settlementReference, setSettlementReference] = useState("");
  const [denominations, setDenominations] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recountMode, setRecountMode] = useState(false);
  const isPendingVariance = session?.status === "variance_review_required";
  const needsClosingCount = Boolean(
    session &&
      (["opened", "closing_count_required", "reopened"].includes(String(session.status)) ||
        (isPendingVariance && recountMode)),
  );
  const needsSettlement = Boolean(
    session &&
      (session.status === "closed" || (isPendingVariance && !recountMode)),
  );
  const requiresSettlementApproval = needsSettlement;
  const canCountDrawer =
    hasPermission(user, "finance.drawer.close.own") ||
    hasPermission(user, "finance.drawer.close.any");
  const canApproveDrawerVariance = hasPermission(user, "finance.variance.approve");
  const canApproveAnyDrawer = hasPermission(user, "finance.drawer.close.any");
  const canTransferToSafe = hasPermission(user, "finance.drawer.transfer.to_safe");
  const canTransferToBank = hasPermission(user, "finance.cash.transfer.to_bank");
  const canConfirmBankDeposit = hasPermission(user, "finance.bank_deposit.confirm");
  const countedClosingCash = Number(session?.counted_closing_cash ?? 0);
  const isZeroCashSettlement =
    needsSettlement && Number.isFinite(countedClosingCash) && Math.abs(countedClosingCash) <= 0.005;
  const expectedClosingCash = Number(
    prompt?.expected_closing_cash ?? session?.expected_closing_cash ?? 0,
  );
  const enteredClosingCash = countedCash.trim() === "" ? null : Number(countedCash);
  const liveVariance =
    enteredClosingCash != null &&
    Number.isFinite(enteredClosingCash) &&
    Number.isFinite(expectedClosingCash)
      ? enteredClosingCash - expectedClosingCash
      : null;
  const persistedVariance = Number(session?.cash_variance ?? 0);
  const displayedVariance = needsClosingCount ? liveVariance : persistedVariance;
  const hasDisplayedVariance =
    displayedVariance != null && Number.isFinite(displayedVariance) && Math.abs(displayedVariance) > 0.005;
  const varianceLabel =
    !hasDisplayedVariance || displayedVariance == null
      ? "Balanced"
      : displayedVariance > 0
        ? "Over"
        : "Short";
  const canApproveSelectedSettlement =
    (!hasDisplayedVariance || canApproveDrawerVariance) &&
    (settlementMode === "safe_transfer"
      ? canTransferToSafe
      : settlementMode === "pending_bank_deposit"
        ? canTransferToBank
        : settlementMode === "immediate_bank_deposit"
          ? canTransferToBank && canConfirmBankDeposit
          : canApproveAnyDrawer);
  const retainedAmount = Number(retainedFloat || 0);
  const settlementTotal = Number(settlementAmount || 0);
  const settlementDifference =
    Number.isFinite(countedClosingCash) && Number.isFinite(retainedAmount) && Number.isFinite(settlementTotal)
      ? countedClosingCash - retainedAmount - settlementTotal
      : null;

  useEffect(() => {
    if (!open || !session?.id) return;
    setPrompt(null);
    setCountedCash("");
    setReason("");
    setRecountMode(false);
    const counted = Number(session.counted_closing_cash ?? 0);
    const hasNoCash = Number.isFinite(counted) && Math.abs(counted) <= 0.005;
    setRetainedFloat(session.retained_float != null ? String(session.retained_float) : hasNoCash ? "0" : "");
    setSettlementMode(session.settlement_mode || (hasNoCash ? "retain_all" : "safe_transfer"));
    setSettlementDestination(session.settlement_destination || (hasNoCash ? "" : "main_cash_safe"));
    setSettlementReference(session.settlement_reference || "");
    const retained = Number(session.retained_float ?? 0);
    const existingSettlement = Number(session.settlement_amount ?? counted - retained);
    setSettlementAmount(Number.isFinite(existingSettlement) && existingSettlement >= 0 ? String(existingSettlement) : "");
    setDenominations("");
    setLoading(true);
    apiClient
      .get<BaseResponse<DrawerClosingPrompt>>(DrawerSessionApis.closingPrompt(session.id))
      .then((res) => setPrompt(res.data?.data ?? null))
      .catch((error) => {
        console.error("Failed to load drawer closing prompt", error);
        toast.error("Failed to load drawer closing prompt");
      })
      .finally(() => setLoading(false));
  }, [
    open,
    session?.id,
    session?.retained_float,
    session?.settlement_amount,
    session?.settlement_destination,
    session?.settlement_mode,
    session?.settlement_reference,
    session?.counted_closing_cash,
  ]);

  const parsedDenominations = useMemo(() => {
    if (!denominations.trim()) return null;
    return { notes: denominations.trim() };
  }, [denominations]);

  const submitCount = async () => {
    if (!session?.id) return;
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid closing cash count.");
      return;
    }
    if (recountMode && reason.trim().length < 5) {
      toast.error("Correcting a submitted count requires a reason.");
      return;
    }
    if (liveVariance != null && Math.abs(liveVariance) > 0.005 && reason.trim().length < 5) {
      toast.error("Short or over cash requires a reason before proceeding.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: DrawerClosingCountInput = {
        counted_closing_cash: amount,
        denominations_json: parsedDenominations,
        reason: reason.trim() || null,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(
        DrawerSessionApis.closingCount(session.id),
        payload,
      );
      const updated = res.data?.data;
      if (updated) onUpdated(updated);
      if (recountMode) setRecountMode(false);
      toast.success(recountMode ? "Corrected drawer count submitted." : "Drawer closing count submitted.");
      if (updated?.status === "approved") {
        onOpenChange(false);
      } else if (updated?.status === "closed" || updated?.status === "variance_review_required") {
        toast.message("Add the settlement decision for counted cash.");
      }
    } catch (error) {
      console.error("Failed to submit drawer count", error);
      const apiError = error as { response?: { data?: { detail?: unknown } } };
      const detail = apiError.response?.data?.detail;
      toast.error(
        typeof detail === "string" && detail.trim()
          ? detail
          : recountMode
            ? "Failed to submit corrected count"
            : "Failed to submit drawer count",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const approveSettlement = async () => {
    if (!session?.id) return;
    if (requiresSettlementApproval && !canApproveSelectedSettlement) {
      toast.error("You do not have permission for this settlement decision.");
      return;
    }
    const retained = Number(retainedFloat || 0);
    const settlement = Number(settlementAmount || 0);
    if (!reason.trim()) {
      toast.error("Settlement decision requires a reason.");
      return;
    }
    if (!Number.isFinite(retained) || retained < 0 || !Number.isFinite(settlement) || settlement < 0) {
      toast.error("Enter valid settlement amounts.");
      return;
    }
    const counted = Number(session.counted_closing_cash ?? 0);
    const difference = counted - retained - settlement;
    if (Number.isFinite(difference) && Math.abs(difference) > 0.005) {
      toast.error("Retained float plus settlement amount must match counted cash.");
      return;
    }
    if (settlementMode === "immediate_bank_deposit" && !settlementReference.trim()) {
      toast.error("Immediate bank deposit requires a reference.");
      return;
    }
    setApproving(true);
    try {
      const payload: DrawerSettlementDecisionInput = {
        reason: reason.trim(),
        retained_float: retained,
        settlement_mode: settlementMode,
        settlement_amount: settlement,
        settlement_destination: settlementDestination.trim() || null,
        settlement_reference: settlementReference.trim() || null,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(
        DrawerSessionApis.settlementDecision(session.id),
        payload,
      );
      const updated = res.data?.data;
      if (updated) onUpdated(updated);
      toast.success("Drawer settlement decision approved.");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to approve drawer settlement decision", error);
      const apiError = error as { response?: { data?: { detail?: unknown } } };
      const detail = apiError.response?.data?.detail;
      toast.error(
        typeof detail === "string" && detail.trim()
          ? detail
          : "Failed to approve drawer settlement decision",
      );
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Drawer reconciliation</DialogTitle>
          <DialogDescription>
            Review expected cash, enter the actual count, and record a reason for any short or over amount.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drawer count prompt...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Expected cash</div>
                <div className="mt-1 text-lg font-semibold">
                  {formatDayCloseCurrency(expectedClosingCash)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Actual count</div>
                <div className="mt-1 text-lg font-semibold">
                  {needsClosingCount
                    ? enteredClosingCash == null || !Number.isFinite(enteredClosingCash)
                      ? "-"
                      : formatDayCloseCurrency(enteredClosingCash)
                    : formatDayCloseCurrency(countedClosingCash)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Short / over</div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    hasDisplayedVariance
                      ? displayedVariance != null && displayedVariance > 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  {hasDisplayedVariance && displayedVariance != null
                    ? `${varianceLabel} ${formatDayCloseCurrency(Math.abs(displayedVariance))}`
                    : "Balanced"}
                </div>
              </div>
              {prompt?.blind_count_enabled ? (
                <div className="text-xs text-muted-foreground sm:col-span-3">
                  This drawer is configured for blind counting, but expected cash is shown in this reconciliation workspace.
                </div>
              ) : null}
            </div>

            {needsClosingCount ? (
              <label className="grid gap-1 text-sm font-medium">
                Actual cash count
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  placeholder="0.00"
                />
              </label>
            ) : null}

            {needsClosingCount ? (
              <label className="grid gap-1 text-sm font-medium">
                denominations
                <Textarea
                  value={denominations}
                  onChange={(event) => setDenominations(event.target.value)}
                  placeholder="Optional denomination notes, e.g. 1000x3, 500x4"
                  rows={3}
                />
              </label>
            ) : null}

            <label className="grid gap-1 text-sm font-medium">
              Reason / note
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  recountMode
                    ? "Required reason for correcting the submitted count"
                    : hasDisplayedVariance || needsSettlement
                    ? "Required for short, over, or settlement approval"
                    : "Optional note"
                }
                rows={3}
              />
            </label>

            {hasDisplayedVariance ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                This drawer is {varianceLabel.toLowerCase()} by{" "}
                {displayedVariance != null ? formatDayCloseCurrency(Math.abs(displayedVariance)) : "0.00"}.
                You can proceed with a reason; final variance settlement requires drawer approval permission.
              </div>
            ) : null}

            {isPendingVariance && !recountMode ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">Count entered incorrectly?</div>
                  <div className="text-muted-foreground">
                    Record a corrected physical count before approving this variance.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCountedCash(String(session?.counted_closing_cash ?? ""));
                    setReason("");
                    setDenominations("");
                    setRecountMode(true);
                  }}
                  disabled={!canCountDrawer}
                  title={!canCountDrawer ? "Drawer counting permission is required." : undefined}
                >
                  Correct count
                </Button>
              </div>
            ) : null}

            {requiresSettlementApproval && !canApproveSelectedSettlement ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                A user with the required variance or transfer permission must submit this settlement decision.
              </div>
            ) : null}

            {needsSettlement ? (
              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <div className="font-medium">Settlement decision</div>
                  <div className="text-sm text-muted-foreground">
                    {isZeroCashSettlement
                      ? "Approve the shortage with no physical cash to retain or transfer."
                      : "Allocate counted cash between retained float and transfer or deposit."}
                  </div>
                </div>

                <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Counted cash</div>
                    <div className="mt-1 font-semibold">{formatDayCloseCurrency(countedClosingCash)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Allocated</div>
                    <div className="mt-1 font-semibold">
                      {formatDayCloseCurrency(
                        Number.isFinite(retainedAmount) && Number.isFinite(settlementTotal)
                          ? retainedAmount + settlementTotal
                          : 0,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Difference</div>
                    <div className="mt-1 font-semibold">
                      {formatDayCloseCurrency(settlementDifference ?? countedClosingCash)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(isZeroCashSettlement
                    ? [["retain_all", "No cash to settle"]]
                    : [
                        ["safe_transfer", "Transfer to safe"],
                        ["pending_bank_deposit", "Pending bank deposit"],
                        ["immediate_bank_deposit", "Immediate bank deposit"],
                        ["retain_all", "Retain all"],
                      ]
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={settlementMode === value ? "default" : "outline"}
                      onClick={() => {
                        setSettlementMode(value);
                        if (value === "retain_all") {
                          const counted = Number(session?.counted_closing_cash ?? 0);
                          setRetainedFloat(Number.isFinite(counted) ? String(counted) : "0");
                          setSettlementAmount("0");
                        }
                        if (value === "safe_transfer" && !settlementDestination.trim()) {
                          setSettlementDestination("main_cash_safe");
                        }
                      }}
                      className="justify-start"
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {isZeroCashSettlement ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Retained cash and settlement amount are both Rs. 0.00. The shortage reason and approving user
                    will be recorded in the drawer audit trail.
                  </div>
                ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium">
                    Retained float
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={retainedFloat}
                      onChange={(event) => setRetainedFloat(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Settlement amount
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settlementAmount}
                      onChange={(event) => setSettlementAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Destination
                    <Input
                      value={settlementDestination}
                      onChange={(event) => setSettlementDestination(event.target.value)}
                      placeholder="Safe, bank account, or deposit owner"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Reference
                    <Input
                      value={settlementReference}
                      onChange={(event) => setSettlementReference(event.target.value)}
                      placeholder="Deposit slip or transfer reference"
                    />
                  </label>
                </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="sticky bottom-0 bg-background pt-3">
          <Button
            variant="outline"
            onClick={() => {
              if (recountMode) {
                setRecountMode(false);
                setCountedCash("");
                setReason("");
                setDenominations("");
                return;
              }
              onOpenChange(false);
            }}
          >
            {recountMode ? "Back to approval" : "Cancel"}
          </Button>
          {needsSettlement ? (
            <Button
              onClick={approveSettlement}
              disabled={approving || loading || (requiresSettlementApproval && !canApproveSelectedSettlement)}
            >
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Submit settlement decision
            </Button>
          ) : (
            <Button
              onClick={submitCount}
              disabled={submitting || loading || !canCountDrawer}
              title={!canCountDrawer ? "Drawer closing permission is required." : undefined}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {recountMode
                ? "Submit corrected count"
                : hasDisplayedVariance
                  ? "Submit count with variance"
                  : "Submit count"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
