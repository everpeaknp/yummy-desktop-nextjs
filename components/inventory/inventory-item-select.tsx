"use client";

import { useEffect, useState } from "react";
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
}: {
  restaurantId: number;
  value: number | null;
  onChange: (itemId: number | null, item: InventoryItemOption | null) => void;
  excludeIds?: number[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const response = await apiClient.get(
          InventoryApis.listInventoryWithQuery({
            restaurantId,
            isActive: true,
            limit: 500,
          }),
        );
        if (cancelled) return;
        if (response.data.status === "success") {
          const rows = response.data.data?.items || response.data.data || [];
          setItems(Array.isArray(rows) ? rows : []);
        }
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
  const selectableItems = items.filter(
    (item) => item.id === value || !excludeSet.has(item.id),
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value != null ? String(value) : ""}
        disabled={disabled || loading}
        onValueChange={(key) => {
          const item = items.find((i) => String(i.id) === key) || null;
          onChange(item ? item.id : null, item);
        }}
      >
        <SelectTrigger>
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
