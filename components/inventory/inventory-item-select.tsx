"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import apiClient from "@/lib/api-client";
import { InventoryApis } from "@/lib/api/endpoints";

export interface InventoryItemOption {
  id: number;
  name: string;
  unit: string;
  current_stock: number | string;
}

export function InventoryItemSelect({
  restaurantId,
  value,
  onChange,
  excludeIds = [],
  disabled = false,
  label = "Inventory item",
  placeholder = "Select item",
  selectedItem = null,
}: {
  restaurantId: number;
  value: number | null;
  onChange: (itemId: number | null, item: InventoryItemOption | null) => void;
  excludeIds?: number[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  selectedItem?: InventoryItemOption | null;
}) {
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [loading, setLoading] = useState(false);
  const selectId = useId();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const allItems: InventoryItemOption[] = [];
        while (!cancelled) {
          const response = await apiClient.get(
            InventoryApis.listInventoryWithQuery({
              restaurantId,
              isActive: true,
              skip: allItems.length,
              limit: 500,
            }),
          );
          if (response.data.status !== "success") throw new Error("Could not load inventory items.");
          const rows = response.data.data?.items || response.data.data || [];
          if (!Array.isArray(rows)) throw new Error("Could not load inventory items.");
          allItems.push(...rows);
          if (rows.length < 500) break;
        }
        if (!cancelled) setItems(allItems);
      } catch (error: any) {
        if (cancelled) return;
        setItems([]);
        toast.error(
          error.response?.data?.detail || "Could not load inventory items.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const excludeSet = new Set(excludeIds);
  const selectableItems = [
    ...(selectedItem && !items.some((item) => item.id === selectedItem.id) ? [selectedItem] : []),
    ...items,
  ].filter(
    (item) => item.id === value || !excludeSet.has(item.id),
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        value={value != null ? String(value) : ""}
        disabled={disabled || loading}
        onValueChange={(key) => {
          const item = selectableItems.find((i) => String(i.id) === key) || null;
          onChange(item ? item.id : null, item);
        }}
      >
        <SelectTrigger id={selectId}>
          <SelectValue placeholder={loading ? "Loading items..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {selectableItems.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name} · {Number(item.current_stock).toLocaleString()} {item.unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
