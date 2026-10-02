"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api-client";
import { PrinterApis, StationApis } from "@/lib/api/endpoints";

export interface StationOption {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
  printer_id?: number | null;
}

interface PrinterOption {
  id: number;
  name: string;
  enabled: boolean;
}

const ADD_NEW_STATION_VALUE = "__add_new_station__";
const NO_PRINTER_VALUE = "__no_printer__";
const NONE_STATION_VALUE = "__none_station__";

export function StationPicker({
  restaurantId,
  value,
  onChange,
  onStationsLoaded,
  disabled = false,
  canManageStations = true,
  label = "Station",
  placeholder = "General / Shared",
}: {
  restaurantId: number;
  value: number | null;
  onChange: (stationId: number | null, station: StationOption | null) => void;
  // Fired once after the station list resolves (including on initial load),
  // so a parent that already has a `value` from initialData -- and thus
  // never gets a user-driven onChange -- can still resolve that station's
  // name (e.g. to check it against a legacy naming convention).
  onStationsLoaded?: (stations: StationOption[]) => void;
  disabled?: boolean;
  canManageStations?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrinterId, setNewPrinterId] = useState<string>(NO_PRINTER_VALUE);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editStation, setEditStation] = useState<StationOption | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrinterId, setEditPrinterId] = useState<string>(NO_PRINTER_VALUE);

  const fetchPrinters = async () => {
    try {
      const response = await apiClient.get(PrinterApis.list(restaurantId));
      if (response.data.status === "success") {
        const rows = response.data.data || [];
        setPrinters(Array.isArray(rows) ? rows.filter((p: PrinterOption) => p.enabled) : []);
      }
    } catch {
      setPrinters([]);
    }
  };

  const fetchStations = async (): Promise<StationOption[]> => {
    const response = await apiClient.get(
      StationApis.list({ restaurantId, isActive: true, limit: 200 }),
    );
    if (response.data.status === "success") {
      const rows = response.data.data?.stations || [];
      return Array.isArray(rows) ? rows : [];
    }
    return [];
  };

  useEffect(() => {
    let cancelled = false;
    if (!restaurantId) return;
    setLoading(true);
    fetchStations()
      .then((rows) => {
        if (cancelled) return;
        setStations(rows);
        onStationsLoaded?.(rows);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setStations([]);
        toast.error(error.response?.data?.detail || "Could not load stations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchPrinters();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Station name is required.");
      return;
    }
    setCreating(true);
    try {
      const response = await apiClient.post(StationApis.createStation, {
        restaurant_id: restaurantId,
        name: newName.trim(),
        code: newCode.trim() || undefined,
        description: newDescription.trim() || undefined,
        printer_id: newPrinterId === NO_PRINTER_VALUE ? undefined : Number(newPrinterId),
      });
      if (response.data.status === "success") {
        const created: StationOption = response.data.data;
        const refreshed = await fetchStations();
        setStations(refreshed);
        onStationsLoaded?.(refreshed);
        onChange(created.id, created);
        setCreateOpen(false);
        setNewName("");
        setNewCode("");
        setNewDescription("");
        setNewPrinterId(NO_PRINTER_VALUE);
        toast.success("Station created");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not create station.");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (station: StationOption) => {
    setEditStation(station);
    setEditName(station.name);
    setEditCode(station.code || "");
    setEditDescription(station.description || "");
    setEditPrinterId(station.printer_id ? String(station.printer_id) : NO_PRINTER_VALUE);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editStation || !editName.trim()) {
      toast.error("Station name is required.");
      return;
    }
    setEditing(true);
    try {
      const response = await apiClient.patch(
        StationApis.updateStation(editStation.id, restaurantId),
        {
          name: editName.trim(),
          code: editCode.trim() || undefined,
          description: editDescription.trim() || undefined,
          printer_id: editPrinterId === NO_PRINTER_VALUE ? null : Number(editPrinterId),
        },
      );
      if (response.data.status === "success") {
        const updated: StationOption = response.data.data;
        const refreshed = await fetchStations();
        setStations(refreshed);
        onStationsLoaded?.(refreshed);
        if (value === updated.id) onChange(updated.id, updated);
        setEditOpen(false);
        toast.success("Station updated");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not update station.");
    } finally {
      setEditing(false);
    }
  };

  const selectedStation = stations.find((s) => s.id === value) || null;

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2">
        <Select
          value={value != null ? String(value) : NONE_STATION_VALUE}
          disabled={disabled || loading}
          onValueChange={(key) => {
            if (key === ADD_NEW_STATION_VALUE) {
              setCreateOpen(true);
              return;
            }
            if (key === NONE_STATION_VALUE) {
              onChange(null, null);
              return;
            }
            const station = stations.find((s) => String(s.id) === key) || null;
            onChange(station ? station.id : null, station);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={loading ? "Loading stations..." : placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_STATION_VALUE}>{placeholder}</SelectItem>
            {stations.map((station) => (
              <SelectItem key={station.id} value={String(station.id)}>
                {station.name}
              </SelectItem>
            ))}
            {canManageStations && (
              <SelectItem value={ADD_NEW_STATION_VALUE} className="font-semibold text-primary">
                + Add new station
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {canManageStations && selectedStation && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Edit station"
            onClick={() => openEdit(selectedStation)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add New Station</DialogTitle>
            <DialogDescription>
              Create a restaurant-specific station (cost centre) for reporting and attribution.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="station_name">Name *</Label>
              <Input
                id="station_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rooftop, Bakery"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="station_code">Code (optional)</Label>
              <Input
                id="station_code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. ROOF"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="station_description">Description (optional)</Label>
              <Textarea
                id="station_description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Printer (optional)</Label>
              <Select value={newPrinterId} onValueChange={setNewPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="No printer assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRINTER_VALUE}>No printer assigned</SelectItem>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={String(printer.id)}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Station"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Station</DialogTitle>
            <DialogDescription>
              Update this station's details or assign it a ticket printer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit_station_name">Name *</Label>
              <Input
                id="edit_station_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_station_code">Code (optional)</Label>
              <Input
                id="edit_station_code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_station_description">Description (optional)</Label>
              <Textarea
                id="edit_station_description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Printer (optional)</Label>
              <Select value={editPrinterId} onValueChange={setEditPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="No printer assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRINTER_VALUE}>No printer assigned</SelectItem>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={String(printer.id)}>
                      {printer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editing}>
              {editing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
