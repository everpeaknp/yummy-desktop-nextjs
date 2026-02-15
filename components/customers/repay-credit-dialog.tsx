"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { CustomerApis } from "@/lib/api/endpoints";
import { toast } from "sonner";

interface RepayCreditDialogProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RepayCreditDialog({ customer, open, onOpenChange, onSuccess }: RepayCreditDialogProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      await apiClient.post(CustomerApis.repayCredit(customer.id), {
        amount: repayAmount,
        paid_date: new Date().toISOString()
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
            Record a partial or full payment for {customer?.full_name || customer?.name}'s credit.
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
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
