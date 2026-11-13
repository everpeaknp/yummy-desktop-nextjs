"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search } from "lucide-react";
import {
  InventoryItemSelect,
  type InventoryItemOption,
} from "@/components/inventory/inventory-item-select";
import { StationPicker } from "@/components/stations/station-picker";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";
import { formatCurrency } from "@/lib/utils";

export interface PurchaseLineDraft {
  key: string;
  mode: "existing" | "new";
  inventoryItemId: number | null;
  // Optional override for an existing-item line; when null the backend
  // defaults to the item's own station_id.
  stationId: number | null;
  newItem: {
    name: string;
    unit: string;
    min_stock_level: string;
    station: string;
    stationId: number | null;
    storage_location: string;
  };
  orderedQuantity: string;
  purchaseUnit: string;
  unitConversionFactor: string;
  unitCost: string;
  totalAmount: string;
  taxRate: string;
}

export function newPurchaseLineDraft(): PurchaseLineDraft {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    mode: "existing",
    inventoryItemId: null,
    stationId: null,
    newItem: {
      name: "",
      unit: "",
      min_stock_level: "0",
      station: "general",
      stationId: null,
      storage_location: "",
    },
    orderedQuantity: "",
    purchaseUnit: "",
    unitConversionFactor: "1",
    unitCost: "",
    totalAmount: "",
    taxRate: "",
  };
}

function lineTotal(line: PurchaseLineDraft): number {
  const qty = Number(line.orderedQuantity) || 0;
  const cost = Number(line.unitCost) || 0;
  const taxRate = Number(line.taxRate) || 0;
  const subtotal = qty * Number(cost.toFixed(2));
  return subtotal + Number(((subtotal * taxRate) / 100).toFixed(2));
}

function DuplicateItemWarning({
  restaurantId,
  name,
  onUseExisting,
}: {
  restaurantId: number;
  name: string;
  onUseExisting: (item: InventoryItemOption) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<InventoryItemOption[]>([]);
  const [checked, setChecked] = useState(false);

  const runCheck = async () => {
    if (!name.trim() || name.trim().length < 2) return;
    setChecking(true);
    try {
      const response = await apiClient.get(
        InventoryApis.searchDuplicateItems({ restaurantId, q: name.trim() }),
      );
      if (response.data.status === "success") {
        setMatches(response.data.data || []);
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.detail || "Could not check for similar items.",
      );
    } finally {
      setChecking(false);
      setChecked(true);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={runCheck}
        disabled={checking}
        className="h-7 text-xs gap-1 px-2"
      >
        <Search className="h-3 w-3" />
        {checking ? "Checking..." : "Check for similar items"}
      </Button>
      {checked && matches.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs space-y-1">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Similar items already exist -- pick one instead of creating a
            duplicate?
          </p>
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUseExisting(item)}
              className="block w-full text-left rounded px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            >
              {item.name} · {item.unit}
            </button>
          ))}
        </div>
      ) : null}
      {checked && matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">No similar items found.</p>
      ) : null}
    </div>
  );
}

