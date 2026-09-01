"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Loader2, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Switch,
} from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiClient from "@/lib/api-client";
import { PrinterApis, StationApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

interface StationRow {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  business_line?: string | null;
  is_active: boolean;
  printer_id?: number | null;
}

interface PrinterOption {
  id: number;
  name: string;
  enabled: boolean;
}

const NO_PRINTER_VALUE = "__no_printer__";
const ANY_BUSINESS_LINE_VALUE = "__any__";

type StationFormState = {
  name: string;
  code: string;
  description: string;
  businessLine: string;
  printerId: string;
};

const emptyForm: StationFormState = {
  name: "",
  code: "",
  description: "",
  businessLine: ANY_BUSINESS_LINE_VALUE,
  printerId: NO_PRINTER_VALUE,
};

export function StationsManagementClient() {
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const restaurantId = restaurant?.id || user?.restaurant_id || 0;

  const [stations, setStations] = useState<StationRow[]>([]);
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StationFormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editStation, setEditStation] = useState<StationRow | null>(null);
  const [editForm, setEditForm] = useState<StationFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<StationRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadStations = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        StationApis.list({
          restaurantId,
          isActive: includeInactive ? undefined : true,
          limit: 200,
        }),
      );
      if (response.data.status === "success") {
        setStations(response.data.data?.stations || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not load stations.");
    } finally {
      setLoading(false);
    }
  };

  const loadPrinters = async () => {
    if (!restaurantId) return;
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

  useEffect(() => {
    void loadStations();
    void loadPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, includeInactive]);

  const buildPayload = (form: StationFormState) => ({
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    description: form.description.trim() || undefined,
    business_line:
      form.businessLine === ANY_BUSINESS_LINE_VALUE ? undefined : form.businessLine,
    printer_id: form.printerId === NO_PRINTER_VALUE ? undefined : Number(form.printerId),
  });

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error("Station name is required.");
      return;
    }
    setCreating(true);
    try {
      const response = await apiClient.post(StationApis.createStation, {
        restaurant_id: restaurantId,
        ...buildPayload(createForm),
      });
      if (response.data.status === "success") {
        toast.success("Station created");
        setCreateOpen(false);
        setCreateForm(emptyForm);
        void loadStations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not create station.");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (station: StationRow) => {
    setEditStation(station);
    setEditForm({
      name: station.name,
      code: station.code || "",
      description: station.description || "",
      businessLine: station.business_line || ANY_BUSINESS_LINE_VALUE,
      printerId: station.printer_id ? String(station.printer_id) : NO_PRINTER_VALUE,
    });
  };

  const handleEditSave = async () => {
    if (!editStation || !editForm.name.trim()) {
      toast.error("Station name is required.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.patch(
        StationApis.updateStation(editStation.id, restaurantId),
        buildPayload(editForm),
      );
      if (response.data.status === "success") {
        toast.success("Station updated");
        setEditStation(null);
        void loadStations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not update station.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const response = await apiClient.patch(
        StationApis.updateStation(toggleTarget.id, restaurantId),
        { is_active: !toggleTarget.is_active },
      );
      if (response.data.status === "success") {
        toast.success(
          toggleTarget.is_active ? "Station deactivated" : "Station reactivated",
        );
        setToggleTarget(null);
        void loadStations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Could not update station.");
    } finally {
      setToggling(false);
    }
  };

  const renderFormFields = (
    form: StationFormState,
    setForm: (updater: (current: StationFormState) => StationFormState) => void,
  ) => (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          placeholder="e.g. Rooftop, Bakery, Poolside"
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label>Code (optional)</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))}
          placeholder="e.g. ROOF"
        />
      </div>
      <div className="grid gap-2">
        <Label>Description (optional)</Label>
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((current) => ({ ...current, description: e.target.value }))
          }
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label>Business line</Label>
        <Select
          value={form.businessLine}
          onValueChange={(value) => setForm((current) => ({ ...current, businessLine: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_BUSINESS_LINE_VALUE}>Restaurant &amp; Hotel</SelectItem>
            <SelectItem value="restaurant">Restaurant only</SelectItem>
            <SelectItem value="hotel">Hotel only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Printer (optional)</Label>
        <Select
          value={form.printerId}
          onValueChange={(value) => setForm((current) => ({ ...current, printerId: value }))}
        >
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
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Configuration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Stations / Departments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The shared list of departments (Kitchen, Bar, Cafe, and any custom ones you add)
            used to tag menu categories, inventory items, KOT printer routing, and Expense /
            Income attribution across the app.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Station
        </Button>
      </header>

      <Card className="border-border shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                {stations.length} station{stations.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="include-inactive" className="text-sm text-muted-foreground">
                Show deactivated
              </Label>
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stations.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              No stations yet. Add one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Business line</TableHead>
                    <TableHead>Printer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations.map((station) => {
                    const printer = printers.find((p) => p.id === station.printer_id);
                    return (
                      <TableRow key={station.id} className={!station.is_active ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">{station.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {station.code || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {station.business_line || "Restaurant & Hotel"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {printer?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={station.is_active ? "secondary" : "outline"}>
                            {station.is_active ? "Active" : "Deactivated"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              title="Edit station"
                              onClick={() => openEdit(station)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title={station.is_active ? "Deactivate station" : "Reactivate station"}
                              onClick={() => setToggleTarget(station)}
                            >
                              {station.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateForm(emptyForm); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Station</DialogTitle>
            <DialogDescription>
              Create a department for menu, inventory, and finance attribution.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(createForm, setCreateForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Station
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editStation != null} onOpenChange={(open) => { if (!open) setEditStation(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Station</DialogTitle>
            <DialogDescription>
              Update this station's details or assign it a ticket printer.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(editForm, setEditForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStation(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toggleTarget != null} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.is_active ? "Deactivate" : "Reactivate"} "{toggleTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.is_active
                ? "It will no longer be selectable for new menu categories, inventory items, or Expense/Income entries. Historical records that already reference it are unaffected."
                : "It will become selectable again across Menu, Inventory, and Finance."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={toggling}>
              {toggling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {toggleTarget?.is_active ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
