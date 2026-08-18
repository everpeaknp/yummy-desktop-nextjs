"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { staffCreditApi } from "@/lib/staff/credit";
import {
  staffSalaryApi,
  type StaffOvertimeSummary,
  type StaffSalaryBalance,
  type StaffSalaryTransaction,
} from "@/lib/staff/salary";
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
import { Switch } from "@/components/ui/switch";

function money(value: number | string | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function salaryTypeLabel(salaryType?: string | null) {
  switch (salaryType) {
    case "monthly":
      return "month";
    case "weekly":
      return "week";
    case "daily":
      return "day";
    case "hourly":
      return "hour";
    default:
      return "";
  }
}

function breakdownText(balance: StaffSalaryBalance) {
  const startDate = balance.accrual_start_date
    ? new Date(balance.accrual_start_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  if (balance.salary_type === "hourly" && balance.mode !== "attendance") {
    return "Hourly staff only accrue once attendance-based salary is turned on.";
  }

  if (balance.mode === "attendance") {
    const b = balance.breakdown || {};
    const parts = [
      b.off_days ? `${b.off_days} day(s) off (paid in full)` : null,
      b.worked_days ? `${b.worked_days} day(s) worked` : null,
      b.absent_days ? `${b.absent_days} day(s) absent (Rs. 0)` : null,
    ].filter(Boolean);
    const hours = b.worked_hours != null ? ` · ${b.worked_hours.toFixed(1)}h clocked` : "";
    return `${parts.join(" · ")} since ${startDate}${hours}`;
  }

  return `${money(balance.daily_rate)}/day (${money(balance.salary_amount)}/${salaryTypeLabel(balance.salary_type)}) × ${balance.days_elapsed} day(s) since ${startDate}`;
}

function minutes(value: number) {
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours === 0 ? `${remainder}m` : `${hours}h ${remainder}m`;
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

export function StaffSalaryCard({
  staffId,
  canManage,
  attendanceBasedSalary,
  selfDiscountPercent,
  onSettingsChanged,
}: {
  staffId: number;
  canManage: boolean;
  attendanceBasedSalary: boolean;
  selfDiscountPercent?: number | null;
  onSettingsChanged: () => Promise<void> | void;
}) {
  const [balance, setBalance] = useState<StaffSalaryBalance | null>(null);
  const [overtime, setOvertime] = useState<StaffOvertimeSummary | null>(null);
  const [history, setHistory] = useState<StaffSalaryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [entryOpen, setEntryOpen] = useState<"pay" | "deduct" | null>(null);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryMethod, setEntryMethod] = useState("cash");
  const [entryReason, setEntryReason] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);

  const [overtimeRateOpen, setOvertimeRateOpen] = useState(false);
  const [overtimeRate, setOvertimeRate] = useState("");
  const [overtimeSaving, setOvertimeSaving] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBalance, nextOvertime] = await Promise.all([
        staffSalaryApi.balance(staffId),
        staffSalaryApi.overtime(staffId),
      ]);
      setBalance(nextBalance);
      setOvertime(nextOvertime);
      // The salary ledger reuses the credit transaction endpoint, so filter
      // to this card's directions client-side.
      const transactions = (await staffCreditApi.transactions(
        staffId,
      )) as unknown as StaffSalaryTransaction[];
      setHistory(
        transactions.filter((t) =>
          ["salary_paid", "salary_deducted", "overtime_paid"].includes(
            t.direction as string,
          ),
        ),
      );
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEntry = (kind: "pay" | "deduct") => {
    setEntryOpen(kind);
    setEntryAmount(kind === "pay" && balance ? String(balance.balance) : "");
    setEntryMethod("cash");
    setEntryReason("");
    setEntryReference("");
  };

  const submitEntry = async () => {
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (entryOpen === "deduct" && entryReason.trim().length < 3) {
      toast.error("Explain why this salary is being deducted");
      return;
    }
    setEntrySaving(true);
    try {
      if (entryOpen === "pay") {
        await staffSalaryApi.pay(staffId, {
          amount,
          payment_method: entryMethod || undefined,
          reason: entryReason.trim() || undefined,
          reference: entryReference.trim() || undefined,
        });
      } else {
        await staffSalaryApi.deduct(staffId, {
          amount,
          reason: entryReason.trim(),
          reference: entryReference.trim() || undefined,
        });
      }
      toast.success(entryOpen === "pay" ? "Salary paid" : "Salary deducted");
      setEntryOpen(null);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setEntrySaving(false);
    }
  };

  const payOvertime = async () => {
    const rate = Number(overtimeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("Enter a valid hourly rate");
      return;
    }
    setOvertimeSaving(true);
    try {
      await staffSalaryApi.resolveOvertime(staffId, {
        action: "pay",
        hourly_rate: rate,
      });
      toast.success("Overtime paid");
      setOvertimeRateOpen(false);
      setOvertimeRate("");
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setOvertimeSaving(false);
    }
  };

  const discardOvertime = async () => {
    setOvertimeSaving(true);
    try {
      await staffSalaryApi.resolveOvertime(staffId, { action: "discard" });
      toast.success("Overtime discarded");
      setDiscardConfirmOpen(false);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setOvertimeSaving(false);
    }
  };

  const toggleAttendanceBasedSalary = async (enabled: boolean) => {
    try {
      await staffSalaryApi.updateAttendanceBasedSalary(staffId, enabled);
      await onSettingsChanged();
      await load();
    } catch (error) {
      toast.error(message(error));
    }
  };

  const openDiscountEditor = () => {
    setDiscountValue(
      selfDiscountPercent == null ? "" : String(selfDiscountPercent),
    );
    setDiscountOpen(true);
  };

  const submitDiscount = async () => {
    const trimmed = discountValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Enter a percentage between 0 and 100, or leave it empty");
      return;
    }
    setDiscountSaving(true);
    try {
      await staffSalaryApi.updateSelfDiscount(staffId, parsed);
      await onSettingsChanged();
      setDiscountOpen(false);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setDiscountSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Salary</CardTitle>
            <CardDescription>
              {attendanceBasedSalary
                ? "Accrues daily, adjusted for attendance"
                : "Accrues daily from the effective salary"}
            </CardDescription>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => openEntry("pay")}
                disabled={!balance || balance.balance <= 0}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Pay
              </Button>
              <Button variant="outline" onClick={() => openEntry("deduct")}>
                <ArrowDownRight className="mr-2 h-4 w-4" />
                Deduct
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && !balance ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : balance ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  icon={Wallet}
                  label="Balance owed"
                  value={money(balance.balance)}
                  prominent={balance.balance !== 0}
                />
                <Metric icon={TrendingUp} label="Accrued so far" value={money(balance.accrued)} />
                <Metric icon={CheckCircle2} label="Already paid" value={money(balance.paid)} />
              </div>
              <p className="text-xs text-muted-foreground">{breakdownText(balance)}</p>

              <section>
                <h3 className="mb-3 font-semibold">Salary &amp; overtime history</h3>
                <div className="space-y-2">
                  {history.length ? (
                    history.map((transaction) => (
                      <TransactionRow key={transaction.id} transaction={transaction} />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                      No salary payments or deductions yet.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          <section className="rounded-xl border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Outstanding overtime</p>
                  <p className="text-lg font-bold">
                    {overtime ? minutes(overtime.outstanding_minutes) : "—"}
                  </p>
                </div>
              </div>
              {canManage && overtime && overtime.outstanding_minutes > 0 ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOvertimeRate("");
                      setOvertimeRateOpen(true);
                    }}
                  >
                    Pay
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDiscardConfirmOpen(true)}
                  >
                    Discard
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Attendance-based salary</p>
                <p className="text-xs text-muted-foreground">
                  Adjust daily pay for late arrivals, early departures, and absences
                </p>
              </div>
              <Switch
                checked={attendanceBasedSalary}
                disabled={!canManage}
                onCheckedChange={toggleAttendanceBasedSalary}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="font-medium">Staff purchase discount</p>
                <p className="text-xs text-muted-foreground">
                  Applied automatically to this staff member&apos;s own food orders
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {selfDiscountPercent == null ? "None" : `${selfDiscountPercent}%`}
                </span>
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={openDiscountEditor}>
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog open={Boolean(entryOpen)} onOpenChange={(open) => !open && setEntryOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entryOpen === "pay" ? "Pay salary" : "Deduct from salary"}</DialogTitle>
            <DialogDescription>
              {entryOpen === "pay"
                ? "Pays this employee against their accrued salary balance."
                : "Reduces this employee's salary balance, for example for an absence."}
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
            {entryOpen === "pay" ? (
              <div>
                <Label>Payment method</Label>
                <select
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs capitalize"
                  value={entryMethod}
                  onChange={(event) => setEntryMethod(event.target.value)}
                >
                  {paymentMethods.map((methodValue) => (
                    <option key={methodValue} value={methodValue}>
                      {methodValue.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <Label>{entryOpen === "deduct" ? "Reason (required)" : "Reason (optional)"}</Label>
              <Input
                value={entryReason}
                onChange={(event) => setEntryReason(event.target.value)}
                placeholder={
                  entryOpen === "pay"
                    ? "e.g. Weekly salary payout, Diwali bonus"
                    : "e.g. Absent without notice"
                }
              />
            </div>
            <div>
              <Label>Reference (optional)</Label>
              <Input
                value={entryReference}
                onChange={(event) => setEntryReference(event.target.value)}
                placeholder="e.g. cheque or transfer number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(null)} disabled={entrySaving}>
              Cancel
            </Button>
            <Button onClick={submitEntry} disabled={entrySaving}>
              {entrySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {entryOpen === "pay" ? "Pay salary" : "Deduct salary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overtimeRateOpen} onOpenChange={(open) => !open && setOvertimeRateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay overtime</DialogTitle>
            <DialogDescription>
              {overtime ? minutes(overtime.outstanding_minutes) : ""} outstanding. Enter the
              hourly rate to pay it at.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Hourly rate</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={overtimeRate}
              onChange={(event) => setOvertimeRate(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOvertimeRateOpen(false)}
              disabled={overtimeSaving}
            >
              Cancel
            </Button>
            <Button onClick={payOvertime} disabled={overtimeSaving}>
              {overtimeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirmOpen} onOpenChange={(open) => !open && setDiscardConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard outstanding overtime?</DialogTitle>
            <DialogDescription>
              The recorded {overtime ? minutes(overtime.outstanding_minutes) : ""} of overtime
              will be cleared without a payout. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscardConfirmOpen(false)}
              disabled={overtimeSaving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={discardOvertime} disabled={overtimeSaving}>
              {overtimeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discountOpen} onOpenChange={(open) => !open && setDiscountOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff purchase discount</DialogTitle>
            <DialogDescription>
              Automatically applied when this staff member orders food from this restaurant.
              Leave empty for no discount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Discount percent</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder="10"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)} disabled={discountSaving}>
              Cancel
            </Button>
            <Button onClick={submitDiscount} disabled={discountSaving}>
              {discountSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
  icon: typeof Wallet;
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

function TransactionRow({ transaction }: { transaction: StaffSalaryTransaction }) {
  const label =
    transaction.direction === "salary_paid"
      ? "Salary paid"
      : transaction.direction === "salary_deducted"
        ? "Salary deducted"
        : transaction.direction === "overtime_paid"
          ? "Overtime paid"
          : "Adjustment";
  const isOutflow = transaction.direction !== "salary_deducted";
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          {isOutflow ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-semibold">{money(transaction.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {label}
            {transaction.reason ? ` • ${transaction.reason}` : ""}
            {transaction.reference ? ` • Ref: ${transaction.reference}` : ""}
            {transaction.balance_after != null ? ` • Balance after: ${money(transaction.balance_after)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(transaction.created_at).toLocaleString()}</p>
        </div>
      </div>
      <Badge variant="outline">{transaction.status}</Badge>
    </div>
  );
}
