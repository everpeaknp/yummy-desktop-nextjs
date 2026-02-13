"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { TableApis, TableTypeApis } from "@/lib/api/endpoints";
import {
  Loader2,
  Armchair,
  Plus,
  MapPinned,
  X,
  Save,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomContainer, type TableData } from "@/components/tables/room-container";
import { ReservationDetailsSheet } from "@/components/reservations/reservation-details-sheet";
import { ReservationApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TableType {
  id: number;
  name: string;
  restaurant_id: number;
  layout_height: number;
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [tableTypes, setTableTypes] = useState<TableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState("All Areas");

  // Layout edit mode
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [originalTables, setOriginalTables] = useState<TableData[]>([]);
  const [categoryHeights, setCategoryHeights] = useState<Record<string, number>>({});
  const [originalHeights, setOriginalHeights] = useState<Record<string, number>>({});
  const [savingLayout, setSavingLayout] = useState(false);

  // Table form dialog
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableData | null>(null);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Area dialog
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [areaDialogMode, setAreaDialogMode] = useState<"add" | "rename">("add");
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaSaving, setAreaSaving] = useState(false);

  // Reservation details
  const [reservationSheetOpen, setReservationSheetOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [loadingReservation, setLoadingReservation] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  const fetchData = useCallback(async (showLoader = false) => {
    if (!user?.restaurant_id) return;
    if (showLoader) setLoading(true);
    try {
      const [tablesRes, typesRes] = await Promise.all([
        apiClient.get(TableApis.getTables(user.restaurant_id)),
        apiClient.get(TableTypeApis.getTableTypes(user.restaurant_id)),
      ]);
      if (tablesRes.data.status === "success") {
        setTables(tablesRes.data.data || []);
      }
      if (typesRes.data.status === "success") {
        setTableTypes(typesRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (user?.restaurant_id) fetchData(true);
  }, [user?.restaurant_id, fetchData]);

  // ─── Area options ───
  const areaOptions = (() => {
    const set = new Set<string>();
    tableTypes.forEach((tt) => set.add(tt.name));
    tables.forEach((t) => {
      if (t.table_type_name) set.add(t.table_type_name);
    });
    const sorted = Array.from(set).sort();
    return ["All Areas", ...sorted];
  })();

  const getLayoutHeight = (areaName: string): number => {
    if (categoryHeights[areaName] != null) return categoryHeights[areaName];
    const tt = tableTypes.find((t) => t.name === areaName);
    return tt?.layout_height ?? 200;
  };

  const handleHeightChanged = (roomName: string, newHeight: number) => {
    setCategoryHeights((prev) => ({ ...prev, [roomName]: Math.max(newHeight, 100) }));
  };

  const getTableTypeId = (areaName: string): number | undefined => {
    return tableTypes.find((t) => t.name === areaName)?.id;
  };

  // ─── Filter / group ───
  const filteredTables =
    selectedArea === "All Areas"
      ? tables
      : tables.filter((t) => (t.table_type_name || "General") === selectedArea);

  const groupedTables = filteredTables.reduce(
    (acc, table) => {
      const area = table.table_type_name || "General";
      if (!acc[area]) acc[area] = [];
      acc[area].push(table);
      return acc;
    },
    {} as Record<string, TableData[]>
  );
  const sortedRooms = Object.keys(groupedTables).sort();

  // ═══════════════════════════════════════════════
  // LAYOUT EDIT MODE
  // ═══════════════════════════════════════════════
  const enterLayoutMode = () => {
    setOriginalTables(JSON.parse(JSON.stringify(tables)));
    // Snapshot current heights from tableTypes
    const heights: Record<string, number> = {};
    tableTypes.forEach((tt) => { heights[tt.name] = tt.layout_height; });
    setOriginalHeights(heights);
    setCategoryHeights(heights);
    setIsLayoutMode(true);
  };

  const cancelLayoutMode = () => {
    setTables(originalTables);
    setCategoryHeights(originalHeights);
    setIsLayoutMode(false);
    setOriginalTables([]);
    setOriginalHeights({});
  };

  const handleTableDrop = (tableId: number, posX: number, posY: number) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, pos_x: posX, pos_y: posY } : t))
    );
  };

  const handleAutoArrange = (
    roomName: string,
    updates: Record<number, { posX: number; posY: number }>,
    newHeight: number
  ) => {
    setTables((prev) =>
      prev.map((t) => {
        const u = updates[t.id];
        return u ? { ...t, pos_x: u.posX, pos_y: u.posY } : t;
      })
    );
    handleHeightChanged(roomName, newHeight);
  };

  const saveLayout = async () => {
    setSavingLayout(true);
    try {
      // Save moved tables
      const movedTables = tables.filter((t) => {
        const orig = originalTables.find((o) => o.id === t.id);
        return orig && (orig.pos_x !== t.pos_x || orig.pos_y !== t.pos_y);
      });

      for (const table of movedTables) {
        await apiClient.put(TableApis.updateTable(table.id), {
          pos_x: table.pos_x,
          pos_y: table.pos_y,
        });
      }

      // Save changed layout_heights
      for (const [roomName, newHeight] of Object.entries(categoryHeights)) {
        const origHeight = originalHeights[roomName];
        if (origHeight != null && Math.abs(origHeight - newHeight) > 0.1) {
          const typeId = getTableTypeId(roomName);
          if (typeId) {
            await apiClient.put(TableTypeApis.updateTableType(typeId), {
              layout_height: newHeight,
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to save layout:", err);
    } finally {
      // Always exit layout mode and refetch — even on network errors,
      // partial saves may have succeeded
      setSavingLayout(false);
      setIsLayoutMode(false);
      setOriginalTables([]);
      setOriginalHeights({});
      fetchData();
    }
  };

  // ═══════════════════════════════════════════════
  // TABLE CRUD
  // ═══════════════════════════════════════════════
  // Client-side duplicate name check
  const isDuplicateName = (() => {
    if (!formName.trim() || !formArea) return false;
    const name = formName.trim().toLowerCase();
    return tables.some(
      (t) =>
        t.table_name.toLowerCase() === name &&
        (t.table_type_name || "") === formArea &&
        t.id !== editingTable?.id
    );
  })();

  const openAddTable = () => {
    setEditingTable(null);
    setFormName("");
    setFormCapacity("");
    setFormError("");
    const defaultArea =
      selectedArea !== "All Areas" ? selectedArea : tableTypes[0]?.name || "";
    setFormArea(defaultArea);
    setTableDialogOpen(true);
  };

  const openEditTable = async (table: TableData) => {
    if (table.status === "RESERVED" && user?.restaurant_id) {
      setLoadingReservation(true);
      try {
        // Fetch reservations and find the one for this table
        const response = await apiClient.get(ReservationApis.listReservations(user.restaurant_id));
        if (response.data.status === "success") {
          const data = response.data.data;
          const reservations = Array.isArray(data) ? data : (data.reservations || []);
          const res = reservations.find((r: any) => 
            (r.table_id === table.id || (r.table_ids && r.table_ids.includes(table.id))) && 
            r.status.toLowerCase() === 'confirmed'
          );
          if (res) {
            setSelectedReservation(res);
            setReservationSheetOpen(true);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch reservation for table:", err);
      } finally {
        setLoadingReservation(false);
      }
    }

    setEditingTable(table);
    setFormName(table.table_name);
    setFormCapacity(table.capacity.toString());
    setFormArea(table.table_type_name || "");
    setFormError("");
    setTableDialogOpen(true);
  };

  const handleSaveTable = async () => {
    if (!formName.trim() || !formCapacity || !formArea) return;
    if (!user?.restaurant_id) return;

    const typeId = getTableTypeId(formArea);
    if (!typeId) return;

    setFormSaving(true);
    setFormError("");
    try {
      if (editingTable) {
        await apiClient.put(TableApis.updateTable(editingTable.id), {
          name: formName.trim(),
          capacity: parseInt(formCapacity),
          table_type_id: typeId,
        });
      } else {
        const existingInArea = tables.filter((t) => t.table_type_name === formArea);
        const pos = findNextPosition(existingInArea);

        await apiClient.post(
          TableApis.createTable(user.restaurant_id),
          {
            name: formName.trim(),
            capacity: parseInt(formCapacity),
            table_type_id: typeId,
            status: "FREE",
            pos_x: pos.x,
            pos_y: pos.y,
          }
        );
      }
      setFormSaving(false);
      setTableDialogOpen(false);
      fetchData();
    } catch (err: any) {
      // If we got a proper HTTP error response (e.g. 400 duplicate), show it
      if (err?.response?.data?.detail) {
        setFormError(err.response.data.detail);
        setFormSaving(false);
        return;
      }
      // Network Error / timeout = no response received.
      // The backend likely processed it — close dialog and refetch to verify.
      console.warn("Save request may have succeeded despite error:", err?.message);
      setFormSaving(false);
      setTableDialogOpen(false);
      fetchData();
    }
  };

  const handleDeleteTable = async () => {
    if (!editingTable) return;
    setFormSaving(true);
    setFormError("");
    try {
      await apiClient.delete(TableApis.deleteTable(editingTable.id));
      setFormSaving(false);
      setTableDialogOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        setFormError(err.response.data.detail);
        setFormSaving(false);
        return;
      }
      setFormSaving(false);
      setTableDialogOpen(false);
      fetchData();
    }
  };

  // ═══════════════════════════════════════════════
  // AREA (TABLE TYPE) CRUD
  // ═══════════════════════════════════════════════
  const openAddArea = () => {
    setAreaDialogMode("add");
    setEditingAreaId(null);
    setAreaName("");
    setAreaDialogOpen(true);
  };

  const openRenameArea = (tt: TableType) => {
    setAreaDialogMode("rename");
    setEditingAreaId(tt.id);
    setAreaName(tt.name);
    setAreaDialogOpen(true);
  };

  const handleSaveArea = async () => {
    if (!areaName.trim() || !user?.restaurant_id) return;
    setAreaSaving(true);
    try {
      if (areaDialogMode === "add") {
        await apiClient.post(
          TableTypeApis.createTableType(user.restaurant_id),
          { name: areaName.trim(), layout_height: 200 }
        );
      } else if (editingAreaId) {
        await apiClient.put(
          TableTypeApis.updateTableType(editingAreaId),
          { name: areaName.trim() }
        );
      }
      setAreaSaving(false);
      setAreaDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Failed to save area:", err);
      setAreaSaving(false);
    }
  };

  const handleDeleteArea = async (tt: TableType) => {
    if (!confirm(`Delete area "${tt.name}"? Tables in this area will also be removed.`))
      return;
    try {
      await apiClient.delete(TableTypeApis.deleteTableType(tt.id));
      if (selectedArea === tt.name) setSelectedArea("All Areas");
      fetchData();
    } catch (err) {
      console.error("Failed to delete area:", err);
    }
  };

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-5 max-w-[1600px] mx-auto p-5 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tables</h1>
          <p className="text-sm text-muted-foreground">
            Switch halls/floors and add tables to the active category.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLayoutMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelLayoutMode}
                className="text-red-500 hover:text-red-600"
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveLayout}
                disabled={savingLayout}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {savingLayout ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={enterLayoutMode}>
                <MapPinned className="w-4 h-4 mr-1" /> Edit Layout
              </Button>
              <Button
                size="sm"
                onClick={openAddTable}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Table
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Area Filter Chips — matching Flutter RoomSelectorBar */}
      <div className="flex flex-wrap items-center gap-2">
        {areaOptions.map((area) => {
          const tt = tableTypes.find((t) => t.name === area);
          return (
            <div key={area} className="relative group">
              <button
                onClick={() => setSelectedArea(area)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                  selectedArea === area
                    ? "bg-orange-600 text-white border-orange-600"
                    : "bg-card text-foreground border-border hover:bg-muted"
                )}
              >
                {area}
              </button>
              {/* Context menu for real areas (not "All Areas") */}
              {tt && !isLayoutMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                      <MoreVertical className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => openRenameArea(tt)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDeleteArea(tt)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {!isLayoutMode && (
          <button
            onClick={openAddArea}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Area
          </button>
        )}
      </div>

      {/* Status Legend — matching Flutter TableStatusLegend */}
      <div className="flex items-center gap-5 text-sm text-muted-foreground">
        <LegendDot color="bg-emerald-500" label="Available" />
        <LegendDot color="bg-red-500" label="Occupied" />
        <LegendDot color="bg-orange-500" label="Reserved" />
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : tables.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-3">
          <Armchair className="w-12 h-12 opacity-20" />
          <p>No tables configured.</p>
          <Button
            size="sm"
            onClick={openAddTable}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Table
          </Button>
        </div>
      ) : selectedArea !== "All Areas" ? (
        <RoomContainer
          title={selectedArea}
          tables={filteredTables}
          layoutHeight={getLayoutHeight(selectedArea)}
          isLayoutMode={isLayoutMode}
          onTableClick={isLayoutMode ? undefined : openEditTable}
          onTableDrop={isLayoutMode ? handleTableDrop : undefined}
          onHeightChanged={isLayoutMode ? (h) => handleHeightChanged(selectedArea, h) : undefined}
          onAutoArrange={isLayoutMode ? (updates, h) => handleAutoArrange(selectedArea, updates, h) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedRooms.map((roomName) => (
            <RoomContainer
              key={roomName}
              title={roomName}
              tables={groupedTables[roomName]}
              layoutHeight={getLayoutHeight(roomName)}
              isLayoutMode={isLayoutMode}
              onTableClick={isLayoutMode ? undefined : openEditTable}
              onTableDrop={isLayoutMode ? handleTableDrop : undefined}
              onHeightChanged={isLayoutMode ? (h) => handleHeightChanged(roomName, h) : undefined}
              onAutoArrange={isLayoutMode ? (updates, h) => handleAutoArrange(roomName, updates, h) : undefined}
            />
          ))}
        </div>
      )}

      {/* ═══ TABLE FORM DIALOG ═══ */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Edit Table" : "Add Table"}</DialogTitle>
            <DialogDescription>
              {editingTable
                ? "Update table details below."
                : "Choose the hall/floor for this table. Defaults to the active filter."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Area / Floor</Label>
              <Select value={formArea} onValueChange={setFormArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {tableTypes.map((tt) => (
                    <SelectItem key={tt.id} value={tt.name}>
                      {tt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Table Name</Label>
              <Input
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(""); }}
                placeholder="e.g. A1, T2"
                maxLength={10}
              />
              {isDuplicateName && (
                <p className="text-xs text-red-500">A table with this name already exists in {formArea}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Capacity</Label>
              <Input
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                placeholder="e.g. 4"
                min={1}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingTable && (
              <Button
                variant="destructive"
                onClick={handleDeleteTable}
                disabled={formSaving}
                className="mr-auto"
              >
                {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
              </Button>
            )}
            {formError && (
              <p className="text-sm text-red-500 mr-auto">{formError}</p>
            )}
            <Button
              onClick={handleSaveTable}
              disabled={formSaving || !formName.trim() || !formCapacity || !formArea || isDuplicateName}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {formSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ AREA DIALOG ═══ */}
      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {areaDialogMode === "add" ? "Add Area" : "Rename Area"}
            </DialogTitle>
            <DialogDescription>
              {areaDialogMode === "add"
                ? "Create a new hall, floor, or section."
                : "Enter the new name for this area."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Area Name</Label>
              <Input
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. Main Dining, Terrace, Outdoor"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveArea}
              disabled={areaSaving || !areaName.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {areaSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              {areaDialogMode === "add" ? "Add" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ RESERVATION DETAILS SHEET ═══ */}
      <ReservationDetailsSheet
        open={reservationSheetOpen}
        onOpenChange={setReservationSheetOpen}
        reservation={selectedReservation}
        onRefresh={() => fetchData(true)}
      />

      {loadingReservation && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}

function findNextPosition(existingTables: TableData[]): { x: number; y: number } {
  const cols = 4;
  const colWidth = 25;
  const rowHeight = 22;
  const margin = 2;
  const boxSize = 18;

  let row = 0;
  while (row < 100) {
    for (let col = 0; col < cols; col++) {
      const cx = col * colWidth + margin;
      const cy = row * rowHeight + margin;
      const collision = existingTables.some((t) => {
        const tx = t.pos_x ?? 0;
        const ty = t.pos_y ?? 0;
        return Math.abs(tx - cx) < boxSize && Math.abs(ty - cy) < boxSize;
      });
      if (!collision) return { x: cx, y: cy };
    }
    row++;
  }
  return { x: margin, y: margin };
}
