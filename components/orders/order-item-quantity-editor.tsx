"use client";

import { useState } from "react";
import { Award, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import type { OrderItem } from "@/types/order";

export type OrderItemQuantityPatch = { qty: number; is_nc?: boolean };

export function OrderItemQuantityEditor({
  item,
  canMarkNc,
  isUpdating,
  onClose,
  onSave,
}: {
  item: OrderItem;
  canMarkNc: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onSave: (patch: OrderItemQuantityPatch) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = useState(Math.max(1, Number(item.qty || 1)));
  const [isNc, setIsNc] = useState(Boolean(item.is_nc));

  const handleSave = async () => {
    const nextQty = Math.max(1, Math.floor(quantity || 1));
    const currentQty = Number(item.qty || 1);
    const currentNc = Boolean(item.is_nc);
    if (nextQty === currentQty && isNc === currentNc) {
      onClose();
      return;
    }
    if (await onSave({ qty: nextQty, ...(isNc !== currentNc ? { is_nc: isNc } : {}) })) onClose();
  };

  return <section aria-label={`Edit ${item.name_snapshot}`} className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4" onClick={event => event.stopPropagation()}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="font-semibold">Edit {item.name_snapshot}</h4><p className="mt-0.5 text-xs text-muted-foreground">Adjust quantity or choose whether this item is chargeable.</p></div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10" disabled={isUpdating || quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Reduce quantity"><Minus className="h-4 w-4" /></Button>
        <Input type="number" min={1} value={quantity} onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-10 w-16 text-center font-bold tabular-nums" aria-label="Quantity" />
        <Button variant="outline" size="icon" className="h-10 w-10" disabled={isUpdating} onClick={() => setQuantity(value => value + 1)} aria-label="Increase quantity"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      {canMarkNc ? <button type="button" aria-pressed={isNc} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium", isNc ? "border-orange-500/50 bg-orange-50 text-orange-800 dark:bg-orange-950/20" : "border-border/60 hover:bg-muted/40")} disabled={isUpdating} onClick={() => setIsNc(value => !value)}><Award className="h-4 w-4" /><span>{isNc ? "Non-chargeable (NC)" : "Mark non-chargeable (NC)"}</span></button> : <span className="text-xs text-muted-foreground">Price: {formatCurrency(item.unit_price)} each</span>}
      <div className="ml-auto flex gap-2"><Button variant="outline" disabled={isUpdating} onClick={onClose}>Cancel</Button><Button disabled={isUpdating} onClick={() => void handleSave()}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button></div>
    </div>
  </section>;
}
