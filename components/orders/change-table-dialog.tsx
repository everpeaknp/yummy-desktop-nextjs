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
import { Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RoomContainer, type TableData } from "@/components/tables/room-container";
import {
  canSelectTableForTransfer,
  dispatchTablesRefresh,
  extractApiDetail,
  getTableTransferAction,
  tableTransferActionLabel,
  tableTransferConfirmBody,
  tableTransferConfirmTitle,
  type TableTransferAction,
} from "@/lib/table-ops";

type TransferTableResult = {
  source_order_id?: number;
  destination_order_id?: number | null;
  destination_table_id?: number;
  action?: string;
};

export type ChangeTableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestOrderId: number;
  restaurantId: number;
  currentTableId?: number | null;
  currentTableIds?: number[];
  onCompleted?: (result: {
    action: "moved" | "merged";
    destinationOrderId: number | null;
    destinationTableId: number;
  }) => void;
};

export function ChangeTableDialog({
  open,
  onOpenChange,
  guestOrderId,
  restaurantId,
  currentTableId,
  currentTableIds,
  onCompleted,
}: ChangeTableDialogProps) {
  const [allTables, setAllTables] = useState<TableData[]>([]);
  const [tableTypes, setTableTypes] = useState<{ id: number; name: string; layout_height: number }[]>([]);
  const [selectedArea, setSelectedArea] = useState("All Areas");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<TableTransferAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const assignedIds = useMemo(() => {
    const ids = new Set<number>();
    if (currentTableIds?.length) {
      currentTableIds.forEach((id) => ids.add(id));
    } else if (currentTableId) {
      ids.add(currentTableId);
    }
    return ids;
  }, [currentTableId, currentTableIds]);

  const fetchTables = useCallback(async () => {
    try {
      const [tablesRes, typesRes] = await Promise.all([
        apiClient.get(`${TableApis.getTables(restaurantId)}?space_kind=table`),
        apiClient.get(`${TableTypeApis.getTableTypes(restaurantId)}?space_kind=table`),
      ]);
      if (tablesRes.data.status === "success") {
        setAllTables(tablesRes.data.data || []);
      }
      if (typesRes.data.status === "success") {
        setTableTypes(typesRes.data.data || []);
      }
    } catch {
      toast.error("Failed to load tables");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) return;
    setSelectedTableId("");
    setPendingAction(null);
    setConfirmOpen(false);
    void fetchTables();
  }, [open, fetchTables]);

  const selectedTable = useMemo(
    () => allTables.find((t) => String(t.id) === selectedTableId),
    [allTables, selectedTableId]
  );

  const handleTablePick = (table: TableData) => {
    if (!canSelectTableForTransfer(table.id, table.status, Array.from(assignedIds))) {
      return;
    }
    const action = getTableTransferAction(table.status);
    if (!action) return;
    setSelectedTableId(String(table.id));
    setPendingAction(action);
    if (action === "merge") {
      setConfirmOpen(true);
    }
  };

  const submitTransfer = async () => {
    if (!selectedTableId || !pendingAction) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post(
        OrderApis.transferGuestBillTable(guestOrderId),
        { destination_table_id: Number(selectedTableId) }
      );
      if (res.data?.status !== "success") {
        toast.error(res.data?.message || "Failed to transfer table");
        return;
      }
      const data = (res.data?.data ?? {}) as TransferTableResult;
      const action = String(data.action ?? pendingAction).toLowerCase() as "moved" | "merged";
      const tableLabel = selectedTable?.table_name || `Table ${selectedTableId}`;
      toast.success(
        action === "merged"
          ? `Bill merged into ${tableLabel}.`
          : `Bill moved to ${tableLabel}.`
      );
      dispatchTablesRefresh();
      onCompleted?.({
        action: action === "merged" ? "merged" : "moved",
        destinationOrderId:
          data.destination_order_id != null ? Number(data.destination_order_id) : null,
        destinationTableId: Number(selectedTableId),
      });
      setConfirmOpen(false);
      onOpenChange(false);
      if (action === "merged" && data.destination_order_id) {
        // Caller may navigate to merged order
      }
    } catch (err: unknown) {
      toast.error(extractApiDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  const primaryButtonLabel =
    pendingAction === "merge" ? "Merge" : pendingAction === "move" ? "Move" : "Continue";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Change Table</DialogTitle>
            <DialogDescription>
              Free tables move the bill. Occupied or bill-printed tables merge into the active order
              on that table (server-side).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/30 rounded-2xl w-fit">
              {(() => {
                const set = new Set<string>();
                tableTypes.forEach((tt) => set.add(tt.name));
                allTables.forEach((t) => {
                  if (t.table_type_name) set.add(t.table_type_name);
                });
                return ["All Areas", ...Array.from(set).sort()].map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    className={cn(
                      "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
                      selectedArea === area
                        ? "bg-background shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground"
                    )}
                  >
                    {area}
                  </button>
                ));
              })()}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="text-emerald-600">Free → Move</span>
              <span className="text-red-600">Occupied / Bill printed → Merge</span>
              <span className="opacity-60">Payment completed / Reserved → blocked</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const filtered =
                  selectedArea === "All Areas"
                    ? allTables
                    : allTables.filter((t) => (t.table_type_name || "General") === selectedArea);
                const grouped = filtered.reduce(
                  (acc, table) => {
                    const area = table.table_type_name || "General";
                    if (!acc[area]) acc[area] = [];
                    acc[area].push(table);
                    return acc;
                  },
                  {} as Record<string, TableData[]>
                );
                return Object.keys(grouped)
                  .sort()
                  .map((roomName) => (
                    <RoomContainer
                      key={roomName}
                      title={roomName}
                      tables={grouped[roomName]}
                      layoutHeight={
                        tableTypes.find((t) => t.name === roomName)?.layout_height ?? 200
                      }
                      onTableClick={handleTablePick}
                      selectedTableId={Number(selectedTableId) || undefined}
                    />
                  ));
              })()}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedTableId || !pendingAction || submitting}
              className="gap-2"
              onClick={() => {
                if (pendingAction === "merge") {
                  setConfirmOpen(true);
                } else {
                  void submitTransfer();
                }
              }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Table2 className="h-4 w-4" />
              )}
              {submitting ? "Working…" : primaryButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedTable && pendingAction
                ? tableTransferConfirmTitle(pendingAction, selectedTable.table_name)
                : "Confirm merge"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction ? tableTransferConfirmBody(pendingAction) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={submitting}
              onClick={() => void submitTransfer()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
