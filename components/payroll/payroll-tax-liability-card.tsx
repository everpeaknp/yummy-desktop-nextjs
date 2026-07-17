"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Loader2,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
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
  type PayrollTaxLiability,
  type PayrollTaxRemittance,
} from "@/lib/payroll/payables";
import {
  canUsePayrollSafe,
  payrollPaymentMethodLabel,
  payrollSafeFundingError,
  previewPayrollTaxAllocations,
  requiresPayrollBank,
  requiresPayrollReference,
  type PayrollCashSource,
  type PayrollPaymentMethod,
} from "@/lib/payroll/payment-form";
import { hasPermission } from "@/lib/role-permissions";
import type {
  DrawerCashControlSummary,
  PaymentBank,
} from "@/types/accounting";
import { useAuth } from "@/hooks/use-auth";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type ApiResponse<T> = { data?: T; message?: string };

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

function displayDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function apiError(error: any) {
  const detail = error?.response?.data?.detail;
  return (
    (typeof detail === "string" ? detail : detail?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    "Payroll tax request failed"
  );
}

function remittanceSource(remittance: PayrollTaxRemittance) {
  if (remittance.payment_bank_name?.trim()) {
    return remittance.payment_bank_name;
  }
  if (remittance.payment_instrument_name?.trim()) {
    return remittance.payment_instrument_name;
  }
  if (remittance.cash_source?.trim().toLowerCase() === "safe") {
    return remittance.cash_source_name || "Main Cash / Safe (1005)";
  }
  return (
    remittance.drawer_session_name ||
    remittance.drawer_name ||
    (remittance.drawer_session_id
      ? `Cash drawer session #${remittance.drawer_session_id}`
      : payrollPaymentMethodLabel(remittance.payment_method))
  );
}

export function PayrollTaxLiabilityCard({
  restaurantId,
  canManage,
  onChanged,
}: {
  restaurantId?: number | null;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const user = useAuth((state) => state.user);
  const [liability, setLiability] = useState<PayrollTaxLiability | null>(null);
  const [remittances, setRemittances] = useState<PayrollTaxRemittance[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [remitOpen, setRemitOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] =
    useState<PayrollPaymentMethod>("bank_transfer");
  const [cashSource, setCashSource] =
    useState<PayrollCashSource>("drawer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [remittedAt, setRemittedAt] = useState("");
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
  const [reversing, setReversing] =
    useState<PayrollTaxRemittance | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalDrawers, setReversalDrawers] = useState<
    ActiveCashDrawerSession[]
  >([]);
  const [reversalDrawerId, setReversalDrawerId] = useState("");
  const [reversalDrawerControlsEnabled, setReversalDrawerControlsEnabled] =
    useState(false);
  const [reversalDrawersLoading, setReversalDrawersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextLiability, nextRemittances] = await Promise.all([
        payrollPayablesApi.taxLiability(),
        payrollPayablesApi.taxRemittances(),
      ]);
      setLiability(nextLiability);
      setRemittances(nextRemittances);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!remitOpen || !liability) return;
    setAmount(Number(liability.outstanding_tax || 0).toFixed(2));
    setMethod("bank_transfer");
    setCashSource("drawer");
    setReference("");
    setNotes("");
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setRemittedAt(local.toISOString().slice(0, 16));
  }, [liability, remitOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!remitOpen || !restaurantId) {
      setSourcesLoaded(false);
      return;
    }
    const loadSources = async () => {
      setSourcesLoading(true);
      setSourcesLoaded(false);
      setBankLoadFailed(false);
      setDrawerLoadFailed(false);
      setSafeLoadFailed(false);
      const [bankResult, drawerResult, summaryResult] =
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
        const active = (bankResult.value.data?.data || []).filter(
          (bank) => bank.is_active,
        );
        setBanks(active);
        setBankId(active[0]?.id ? String(active[0].id) : "");
      } else {
        setBanks([]);
        setBankLoadFailed(true);
      }

      if (drawerResult.status === "fulfilled") {
        const parsed = parseActiveCashDrawers(drawerResult.value.data);
        setDrawers(parsed.sessions);
        setDrawerControlsEnabled(parsed.controlsEnabled);
        setDrawerSessionId(
          parsed.sessions[0]?.id ? String(parsed.sessions[0].id) : "",
        );
      } else {
        setDrawers([]);
        setDrawerControlsEnabled(false);
        setDrawerLoadFailed(true);
      }

      if (summaryResult.status === "fulfilled") {
        setCashSummary(summaryResult.value.data?.data || null);
      } else {
        setCashSummary(null);
        setSafeLoadFailed(true);
      }
      setSourcesLoaded(true);
      setSourcesLoading(false);
    };
    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [remitOpen, restaurantId]);

  useEffect(() => {
    let cancelled = false;
    const drawerFunded =
      reversing?.payment_method.trim().toLowerCase() === "cash" &&
      reversing.cash_source?.trim().toLowerCase() !== "safe";
    if (!drawerFunded || !restaurantId) {
      setReversalDrawers([]);
      setReversalDrawerId("");
      setReversalDrawerControlsEnabled(false);
      return;
    }
    const loadReversalDrawers = async () => {
      setReversalDrawersLoading(true);
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
          (drawer) => drawer.id === reversing?.drawer_session_id,
        );
        setReversalDrawerId(
          original?.id
            ? String(original.id)
            : parsed.sessions[0]?.id
              ? String(parsed.sessions[0].id)
              : "",
        );
      } catch {
        if (!cancelled) {
          setReversalDrawers([]);
          setReversalDrawerControlsEnabled(false);
        }
      } finally {
        if (!cancelled) setReversalDrawersLoading(false);
      }
    };
    void loadReversalDrawers();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, reversing]);

  const numericAmount = Number(amount || 0);
  const allocations = useMemo(
    () =>
      previewPayrollTaxAllocations(liability?.runs || [], numericAmount),
    [liability?.runs, numericAmount],
  );
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

  const recordRemittance = async () => {
    if (!liability || !restaurantId) return;
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > Number(liability.outstanding_tax || 0) + 0.001
    ) {
      toast.error(
        `Enter an amount between Rs. 0.01 and ${money(liability.outstanding_tax)}`,
      );
      return;
    }
    if (!sourcesLoaded) {
      toast.error("Payment sources are still loading.");
      return;
    }
    if (requiresPayrollBank(method) && (bankLoadFailed || !selectedBank)) {
      toast.error("Select the restaurant bank funding this remittance.");
      return;
    }
    if (requiresPayrollBank(method) && reference.trim().length < 2) {
      toast.error("Enter the tax payment reference.");
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
        toast.error("Select the cash drawer funding this tax remittance.");
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
      await payrollPayablesApi.recordTaxRemittance({
        amount: numericAmount,
        payment_method: method,
        payment_bank_id: requiresPayrollBank(method)
          ? selectedBank?.id
          : undefined,
        payment_reference: reference.trim() || undefined,
        cash_source: method === "cash" ? cashSource : undefined,
        remitted_at: remittedAt
          ? new Date(remittedAt).toISOString()
          : undefined,
        notes: notes.trim() || undefined,
        allocations: allocations.map((allocation) => ({
          payroll_run_id: allocation.payrollRunId,
          amount: allocation.amount,
        })),
        ...drawerPayload,
      });
      toast.success(
        numericAmount < Number(liability.outstanding_tax || 0)
          ? `Partial tax remittance recorded. ${money(
              liability.outstanding_tax - numericAmount,
            )} remains.`
          : "Payroll tax liability remitted in full",
      );
      setRemitOpen(false);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const reverseRemittance = async () => {
    if (!reversing || reversalReason.trim().length < 3) {
      toast.error("Explain why this tax remittance is being corrected.");
      return;
    }
    const drawerFunded =
      reversing.payment_method.trim().toLowerCase() === "cash" &&
      reversing.cash_source?.trim().toLowerCase() !== "safe";
    setSaving(true);
    try {
      await payrollPayablesApi.reverseTaxRemittance(
        reversing.id,
        reversalReason.trim(),
        drawerFunded && reversalDrawerId
          ? Number(reversalDrawerId)
          : undefined,
      );
      toast.success("Tax remittance reversed and liability restored");
      setReversing(null);
      setReversalReason("");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !liability) {
    return (
      <Card>
        <CardContent className="flex h-36 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </CardContent>
      </Card>
    );
  }
  if (!liability) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Payroll tax liability</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Tax withheld from approved salary remains payable until a
              remittance is recorded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {detailsOpen ? (
                <ChevronUp className="mr-2 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4" />
              )}
              {detailsOpen ? "Hide details" : "View periods and history"}
            </Button>
            {canManage ? (
              <Button
                onClick={() => setRemitOpen(true)}
                disabled={Number(liability.outstanding_tax || 0) <= 0}
              >
                <Landmark className="mr-2 h-4 w-4" />
                Remit tax
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TaxMetric
              label="Tax accrued"
              value={money(liability.accrued_tax)}
              helper={`${liability.run_count} payroll period${
                liability.run_count === 1 ? "" : "s"
              }`}
            />
            <TaxMetric
              label="Tax remitted"
              value={money(liability.remitted_tax)}
              helper={`${liability.remittance_count} remittance${
                liability.remittance_count === 1 ? "" : "s"
              }`}
            />
            <TaxMetric
              label="Outstanding liability"
              value={money(liability.outstanding_tax)}
              helper={`As of ${displayDate(liability.as_of)}`}
              attention={liability.outstanding_tax > 0}
            />
            <TaxMetric
              label="Liability account"
              value="2140"
              helper="Payroll Tax Payable"
            />
          </div>

          {detailsOpen ? (
          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Periods still owing</h3>
                  <p className="text-sm text-muted-foreground">
                    Remittances settle the oldest payroll tax first.
                  </p>
                </div>
                <Badge variant="outline">
                  {
                    liability.runs.filter(
                      (run) => Number(run.outstanding_tax || 0) > 0,
                    ).length
                  }
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {liability.runs
                  .filter((run) => Number(run.outstanding_tax || 0) > 0)
                  .map((run) => (
                    <div
                      key={run.payroll_run_id}
                      className="flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/payroll/${run.payroll_run_id}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {displayDate(run.date_from)} -{" "}
                          {displayDate(run.date_to)}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Accrued {money(run.accrued_tax)} · remitted{" "}
                          {money(run.remitted_tax)}
                        </p>
                      </div>
                      <p className="font-bold">{money(run.outstanding_tax)}</p>
                    </div>
                  ))}
                {!liability.runs.some(
                  (run) => Number(run.outstanding_tax || 0) > 0,
                ) ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No payroll tax is waiting for remittance.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Tax remittance history</h3>
                  <p className="text-sm text-muted-foreground">
                    Funding source, allocations, and corrections stay auditable.
                  </p>
                </div>
                <Badge variant="outline">{remittances.length}</Badge>
              </div>
              <div className="mt-3 space-y-3">
                {remittances.map((remittance) => (
                  <article
                    key={remittance.id}
                    className={`rounded-lg border p-3 ${
                      remittance.status === "reversed"
                        ? "border-destructive/30 bg-destructive/5"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {money(remittance.amount)}
                          </p>
                          <Badge
                            variant={
                              remittance.status === "posted"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {remittance.status}
                          </Badge>
                          <Badge variant="outline">
                            {payrollPaymentMethodLabel(
                              remittance.payment_method,
                            )}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {displayDateTime(remittance.remitted_at)}
                          {remittance.created_by_name
                            ? ` · by ${remittance.created_by_name}`
                            : ""}
                        </p>
                      </div>
                      {canManage && remittance.status === "posted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReversing(remittance);
                            setReversalReason("");
                          }}
                        >
                          <RotateCcw className="mr-2 h-3.5 w-3.5" />
                          Correct
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <HistoryFact
                        label="Source"
                        value={remittanceSource(remittance)}
                      />
                      <HistoryFact
                        label="Reference"
                        value={remittance.payment_reference || "No reference"}
                      />
                      <HistoryFact
                        label="Source balance after"
                        value={
                          remittance.source_balance_after == null
                            ? "Not recorded"
                            : money(remittance.source_balance_after)
                        }
                      />
                    </div>
                    {remittance.allocations.length ? (
                      <div className="mt-3 rounded-lg bg-muted/30 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Payroll tax periods covered
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {remittance.allocations.map((allocation) => (
                            <div
                              key={allocation.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <Link
                                href={`/payroll/${allocation.payroll_run_id}`}
                                className="font-medium hover:underline"
                              >
                                {displayDate(allocation.date_from)} -{" "}
                                {displayDate(allocation.date_to)}
                              </Link>
                              <span className="font-semibold">
                                {money(allocation.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {remittance.status === "reversed" ? (
                      <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-muted-foreground">
                        {remittance.reversal_reason || "Remittance reversed"}
                        {remittance.reversed_by_name
                          ? ` · by ${remittance.reversed_by_name}`
                          : ""}
                        {remittance.reversed_at
                          ? ` · ${displayDateTime(remittance.reversed_at)}`
                          : ""}
                      </p>
                    ) : null}
                  </article>
                ))}
                {!remittances.length ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No payroll tax remittances recorded yet.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={remitOpen}
        onOpenChange={(open) => !saving && setRemitOpen(open)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Remit payroll tax</DialogTitle>
            <DialogDescription>
              Record a full or partial payment of tax already withheld from
              approved salary. Oldest payroll periods are settled first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <TaxMetric
                label="Outstanding"
                value={money(liability.outstanding_tax)}
                helper="Before this remittance"
              />
              <TaxMetric
                label="Paying now"
                value={money(Number.isFinite(numericAmount) ? numericAmount : 0)}
                helper="Tax authority payment"
              />
              <TaxMetric
                label="Balance after"
                value={money(
                  Math.max(0, liability.outstanding_tax - numericAmount),
                )}
                helper="Remaining liability"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Remittance amount</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setAmount(
                      Number(liability.outstanding_tax || 0).toFixed(2),
                    )
                  }
                >
                  Pay full liability
                </Button>
              </div>
              <Input
                type="number"
                min="0.01"
                max={liability.outstanding_tax}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remitted at</Label>
                <Input
                  type="datetime-local"
                  value={remittedAt}
                  onChange={(event) => setRemittedAt(event.target.value)}
                />
              </div>
            </div>

            {sourcesLoading ? (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payment sources...
              </div>
            ) : null}

            {requiresPayrollBank(method) && !sourcesLoading ? (
              <div className="space-y-2">
                <Label>Pay from bank</Label>
                {bankLoadFailed ? (
                  <Alert variant="destructive">
                    Configured banks could not be loaded. Refresh and try again.
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
                    <Link
                      href="/manage/settings"
                      className="font-semibold underline"
                    >
                      Payment settings
                    </Link>
                    .
                  </Alert>
                )}
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
                      Safe funding requires safe-disbursement permission and a
                      ready accounting ledger.
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
                    Your role cannot list drawers. The server will try to
                    resolve your single assigned drawer.
                  </Alert>
                ) : drawerControlsEnabled && drawers.length ? (
                  <div className="space-y-2">
                    <Label>Open cash drawer</Label>
                    <Select
                      value={drawerSessionId}
                      onValueChange={setDrawerSessionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an open drawer" />
                      </SelectTrigger>
                      <SelectContent>
                        {drawers.map((drawer) => (
                          <SelectItem key={drawer.id} value={String(drawer.id)}>
                            {drawer.name ||
                              drawer.drawer_key ||
                              `Drawer #${drawer.id}`}
                            {drawer.station ? ` - ${drawer.station}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDrawer ? (
                      <p className="text-xs text-muted-foreground">
                        Cash will be deducted from{" "}
                        {selectedDrawer.name || selectedDrawer.drawer_key}.
                      </p>
                    ) : null}
                  </div>
                ) : drawerControlsEnabled ? (
                  <Alert>
                    No open drawer is available. Open one from{" "}
                    <Link
                      href="/cash-drawers"
                      className="font-semibold underline"
                    >
                      Cash Drawers
                    </Link>
                    .
                  </Alert>
                ) : (
                  <Alert>
                    Drawer controls are disabled. No drawer selection is
                    required.
                  </Alert>
                )}
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
                    ? "Tax payment transaction reference"
                    : cashSource === "safe"
                      ? "Safe withdrawal voucher or reference"
                      : "Tax receipt or voucher number"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Tax authority, filing period, or other useful note"
              />
            </div>

            <section className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Payroll tax periods covered
                </h3>
              </div>
              <div className="mt-3 space-y-2">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.payrollRunId}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {displayDate(allocation.dateFrom)} -{" "}
                        {displayDate(allocation.dateTo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Period balance after: {money(allocation.balanceAfter)}
                      </p>
                    </div>
                    <p className="font-semibold">{money(allocation.amount)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Oldest outstanding payroll tax is settled first.
              </p>
            </section>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemitOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={recordRemittance}
              disabled={
                saving ||
                sourcesLoading ||
                !sourcesLoaded ||
                liability.outstanding_tax <= 0
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : method === "cash" && cashSource === "safe" ? (
                <ShieldCheck className="mr-2 h-4 w-4" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Record remittance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reversing)}
        onOpenChange={(open) => !open && !saving && setReversing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct tax remittance</DialogTitle>
            <DialogDescription>
              The posted remittance remains in history as reversed and its
              allocations return to payroll tax liability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for correction</Label>
            <Input
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="For example: duplicate or wrong amount"
            />
          </div>

          {reversing?.payment_method.trim().toLowerCase() === "cash" &&
          reversing.cash_source?.trim().toLowerCase() === "safe" ? (
            <Alert>
              Reversal restores the cash to Main Cash / Safe (1005). No drawer
              selection is required.
            </Alert>
          ) : reversing?.payment_method.trim().toLowerCase() === "cash" ? (
            <div className="space-y-2">
              <Label>Cash reversal destination</Label>
              {reversalDrawersLoading ? (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading open drawers...
                </div>
              ) : reversalDrawerControlsEnabled &&
                reversalDrawers.length ? (
                <Select
                  value={reversalDrawerId}
                  onValueChange={setReversalDrawerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an open drawer" />
                  </SelectTrigger>
                  <SelectContent>
                    {reversalDrawers.map((drawer) => (
                      <SelectItem key={drawer.id} value={String(drawer.id)}>
                        {drawer.name ||
                          drawer.drawer_key ||
                          `Drawer #${drawer.id}`}
                        {drawer.station ? ` - ${drawer.station}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : reversalDrawerControlsEnabled ? (
                <Alert>
                  No open drawer is available to receive the reversed cash.
                </Alert>
              ) : (
                <Alert>
                  The server will use the original or assigned drawer when
                  drawer controls require one.
                </Alert>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReversing(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reverseRemittance}
              disabled={
                saving ||
                reversalDrawersLoading ||
                reversalReason.trim().length < 3 ||
                (reversing?.payment_method.trim().toLowerCase() === "cash" &&
                  reversing.cash_source?.trim().toLowerCase() !== "safe" &&
                  reversalDrawerControlsEnabled &&
                  !reversalDrawerId)
              }
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reverse remittance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaxMetric({
  label,
  value,
  helper,
  attention = false,
}: {
  label: string;
  value: string;
  helper: string;
  attention?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        attention ? "border-amber-500/30 bg-amber-500/10" : "bg-muted/20"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function HistoryFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}