export function PurchaseLineItemsEditor({
  restaurantId,
  lines,
  onChange,
  disabled = false,
  initialItem,
}: {
  restaurantId: number;
  lines: PurchaseLineDraft[];
  onChange: (lines: PurchaseLineDraft[]) => void;
  disabled?: boolean;
  initialItem?: InventoryItemOption | null;
}) {
  const usedItemIds = lines
    .filter((l) => l.mode === "existing" && l.inventoryItemId != null)
    .map((l) => l.inventoryItemId as number);

  const updateLine = (index: number, patch: Partial<PurchaseLineDraft>) => {
    const updated = [...lines];
    const next = { ...updated[index], ...patch };
    if (patch.unitCost !== undefined) next.totalAmount = "";
    if (patch.totalAmount !== undefined ||
      (next.totalAmount !== "" && (patch.orderedQuantity !== undefined || patch.taxRate !== undefined))) {
      const quantity = Number(next.orderedQuantity);
      const taxFactor = 1 + Number(next.taxRate || 0) / 100;
      next.unitCost = next.totalAmount !== "" && quantity > 0 && taxFactor > 0
        ? String(Number((Number(next.totalAmount) / (quantity * taxFactor)).toFixed(2)))
        : "";
    }
    updated[index] = next;
    onChange(updated);
  };

  const updateNewItem = (
    index: number,
    patch: Partial<PurchaseLineDraft["newItem"]>,
  ) => {
    updateLine(index, { newItem: { ...lines[index].newItem, ...patch } });
  };

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Purchase Lines</Label>
        <span className="text-xs text-muted-foreground">
          Total: {formatCurrency(total)}
        </span>
      </div>

      {lines.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
          No lines yet. Add at least one item you are buying.
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="rounded-md border bg-background p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={line.mode === "existing" ? "default" : "outline"}
                    className="h-7 text-xs"
                    disabled={disabled}
                    onClick={() => updateLine(index, { mode: "existing" })}
                  >
                    Existing item
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={line.mode === "new" ? "default" : "outline"}
                    className="h-7 text-xs"
                    disabled={disabled}
                    onClick={() =>
                      updateLine(index, { mode: "new", inventoryItemId: null })
                    }
                  >
                    Create new item
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || lines.length === 1}
                  onClick={() =>
                    onChange(lines.filter((l) => l.key !== line.key))
                  }
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {line.mode === "existing" ? (
                <InventoryItemSelect
                  restaurantId={restaurantId}
                  value={line.inventoryItemId}
                  onChange={(itemId, item) =>
                    updateLine(index, {
                      inventoryItemId: itemId,
                      purchaseUnit: line.purchaseUnit || item?.unit || "",
                    })
                  }
                  excludeIds={usedItemIds}
                  disabled={disabled}
                  label="Item"
                  selectedItem={line.inventoryItemId === initialItem?.id ? initialItem : null}
                />
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Item name *</Label>
                      <Input
                        value={line.newItem.name}
                        onChange={(e) =>
                          updateNewItem(index, { name: e.target.value })
                        }
                        disabled={disabled}
                        placeholder="e.g. Chicken breast"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit *</Label>
                      <Input
                        value={line.newItem.unit}
                        onChange={(e) =>
                          updateNewItem(index, { unit: e.target.value })
                        }
                        disabled={disabled}
                        placeholder="e.g. kg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Min stock level</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.newItem.min_stock_level}
                        onChange={(e) =>
                          updateNewItem(index, {
                            min_stock_level: e.target.value,
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Storage location</Label>
                      <Input
                        value={line.newItem.storage_location}
                        onChange={(e) =>
                          updateNewItem(index, {
                            storage_location: e.target.value,
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <StationPicker
                    label="Station"
                    restaurantId={restaurantId}
                    value={line.newItem.stationId}
                    onChange={(stationId) =>
                      updateNewItem(index, { stationId })
                    }
                    disabled={disabled}
                  />
                  <DuplicateItemWarning
                    restaurantId={restaurantId}
                    name={line.newItem.name}
                    onUseExisting={(item) =>
                      updateLine(index, {
                        mode: "existing",
                        inventoryItemId: item.id,
                        purchaseUnit: line.purchaseUnit || item.unit,
                      })
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                <div className="flex flex-col justify-end space-y-1">
                  <Label htmlFor={`purchase-quantity-${line.key}`} className="text-xs">Quantity *</Label>
                  <Input
                    id={`purchase-quantity-${line.key}`}
                    name={`quantity_${index}`}
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={line.orderedQuantity}
                    onChange={(e) =>
                      updateLine(index, { orderedQuantity: e.target.value })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="flex flex-col justify-end space-y-1">
                  <Label htmlFor={`purchase-unit-${line.key}`} className="text-xs">Purchase unit</Label>
                  <Input
                    id={`purchase-unit-${line.key}`}
                    name={`purchase_unit_${index}`}
                    value={line.purchaseUnit}
                    onChange={(e) =>
                      updateLine(index, { purchaseUnit: e.target.value })
                    }
                    disabled={disabled}
                    placeholder="e.g. box"
                  />
                </div>
                <div className="flex flex-col justify-end space-y-1">
                  <Label htmlFor={`purchase-unit-cost-${line.key}`} className="text-xs">Unit cost *</Label>
                  <Input
                    id={`purchase-unit-cost-${line.key}`}
                    name={`unit_cost_${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unitCost}
                    onChange={(e) =>
                      updateLine(index, { unitCost: e.target.value })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="flex flex-col justify-end space-y-1">
                  <Label htmlFor={`purchase-tax-rate-${line.key}`} className="text-xs">Tax rate %</Label>
                  <Input
                    id={`purchase-tax-rate-${line.key}`}
                    name={`tax_rate_${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={line.taxRate}
                    onChange={(e) =>
                      updateLine(index, { taxRate: e.target.value })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="col-span-2 flex flex-col justify-end space-y-1 sm:col-span-1">
                  <Label htmlFor={`purchase-total-${line.key}`} className="whitespace-nowrap text-xs">
                    Total incl. tax
                  </Label>
                  <Input
                    id={`purchase-total-${line.key}`}
                    aria-label="Total incl. tax (NPR)"
                    name={`total_amount_${index}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.totalAmount || (line.orderedQuantity && line.unitCost !== "" ? String(Number(lineTotal(line).toFixed(2))) : "")}
                    onChange={(event) => updateLine(index, { totalAmount: event.target.value })}
                    disabled={disabled || Number(line.orderedQuantity) <= 0}
                    placeholder={Number(line.orderedQuantity) <= 0 ? "Enter quantity first" : "0.00"}
                  />
                </div>
              </div>
              {line.totalAmount !== "" && Math.abs(lineTotal(line) - Number(line.totalAmount)) >= 0.005 && (
                <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                  Recorded total will be {formatCurrency(lineTotal(line))} because unit cost uses two decimal places.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, newPurchaseLineDraft()])}
        disabled={disabled}
        className="gap-1 text-xs"
      >
        <Plus className="h-3.5 w-3.5" /> Add line
      </Button>
    </div>
  );
}
