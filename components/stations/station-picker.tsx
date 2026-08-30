"use client";

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
import { StationApis } from "@/lib/api/endpoints";

export interface StationOption {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
}

const ADD_NEW_STATION_VALUE = "__add_new_station__";

export function StationPicker({
  restaurantId,
  value,
  onChange,
  disabled = false,
  canManageStations = true,
  label = "Station",
  placeholder = "General / Shared",
}: {
  restaurantId: number;
  value: number | null;
  onChange: (stationId: number | null, station: StationOption | null) => void;
  disabled?: boolean;
  canManageStations?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");

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
        if (!cancelled) setStations(rows);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setStations([]);
        toast.error(error.response?.data?.detail || "Could not load stations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
      });
      if (response.data.status === "success") {
        const created: StationOption = response.data.data;
        setStations(await fetchStations());
        onChange(created.id, created);
        setCreateOpen(false);
        setNewName("");
        setNewCode("");
        setNewDescription("");
        toast.success("Station created");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not create station.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value != null ? String(value) : ""}
        disabled={disabled || loading}
        onValueChange={(key) => {
          if (key === ADD_NEW_STATION_VALUE) {
            setCreateOpen(true);
            return;
          }
          const station = stations.find((s) => String(s.id) === key) || null;
          onChange(station ? station.id : null, station);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading stations..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
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
    </div>
  );
}
