"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { CashAndBanksApis, DrawerSessionApis } from "@/lib/api/endpoints";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type SettlementAccount = {
  account_type: "drawer" | "bank";
  id: number;
  name: string;
  bank_type: "bank" | "custom" | "owner_equity" | string;
  current_balance: number | string;
};

type SettlementAllocationDraft = {
  key: string;
  accountId: string;
  amount: string;
  reference: string;
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
  const [settlementAccounts, setSettlementAccounts] = useState<SettlementAccount[]>([]);
  const [settlementAllocations, setSettlementAllocations] = useState<SettlementAllocationDraft[]>([]);
  const [settlementAccountsLoading, setSettlementAccountsLoading] = useState(false);
  const [settlementAccountsError, setSettlementAccountsError] = useState<string | null>(null);
  const [denominations, setDenominations] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [recountMode, setRecountMode] = useState(false);
  const allocationKeySeed = useRef(0);
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
    (settlementAllocations.length === 0
      ? canApproveAnyDrawer
      : settlementAllocations.every((allocation) => {
          const account = settlementAccounts.find(
            (candidate) => String(candidate.id) === allocation.accountId,
          );
          return account?.bank_type === "custom"
            ? canTransferToSafe
            : Boolean(account) && canTransferToBank && canConfirmBankDeposit;
        }));
  const retainedAmount = Number(retainedFloat || 0);
  const settlementTotal = settlementAllocations.reduce(
    (total, allocation) => total + (Number(allocation.amount) || 0),
    0,
  );
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
    setRetainedFloat(
      session.retained_float != null
        ? String(session.retained_float)
        : Number.isFinite(counted)
          ? String(counted)
          : "0",
    );
    const existingLines = (session.settlement_lines ?? []).map((line) => ({
      key: `existing-${line.id}`,
      accountId: String(line.destination_account_id),
      amount: String(line.amount),
      reference: line.reference || "",
    }));
    if (
      existingLines.length === 0 &&
      session.settlement_destination_id != null &&
      Number(session.settlement_amount ?? 0) > 0
    ) {
      existingLines.push({
        key: "legacy-settlement",
        accountId: String(session.settlement_destination_id),
        amount: String(session.settlement_amount),
        reference: session.settlement_reference || "",
      });
    }
    setSettlementAllocations(hasNoCash ? [] : existingLines);
    setSettlementAccounts([]);
    setSettlementAccountsError(null);
    setDenominations("");
    setLoading(true);
    setSettlementAccountsLoading(true);
    apiClient
      .get<BaseResponse<SettlementAccount[]>>(
        CashAndBanksApis.list(session.restaurant_id, String(session.business_line || "restaurant")),
      )
      .then((res) => {
        const available = (res.data?.data ?? []).filter((account) => {
          if (account.account_type !== "bank") return false;
          if (account.bank_type === "custom") return canTransferToSafe;
          return canTransferToBank && canConfirmBankDeposit;
        });
        setSettlementAccounts(available);
      })
      .catch((error) => {
        console.error("Failed to load settlement accounts", error);
        setSettlementAccountsError("Unable to load eligible Cash & Banks destinations.");
      })
      .finally(() => setSettlementAccountsLoading(false));
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
    session?.settlement_destination_id,
    session?.settlement_lines,
    session?.settlement_mode,
    session?.settlement_reference,
    session?.counted_closing_cash,
    canTransferToSafe,
    canTransferToBank,
    canConfirmBankDeposit,
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

  const addSettlementAllocation = () => {
    const usedAccountIds = new Set(
      settlementAllocations.map((allocation) => allocation.accountId),
    );
    const nextAccount = settlementAccounts.find(
      (account) => !usedAccountIds.has(String(account.id)),
    );
    if (!nextAccount) {
      toast.error(
        settlementAccountsError ||
          "No additional eligible Cash & Banks destination is available.",
      );
      return;
    }
    const counted = Number(session?.counted_closing_cash ?? 0);
    let remaining = counted - retainedAmount - settlementTotal;
    if (settlementAllocations.length === 0 && remaining <= 0.005) {
      setRetainedFloat("0");
      remaining = counted;
    }
    allocationKeySeed.current += 1;
    setSettlementAllocations((current) => [
      ...current,
      {
        key: `allocation-${allocationKeySeed.current}`,
        accountId: String(nextAccount.id),
        amount: remaining > 0.005 ? String(remaining) : "",
        reference: "",
      },
    ]);
  };

  const updateSettlementAllocation = (
    key: string,
    patch: Partial<SettlementAllocationDraft>,
  ) => {
    setSettlementAllocations((current) =>
      current.map((allocation) =>
        allocation.key === key ? { ...allocation, ...patch } : allocation,
      ),
    );
  };

  const retainAllCountedCash = () => {
    const counted = Number(session?.counted_closing_cash ?? 0);
    setRetainedFloat(Number.isFinite(counted) ? String(counted) : "0");
    setSettlementAllocations([]);
  };

  const approveSettlement = async () => {
    if (!session?.id) return;
    if (requiresSettlementApproval && !canApproveSelectedSettlement) {
      toast.error("You do not have permission for this settlement decision.");
      return;
    }
    const retained = Number(retainedFloat || 0);
    if (reason.trim().length < 5) {
      toast.error("Settlement reason must be at least 5 characters.");
      return;
    }
    if (!Number.isFinite(retained) || retained < 0) {
      toast.error("Enter a valid amount to keep in the drawer.");
      return;
    }
    const destinationIds = new Set<string>();
    for (const allocation of settlementAllocations) {
      const account = settlementAccounts.find(
        (candidate) => String(candidate.id) === allocation.accountId,
      );
      const amount = Number(allocation.amount);
      if (!account) {
        toast.error("Select an account for every transfer.");
        return;
      }
      if (destinationIds.has(allocation.accountId)) {
        toast.error("Use each destination account only once.");
        return;
      }
      destinationIds.add(allocation.accountId);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(`Enter a transfer amount greater than zero for ${account.name}.`);
        return;
      }
      if (account.bank_type !== "custom" && !allocation.reference.trim()) {
        toast.error(`Add a reference for the transfer to ${account.name}.`);
        return;
      }
    }
    const counted = Number(session.counted_closing_cash ?? 0);
    const difference = counted - retained - settlementTotal;
    if (Number.isFinite(difference) && Math.abs(difference) > 0.005) {
      toast.error("Allocate all counted cash before submitting.");
      return;
    }
    setApproving(true);
    try {
      const payload: DrawerSettlementDecisionInput = {
        reason: reason.trim(),
        retained_float: retained,
        settlement_lines: settlementAllocations.map((allocation) => ({
          destination_account_id: Number(allocation.accountId),
          amount: Number(allocation.amount),
          reference: allocation.reference.trim() || null,
        })),
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
              {needsSettlement ? "Close note" : "Reason / note"}
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  recountMode
                    ? "Required reason for correcting the submitted count"
                    : hasDisplayedVariance || needsSettlement
                    ? "Explain shortages, overages, or unusual transfers"
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
              <div className="space-y-4 rounded-md border p-3">
                <div>
                  <div className="font-medium">Where should the counted cash go?</div>
                  <div className="text-sm text-muted-foreground">
                    Keep cash in this drawer, transfer it to one or more accounts, or split it between both.
                  </div>
                </div>

                <div className="grid gap-2 rounded-md bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Counted</div>
                    <div className="mt-1 font-semibold">{formatDayCloseCurrency(countedClosingCash)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Allocated</div>
                    <div className="mt-1 font-semibold">{formatDayCloseCurrency(retainedAmount + settlementTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Left to allocate</div>
                    <div className={`mt-1 font-semibold ${settlementDifference != null && settlementDifference < -0.005 ? "text-destructive" : settlementDifference != null && Math.abs(settlementDifference) <= 0.005 ? "text-emerald-600" : ""}`}>
                      {formatDayCloseCurrency(settlementDifference ?? countedClosingCash)}
                    </div>
                  </div>
                </div>

                {isZeroCashSettlement ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    There is no physical cash to allocate. The shortage reason and approving user will be recorded.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Keep in this drawer</div>
                          <div className="text-xs text-muted-foreground">Available as the next opening float.</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={retainAllCountedCash}>Keep all</Button>
                      </div>
                      <Input aria-label="Amount kept in drawer" type="number" min="0" step="0.01" value={retainedFloat} onChange={(event) => setRetainedFloat(event.target.value)} placeholder="0.00" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Transfer to accounts</div>
                          <div className="text-xs text-muted-foreground">Add a row for every destination.</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addSettlementAllocation} disabled={settlementAccountsLoading || settlementAllocations.length >= settlementAccounts.length}>
                          <Plus className="mr-1 h-4 w-4" /> Add account
                        </Button>
                      </div>

                      {settlementAllocations.length === 0 ? (
                        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No transfers. All allocated cash stays in the drawer.</div>
                      ) : settlementAllocations.map((allocation, index) => {
                        const selectedAccount = settlementAccounts.find((account) => String(account.id) === allocation.accountId);
                        return (
                          <div key={allocation.key} className="space-y-3 rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">Destination {index + 1}</div>
                              <Button type="button" variant="ghost" size="icon" aria-label={`Remove destination ${index + 1}`} onClick={() => setSettlementAllocations((current) => current.filter((item) => item.key !== allocation.key))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="grid gap-1 text-sm font-medium">
                                Account
                                <Select value={allocation.accountId} onValueChange={(accountId) => updateSettlementAllocation(allocation.key, { accountId, reference: "" })}>
                                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                                  <SelectContent>
                                    {settlementAccounts.map((account) => {
                                      const usedElsewhere = settlementAllocations.some((item) => item.key !== allocation.key && item.accountId === String(account.id));
                                      return <SelectItem key={account.id} value={String(account.id)} disabled={usedElsewhere}>{account.name} / Rs. {Number(account.current_balance || 0).toLocaleString()}</SelectItem>;
                                    })}
                                  </SelectContent>
                                </Select>
                              </label>
                              <label className="grid gap-1 text-sm font-medium">
                                Amount
                                <Input type="number" min="0.01" step="0.01" value={allocation.amount} onChange={(event) => updateSettlementAllocation(allocation.key, { amount: event.target.value })} placeholder="0.00" />
                              </label>
                            </div>
                            <label className="grid gap-1 text-sm font-medium">
                              Reference{selectedAccount?.bank_type !== "custom" ? " *" : " (optional)"}
                              <Input value={allocation.reference} onChange={(event) => updateSettlementAllocation(allocation.key, { reference: event.target.value })} placeholder="Deposit slip or transfer reference" />
                            </label>
                          </div>
                        );
                      })}
                      {settlementAccountsError ? (
                        <div className="text-xs text-destructive">{settlementAccountsError}</div>
                      ) : !settlementAccountsLoading && settlementAccounts.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No eligible destination accounts. Add one under Cash &amp; Banks or keep the cash in this drawer.</div>
                      ) : null}
                    </div>
                  </>
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
              Complete drawer close
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
