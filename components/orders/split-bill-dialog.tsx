"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { OrderItem } from "@/types/order";
import type { SplitBillPartInput } from "@/types/guest-bill";
import { parseSplitBillResult } from "@/types/guest-bill";
import { extractApiDetail } from "@/lib/table-ops";
import { runLockedAction } from "@/lib/request-lock";
import { dispatchPosMutationSync } from "@/lib/sync-invalidation";
import { refetchOrderBeforeMutation } from "@/lib/pos-order-refresh";

type PartDraft = {
  id: string;
  label: string;
  lines: Record<number, number>;
};

export type SplitBillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  items: OrderItem[];
  onCompleted?: () => void;
};

function newPart(index: number): PartDraft {
  return {
    id: `part-${Date.now()}-${index}`,
    label: `Guest ${index}`,
    lines: {},
  };
}

export function SplitBillDialog({
  open,
  onOpenChange,
  orderId,
  items,
  onCompleted,
}: SplitBillDialogProps) {
  const [parts, setParts] = useState<PartDraft[]>([newPart(1), newPart(2)]);
  const [keepUnassigned, setKeepUnassigned] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParts([newPart(1), newPart(2)]);
    setKeepUnassigned(true);
  }, [open]);

  const assignedByItem = useMemo(() => {
    const map = new Map<number, number>();
    for (const part of parts) {
      for (const [itemId, qty] of Object.entries(part.lines)) {
        const id = Number(itemId);
        const q = Number(qty) || 0;
        if (q <= 0) continue;
        map.set(id, (map.get(id) ?? 0) + q);
      }
    }
    return map;
  }, [parts]);

  const addPart = () => setParts((prev) => [...prev, newPart(prev.length + 1)]);

  const removePart = (id: string) => {
    setParts((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const setLineQty = (partId: string, orderItemId: number, qty: number) => {
    setParts((prev) =>
      prev.map((p) => {
        if (p.id !== partId) return p;
        const next = { ...p.lines };
        if (qty <= 0) delete next[orderItemId];
        else next[orderItemId] = qty;
        return { ...p, lines: next };
      })
    );
  };

  const buildPayload = (): SplitBillPartInput[] => {
    return parts
      .map((part) => ({
        label: part.label.trim() || "Guest",
        lines: Object.entries(part.lines)
          .map(([orderItemId, qty]) => ({
            order_item_id: Number(orderItemId),
            qty: Number(qty),
          }))
          .filter((line) => line.qty > 0),
      }))
      .filter((part) => part.lines.length > 0);
  };

  const submit = async () => {
    const payloadParts = buildPayload();
    if (payloadParts.length === 0) {
      toast.error("Assign at least one item quantity to a guest bill.");
      return;
    }

    for (const item of items) {
      const assigned = assignedByItem.get(item.id) ?? 0;
      if (assigned > item.qty) {
        toast.error(`"${item.name_snapshot}" exceeds available quantity (${item.qty}).`);
        return;
      }
    }

    if (submitting) return;

    const done = await runLockedAction(`split-bill:${orderId}`, async ({ idempotencyKey }) => {
      setSubmitting(true);
      try {
        await refetchOrderBeforeMutation(orderId);

        const res = await apiClient.post(
          OrderApis.splitBill(orderId),
          {
            source_order_id: orderId,
            parts: payloadParts,
            keep_unassigned_in_parent: keepUnassigned,
          },
          { idempotencyKey }
        );
        if (res.data?.status !== "success") {
          toast.error(res.data?.message || "Failed to split bill");
          return false;
        }
        const result = parseSplitBillResult(res.data?.data);
        const count = result?.children?.length ?? payloadParts.length;
        toast.success(`Bill split into ${count} guest bill${count === 1 ? "" : "s"}.`);
        dispatchPosMutationSync({ orderId, reason: "split-bill" });
        onCompleted?.();
        onOpenChange(false);
        return true;
      } catch (err: unknown) {
        toast.error(extractApiDetail(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    });

    if (done === undefined) {
      toast.message("Split bill request already in progress.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Split Bill
          </DialogTitle>
          <DialogDescription>
            Assign item quantities to separate guest bills. The server creates child orders; each
            can be paid independently.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Checkbox
            id="keep-unassigned"
            checked={keepUnassigned}
            onCheckedChange={(v) => setKeepUnassigned(v === true)}
          />
          <Label htmlFor="keep-unassigned" className="text-sm font-normal cursor-pointer">
            Keep unassigned items on the parent bill
          </Label>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
          {parts.map((part, index) => (
            <div key={part.id} className="rounded-xl border p-4 space-y-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <Input
                  value={part.label}
                  onChange={(e) =>
                    setParts((prev) =>
                      prev.map((p) => (p.id === part.id ? { ...p, label: e.target.value } : p))
                    )
                  }
                  className="max-w-[200px] font-semibold"
                  placeholder="Guest label"
                />
                {parts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-destructive"
                    onClick={() => removePart(part.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const assignedElsewhere =
                    (assignedByItem.get(item.id) ?? 0) - (part.lines[item.id] ?? 0);
                  const remaining = Math.max(0, item.qty - assignedElsewhere);
                  const value = part.lines[item.id] ?? 0;
                  return (
                    <div
                      key={`${part.id}-${item.id}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.name_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          Available: {remaining} / {item.qty}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={value || ""}
                        onChange={(e) => {
                          const n = Math.min(remaining, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setLineQty(part.id, item.id, n);
                        }}
                        className="w-20 h-9"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={addPart}>
          <Plus className="h-4 w-4" />
          Add guest bill
        </Button>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Split bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
