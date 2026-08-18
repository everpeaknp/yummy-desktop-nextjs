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
  staffCreditApi,
  type StaffCreditBalance,
  type StaffCreditTransaction,
} from "@/lib/staff/credit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function money(value: number | string | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const paymentMethods = ["cash", "card", "upi", "bank_transfer", "other"];

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
  const [transactions, setTransactions] = useState<StaffCreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [entryOpen, setEntryOpen] = useState<"advance" | "repay" | null>(null);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryMethod, setEntryMethod] = useState("cash");
  const [entryReason, setEntryReason] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);

  const [reversing, setReversing] = useState<StaffCreditTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalSaving, setReversalSaving] = useState(false);

  const [limitOpen, setLimitOpen] = useState(false);
  const [limitValue, setLimitValue] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBalance, nextTransactions] = await Promise.all([
        staffCreditApi.balance(staffId),
        staffCreditApi.transactions(staffId),
      ]);
      setBalance(nextBalance);
      setTransactions(nextTransactions);
    } catch (error) {
      toast.error(message(error));
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
    setEntryMethod("cash");
    setEntryReason("");
  };

  const submitEntry = async () => {
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setEntrySaving(true);
    try {
      const payload = {
        amount,
        payment_method: entryMethod || undefined,
        reason: entryReason.trim() || undefined,
      };
      if (entryOpen === "advance") await staffCreditApi.recordAdvance(staffId, payload);
      else await staffCreditApi.recordRepayment(staffId, payload);
      toast.success(entryOpen === "advance" ? "Advance recorded" : "Repayment recorded");
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
      await staffCreditApi.reverse(staffId, reversing.id, reversalReason.trim());
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
    setLimitValue(discountLimitAmount == null ? "" : String(discountLimitAmount));
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
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Discount limit &amp; credit</CardTitle>
            <CardDescription>
              Per-bill discount authorization cap, plus advances given to and repaid by this employee.
            </CardDescription>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => openEntry("advance")}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Advance
              </Button>
              <Button variant="outline" onClick={() => openEntry("repay")}>
                <ArrowDownRight className="mr-2 h-4 w-4" />
                Repay
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Discount authorization limit</p>
              <p className="mt-1 text-xl font-bold">
                {discountLimitAmount == null ? "No limit set" : money(discountLimitAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Above this, applying a manual discount needs a manager override.
              </p>
            </div>
            {canManage ? (
              <Button size="sm" variant="outline" onClick={openLimitEditor}>
                <Edit3 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>

          {loading && !balance ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : balance ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  icon={WalletCards}
                  label="Balance owed"
                  value={money(balance.balance)}
                  prominent={balance.balance !== 0}
                />
                <Metric icon={ArrowUpRight} label="Total advanced" value={money(balance.total_advanced)} />
                <Metric icon={ArrowDownRight} label="Total repaid" value={money(balance.total_repaid)} />
              </div>

              <section>
                <h3 className="mb-3 font-semibold">Advance &amp; repayment history</h3>
                <div className="space-y-2">
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
                    <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                      No advances or repayments recorded yet.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(entryOpen)} onOpenChange={(open) => !open && setEntryOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entryOpen === "advance" ? "Record an advance" : "Record a repayment"}</DialogTitle>
            <DialogDescription>
              {entryOpen === "advance"
                ? "Money given to this employee, added to their outstanding balance."
                : "Money received back from this employee, reducing their outstanding balance."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label>Payment method</Label>
              <Select value={entryMethod} onValueChange={setEntryMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((methodValue) => (
                    <SelectItem key={methodValue} value={methodValue} className="capitalize">
                      {methodValue.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={entryReason}
                onChange={(event) => setEntryReason(event.target.value)}
                placeholder={entryOpen === "advance" ? "e.g. Emergency advance" : "e.g. Deducted from salary"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(null)} disabled={entrySaving}>
              Cancel
            </Button>
            <Button onClick={submitEntry} disabled={entrySaving}>
              {entrySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {entryOpen === "advance" ? "Record advance" : "Record repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversing)} onOpenChange={(open) => { if (!open && !reversalSaving) setReversing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse transaction</DialogTitle>
            <DialogDescription>
              This reverses {reversing ? money(reversing.amount) : "the amount"} and restores the employee&apos;s
              balance. The original record remains visible.
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
            <Button variant="outline" onClick={() => setReversing(null)} disabled={reversalSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReversal} disabled={reversalSaving || reversalReason.trim().length < 3}>
              {reversalSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitOpen} onOpenChange={(open) => !open && setLimitOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discount authorization limit</DialogTitle>
            <DialogDescription>
              The most this staff member can discount on a single bill without a manager override. Leave empty for
              no limit.
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
            <Button variant="outline" onClick={() => setLimitOpen(false)} disabled={limitSaving}>
              Cancel
            </Button>
            <Button onClick={submitLimit} disabled={limitSaving}>
              {limitSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  prominent = false,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${prominent ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/10"}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
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
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
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
            {transaction.balance_after != null ? ` • Balance after: ${money(transaction.balance_after)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(transaction.created_at).toLocaleString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant={reversed ? "secondary" : "outline"}>{transaction.status}</Badge>
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
