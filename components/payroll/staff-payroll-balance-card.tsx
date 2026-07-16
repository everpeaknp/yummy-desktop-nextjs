"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Loader2,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import {
  parseActiveCashDrawers,
  type ActiveCashDrawerSession,
} from "@/lib/cash-expense-drawer-selection";
import { PayrollPaymentDialog } from "@/components/payroll/payroll-payment-dialog";
import { PayrollPaymentHistory } from "@/components/payroll/payroll-payment-history";
import { SalaryCalculationBreakdown } from "@/components/payroll/salary-calculation-breakdown";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
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
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAuth } from "@/hooks/use-auth";
import {
  payrollPayablesApi,
  type PayrollPayment,
  type PayrollPeriodSuggestion,
  type PayrollStaffBalance,
} from "@/lib/payroll/payables";
import type { PayrollHistoryRecord } from "@/lib/staff/workforce";

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
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

export function StaffPayrollBalanceCard({
  staffId,
  canManage,
  payrollHistory = [],
}: {
  staffId: number;
  canManage: boolean;
  payrollHistory?: PayrollHistoryRecord[];
}) {
  const router = useRouter();
  const storedRestaurantId = useRestaurant((state) => state.restaurant?.id);
  const authRestaurantId = useAuth((state) => state.user?.restaurant_id);
  const restaurantId = storedRestaurantId ?? authRestaurantId;
  const [balance, setBalance] = useState<PayrollStaffBalance | null>(null);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<PayrollStaffBalance | null>(null);
  const [reversing, setReversing] = useState<PayrollPayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalDrawers, setReversalDrawers] = useState<ActiveCashDrawerSession[]>([]);
  const [reversalDrawerId, setReversalDrawerId] = useState("");
  const [reversalDrawerControlsEnabled, setReversalDrawerControlsEnabled] = useState(false);
  const [reversalDrawersLoading, setReversalDrawersLoading] = useState(false);
  const [reversalDrawerError, setReversalDrawerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBalance, nextPayments] = await Promise.all([
        payrollPayablesApi.staffBalance(staffId),
        payrollPayablesApi.payments(staffId),
      ]);
      setBalance(nextBalance);
      setPayments(nextPayments);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (
      !reversing ||
      reversing.payment_method.trim().toLowerCase() !== "cash" ||
      !restaurantId
    ) {
      setReversalDrawers([]);
      setReversalDrawerId("");
      setReversalDrawerControlsEnabled(false);
      setReversalDrawerError(null);
      return;
    }

    const loadDrawers = async () => {
      setReversalDrawersLoading(true);
      setReversalDrawerError(null);
      try {
        const response = await apiClient.get(
          DrawerSessionApis.active({
            restaurantId,
            businessLine: "restaurant",
          }),
        );
        if (cancelled) return;
        const parsed = parseActiveCashDrawers(response.data);
        setReversalDrawers(parsed.sessions);
        setReversalDrawerControlsEnabled(parsed.controlsEnabled);
        const original = parsed.sessions.find(
          (drawer) => drawer.id === reversing.drawer_session_id,
        );
        setReversalDrawerId(
          original?.id
            ? String(original.id)
            : parsed.sessions[0]?.id
              ? String(parsed.sessions[0].id)
              : "",
        );
      } catch {
        if (cancelled) return;
        // The backend can reuse the original active drawer or resolve a single
        // assigned drawer even when this role cannot list sessions.
        setReversalDrawers([]);
        setReversalDrawerControlsEnabled(false);
        setReversalDrawerError(
          "Cash drawers could not be listed. The server will try the original or your single assigned drawer.",
        );
      } finally {
        if (!cancelled) setReversalDrawersLoading(false);
      }
    };

    void loadDrawers();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, reversing]);

  const approvedOutstanding = useMemo(
    () =>
      balance?.outstanding_items.reduce(
        (sum, row) => sum + Number(row.outstanding_amount || 0),
        0,
      ) || 0,
    [balance],
  );

  const historyByItemId = useMemo(
    () =>
      new Map(
        payrollHistory.map((record) => [record.item.id, record] as const),
      ),
    [payrollHistory],
  );

  const prepare = (period?: PayrollPeriodSuggestion) => {
    const selectedPeriod =
      period ?? balance?.suggested_periods.find((row) => row.ready);
    if (!selectedPeriod) return;
    const params = new URLSearchParams({
      date_from: selectedPeriod.date_from,
      date_to: selectedPeriod.date_to,
      staff_id: String(staffId),
      automatic: "1",
    });
    router.push(`/payroll/create?${params.toString()}`);
  };

  const reversePayment = async () => {
    if (!reversing || reversalReason.trim().length < 3) {
      toast.error("Explain why this payment is being corrected");
      return;
    }
    setSaving(true);
    try {
      await payrollPayablesApi.reversePayment(
        reversing.id,
        reversalReason.trim(),
        reversalDrawerId ? Number(reversalDrawerId) : undefined,
      );
      toast.success("Payment reversed and the salary balance restored");
      setReversing(null);
      setReversalReason("");
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !balance) {
    return (
      <Card>
        <CardContent className="flex h-36 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </CardContent>
      </Card>
    );
  }
  if (!balance) return null;

  const nextReady = balance.suggested_periods.find((row) => row.ready);
  const blocked = balance.suggested_periods.filter((row) => !row.ready);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Salary overview</CardTitle>
            <CardDescription>
              What this employee earned, what has been paid, and what remains.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {canManage && approvedOutstanding > 0 ? (
              <Button onClick={() => setPaying(balance)}>
                <Banknote className="mr-2 h-4 w-4" />
                Pay {money(approvedOutstanding)}
              </Button>
            ) : null}
            {canManage && nextReady ? (
              <Button variant="outline" onClick={() => prepare()}>
                <CalendarClock className="mr-2 h-4 w-4" /> Prepare next salary
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={ReceiptText}
              label="Salary earned"
              value={money(balance.total_due)}
              helper="Approved and calculated"
            />
            <Metric
              icon={CheckCircle2}
              label="Paid"
              value={money(balance.total_paid)}
              helper={`Through ${displayDate(balance.paid_through)}`}
            />
            <Metric
              icon={WalletCards}
              label="Remaining"
              value={money(balance.total_outstanding)}
              helper={`${balance.overdue_period_count} overdue period${balance.overdue_period_count === 1 ? "" : "s"}`}
              prominent={balance.total_outstanding > 0}
            />
            <Metric
              icon={CalendarClock}
              label="Current accrual"
              value={money(balance.current_accrual)}
              helper="Not due yet"
            />
          </div>

          {blocked.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {blocked.length} salary period{blocked.length === 1 ? "" : "s"} need attention
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {blocked.slice(0, 3).flatMap((period) =>
                  period.blockers.slice(0, 1).map((row) => (
                    <p key={`${period.date_from}-${row.code}`}>
                      {displayDate(period.date_from)} - {displayDate(period.date_to)}: {row.message}
                    </p>
                  )),
                )}
              </div>
            </div>
          ) : null}

          {balance.suggested_periods.length ? (
            <CalculatedPeriods
              periods={balance.suggested_periods}
              canManage={canManage}
              onPrepare={prepare}
            />
          ) : null}

          <section>
            <div className="mb-3">
              <h3 className="font-semibold">Approved salary waiting for payment</h3>
              <p className="text-sm text-muted-foreground">
                Pay the full balance or enter a smaller amount. Oldest periods are
                settled first.
              </p>
            </div>
            <div className="space-y-2">
              {balance.outstanding_items.length ? (
                balance.outstanding_items.map((item) => (
                  <div
                    key={item.payroll_item_id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/payroll/${item.payroll_run_id}`}
                        className="font-semibold hover:underline"
                      >
                        {displayDate(item.date_from)} - {displayDate(item.date_to)}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Net {money(item.net_pay)} · already paid {money(item.paid_amount)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Badge variant={item.run_status === "partially_paid" ? "secondary" : "outline"}>
                        {item.run_status.replaceAll("_", " ")}
                      </Badge>
                      <p className="text-lg font-bold">{money(item.outstanding_amount)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  No approved salary is waiting for payment.
                </div>
              )}
            </div>
          </section>

          {payrollHistory.length ? (
            <section>
              <div className="mb-3">
                <h3 className="font-semibold">Detailed salary calculations</h3>
                <p className="text-sm text-muted-foreground">
                  Expand a period to see attendance, earnings, reductions, tax,
                  and calculation evidence.
                </p>
              </div>
              <div className="space-y-3">
                {payrollHistory.map(({ run, item }) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <Link href={`/payroll/${run.id}`} className="text-sm font-semibold hover:underline">
                        {displayDate(run.date_from)} - {displayDate(run.date_to)}
                      </Link>
                      <Badge variant={run.status === "paid" ? "default" : "secondary"}>
                        {run.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <SalaryCalculationBreakdown item={item} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <PayrollPaymentHistory
            payments={payments}
            canManage={canManage}
            historyByItemId={historyByItemId}
            onReverse={(payment) => {
              setReversing(payment);
              setReversalReason("");
            }}
          />
        </CardContent>
      </Card>

      <PayrollPaymentDialog
        staff={paying}
        restaurantId={restaurantId}
        onOpenChange={(open) => !open && setPaying(null)}
        onRecorded={load}
      />

      <Dialog
        open={Boolean(reversing)}
        onOpenChange={(open) => {
          if (!open && !saving) setReversing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct salary payment</DialogTitle>
            <DialogDescription>
              This reverses the posted payment and restores {reversing ? money(reversing.amount) : "the amount"} to the employee&apos;s balance. The original record remains visible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for correction</Label>
            <Input
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="For example: wrong amount or duplicate payment"
            />
          </div>
          {reversing?.payment_method.trim().toLowerCase() === "cash" ? (
            <div className="space-y-2">
              <Label>Cash reversal destination</Label>
              {reversalDrawersLoading ? (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading open drawers...
                </div>
              ) : reversalDrawerError ? (
                <Alert>{reversalDrawerError}</Alert>
              ) : reversalDrawerControlsEnabled && reversalDrawers.length ? (
                <Select value={reversalDrawerId} onValueChange={setReversalDrawerId}>
                  <SelectTrigger><SelectValue placeholder="Select an open drawer" /></SelectTrigger>
                  <SelectContent>
                    {reversalDrawers.map((drawer) => (
                      <SelectItem key={drawer.id} value={String(drawer.id)}>
                        {drawer.name || drawer.drawer_key || `Drawer #${drawer.id}`}{drawer.station ? ` - ${drawer.station}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : reversalDrawerControlsEnabled ? (
                <Alert>No open drawer is available to receive the reversed cash.</Alert>
              ) : (
                <Alert>Cash drawer controls are disabled; no drawer selection is required.</Alert>
              )}
              <p className="text-xs text-muted-foreground">
                The reversed cash is added back to this drawer and the original payment remains visible.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reversePayment}
              disabled={
                saving ||
                reversalDrawersLoading ||
                reversalReason.trim().length < 3 ||
                (reversing?.payment_method.trim().toLowerCase() === "cash" &&
                  reversalDrawerControlsEnabled &&
                  !reversalDrawerId)
              }
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Reverse payment
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
  helper,
  prominent = false,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  helper: string;
  prominent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${prominent ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/10"}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function CalculatedPeriods({
  periods,
  canManage,
  onPrepare,
}: {
  periods: PayrollPeriodSuggestion[];
  canManage: boolean;
  onPrepare: (period: PayrollPeriodSuggestion) => void;
}) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-semibold">Calculated unpaid periods</h3>
        <p className="text-sm text-muted-foreground">
          Completed periods are calculated automatically; only exceptions need your attention.
        </p>
      </div>
      <div className="space-y-2">
        {periods.map((period) => (
          <div
            key={`${period.date_from}-${period.date_to}`}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {displayDate(period.date_from)} - {displayDate(period.date_to)}
              </p>
              <p className="text-xs text-muted-foreground">
                Due {displayDate(period.due_date)} · {period.frequency}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="font-semibold">{money(period.net_pay)}</span>
              <Badge variant={period.ready ? "outline" : "secondary"}>
                {period.ready ? "Ready to review" : "Needs attention"}
              </Badge>
              {canManage && period.ready ? (
                <Button size="sm" variant="outline" onClick={() => onPrepare(period)}>
                  Prepare
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
