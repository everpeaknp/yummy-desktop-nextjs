"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CashBankAccountSelect,
  type CashBankAccountOption,
} from "@/components/finance/cash-bank-account-select";
import {
  PurchaseLineItemsEditor,
  newPurchaseLineDraft,
  type PurchaseLineDraft,
} from "@/components/purchases/purchase-line-items-editor";
import apiClient from "@/lib/api-client";
import { PurchaseApis, SupplierApis } from "@/lib/api/endpoints";

function todayForDateInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function RecordPurchaseDialog({
  open,
  onOpenChange,
  restaurantId,
  initialItem,
  initialSupplierId,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  initialItem?: {
    id: number;
    name: string;
    unit: string;
    current_stock: number | string;
  } | null;
  initialSupplierId?: number | string | null;
  onRecorded?: () => void | Promise<void>;
}) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    supplier_id: "",
    purchase_date: "",
    reference_number: "",
    notes: "",
  });
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    newPurchaseLineDraft(),
  ]);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [paidAmount, setPaidAmount] = useState("");
  const [account, setAccount] = useState<CashBankAccountOption | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      supplier_id: initialSupplierId ? String(initialSupplierId) : "",
      purchase_date: todayForDateInput(),
      reference_number: "",
      notes: "",
    });
    setLines([
      {
        ...newPurchaseLineDraft(),
        inventoryItemId: initialItem?.id ?? null,
        purchaseUnit: initialItem?.unit ?? "",
      },
    ]);
    setPaymentStatus("pending");
    setPaidAmount("");
    setAccount(null);
    let cancelled = false;
    apiClient
      .get(SupplierApis.listSuppliers(restaurantId, true))
      .then((response) => {
        if (!cancelled && response.data.status === "success") {
          setSuppliers(response.data.data?.suppliers || []);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load suppliers.");
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    restaurantId,
    initialItem?.id,
    initialItem?.unit,
    initialSupplierId,
  ]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.supplier_id)
      return toast.error("Select a supplier before saving.");
    const validLines = lines.filter((line) =>
      line.mode === "existing"
        ? line.inventoryItemId != null
        : line.newItem.name.trim() && line.newItem.unit.trim(),
    );
    if (!validLines.length)
      return toast.error("Add at least one purchase line.");
    if (
      validLines.some(
        (line) =>
          !Number.isFinite(Number(line.orderedQuantity)) ||
          Number(line.orderedQuantity) <= 0 ||
          line.unitCost === "" ||
          !Number.isFinite(Number(line.unitCost)) ||
          Number(line.unitCost) < 0,
      )
    ) {
      return toast.error(
        "Every line needs a quantity and a unit cost or total amount.",
      );
    }
    if (["paid", "partial"].includes(paymentStatus) && !account) {
      return toast.error("Select the cash or bank account used to pay.");
    }
    if (paymentStatus === "partial" && Number(paidAmount) <= 0) {
      return toast.error("Enter the amount paid now.");
    }
    setSubmitting(true);
    try {
      await apiClient.post(PurchaseApis.create, {
        restaurant_id: restaurantId,
        supplier_id: Number(form.supplier_id),
        purchase_date: form.purchase_date,
        reference_number: form.reference_number.trim() || undefined,
        notes: form.notes.trim() || undefined,
        payment_status: paymentStatus,
        paid_amount:
          paymentStatus === "partial" ? Number(paidAmount) : undefined,
        account_type: ["paid", "partial"].includes(paymentStatus)
          ? account?.account_type
          : undefined,
        account_id: ["paid", "partial"].includes(paymentStatus)
          ? account?.id
          : undefined,
        idempotency_key: crypto.randomUUID(),
        lines: validLines.map((line) => ({
          inventory_item_id:
            line.mode === "existing" ? line.inventoryItemId : undefined,
          station_id: line.mode === "existing" ? line.stationId : undefined,
          new_item:
            line.mode === "new"
              ? {
                  name: line.newItem.name.trim(),
                  unit: line.newItem.unit.trim(),
                  min_stock_level: Number(line.newItem.min_stock_level || 0),
                  station: line.newItem.station || "general",
                  station_id: line.newItem.stationId,
                  storage_location:
                    line.newItem.storage_location.trim() || undefined,
                }
              : undefined,
          ordered_quantity: Number(line.orderedQuantity),
          purchase_unit: line.purchaseUnit.trim() || undefined,
          unit_conversion_factor: Number(line.unitConversionFactor || 1),
          unit_cost: Number(line.unitCost),
          tax_rate: line.taxRate ? Number(line.taxRate) : undefined,
        })),
      });
      toast.success("Purchase recorded and stock updated.");
      onOpenChange(false);
      await onRecorded?.();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to save purchase.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[92vh] sm:w-full">
        <form
          onSubmit={save}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
            <DialogTitle>Record Purchase</DialogTitle>
            <DialogDescription>
              Add the supplier bill and items once. Saving immediately updates
              stock, supplier balance, and accounting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase-supplier">Supplier *</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(supplier_id) =>
                    setForm({ ...form, supplier_id })
                  }
                >
                  <SelectTrigger id="purchase-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Purchase date</Label>
                <Input
                  id="purchase-date"
                  name="purchase_date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(event) =>
                    setForm({ ...form, purchase_date: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase-reference">Reference number</Label>
                <Input
                  id="purchase-reference"
                  name="reference_number"
                  placeholder="Supplier invoice/bill #"
                  value={form.reference_number}
                  onChange={(event) =>
                    setForm({ ...form, reference_number: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-payment">Payment</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(value) => {
                    setPaymentStatus(value);
                    if (value !== "paid" && value !== "partial")
                      setAccount(null);
                    if (value !== "partial") setPaidAmount("");
                  }}
                >
                  <SelectTrigger id="purchase-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid now</SelectItem>
                    <SelectItem value="partial">Pay part now</SelectItem>
                    <SelectItem value="pending">
                      Pay later / supplier due
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {["paid", "partial"].includes(paymentStatus) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <CashBankAccountSelect
                  label="Paid from account"
                  value={account}
                  onChange={setAccount}
                />
                {paymentStatus === "partial" && (
                  <div className="space-y-2">
                    <Label htmlFor="purchase-paid-amount">Amount paid now</Label>
                    <Input
                      id="purchase-paid-amount"
                      name="paid_amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      The remaining amount stays as a supplier bill.
                    </p>
                  </div>
                )}
              </div>
            )}
            <PurchaseLineItemsEditor
              restaurantId={restaurantId}
              lines={lines}
              onChange={setLines}
              disabled={submitting}
              initialItem={initialItem}
            />
            <div className="space-y-2">
              <Label htmlFor="purchase-notes">Notes</Label>
              <Textarea
                id="purchase-notes"
                name="notes"
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-6">
            <Button
              className="h-11 flex-1 sm:flex-none"
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="h-11 flex-[1.3] sm:flex-none"
              type="submit"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
