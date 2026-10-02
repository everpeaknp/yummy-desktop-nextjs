"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  MoreHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { DataList, ListRow } from "@/components/patterns/data/data-list";

import { staffCreditApi } from "@/lib/staff/credit";
import {
  staffSalaryApi,
  type StaffOvertimeSummary,
  type StaffSalaryBalance,
  type StaffSalaryTransaction,
} from "@/lib/staff/salary";
import type { SalaryHistoryRecord } from "@/lib/staff/workforce";
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import { formatCurrency, formatDate } from "@/lib/utils";

function money(value: number | string | null | undefined) {
  return formatCurrency(value);
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
      b.absent_days
        ? `${b.absent_days} day(s) absent (${formatCurrency(0)})`
        : null,
    ].filter(Boolean);
    const hours =
      b.worked_hours != null ? ` · ${b.worked_hours.toFixed(1)}h clocked` : "";
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

export function StaffSalaryCard({
  staffId,
  canManage,
  attendanceBasedSalary,
  selfDiscountPercent,
  compensationHistory,
  onSettingsChanged,
}: {
  staffId: number;
  canManage: boolean;
  attendanceBasedSalary: boolean;
  selfDiscountPercent?: number | null;
  compensationHistory: SalaryHistoryRecord[];
  onSettingsChanged: () => Promise<void> | void;
}) {
  const [balance, setBalance] = useState<StaffSalaryBalance | null>(null);
  const [overtime, setOvertime] = useState<StaffOvertimeSummary | null>(null);
  const [history, setHistory] = useState<StaffSalaryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryOpen, setEntryOpen] = useState<"pay" | "deduct" | null>(null);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryAccount, setEntryAccount] =
    useState<CashBankAccountOption | null>(null);

  const [overtimeRateOpen, setOvertimeRateOpen] = useState(false);
  const [overtimeRate, setOvertimeRate] = useState("");
  const [overtimeSaving, setOvertimeSaving] = useState(false);
  const [overtimeAccount, setOvertimeAccount] =
    useState<CashBankAccountOption | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);

  const paymentHistory = history.filter((item) =>
    ["salary_paid", "overtime_paid"].includes(item.direction),
  );
  const adjustmentHistory = history.filter(
    (item) => item.direction === "salary_deducted",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const openEntry = (kind: "pay" | "deduct") => {
    setEntryOpen(kind);
    setEntryAmount(kind === "pay" && balance ? String(balance.balance) : "");
    setEntryReason("");
    setEntryReference("");
    setEntryAccount(null);
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
    if (entryOpen === "pay" && !entryAccount) {
      toast.error("Select the account paying this salary");
      return;
    }
    setEntrySaving(true);
    try {
      if (entryOpen === "pay") {
        await staffSalaryApi.pay(staffId, {
          amount,
          reason: entryReason.trim() || undefined,
          reference: entryReference.trim() || undefined,
          account_type: entryAccount!.account_type,
          account_id: entryAccount!.id,
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
    if (!overtimeAccount) {
      toast.error("Select the account paying this overtime");
      return;
    }
    setOvertimeSaving(true);
    try {
      await staffSalaryApi.resolveOvertime(staffId, {
        action: "pay",
        hourly_rate: rate,
        account_type: overtimeAccount.account_type,
        account_id: overtimeAccount.id,
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
    if (
      parsed !== null &&
      (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
    ) {
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
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="text-base font-semibold">Current salary</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {attendanceBasedSalary
                ? "Accrues daily, adjusted for attendance"
                : "Accrues daily from the effective salary"}
            </p>
          </div>
          {canManage && overtime && overtime.outstanding_minutes > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="More salary actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setOvertimeRate("");
                    setOvertimeAccount(null);
                    setOvertimeRateOpen(true);
                  }}
                >
                  Pay overtime
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDiscardConfirmOpen(true)}>
                  Discard overtime
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="space-y-6">
          {loading && !balance ? (
            <LoadingState label="Loading salary account" className="min-h-32" />
          ) : error && !balance ? (
            <ErrorState
              title="Salary account unavailable"
              description={error}
              actionLabel="Retry"
              onAction={() => void load()}
              className="min-h-40"
            />
          ) : balance ? (
            <>
              <DataList className="rounded-none border-x-0 bg-transparent">
                <ListRow
                  leading={<Wallet className="h-4 w-4" />}
                  title="Pending"
                  trailing={
                    <span className="font-semibold tabular-nums">
                      {money(balance.balance)}
                    </span>
                  }
                />
                <ListRow
                  leading={<TrendingUp className="h-4 w-4" />}
                  title="Accrued"
                  trailing={
                    <span className="font-semibold tabular-nums">
                      {money(balance.accrued)}
                    </span>
                  }
                />
                <ListRow
                  leading={<CheckCircle2 className="h-4 w-4" />}
                  title="Paid"
                  trailing={
                    <span className="font-semibold tabular-nums">
                      {money(balance.paid)}
                    </span>
                  }
                />
                <ListRow
                  leading={<Clock className="h-4 w-4" />}
                  title="Overtime"
                  trailing={
                    <span className="font-semibold tabular-nums">
                      {overtime ? minutes(overtime.outstanding_minutes) : "—"}
                    </span>
                  }
                />
              </DataList>
              <p className="text-xs text-muted-foreground">
                {breakdownText(balance)}
              </p>

              {canManage ? (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEntry("pay")}
                    disabled={balance.balance <= 0}
                  >
                    Pay salary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEntry("deduct")}
                  >
                    Deduct
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          <section className="border-t pt-4">
            <h3 className="mb-2 text-base font-semibold">Financial history</h3>
            <div className="divide-y border-y">
              <HistoryDisclosure
                label="Salary history"
                count={history.length}
                transactions={history}
              />
              <HistoryDisclosure
                label="Payments"
                count={paymentHistory.length}
                transactions={paymentHistory}
              />
              <HistoryDisclosure
                label="Adjustments"
                count={adjustmentHistory.length}
                transactions={adjustmentHistory}
              />
              <CompensationHistoryDisclosure records={compensationHistory} />
            </div>
          </section>

          <details className="group border-t pt-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold">
              Salary settings
              <span className="text-xs font-normal text-muted-foreground">
                Attendance and discount
              </span>
            </summary>
            <div className="flex items-center justify-between gap-4 border-t py-4">
              <div>
                <p className="font-medium">Attendance-based salary</p>
                <p className="text-xs text-muted-foreground">
                  Adjust daily pay for late arrivals, early departures, and
                  absences
                </p>
              </div>
              <Switch
                checked={attendanceBasedSalary}
                disabled={!canManage}
                onCheckedChange={toggleAttendanceBasedSalary}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t py-4">
              <div>
                <p className="font-medium">Staff purchase discount</p>
                <p className="text-xs text-muted-foreground">
                  Applied automatically to this staff member&apos;s own food
                  orders
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {selfDiscountPercent == null
                    ? "None"
                    : `${selfDiscountPercent}%`}
                </span>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openDiscountEditor}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      </section>

      <Dialog
        open={Boolean(entryOpen)}
        onOpenChange={(open) => !open && setEntryOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entryOpen === "pay" ? "Pay salary" : "Deduct from salary"}
            </DialogTitle>
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
              <div className="space-y-4">
                <CashBankAccountSelect
                  value={entryAccount}
                  onChange={setEntryAccount}
                  disabled={entrySaving}
                  label="Pay from"
                />
              </div>
            ) : null}
            <div>
              <Label>
                {entryOpen === "deduct"
                  ? "Reason (required)"
                  : "Reason (optional)"}
              </Label>
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
            <Button
              variant="outline"
              onClick={() => setEntryOpen(null)}
              disabled={entrySaving}
            >
              Cancel
            </Button>
            <Button
              onClick={submitEntry}
              disabled={entrySaving || (entryOpen === "pay" && !entryAccount)}
            >
              {entrySaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {entryOpen === "pay" ? "Pay salary" : "Deduct salary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overtimeRateOpen}
        onOpenChange={(open) => !open && setOvertimeRateOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay overtime</DialogTitle>
            <DialogDescription>
              {overtime ? minutes(overtime.outstanding_minutes) : ""}{" "}
              outstanding. Enter the hourly rate to pay it at.
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
            <CashBankAccountSelect
              value={overtimeAccount}
              onChange={setOvertimeAccount}
              disabled={overtimeSaving}
              label="Pay from"
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
            <Button
              onClick={payOvertime}
              disabled={overtimeSaving || !overtimeAccount}
            >
              {overtimeSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={discardConfirmOpen}
        onOpenChange={(open) => !open && setDiscardConfirmOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard outstanding overtime?</DialogTitle>
            <DialogDescription>
              The recorded{" "}
              {overtime ? minutes(overtime.outstanding_minutes) : ""} of
              overtime will be cleared without a payout. This cannot be undone.
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
            <Button
              variant="destructive"
              onClick={discardOvertime}
              disabled={overtimeSaving}
            >
              {overtimeSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={discountOpen}
        onOpenChange={(open) => !open && setDiscountOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff purchase discount</DialogTitle>
            <DialogDescription>
              Automatically applied when this staff member orders food from this
              restaurant. Leave empty for no discount.
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
            <Button
              variant="outline"
              onClick={() => setDiscountOpen(false)}
              disabled={discountSaving}
            >
              Cancel
            </Button>
            <Button onClick={submitDiscount} disabled={discountSaving}>
              {discountSaving ? (
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

function HistoryDisclosure({
  label,
  count,
  transactions,
}: {
  label: string;
  count: number;
  transactions: StaffSalaryTransaction[];
}) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </summary>
      <div className="divide-y border-t pl-3">
        {transactions.length ? (
          transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No {label.toLowerCase()} yet.
          </p>
        )}
      </div>
    </details>
  );
}

function CompensationHistoryDisclosure({
  records,
}: {
  records: SalaryHistoryRecord[];
}) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium">
        <span>Compensation changes</span>
        <span className="tabular-nums text-muted-foreground">
          {records.length}
        </span>
      </summary>
      <div className="divide-y border-t pl-3">
        {records.length ? (
          records.map((record) => (
            <div key={record.id} className="py-3">
              <p className="font-medium tabular-nums">
                {money(record.salary_amount)} / {record.salary_type}
              </p>
              <p className="text-xs text-muted-foreground">
                Effective {formatDate(record.effective_from)}
                {record.effective_to
                  ? ` to ${formatDate(record.effective_to)}`
                  : ""}
                {record.reason ? ` · ${record.reason}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No compensation changes yet.
          </p>
        )}
      </div>
    </details>
  );
}

function TransactionRow({
  transaction,
}: {
  transaction: StaffSalaryTransaction;
}) {
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
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="pt-0.5 text-muted-foreground">
          {isOutflow ? (
            <ArrowDownRight className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-semibold">{money(transaction.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {label}
            {transaction.reason ? ` • ${transaction.reason}` : ""}
            {transaction.reference ? ` • Ref: ${transaction.reference}` : ""}
            {transaction.balance_after != null
              ? ` • Balance after: ${money(transaction.balance_after)}`
              : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <Badge variant="outline">{transaction.status}</Badge>
    </div>
  );
}
