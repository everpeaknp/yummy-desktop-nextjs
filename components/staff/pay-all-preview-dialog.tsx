"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { staffSalaryApi, type StaffPayAllPreviewItem } from "@/lib/staff/salary";
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
import { ScrollArea } from "@/components/ui/scroll-area";

function money(value: number) {
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const payAllMethods = ["cash", "card", "upi", "bank_transfer", "other"];

/**
 * Shown before "Pay all outstanding salaries" actually pays anyone -- lists
 * exactly who would be paid and how much, so the amount isn't a surprise.
 * Clicking a name opens that staff member's own Financials tab instead,
 * where they can be paid, deducted from, or given a bonus individually with
 * a full accrual breakdown.
 */
export function PayAllPreviewDialog({
  open,
  onOpenChange,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StaffPayAllPreviewItem[]>([]);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMethod("cash");
    setReference("");
    setReason("");
    staffSalaryApi
      .previewPayAll()
      .then(setItems)
      .catch((error) => {
        toast.error(error?.response?.data?.detail || "Failed to load the pay-all preview");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, onOpenChange]);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const confirmPayAll = async () => {
    setPaying(true);
    try {
      const result = await staffSalaryApi.payAll({
        payment_method: method || undefined,
        reference: reference.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      toast.success(`Paid ${result.paid_count} staff member(s).`);
      onOpenChange(false);
      await onPaid();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to pay outstanding salaries");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay all outstanding salaries?</DialogTitle>
          <DialogDescription>
            Review each staff member&apos;s current balance before paying everyone in full. Click
            a name to pay, deduct, or add a bonus for just that person instead.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            No staff currently have an outstanding balance.
          </div>
        ) : (
          <>
            <ScrollArea className="h-72 rounded-lg border">
              <div className="divide-y">
                {items.map((item) => (
                  <Link
                    key={item.staff_id}
                    href={item.user_id ? `/staff/${item.user_id}` : "#"}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <span className="font-medium">
                      {item.user_name || `Staff #${item.staff_id}`}
                    </span>
                    <span className="font-semibold">{money(item.amount)}</span>
                  </Link>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{items.length} staff member(s)</span>
              <span className="font-semibold">Total: {money(total)}</span>
            </div>
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label>Payment method (applied to all)</Label>
                <select
                  className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs capitalize"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  {payAllMethods.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. August payroll run"
                />
              </div>
              <div>
                <Label>Reference (optional)</Label>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="e.g. bank batch number"
                />
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>
            Cancel
          </Button>
          <Button onClick={confirmPayAll} disabled={paying || loading || items.length === 0}>
            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pay all · {money(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
