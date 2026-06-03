"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CreditCard,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
  QrCode,
  AlertCircle,
} from "lucide-react";
import {
  buildPaymentPayload,
  computeRemaining,
  createPaymentRow,
  parseRowAmount,
  validatePaymentRows,
  type CheckoutPaymentMethod,
  type CheckoutPaymentRow,
} from "@/lib/checkout-multi-payment";
import { getApiErrorMessage } from "@/lib/api-response";
import { runLockedAction } from "@/lib/request-lock";
import { dispatchPosMutationSync } from "@/lib/sync-invalidation";
import { refetchOrderBeforeMutation } from "@/lib/pos-order-refresh";

const METHOD_OPTIONS: Array<{
  value: CheckoutPaymentMethod;
  label: string;
  icon: typeof Banknote;
  color: string;
}> = [
  { value: "cash", label: "Cash", icon: Banknote, color: "text-emerald-600" },
  { value: "card", label: "Card", icon: CreditCard, color: "text-blue-600" },
  { value: "fonepay", label: "Fonepay", icon: QrCode, color: "text-fuchsia-600" },
  { value: "digital", label: "Digital/QR", icon: Smartphone, color: "text-purple-600" },
  { value: "credit", label: "Credit", icon: Wallet, color: "text-orange-600" },
];

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCustomerLabel(c: { full_name?: string; name?: string; phone?: string }, currency: string) {
  const name = c?.full_name || c?.name || "Guest";
  const phone = c?.phone || "No phone";
  return `${name} (${phone})`;
}

export type MultiPaymentSubmitResult = {
  ok: boolean;
  paymentComplete?: boolean;
  succeededCount: number;
  failedIndex?: number;
  error?: string;
};

type MultiPaymentBuilderProps = {
  orderId: number;
  balanceDue: number;
  currency: string;
  orderCustomerId?: number | null;
  orderCustomerName?: string | null;
  customers: Array<{ id: number; full_name?: string; name?: string; phone?: string }>;
  staticPaymentQrs: Array<{ name: string; payload: string }>;
  staticPaymentCards: Array<{ name: string; identifier?: string | null }>;
  onRefresh: () => Promise<void>;
  onPaymentComplete?: () => void;
  onFonepayRow: (row: CheckoutPaymentRow) => void;
  persistCustomerId?: (customerId: number) => Promise<void>;
};

