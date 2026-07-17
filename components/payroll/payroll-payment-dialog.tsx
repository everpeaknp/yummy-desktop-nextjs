"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AccountingApis, DrawerSessionApis } from "@/lib/api/endpoints";
import {
  buildCashExpenseDrawerPayload,
  parseActiveCashDrawers,
  type ActiveCashDrawerSession,
} from "@/lib/cash-expense-drawer-selection";
import { getPaymentBankLabel } from "@/lib/payment-banks";
import {
  payrollPayablesApi,
  type PayrollStaffBalance,
} from "@/lib/payroll/payables";
import {
  canUsePayrollSafe,
  payrollSafeFundingError,
  previewPayrollAllocations,
  requiresPayrollBank,
  requiresPayrollReference,
  type PayrollCashSource,
  type PayrollPaymentMethod,
} from "@/lib/payroll/payment-form";
import type {
  DrawerCashControlSummary,
  PaymentBank,
} from "@/types/accounting";
import { Alert } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { PayrollSafeSourceSummary } from "@/components/payroll/payroll-safe-source-summary";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";

type ApiResponse<T> = { data?: T; message?: string };

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function errorMessage(error: any) {
  const detail = error?.response?.data?.detail;
  return (
    (typeof detail === "string" ? detail : detail?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    "Unable to record salary payment"
  );
}

export function PayrollPaymentDialog({
  staff,
  restaurantId,
  onOpenChange,
  onRecorded,
}: {
  staff: PayrollStaffBalance | null;
  restaurantId?: number | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void | Promise<void>;
}) {
  const open = Boolean(staff);
  const user = useAuth((state) => state.user);
  const approvedOutstanding = useMemo(
    () =>
      staff?.outstanding_items.reduce(
        (total, item) => total + Number(item.outstanding_amount || 0),
        0,
      ) || 0,
    [staff],
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayrollPaymentMethod>("cash");
  const [cashSource, setCashSource] = useState<PayrollCashSource>("drawer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [bankId, setBankId] = useState("");
  const [drawerSessionId, setDrawerSessionId] = useState("");
  const [banks, setBanks] = useState<PaymentBank[]>([]);
  const [drawers, setDrawers] = useState<ActiveCashDrawerSession[]>([]);
  const [drawerControlsEnabled, setDrawerControlsEnabled] = useState(false);
  const [cashSummary, setCashSummary] =
    useState<DrawerCashControlSummary | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [bankLoadFailed, setBankLoadFailed] = useState(false);
  const [drawerLoadFailed, setDrawerLoadFailed] = useState(false);
  const [safeLoadFailed, setSafeLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !staff) return;
    setAmount(approvedOutstanding.toFixed(2));
    setMethod("cash");
    setCashSource("drawer");
    setReference("");
    setNotes("");
    setBankId("");
    setDrawerSessionId("");
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setPaidAt(local.toISOString().slice(0, 16));
  }, [approvedOutstanding, open, staff]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !restaurantId) {
      setBanks([]);
      setDrawers([]);
      setCashSummary(null);
      setSourcesLoaded(false);
      setBankLoadFailed(false);
      setDrawerLoadFailed(false);
      setSafeLoadFailed(false);
      return;
    }

    const loadSources = async () => {
      setSourcesLoading(true);
      setSourcesLoaded(false);
      setBankLoadFailed(false);
      setDrawerLoadFailed(false);
      setSafeLoadFailed(false);
      const [bankResult, drawerResult, cashSummaryResult] =
        await Promise.allSettled([
        apiClient.get<ApiResponse<PaymentBank[]>>(
          AccountingApis.paymentBanks(restaurantId),
        ),
        apiClient.get(
          DrawerSessionApis.active({
            restaurantId,
            businessLine: "restaurant",
          }),
        ),
        apiClient.get<ApiResponse<DrawerCashControlSummary>>(
          DrawerSessionApis.cashControlSummary({
            restaurantId,
            businessLine: "restaurant",
          }),
        ),
      ]);
      if (cancelled) return;

      if (bankResult.status === "fulfilled") {
        const activeBanks = (bankResult.value.data?.data || []).filter(
          (bank) => bank.is_active,
        );
        setBanks(activeBanks);
        setBankId((current) =>
          current && activeBanks.some((bank) => String(bank.id) === current)
            ? current
            : activeBanks[0]?.id
              ? String(activeBanks[0].id)
              : "",
        );
      } else {
        setBanks([]);
        setBankLoadFailed(true);
      }

      if (drawerResult.status === "fulfilled") {
        const parsed = parseActiveCashDrawers(drawerResult.value.data);
        setDrawerControlsEnabled(parsed.controlsEnabled);
        setDrawers(parsed.sessions);
        setDrawerSessionId((current) =>
          current &&
          parsed.sessions.some((drawer) => String(drawer.id) === current)
            ? current
            : parsed.sessions[0]?.id
              ? String(parsed.sessions[0].id)
              : "",
        );
      } else {
        // A payroll manager may be allowed to pay but not list drawers. The
        // backend can still resolve a single assigned drawer for that user.
        setDrawerControlsEnabled(false);
        setDrawers([]);
        setDrawerLoadFailed(true);
      }

      if (cashSummaryResult.status === "fulfilled") {
        setCashSummary(cashSummaryResult.value.data?.data || null);
      } else {
        setCashSummary(null);
        setSafeLoadFailed(true);
      }
      setSourcesLoading(false);
      setSourcesLoaded(true);
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  const numericAmount = Number(amount || 0);
  const allocations = useMemo(
    () =>
      previewPayrollAllocations(
        staff?.outstanding_items || [],
        numericAmount,
      ),
    [numericAmount, staff?.outstanding_items],
  );
  const remaining = Math.max(0, approvedOutstanding - numericAmount);
  const selectedBank = banks.find((bank) => String(bank.id) === bankId);
  const selectedDrawer = drawers.find(
    (drawer) => String(drawer.id) === drawerSessionId,
  );
  const hasSafePermission = hasPermission(
    user,
    "finance.cash.safe.disburse",
  );
  const canUseSafe = canUsePayrollSafe({
    summary: cashSummary,
    hasDisbursementPermission: hasSafePermission,
  });

  const recordPayment = async () => {
    if (!staff) return;
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > approvedOutstanding + 0.001
    ) {
      toast.error(
        `Enter an amount between Rs. 0.01 and ${money(approvedOutstanding)}`,
      );
      return;
    }
    if (!restaurantId) {
      toast.error("Restaurant payment sources are unavailable. Refresh and try again.");
      return;
    }
    if (!sourcesLoaded) {
      toast.error("Payment sources are still loading. Try again in a moment.");
      return;
    }
    if (requiresPayrollBank(method) && bankLoadFailed) {
      toast.error("Configured banks could not be loaded. Refresh before paying by bank.");
      return;
    }
    if (requiresPayrollBank(method) && !selectedBank) {
      toast.error("Select the restaurant bank account used for this payment.");
      return;
    }
    if (
      requiresPayrollBank(method) &&
      reference.trim().length < 2
    ) {
      toast.error("Enter the bank transfer reference.");
      return;
    }

    let drawerPayload: { drawer_session_id?: number } = {};
    if (method === "cash" && cashSource === "drawer") {
      try {
        drawerPayload = buildCashExpenseDrawerPayload({
          paymentMethod: method,
          controlsEnabled: drawerControlsEnabled,
          selectedDrawerSessionId: drawerSessionId,
        });
      } catch {
        toast.error("Select the cash drawer funding this salary payment.");
        return;
      }
    }
    if (method === "cash" && cashSource === "safe") {
      const safeError = payrollSafeFundingError({
        summary: cashSummary,
        hasDisbursementPermission: hasSafePermission,
        reference,
        amount: numericAmount,
      });
      if (safeLoadFailed || safeError) {
        toast.error(
          safeError || "The Main Cash / Safe balance could not be verified.",
        );
        return;
      }
    }

    setSaving(true);
    try {
      await payrollPayablesApi.recordPayment({
        staff_id: staff.staff_id,
        amount: numericAmount,
        payment_method: method,
        payment_bank_id: requiresPayrollBank(method)
          ? selectedBank?.id
          : undefined,
        cash_source: method === "cash" ? cashSource : undefined,
        payment_reference: reference.trim() || undefined,
        paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
        ...drawerPayload,
      });
      toast.success(
        numericAmount < approvedOutstanding
          ? `Partial payment recorded. ${money(remaining)} remains.`
          : "Outstanding salary paid in full",
      );
      onOpenChange(false);
      await onRecorded();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pay {staff?.staff_name || "employee"}</DialogTitle>
          <DialogDescription>
            Choose the amount and the actual account funding this payment. Partial
            payments settle the oldest salary first.
          </DialogDescription>
        </DialogHeader>

        {staff ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <PaymentMetric label="Approved balance" value={money(approvedOutstanding)} />
              <PaymentMetric
                label="Paying now"
                value={money(Number.isFinite(numericAmount) ? numericAmount : 0)}
              />
              <PaymentMetric label="Balance after" value={money(remaining)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="payroll-payment-amount">Payment amount</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAmount(approvedOutstanding.toFixed(2))}
                >
                  Pay full balance
                </Button>
              </div>
              <Input
                id="payroll-payment-amount"
                type="number"
                min="0.01"
                max={approvedOutstanding}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {numericAmount > 0 && numericAmount < approvedOutstanding ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  This is a partial payment. The remaining balance stays visible.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select
                  value={method}
                  onValueChange={(value) =>
                    setMethod(value as PayrollPaymentMethod)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid at</Label>
                <Input
                  type="datetime-local"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                />
              </div>
            </div>

            {sourcesLoading ? (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading payment sources...
              </div>
            ) : null}
            {method === "cash" && !sourcesLoading ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Cash source</Label>
                  <Select
                    value={cashSource}
                    onValueChange={(value) =>
                      setCashSource(value as PayrollCashSource)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drawer">Open cash drawer</SelectItem>
                      <SelectItem value="safe" disabled={!canUseSafe}>
                        Main Cash / Safe (1005)
                        {!canUseSafe ? " - unavailable" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canUseSafe ? (
                    <p className="text-xs text-muted-foreground">
                      Safe funding is available only with safe-disbursement
                      permission and a ready accounting ledger.
                    </p>
                  ) : null}
                </div>

                {cashSource === "safe" ? (
                  <PayrollSafeSourceSummary
                    summary={cashSummary}
                    loading={sourcesLoading}
                    loadFailed={safeLoadFailed}
                    amount={numericAmount}
                  />
                ) : drawerLoadFailed ? (
                <Alert>
                  Your role cannot list cash drawers. The server will use your
                  single assigned open drawer; if it cannot resolve one, it will
                  stop the payment with a clear error.
                </Alert>
              ) : drawerControlsEnabled ? (
                <div className="space-y-2">
                  <Label>Open cash drawer</Label>
                  {drawers.length ? (
                    <Select value={drawerSessionId} onValueChange={setDrawerSessionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an open cash drawer" />
                      </SelectTrigger>
                      <SelectContent>
                        {drawers.map((drawer) => (
                          <SelectItem key={drawer.id} value={String(drawer.id)}>
                            {drawer.name || drawer.drawer_key || `Drawer #${drawer.id}`}
                            {drawer.station ? ` - ${drawer.station}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Alert>
                      No open cash drawer is available. Open one from{" "}
                      <Link className="font-semibold underline" href="/cash-drawers">
                        Cash Drawers
                      </Link>{" "}
                      before paying cash salary.
                    </Alert>
                  )}
                  {selectedDrawer ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Banknote className="h-3.5 w-3.5" /> Cash will be recorded
                      against {selectedDrawer.name || selectedDrawer.drawer_key}.
                    </p>
                  ) : null}
                </div>
              ) : (
                <Alert>
                  Cash drawer controls are disabled. This will be recorded as a
                  general cash payment.
                </Alert>
                )}
              </div>
            ) : null}

            {requiresPayrollBank(method) && !sourcesLoading ? (
              <div className="space-y-2">
                <Label>Pay from bank</Label>
                {bankLoadFailed ? (
                  <Alert variant="destructive">
                    Configured banks could not be loaded. Refresh this dialog and
                    try again.
                  </Alert>
                ) : banks.length ? (
                  <Select value={bankId} onValueChange={setBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a configured bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={String(bank.id)}>
                          {getPaymentBankLabel(bank)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Alert>
                    No active bank is configured. Add one in{" "}
                    <Link className="font-semibold underline" href="/manage/settings">
                      Payment settings
                    </Link>{" "}
                    before recording a bank payment.
                  </Alert>
                )}
                {selectedBank ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Landmark className="h-3.5 w-3.5" /> Payment source:{" "}
                    {getPaymentBankLabel(selectedBank)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>
                Reference{" "}
                {requiresPayrollReference(method, cashSource)
                  ? "(required)"
                  : "(optional)"}
              </Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={
                  method === "bank_transfer"
                    ? "Transfer reference"
                    : cashSource === "safe"
                      ? "Safe withdrawal voucher or reference"
                    : "Receipt or voucher number"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add a useful payment note"
              />
            </div>

            <section className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Salary periods covered</h3>
              </div>
              <div className="mt-3 space-y-2">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.payrollItemId}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {displayDate(allocation.dateFrom)} - {displayDate(allocation.dateTo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance after: {money(allocation.balanceAfter)}
                      </p>
                    </div>
                    <p className="font-semibold">{money(allocation.amount)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> Oldest approved salary is
                settled first.
              </div>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={recordPayment}
            disabled={saving || !sourcesLoaded || sourcesLoading || approvedOutstanding <= 0}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : cashSource === "safe" && method === "cash" ? (
              <ShieldCheck className="mr-2 h-4 w-4" />
            ) : (
              <Building2 className="mr-2 h-4 w-4" />
            )}
            Record {numericAmount < approvedOutstanding ? "partial " : ""}payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
