"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Minus, Plus, Utensils } from "lucide-react";

import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type {
  InventoryConsumptionPurpose,
  InventoryConsumptionRequest,
  InventoryConsumptionResult,
} from "@/types/inventory";

type InventoryOption = {
  id: number;
  name: string;
  unit: string;
  current_stock: number | string;
};

type DraftLine = {
  key: string;
  inventoryItemId: string;
  quantity: string;
};

const PURPOSES: Array<{ value: InventoryConsumptionPurpose; label: string }> = [
  { value: "preparation", label: "Preparation" },
  { value: "staff_meal", label: "Staff meal" },
  { value: "complimentary", label: "Complimentary" },
  { value: "testing", label: "Testing" },
  { value: "other", label: "Other" },
];

function newLine(): DraftLine {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    inventoryItemId: "",
    quantity: "",
  };
}

export function InventoryConsumptionDialog({
  open,
  onOpenChange,
  restaurantId,
  items,
  canOverrideNegative,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  items: InventoryOption[];
  canOverrideNegative: boolean;
  onCompleted: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [purpose, setPurpose] = useState<InventoryConsumptionPurpose>("preparation");
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [preview, setPreview] = useState<InventoryConsumptionResult | null>(null);
  const [loading, setLoading] = useState<"preview" | "submit" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newLine().key);

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.inventoryItemId).filter(Boolean)),
    [lines],
  );

  const reset = () => {
    setLines([newLine()]);
    setPurpose("preparation");
    setNote("");
    setAllowNegative(false);
    setPreview(null);
    setIdempotencyKey(newLine().key);
  };

  const payload = (): InventoryConsumptionRequest | null => {
    const parsed = lines.map((line) => ({
      inventory_item_id: Number(line.inventoryItemId),
      quantity: Number(line.quantity),
    }));
    if (
      parsed.length === 0 ||
      parsed.some((line) => !line.inventory_item_id || !Number.isFinite(line.quantity) || line.quantity <= 0)
    ) {
      toast({
        title: "Complete every line",
        description: "Select an item and enter a quantity greater than zero.",
        variant: "destructive",
      });
      return null;
    }
    if (new Set(parsed.map((line) => line.inventory_item_id)).size !== parsed.length) {
      toast({
        title: "Duplicate item",
        description: "Add each inventory item only once.",
        variant: "destructive",
      });
      return null;
    }
    if (allowNegative && !note.trim()) {
      toast({
        title: "Reason required",
        description: "Explain why negative stock is being allowed.",
        variant: "destructive",
      });
      return null;
    }
    return {
      restaurant_id: restaurantId,
      idempotency_key: idempotencyKey,
      purpose,
      note: note.trim() || undefined,
      allow_negative: canOverrideNegative && allowNegative,
      lines: parsed,
    };
  };

  const runPreview = async () => {
    const request = payload();
    if (!request) return;
    setLoading("preview");
    try {
      const response = await apiClient.post(InventoryApis.previewConsumption, request);
      setPreview(response.data.data as InventoryConsumptionResult);
    } catch (error: any) {
      toast({
        title: "Cannot consume stock",
        description: error.response?.data?.detail || "Consumption preview failed.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const submit = async () => {
    const request = payload();
    if (!request) return;
    setLoading("submit");
    try {
      await apiClient.post(InventoryApis.consume, request);
      toast({ title: "Stock consumed", description: "Inventory balances were updated." });
      await onCompleted();
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Consumption failed",
        description: error.response?.data?.detail || "Stock could not be consumed.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" /> Consume stock
          </DialogTitle>
          <DialogDescription>
            Record ingredients or supplies used outside automatic recipe consumption.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Items</Label>
            {lines.map((line, index) => {
              const selected = items.find((item) => String(item.id) === line.inventoryItemId);
              return (
                <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2">
                  <Select
                    value={line.inventoryItemId}
                    onValueChange={(value) => {
                      setLines((current) =>
                        current.map((entry) =>
                          entry.key === line.key ? { ...entry, inventoryItemId: value } : entry,
                        ),
                      );
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger aria-label={`Consumption item ${index + 1}`}>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={String(item.id)}
                          disabled={selectedIds.has(String(item.id)) && line.inventoryItemId !== String(item.id)}
                        >
                          {item.name} · {Number(item.current_stock).toLocaleString()} {item.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Input
                      aria-label={`Consumption quantity ${index + 1}`}
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) => {
                        const quantity = event.target.value;
                        setLines((current) =>
                          current.map((entry) =>
                            entry.key === line.key ? { ...entry, quantity } : entry,
                          ),
                        );
                        setPreview(null);
                      }}
                      placeholder="0"
                      className="pr-10"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                      {selected?.unit || ""}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove consumption line"
                    disabled={lines.length === 1}
                    onClick={() => {
                      setLines((current) => current.filter((entry) => entry.key !== line.key));
                      setPreview(null);
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((current) => [...current, newLine()])}
              disabled={lines.length >= items.length}
            >
              <Plus className="mr-2 h-4 w-4" /> Add item
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={(value) => setPurpose(value as InventoryConsumptionPurpose)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canOverrideNegative ? (
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div>
                  <Label htmlFor="allow-negative">Allow negative stock</Label>
                  <p className="text-xs text-muted-foreground">Requires a written reason.</p>
                </div>
                <Switch id="allow-negative" checked={allowNegative} onCheckedChange={setAllowNegative} />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumption-note">Note</Label>
            <Textarea
              id="consumption-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={allowNegative ? "Reason for negative stock" : "Optional context"}
              rows={3}
            />
          </div>

          {preview ? (
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Item</span><span>After</span><span>COGS</span>
              </div>
              {preview.lines.map((line) => (
                <div key={line.inventory_item_id} className="grid grid-cols-[minmax(0,1fr)_110px_110px] border-t px-3 py-2 text-sm">
                  <span className="truncate">{line.item_name}</span>
                  <span className={line.is_negative ? "font-medium text-amber-600" : ""}>
                    {Number(line.resulting_stock).toLocaleString()} {line.unit}
                  </span>
                  <span>Rs. {Number(line.cogs_amount).toLocaleString()}</span>
                </div>
              ))}
              {preview.has_negative_stock ? (
                <div className="flex items-center gap-2 border-t bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> This batch creates negative stock.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={runPreview} disabled={Boolean(loading)}>
            {loading === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Preview
          </Button>
          <Button type="button" onClick={submit} disabled={!preview || Boolean(loading)}>
            {loading === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record consumption
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