export function MultiPaymentBuilder({
  orderId,
  balanceDue,
  currency,
  orderCustomerId,
  orderCustomerName,
  customers,
  staticPaymentQrs,
  staticPaymentCards,
  onRefresh,
  onPaymentComplete,
  onFonepayRow,
  persistCustomerId,
}: MultiPaymentBuilderProps) {
  const [rows, setRows] = useState<CheckoutPaymentRow[]>(() => [
    createPaymentRow({ amount: balanceDue > 0 ? balanceDue.toFixed(2) : "" }),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [partialResult, setPartialResult] = useState<MultiPaymentSubmitResult | null>(null);

  useEffect(() => {
    setRows((prev) => {
      if (prev.length !== 1) return prev;
      const only = prev[0];
      if (parseRowAmount(only.amount) > 0) return prev;
      return [{ ...only, amount: balanceDue > 0 ? balanceDue.toFixed(2) : "" }];
    });
  }, [balanceDue]);

  const validation = useMemo(
    () =>
      validatePaymentRows({
        rows,
        balanceDue,
        orderCustomerId,
        staticPaymentQrs,
        staticPaymentCards,
      }),
    [rows, balanceDue, orderCustomerId, staticPaymentQrs, staticPaymentCards]
  );

  const remaining = validation.remaining;
  const totalEntered = validation.total;

  const updateRow = useCallback((id: string, patch: Partial<CheckoutPaymentRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setPartialResult(null);
    setGlobalError(null);
  }, []);

  const addRow = () => {
    const nextRemaining = computeRemaining(balanceDue, rows);
    setRows((prev) => [
      ...prev,
      createPaymentRow({
        amount: nextRemaining > 0 ? nextRemaining.toFixed(2) : "",
      }),
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const fillRemaining = (id: string) => {
    const otherTotal = rows
      .filter((r) => r.id !== id)
      .reduce((s, r) => s + parseRowAmount(r.amount), 0);
    const fill = Math.max(0, Number((balanceDue - otherTotal).toFixed(2)));
    updateRow(id, { amount: fill > 0 ? fill.toFixed(2) : "" });
  };

  const splitEvenly = () => {
    if (rows.length === 0) return;
    const per = balanceDue / rows.length;
    let allocated = 0;
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx === prev.length - 1) {
          const last = Math.max(0, Number((balanceDue - allocated).toFixed(2)));
          return { ...r, amount: last.toFixed(2) };
        }
        const slice = Math.max(0, Number(per.toFixed(2)));
        allocated += slice;
        return { ...r, amount: slice.toFixed(2) };
      })
    );
  };

  const submitSequential = async (startIndex = 0) => {
    const check = validatePaymentRows({
      rows,
      balanceDue,
      orderCustomerId,
      staticPaymentQrs,
      staticPaymentCards,
    });
    if (!check.valid) {
      setGlobalError(check.globalError || "Fix validation errors before submitting");
      return;
    }

    const fonepayRows = rows.filter((r) => r.method === "fonepay");
    if (fonepayRows.length === 1 && rows.length === 1) {
      onFonepayRow(fonepayRows[0]);
      return;
    }

    if (submitting) return;

    const lockResult = await runLockedAction(
      `checkout-multi-pay:${orderId}`,
      async ({ idempotencyKey }) => {
        setSubmitting(true);
        setGlobalError(null);
        let runningBalance = balanceDue;
        let paymentComplete = false;
        let succeeded = startIndex;

        try {
          await refetchOrderBeforeMutation(orderId);

          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (row.method === "fonepay") {
              throw new Error("Fonepay row must be submitted alone via QR flow");
            }

            if (row.method === "credit" && persistCustomerId) {
              const cid =
                orderCustomerId || (row.customerId ? parseInt(row.customerId, 10) : undefined);
              if (cid) await persistCustomerId(cid);
            }

            const payload = buildPaymentPayload(
              row,
              runningBalance,
              orderCustomerId ?? undefined,
              staticPaymentQrs,
              staticPaymentCards
            );

            const res = await apiClient.post(OrderApis.addPayment(orderId), payload, {
              idempotencyKey: i === startIndex ? idempotencyKey : undefined,
            });
            succeeded = i + 1;
            runningBalance = Math.max(
              0,
              Number((runningBalance - payload.payment.amount).toFixed(2))
            );
            if (res.data?.data?.payment_complete) {
              paymentComplete = true;
            }
          }

          dispatchPosMutationSync({ orderId, reason: "multi-payment" });
          await onRefresh();
          setPartialResult(null);
          if (paymentComplete) onPaymentComplete?.();
          return true;
        } catch (err: unknown) {
          const message = getApiErrorMessage(err, "Payment failed");
          setPartialResult({
            ok: false,
            succeededCount: succeeded,
            failedIndex: succeeded,
            error: message,
          });
          setGlobalError(
            succeeded > 0
              ? `Payment ${succeeded + 1} failed: ${message}. Earlier payments were saved.`
              : message
          );
          await onRefresh();
          return false;
        } finally {
          setSubmitting(false);
        }
      }
    );

    if (lockResult === undefined) {
      setGlobalError("Payment request already in progress.");
    }
  };

  const canSubmit = validation.valid && !submitting;

  return (
    <div className="space-y-4 min-w-0">
      {(globalError || partialResult?.error) && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{globalError || partialResult?.error}</span>
        </div>
      )}

      {partialResult && partialResult.succeededCount > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm">
          {partialResult.succeededCount} payment(s) saved. Retry from row{" "}
          {partialResult.succeededCount + 1} or adjust amounts after refresh.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Balance due
          </p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(balanceDue, currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Remaining
          </p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              remaining > 0.009 ? "text-destructive" : "text-emerald-600"
            )}
          >
            {formatCurrency(remaining, currency)}
          </p>
        </div>
        <div className="col-span-2 flex justify-between text-xs text-muted-foreground">
          <span>Allocated: {formatCurrency(totalEntered, currency)}</span>
          {totalEntered > balanceDue + 0.009 && (
            <span className="text-destructive font-semibold">Overpayment</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={submitting}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add row
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={splitEvenly} disabled={submitting || rows.length < 2}>
          Split evenly
        </Button>
      </div>

      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
        {rows.map((row, index) => {
          const rowErr = validation.rowErrors[row.id] || {};
          const MethodIcon = METHOD_OPTIONS.find((m) => m.value === row.method)?.icon || Banknote;

          return (
            <div
              key={row.id}
              className="rounded-xl border border-border/60 p-4 space-y-3 bg-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Payment {index + 1}
                </span>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeRow(row.id)}
                    disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {METHOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => updateRow(row.id, { method: m.value })}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium min-w-0",
                      row.method === m.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border/50 text-muted-foreground"
                    )}
                  >
                    <m.icon className={cn("h-3.5 w-3.5 shrink-0", m.color)} />
                    <span className="truncate">{m.label}</span>
                  </button>
                ))}
              </div>
              {rowErr.method && (
                <p className="text-xs text-destructive">{rowErr.method}</p>
              )}

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                      className={cn("pl-10 tabular-nums", rowErr.amount && "border-destructive")}
                      disabled={submitting}
                    />
                  </div>
                  {rowErr.amount && (
                    <p className="text-xs text-destructive">{rowErr.amount}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-end shrink-0 text-[11px]"
                  onClick={() => fillRemaining(row.id)}
                  disabled={submitting}
                >
                  Fill remaining
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reference (optional)</Label>
                <Input
                  value={row.reference}
                  onChange={(e) => updateRow(row.id, { reference: e.target.value })}
                  placeholder="Receipt / txn id"
                  disabled={submitting}
                />
              </div>

              {row.method === "credit" && !orderCustomerId && (
                <div className="space-y-1">
                  <Label className="text-xs">Customer (required)</Label>
                  <Select
                    value={row.customerId}
                    onValueChange={(v) => updateRow(row.id, { customerId: v })}
                  >
                    <SelectTrigger className={rowErr.customerId ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {formatCustomerLabel(c, currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {rowErr.customerId && (
                    <p className="text-xs text-destructive">{rowErr.customerId}</p>
                  )}
                </div>
              )}

              {row.method === "credit" && orderCustomerId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MethodIcon className="h-3.5 w-3.5" />
                  Credit to: <span className="font-semibold text-foreground">{orderCustomerName || "Order customer"}</span>
                </p>
              )}

              {row.method === "digital" && (
                <div className="space-y-2">
                  <Label className="text-xs">Static QR</Label>
                  {staticPaymentQrs.length === 0 ? (
                    <p className="text-xs text-destructive">{rowErr.instrument || "No QR configured"}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {staticPaymentQrs.map((qr, idx) => (
                        <button
                          key={`${row.id}-qr-${idx}`}
                          type="button"
                          onClick={() => updateRow(row.id, { selectedQrIndex: idx })}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-left text-xs",
                            row.selectedQrIndex === idx
                              ? "border-primary bg-primary/5"
                              : "border-border/50"
                          )}
                        >
                          {qr.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {row.method === "card" && (
                <div className="space-y-2">
                  <Label className="text-xs">Card account</Label>
                  {staticPaymentCards.length ===  0 ? (
                    <p className="text-xs text-destructive">{rowErr.instrument || "No card configured"}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {staticPaymentCards.map((card, idx) => (
                        <button
                          key={`${row.id}-card-${idx}`}
                          type="button"
                          onClick={() => updateRow(row.id, { selectedCardIndex: idx })}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-left text-xs",
                            row.selectedCardIndex === idx
                              ? "border-primary bg-primary/5"
                              : "border-border/50"
                          )}
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {row.method === "fonepay" && rows.length === 1 && (
                <p className="text-xs text-muted-foreground">
                  Submit opens Fonepay QR for this amount (one payment per QR session).
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full h-11 font-semibold gap-2"
        disabled={!canSubmit}
        onClick={() =>
          partialResult?.failedIndex != null
            ? submitSequential(partialResult.failedIndex)
            : submitSequential(0)
        }
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {submitting
          ? "Processing payments…"
          : partialResult?.failedIndex != null
            ? `Retry from payment ${partialResult.failedIndex + 1}`
            : `Submit ${rows.length} payment${rows.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
