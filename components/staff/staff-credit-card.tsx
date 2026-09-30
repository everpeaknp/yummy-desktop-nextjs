"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Edit3,
  Loader2,
  Undo2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { DataList, ListRow } from "@/components/patterns/data/data-list";

import {
  staffCreditApi,
  type StaffCreditBalance,
  type StaffCreditTransaction,
} from "@/lib/staff/credit";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import { formatCurrency } from "@/lib/utils";

function money(value: number | string | null | undefined) {
  return formatCurrency(value);
}

function message(error: any) {
  const detail = error?.response?.data?.detail;
  return (
    (typeof detail === "string" ? detail : detail?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    "Request failed"
  );
}

export function StaffCreditCard({
  staffId,
  canManage,
  discountLimitAmount,
  onDiscountLimitChanged,
}: {
  staffId: number;
  canManage: boolean;
  discountLimitAmount?: number | null;
  onDiscountLimitChanged: (value: number | null) => Promise<void> | void;
}) {
  const [balance, setBalance] = useState<StaffCreditBalance | null>(null);
  const [transactions, setTransactions] = useState<StaffCreditTransaction[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryOpen, setEntryOpen] = useState<"advance" | "repay" | null>(null);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryAccount, setEntryAccount] =
    useState<CashBankAccountOption | null>(null);

  const [reversing, setReversing] = useState<StaffCreditTransaction | null>(
    null,
  );
  const [reversalReason, setReversalReason] = useState("");
  const [reversalSaving, setReversalSaving] = useState(false);

  const [limitOpen, setLimitOpen] = useState(false);
  const [limitValue, setLimitValue] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBalance, nextTransactions] = await Promise.all([
        staffCreditApi.balance(staffId),
        staffCreditApi.transactions(staffId),
      ]);
      setBalance(nextBalance);
      setTransactions(nextTransactions);
    } catch (error) {
      const detail = message(error);
      setError(detail);
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEntry = (kind: "advance" | "repay") => {
    setEntryOpen(kind);
    setEntryAmount("");
    setEntryReason("");
    setEntryAccount(null);
  };

  const submitEntry = async () => {
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!entryAccount) {
      toast.error("Select a Cash & Banks account");
      return;
    }
    setEntrySaving(true);
    try {
      const payload = {
        amount,
        reason: entryReason.trim() || undefined,
        account_type: entryAccount.account_type,
        account_id: entryAccount.id,
      };
      if (entryOpen === "advance")
        await staffCreditApi.recordAdvance(staffId, payload);
      else await staffCreditApi.recordRepayment(staffId, payload);
      toast.success(
        entryOpen === "advance" ? "Advance recorded" : "Repayment recorded",
      );
      setEntryOpen(null);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setEntrySaving(false);
    }
  };

  const submitReversal = async () => {
    if (!reversing || reversalReason.trim().length < 3) {
      toast.error("Explain why this transaction is being reversed");
      return;
    }
    setReversalSaving(true);
    try {
      await staffCreditApi.reverse(
        staffId,
        reversing.id,
        reversalReason.trim(),
      );
      toast.success("Transaction reversed");
      setReversing(null);
      setReversalReason("");
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setReversalSaving(false);
    }
  };

  const openLimitEditor = () => {
    setLimitValue(
      discountLimitAmount == null ? "" : String(discountLimitAmount),
    );
    setLimitOpen(true);
  };

  const submitLimit = async () => {
    const trimmed = limitValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error("Enter a valid limit or leave it empty for no limit");
      return;
    }
    setLimitSaving(true);
    try {
      await onDiscountLimitChanged(parsed);
      setLimitOpen(false);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLimitSaving(false);
    }
  };

  return (
    <>
      <section className="space-y-4">
        <div className="border-b pb-3">
          <div>
            <h3 className="text-base font-semibold">Credits &amp; advances</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-bill discount authorization cap, plus advances given to and
              repaid by this employee.
            </p>
          </div>
        </div>
        <div className="space-y-6">
          {loading && !balance ? (
            <LoadingState label="Loading advances" className="min-h-32" />
          ) : error && !balance ? (
            <ErrorState
              title="Credit and advances unavailable"
              description={error}
              actionLabel="Retry"
              onAction={() => void load()}
              className="min-h-40"
            />
          ) : balance ? (
            <>
              <DataList className="rounded-none border-x-0 bg-transparent">
                <ListRow
                  leading={<WalletCards className="h-4 w-4" />}
                  title="Balance"
                  trailing={
                    <span className="font-semibold tabular-nums">
                      {money(balance.balance)}
                    </span>
                  }
                />
              </DataList>

              {canManage ? (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEntry("advance")}
                  >
                    Give advance
                  </Button>
                  {balance.balance > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEntry("repay")}
                    >
                      Take repayment
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <details className="group border-t pt-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold">
                  <span>Advance history</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {transactions.length} record
                    {transactions.length === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="divide-y border-y">
                  <div className="grid grid-cols-2 divide-x border-b text-sm">
                    <div className="py-3 pr-3">
                      <p className="text-xs text-muted-foreground">Advanced</p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {money(balance.total_advanced)}
                      </p>
                    </div>
                    <div className="py-3 pl-3">
                      <p className="text-xs text-muted-foreground">Repaid</p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {money(balance.total_repaid)}
                      </p>
                    </div>
                  </div>
                  {transactions.length ? (
                    transactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        canManage={canManage}
                        onReverse={() => {
                          setReversing(transaction);
                          setReversalReason("");
                        }}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="No advance history"
                      description="Advances and repayments will appear here."
                      className="min-h-36"
                    />
                  )}
                </div>
              </details>

              <details className="group border-t pt-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold">
                  <span>Discount authorization</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {discountLimitAmount == null
                      ? "No limit"
                      : money(discountLimitAmount)}
                  </span>
                </summary>
                <div className="flex items-center justify-between gap-4 border-t py-4">
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Discounts above this amount require a manager override.
                  </p>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openLimitEditor}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  ) : null}
                </div>
              </details>
            </>
          ) : null}
        </div>
      </section>

      <Dialog
        open={Boolean(entryOpen)}
        onOpenChange={(open) => !open && setEntryOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entryOpen === "advance"
                ? "Record an advance"
                : "Record a repayment"}
            </DialogTitle>
            <DialogDescription>
              {entryOpen === "advance"
                ? "Money given to this employee, added to their outstanding balance."
                : "Money received back from this employee, reducing their outstanding balance."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <CashBankAccountSelect
              value={entryAccount}
              onChange={setEntryAccount}
              disabled={entrySaving}
              label={entryOpen === "advance" ? "Pay from" : "Receive into"}
            />
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entryAmount}
                onChange={(event) => setEntryAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={entryReason}
                onChange={(event) => setEntryReason(event.target.value)}
                placeholder={
                  entryOpen === "advance"
                    ? "e.g. Emergency advance"
                    : "e.g. Deducted from salary"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEntryOpen(null)}
              disabled={entrySaving}
            >
              Cancel
            </Button>
            <Button
              onClick={submitEntry}
              disabled={entrySaving || !entryAccount}
            >
              {entrySaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {entryOpen === "advance" ? "Record advance" : "Record repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reversing)}
        onOpenChange={(open) => {
          if (!open && !reversalSaving) setReversing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse transaction</DialogTitle>
            <DialogDescription>
              This reverses {reversing ? money(reversing.amount) : "the amount"}{" "}
              and restores the employee&apos;s balance. The original record
              remains visible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="For example: entered by mistake"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReversing(null)}
              disabled={reversalSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReversal}
              disabled={reversalSaving || reversalReason.trim().length < 3}
            >
              {reversalSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={limitOpen}
        onOpenChange={(open) => !open && setLimitOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discount authorization limit</DialogTitle>
            <DialogDescription>
              The most this staff member can discount on a single bill without a
              manager override. Leave empty for no limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Limit</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={limitValue}
              onChange={(event) => setLimitValue(event.target.value)}
              placeholder="No limit"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLimitOpen(false)}
              disabled={limitSaving}
            >
              Cancel
            </Button>
            <Button onClick={submitLimit} disabled={limitSaving}>
              {limitSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransactionRow({
  transaction,
  canManage,
  onReverse,
}: {
  transaction: StaffCreditTransaction;
  canManage: boolean;
  onReverse: () => void;
}) {
  const reversed = transaction.status === "reversed";
  const label =
    transaction.direction === "advance_granted"
      ? "Advance given"
      : transaction.direction === "repayment_received"
        ? "Repayment received"
        : "Adjustment";
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="pt-0.5 text-muted-foreground">
          {reversed ? (
            <Undo2 className="h-4 w-4" />
          ) : transaction.direction === "advance_granted" ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-semibold">{money(transaction.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {label}
            {transaction.reason ? ` • ${transaction.reason}` : ""}
            {transaction.balance_after != null
              ? ` • Balance after: ${money(transaction.balance_after)}`
              : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant={reversed ? "secondary" : "outline"}>
          {transaction.status}
        </Badge>
        {canManage && !reversed ? (
          <Button size="sm" variant="outline" onClick={onReverse}>
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Reverse
          </Button>
        ) : null}
      </div>
    </div>
  );
}
