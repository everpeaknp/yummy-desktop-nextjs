"use client";

import { useEffect, useState } from "react";
import { Award, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, formatCurrency } from "@/lib/utils";
import type { OrderItem } from "@/types/order";
import type { OrderItemQuantityPatch } from "./order-item-quantity-editor";

export function OrderItemQuantitySheet({
  item,
  canMarkNc,
  isUpdating,
  onClose,
  onSave,
}: {
  item: OrderItem | null;
  canMarkNc: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onSave: (patch: OrderItemQuantityPatch) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isNc, setIsNc] = useState(false);

  useEffect(() => {
    setQuantity(Math.max(1, Number(item?.qty || 1)));
    setIsNc(Boolean(item?.is_nc));
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    const nextQty = Math.max(1, Math.floor(quantity || 1));
    const currentQty = Number(item.qty || 1);
    const currentNc = Boolean(item.is_nc);
    if (nextQty === currentQty && isNc === currentNc) {
      onClose();
      return;
    }
    const saved = await onSave({
      qty: nextQty,
      ...(isNc !== currentNc ? { is_nc: isNc } : {}),
    });
    if (saved) onClose();
  };

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-3xl rounded-t-2xl px-6 pb-6 pt-8"
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{item?.name_snapshot}</SheetTitle>
          <SheetDescription>
            {item?.category_name_snapshot || "Menu item"} · {item ? formatCurrency(item.unit_price) : ""} each
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-6">
          <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
            <div>
              <p className="font-semibold">Quantity</p>
              <p className="text-sm text-muted-foreground">
                Changes are sent to the kitchen only when you confirm.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                disabled={isUpdating || quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                aria-label="Reduce quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
                className="h-10 w-20 text-center font-bold tabular-nums"
                aria-label="Quantity"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                disabled={isUpdating}
                onClick={() => setQuantity((value) => value + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {canMarkNc && (
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors",
                isNc
                  ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/20"
                  : "border-border/60 hover:bg-muted/40",
              )}
              disabled={isUpdating}
              onClick={() => setIsNc((value) => !value)}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    isNc
                      ? "bg-orange-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Award className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">Non-chargeable (NC)</p>
                  <p className="text-sm text-muted-foreground">
                    Exclude this item from the bill.
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  isNc
                    ? "bg-orange-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isNc ? "NC" : "Chargeable"}
              </span>
            </button>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!item || isUpdating}>
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update &amp; Send
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
