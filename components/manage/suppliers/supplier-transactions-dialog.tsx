"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CashBankAccountSelect, type CashBankAccountOption } from "@/components/finance/cash-bank-account-select";
import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { SupplierApis } from "@/lib/api/endpoints";
import { cn, formatCurrency } from "@/lib/utils";

interface SupplierTransaction {
  id: number;
  source_type?: string | null;
  business_line?: string | null;
  description?: string | null;
  reference?: string | null;
  signed_amount: number | string;
  paid_amount: number | string;
  remaining_amount: number | string;
  payment_status: string;
  status: string;
  transaction_direction: "payable" | "credit";
  paid_on: string;
}

export function SupplierTransactionsDialog({
  supplier,
  open,
  onOpenChange,
  onSettled,
}: {
  supplier: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettled?: () => void | Promise<void>;
}) {
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [currentPayable, setCurrentPayable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentTransaction, setPaymentTransaction] =
    useState<SupplierTransaction | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<CashBankAccountOption | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!open || !supplier?.id || !restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        SupplierApis.transactions(supplier.id, restaurantId),
      );
      const data = response.data?.data;
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
      setCurrentPayable(Number(data?.current_payable || 0));
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not load supplier transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [open, restaurantId, supplier?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPayment = (transaction: SupplierTransaction) => {
    setPaymentTransaction(transaction);
    setAmount(Number(transaction.remaining_amount || 0).toFixed(2));
    setReference("");
    setPaymentAccount(null);
  };

  const settle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!restaurantId || !supplier?.id || !paymentTransaction) return;
    const paymentAmount = Number(amount);
    const remaining = Number(paymentTransaction.remaining_amount || 0);
    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0 ||
      paymentAmount > remaining
    ) {
      toast.error("Enter an amount within the remaining balance.");
      return;
    }
    if (!paymentAccount) {
      toast.error("Select the account paying this supplier.");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(
        SupplierApis.settleTransaction(
          supplier.id,
          paymentTransaction.id,
          restaurantId,
        ),
        {
          paid_amount: paymentAmount,
          payment_method:
            paymentAccount.account_type === "drawer" || paymentAccount.bank_type === "custom"
              ? "cash"
              : "bank_transfer",
          reference: reference.trim() || null,
          account_type: paymentAccount.account_type,
          account_id: paymentAccount.id,
        },
      );
      toast.success("Supplier payment recorded.");
      setPaymentTransaction(null);
      await load();
      await onSettled?.();
    } catch (requestError: any) {
      toast.error(
        requestError.response?.data?.detail ||
          requestError.response?.data?.message ||
          "Could not record supplier payment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{supplier?.name || "Supplier"} ledger</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">Current payable</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCurrency(currentPayable)}
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No supplier transactions yet.
              </div>
            ) : (
              <div className="divide-y">
                {transactions.map((transaction) => {
                  const credit = transaction.transaction_direction === "credit";
                  const status =
                    transaction.status === "reversed"
                      ? "reversed"
                      : transaction.payment_status;
                  return (
                    <div key={transaction.id} className="flex gap-3 py-4">
                      {credit ? (
                        <ArrowDownLeft className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {transaction.description ||
                                label(transaction.source_type || "expense")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {label(transaction.source_type || "expense")} ·{" "}
                              {new Date(transaction.paid_on).toLocaleDateString()}
                              {transaction.reference
                                ? ` · ${transaction.reference}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-semibold tabular-nums",
                                credit ? "text-emerald-600" : "text-rose-600",
                              )}
                            >
                              {credit ? "−" : ""}
                              {formatCurrency(
                                Math.abs(Number(transaction.signed_amount || 0)),
                              )}
                            </p>
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {label(status)}
                            </Badge>
                          </div>
                        </div>
                        {Number(transaction.remaining_amount || 0) > 0 ? (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              Paid {formatCurrency(transaction.paid_amount)} · Remaining{" "}
                              {formatCurrency(transaction.remaining_amount)}
                            </p>
                            {canSettle(transaction) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void openPayment(transaction)}
                              >
                                Pay
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentTransaction !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !submitting) setPaymentTransaction(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay {supplier?.name || "supplier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={settle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-amount">Amount</Label>
              <Input
                id="supplier-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={Number(paymentTransaction?.remaining_amount || 0)}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <CashBankAccountSelect
                label="Pay from account"
                businessLine={paymentTransaction?.business_line || "restaurant"}
                value={paymentAccount}
                onChange={setPaymentAccount}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-reference">
                Reference (optional)
              </Label>
              <Input
                id="supplier-payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={160}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setPaymentTransaction(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !paymentAccount}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function canSettle(transaction: SupplierTransaction) {
  return (
    Number(transaction.remaining_amount || 0) > 0 &&
    transaction.status !== "reversed" &&
    transaction.transaction_direction !== "credit" &&
    ["general_purchase", "inventory_adjustment", "manual_entry"].includes(
      transaction.source_type || "",
    )
  );
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
