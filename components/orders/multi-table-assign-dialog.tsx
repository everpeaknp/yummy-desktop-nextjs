"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { OrderApis, TableApis, TableTypeApis } from "@/lib/api/endpoints";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TableData } from "@/components/tables/room-container";
import { extractApiDetail, isTableFree } from "@/lib/table-ops";
import { runLockedAction } from "@/lib/request-lock";
import { dispatchPosMutationSync } from "@/lib/sync-invalidation";
import { refetchOrderBeforeMutation } from "@/lib/pos-order-refresh";

export type MultiTableAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: number;
  restaurantId: number;
  initialTableIds: number[];
  numberOfGuests?: number | null;
  onCompleted?: () => void;
};

export function MultiTableAssignDialog({
  open,
  onOpenChange,
  orderId,
  restaurantId,
  initialTableIds,
  numberOfGuests,
  onCompleted,
}: MultiTableAssignDialogProps) {
  const [allTables, setAllTables] = useState<TableData[]>([]);
  const [tableTypes, setTableTypes] = useState<{ id: number; name: string; layout_height: number }[]>([]);
  const [selectedArea, setSelectedArea] = useState("All Areas");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const [tablesRes, typesRes] = await Promise.all([
        apiClient.get(`${TableApis.getTables(restaurantId)}?space_kind=table`),
        apiClient.get(`${TableTypeApis.getTableTypes(restaurantId)}?space_kind=table`),
      ]);
      if (tablesRes.data.status === "success") setAllTables(tablesRes.data.data || []);
      if (typesRes.data.status === "success") setTableTypes(typesRes.data.data || []);
    } catch {
      toast.error("Failed to load tables");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(initialTableIds.length ? [...initialTableIds] : []);
    void fetchTables();
  }, [open, initialTableIds, fetchTables]);

  const toggleTable = (table: TableData) => {
    if (!isTableFree(table.status) && !selectedIds.includes(table.id)) {
      toast.error("Only free tables can be added to a multi-table assignment.");
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id]
    );
  };

  const capacityTotal = useMemo(() => {
    return selectedIds.reduce((sum, id) => {
      const t = allTables.find((row) => row.id === id);
      return sum + (t?.capacity ?? 0);
    }, 0);
  }, [selectedIds, allTables]);

  const submit = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one table.");
      return;
    }
    if (submitting) return;

    const done = await runLockedAction(`multi-table:${orderId}`, async () => {
      setSubmitting(true);
      try {
        await refetchOrderBeforeMutation(orderId);

        const payload: { table_ids: number[]; number_of_guests?: number } = {
          table_ids: selectedIds,
        };
        if (numberOfGuests != null && numberOfGuests > 0) {
          payload.number_of_guests = numberOfGuests;
        }
        const res = await apiClient.patch(OrderApis.updateOrder(orderId), payload);
        if (res.data?.status === "success") {
          toast.success(
            selectedIds.length === 1
              ? "Table assignment updated."
              : `${selectedIds.length} tables assigned to this order.`
          );
          dispatchPosMutationSync({ orderId, reason: "multi-table-assign" });
          onCompleted?.();
          onOpenChange(false);
          return true;
        }
        toast.error(res.data?.message || "Failed to update tables");
        return false;
      } catch (err: unknown) {
        toast.error(extractApiDetail(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    });

    if (done === undefined) {
      toast.message("Table update already in progress.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Assign Tables</DialogTitle>
          <DialogDescription>
            One order can span multiple tables. Select free tables only — this does not merge bills
            with other orders.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <span className="font-bold">{selectedIds.length}</span> table
            {selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <span className="text-muted-foreground">
            Total capacity: <span className="font-semibold text-foreground">{capacityTotal}</span>
            {numberOfGuests ? ` • Guests: ${numberOfGuests}` : ""}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          <div className="flex flex-wrap gap-2">
            {["All Areas", ...Array.from(new Set(allTables.map((t) => t.table_type_name || "General"))).sort()].map(
              (area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setSelectedArea(area)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold",
                    selectedArea === area ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {area}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(
              (selectedArea === "All Areas"
                ? allTables
                : allTables.filter((t) => (t.table_type_name || "General") === selectedArea)
              ).reduce(
                (acc, table) => {
                  const area = table.table_type_name || "General";
                  if (!acc[area]) acc[area] = [];
                  acc[area].push(table);
                  return acc;
                },
                {} as Record<string, TableData[]>
              )
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([roomName, tables]) => (
                <div key={roomName} className="space-y-2">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{roomName}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tables.map((table) => {
                      const checked = selectedIds.includes(table.id);
                      const free = isTableFree(table.status);
                      const disabled = !free && !checked;
                      return (
                        <label
                          key={table.id}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm",
                            checked && "border-primary bg-primary/5",
                            disabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => toggleTable(table)}
                          />
                          <span className="font-medium truncate">{table.table_name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{table.capacity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting || selectedIds.length === 0} onClick={() => void submit()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
