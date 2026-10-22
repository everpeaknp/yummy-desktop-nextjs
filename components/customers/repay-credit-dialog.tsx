"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { CashAndBanksApis, CustomerApis } from "@/lib/api/endpoints";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CashBankAccount {
  account_type: "drawer" | "bank";
  id: number;
  name: string;
  current_balance: number | string;
  drawer_session_id?: number | null;
}

interface RepayCreditDialogProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RepayCreditDialog({ customer, open, onOpenChange, onSuccess }: RepayCreditDialogProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const restaurantId = useAuth((state) => state.user?.restaurant_id);
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [accountKey, setAccountKey] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadAccounts = async () => {
      if (!open || !restaurantId) return;
      setAccountsLoading(true);
      try {
        const response = await apiClient.get(
          CashAndBanksApis.list(Number(restaurantId), "restaurant"),
        );
        if (cancelled) return;
        const rows = Array.isArray(response.data?.data)
          ? (response.data.data as CashBankAccount[])
          : [];
        const available = rows.filter(
          (account) => account.account_type === "bank" || account.drawer_session_id,
        );
        setAccounts(available);
        setAccountKey(available[0] ? `${available[0].account_type}:${available[0].id}` : "");
      } catch (error: any) {
        if (!cancelled) {
          setAccounts([]);
          setAccountKey("");
          toast.error(error.response?.data?.detail || "Could not load Cash & Banks accounts");
        }
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    };
    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const repayAmount = parseFloat(amount);
    if (isNaN(repayAmount) || repayAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (repayAmount > customer.credit) {
        toast.error(`Amount cannot exceed the current credit balance of Rs. ${customer.credit}`);
        return;
    }
    const account = accounts.find(
      (row) => `${row.account_type}:${row.id}` === accountKey,
    );
    if (!account) {
      toast.error("Select the account receiving this repayment");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(CustomerApis.repayCredit(customer.id), {
        amount: repayAmount,
        paid_date: new Date().toISOString(),
        payment_method: account.account_type === "drawer" ? "cash" : "bank_transfer",
        account_type: account.account_type,
        account_id: account.id,
      });
      toast.success("Credit repayment recorded successfully");
      onSuccess();
      onOpenChange(false);
      setAmount("");
    } catch (err: any) {
      console.error("Failed to repay credit:", err);
      toast.error(err.response?.data?.detail || "Failed to record credit repayment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Repay Credit</DialogTitle>
          <DialogDescription>
            Record a partial or full payment for {customer?.full_name || customer?.name}&apos;s credit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-credit">Current Credit Balance</Label>
            <div className="text-2xl font-bold text-red-600">
              Rs. {(customer?.credit || 0).toLocaleString()}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Receive into</Label>
            <Select
              value={accountKey}
              onValueChange={setAccountKey}
              disabled={accountsLoading || accounts.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={accountsLoading ? "Loading accounts..." : "Select account"} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem
                    key={`${account.account_type}:${account.id}`}
                    value={`${account.account_type}:${account.id}`}
                  >
                    {account.name} · Rs. {Number(account.current_balance || 0).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!accountsLoading && accounts.length === 0 ? (
              <p className="text-xs text-destructive">Add or open a Cash & Banks account first.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Repayment Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || accountsLoading || accounts.length === 0}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
