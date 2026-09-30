"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Printer,
  Plus,
  Trash2,
  Settings2,
  Wifi,
  Bluetooth,
  RefreshCw,
  Loader2,
  Save,
  MapPin,
  LayoutGrid,
  Info,
  Monitor,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  PrinterApis,
  RestaurantApis,
  StationApis,
  StaffApis,
} from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";

interface Printer {
  id: number;
  name: string;
  display_name: string;
  address: string;
  printer_type: "bluetooth" | "network";
  connection_config: any;
  enabled: boolean;
  is_default: boolean;
}

interface DynamicStation {
  id: number;
  name: string;
  printer_id: number | null;
  is_active: boolean;
}

interface ReceiptTerminal {
  id?: number;
  name: string;
  printer_id: number | null;
  user_ids: number[];
  users?: { id: number; name: string; email: string }[];
  is_active: boolean;
}

interface StaffUser {
  id: number;
  name: string;
  email: string;
  is_active?: boolean;
}

interface PrinterManagementProps {
  restaurantId: number;
}

type ElectronPrinterBridge = {
  testNetworkPrinter?: (options: {
    host: string;
    port: number;
    timeoutMs: number;
  }) => Promise<{ success?: boolean; message?: string }>;
};

export function PrinterManagement({ restaurantId }: PrinterManagementProps) {
  const restaurant = useRestaurant((s) => s.restaurant);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [stations, setStations] = useState<DynamicStation[]>([]);
  const [receiptPrinterId, setReceiptPrinterId] = useState<number | null>(null);
  const [receiptTerminals, setReceiptTerminals] = useState<ReceiptTerminal[]>(
    [],
  );
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Local Device Settings
  const [localDeviceStations, setLocalDeviceStations] = useState<string[]>([]);

  // Create/Edit Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Partial<Printer> | null>(
    null,
  );
  const [formLoading, setFormLoading] = useState(false);
  const [isTerminalDialogOpen, setIsTerminalDialogOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] =
    useState<ReceiptTerminal | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setUnauthorized(false);
      setLoadError(false);
      const printersRes = await apiClient.get(PrinterApis.list(restaurantId));

      if (printersRes.data.status === "success") {
        setPrinters(printersRes.data.data);
      }

      // Station.printer_id is the source of truth for KOT routing (see
      // app/services/printer_service.py::get_printer_for_kot) -- fetch
      // the restaurant's real dynamic stations, not the deprecated
      // kot_station_config blob.
      const stationsRes = await apiClient.get(
        StationApis.list({ restaurantId, isActive: true, limit: 200 }),
      );
      if (stationsRes.data.status === "success") {
        setStations(stationsRes.data.data?.stations || []);
      }

      const [terminalsRes, staffRes] = await Promise.all([
        apiClient.get(PrinterApis.receiptTerminals(restaurantId)),
        apiClient.get(StaffApis.list()),
      ]);
      setReceiptTerminals(
        (terminalsRes.data?.data || []).map((terminal: any) => ({
          ...terminal,
          user_ids: (terminal.users || []).map((user: any) => user.id),
        })),
      );
      setStaffUsers(staffRes.data?.data || []);

      // Receipt printing is not a station -- it's a dedicated field on
      // the restaurant (see Restaurant.receipt_printer_id).
      const currentRestaurant = useRestaurant.getState().restaurant;
      setReceiptPrinterId(
        (currentRestaurant as any)?.receipt_printer_id ?? null,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setUnauthorized(true);
        return;
      }
      setLoadError(true);
      toast.error("Failed to load printer settings");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchData();
    // Load local device settings
    try {
      const saved = localStorage.getItem("yummy_local_kot_stations");
      if (saved) {
        setLocalDeviceStations(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse local stations", e);
    }
  }, [fetchData]);

  const handleToggleLocalStation = (stationName: string) => {
    setLocalDeviceStations((prev) => {
      const newStations = prev.includes(stationName)
        ? prev.filter((s) => s !== stationName)
        : [...prev, stationName];

      localStorage.setItem(
        "yummy_local_kot_stations",
        JSON.stringify(newStations),
      );
      return newStations;
    });
  };

  const handleToggleEnabled = async (printer: Printer) => {
    try {
      const updated = { ...printer, enabled: !printer.enabled };
      await apiClient.put(PrinterApis.update(printer.id), {
        enabled: updated.enabled,
      });
      setPrinters((prev) =>
        prev.map((p) => (p.id === printer.id ? updated : p)),
      );
      toast.success(`Printer ${updated.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error("Failed to update printer");
    }
  };

  const handleTestPrinter = async (id: number | undefined) => {
    if (!id) {
      toast.info(
        "Please register the printer configuration before testing the hardware connection.",
      );
      return;
    }

    try {
      setTestingId(id);
      toast.loading("Testing printer connectivity...", { id: `test-${id}` });
      const printer = printers.find((p) => p.id === id);

      // In Electron, prefer local desktop-to-printer network test.
      const electronAPI =
        typeof window !== "undefined"
          ? (window as Window & { electronAPI?: ElectronPrinterBridge })
              .electronAPI
          : undefined;
      const printerType = String(printer?.printer_type || "").toLowerCase();
      const isNetworkPrinter =
        printerType.includes("network") ||
        /^\d{1,3}(\.\d{1,3}){3}$/.test(String(printer?.address || "").trim());

      if (
        electronAPI?.testNetworkPrinter &&
        isNetworkPrinter &&
        printer?.address
      ) {
        const host =
          String(printer?.connection_config?.ip_address || "").trim() ||
          String(printer.address).trim();
        const testRes = await electronAPI.testNetworkPrinter({
          host,
          port: Number(printer.connection_config?.port || 9100),
          timeoutMs: 10000,
        });
        toast.dismiss(`test-${id}`);
        if (testRes?.success) {
          toast.success("Connection Successful (Local Electron)", {
            description: testRes.message,
          });
        } else {
          toast.error("Connection Failed (Local Electron)", {
            description:
              testRes?.message || "Could not reach printer from this desktop.",
          });
        }
        return;
      }

      // Browser/backend fallback: server-side test endpoint.
      const response = await apiClient.post(PrinterApis.test(id));
      toast.dismiss(`test-${id}`);

      if (response.data.status === "success") {
        toast.success("Connection Successful", {
          description: response.data.message,
        });
      } else {
        toast.error("Connection Failed", {
          description: response.data.message || "Could not reach printer.",
        });
      }
    } catch (err) {
      toast.dismiss(`test-${id}`);
      toast.error("Network Error", {
        description: "Failed to communicate with printer service.",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeletePrinter = async (id: number) => {
    if (!confirm("Are you sure you want to delete this printer?")) return;
    try {
      await apiClient.delete(PrinterApis.delete(id));
      setPrinters((prev) => prev.filter((p) => p.id !== id));
      toast.success("Printer deleted");
    } catch (err) {
      toast.error("Failed to delete printer");
    }
  };

  const handleSavePrinter = async () => {
    if (!editingPrinter?.name || !editingPrinter.printer_type) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        ...editingPrinter,
        connection_config:
          editingPrinter.printer_type === "network"
            ? {
                ip_address: editingPrinter.address,
                port: parseInt(
                  (editingPrinter.connection_config?.port || "9100").toString(),
                ),
              }
            : {
                mac_address: editingPrinter.address,
              },
      };

      if (editingPrinter.id) {
        await apiClient.put(PrinterApis.update(editingPrinter.id), payload);
        toast.success("Printer updated");
      } else {
        await apiClient.post(PrinterApis.create(restaurantId), payload);
        toast.success("Printer added");
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error("Failed to save printer");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStationPrinter = async (
    stationId: number,
    printerId: string,
  ) => {
    const newPrinterId = printerId === "none" ? null : parseInt(printerId);
    try {
      await apiClient.patch(
        StationApis.updateStation(stationId, restaurantId),
        {
          printer_id: newPrinterId,
        },
      );
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId ? { ...s, printer_id: newPrinterId } : s,
        ),
      );
      toast.success("Station printer updated");
    } catch (err) {
      toast.error("Failed to update station printer");
    }
  };

  const handleUpdateReceiptPrinter = async (printerId: string) => {
    const newPrinterId = printerId === "none" ? null : parseInt(printerId);
    try {
      await apiClient.put(RestaurantApis.update(restaurantId), {
        receipt_printer_id: newPrinterId,
      });
      setReceiptPrinterId(newPrinterId);
      toast.success("Receipt printer updated");
      useRestaurant.getState().fetchRestaurant();
    } catch (err) {
      toast.error("Failed to update receipt printer");
    }
  };

  const openNewTerminal = () => {
    setEditingTerminal({
      name: "",
      printer_id: null,
      user_ids: [],
      is_active: true,
    });
    setIsTerminalDialogOpen(true);
  };

  const handleSaveTerminal = async () => {
    if (!editingTerminal?.name.trim() || !editingTerminal.printer_id) {
      toast.error("Enter a terminal name and choose a printer");
      return;
    }
    try {
      setFormLoading(true);
      const payload = {
        name: editingTerminal.name.trim(),
        printer_id: editingTerminal.printer_id,
        user_ids: editingTerminal.user_ids,
        is_active: editingTerminal.is_active,
      };
      if (editingTerminal.id) {
        await apiClient.put(
          PrinterApis.updateReceiptTerminal(editingTerminal.id),
          payload,
        );
      } else {
        await apiClient.post(
          PrinterApis.createReceiptTerminal(restaurantId),
          payload,
        );
      }
      toast.success(
        editingTerminal.id
          ? "Receipt terminal updated"
          : "Receipt terminal created",
      );
      setIsTerminalDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || "Failed to save receipt terminal",
      );
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading printers" />;
  }

  if (unauthorized) {
    return (
      <ErrorState
        title="Printer settings are restricted"
        description="Ask an administrator to manage printer connections and station routing."
      />
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="Printer settings could not be loaded"
        description="Check the connection and try loading the hardware settings again."
        actionLabel="Try again"
        onAction={() => void fetchData()}
      />
    );
  }

  return (
    <div className="space-y-7">
      {/* Printers Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold">Configured printers</h2>
            <p className="text-sm text-muted-foreground">
              Connections used for receipts and kitchen tickets.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingPrinter({
                printer_type: "network",
                enabled: true,
                is_default: false,
              });
              setIsDialogOpen(true);
            }}
            className="h-11 font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add printer
          </Button>
        </div>

        {printers.length === 0 ? (
          <EmptyState
            icon={<Printer className="h-5 w-5" />}
            title="No printers configured"
            description="Add a printer to route receipts or kitchen tickets to physical hardware."
            actionLabel="Add printer"
            onAction={() => {
              setEditingPrinter({
                printer_type: "network",
                enabled: true,
                is_default: false,
              });
              setIsDialogOpen(true);
            }}
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border md:hidden">
            {printers.map((printer) => (
              <div key={printer.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted",
                      printer.printer_type === "network"
                        ? "text-blue-600"
                        : "text-purple-600",
                    )}
                  >
                    {printer.printer_type === "network" ? (
                      <Wifi className="h-4 w-4" />
                    ) : (
                      <Bluetooth className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{printer.name}</p>
                      {printer.is_default ? (
                        <Badge variant="secondary">Default</Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {printer.address || "Connection not specified"}
                    </p>
                  </div>
                  <Switch
                    checked={printer.enabled}
                    aria-label={`${printer.enabled ? "Disable" : "Enable"} ${printer.name}`}
                    onCheckedChange={() => handleToggleEnabled(printer)}
                  />
                </div>
                <div className="grid grid-cols-[1fr_44px_44px] gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => handleTestPrinter(printer.id)}
                    disabled={testingId === printer.id}
                  >
                    {testingId === printer.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Test connection
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label={`Edit ${printer.name}`}
                    onClick={() => {
                      setEditingPrinter(printer);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    aria-label={`Delete ${printer.name}`}
                    onClick={() => handleDeletePrinter(printer.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "hidden overflow-hidden rounded-xl border border-border md:block",
            printers.length === 0 && "md:hidden",
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border/40 hover:bg-muted/30">
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">
                  Hardware
                </TableHead>
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">
                  Connection
                </TableHead>
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id} className="border-border/40">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/5",
                          printer.printer_type === "network"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-purple-500/10 text-purple-500",
                        )}
                      >
                        {printer.printer_type === "network" ? (
                          <Wifi className="w-4 h-4" />
                        ) : (
                          <Bluetooth className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm tracking-tight">
                            {printer.name}
                          </span>
                          {printer.is_default && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-0 text-[8px] font-black h-4 px-1 p-0 uppercase tracking-widest"
                            >
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase opacity-60">
                          {printer.printer_type}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="space-y-1">
                      <code className="text-[11px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {printer.address}
                      </code>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={printer.enabled}
                        onCheckedChange={() => handleToggleEnabled(printer)}
                        className="scale-75"
                      />
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-tight",
                          printer.enabled
                            ? "text-emerald-500"
                            : "text-muted-foreground opacity-50",
                        )}
                      >
                        {printer.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-widest px-3 border-border/40 hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTestPrinter(printer.id);
                        }}
                        disabled={testingId === printer.id}
                      >
                        {testingId === printer.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-muted"
                        onClick={() => {
                          setEditingPrinter(printer);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeletePrinter(printer.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Station Routing Section */}
      <div className="space-y-3 pt-4 border-t border-border/20">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Kitchen station routing</h2>
          <p className="text-sm text-muted-foreground">
            Choose the printer used by each preparation station.
          </p>
        </div>

        {stations.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-5 w-5" />}
            title="No preparation stations"
            description="Create a station before assigning kitchen ticket printing."
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border md:hidden">
            {stations.map((station) => (
              <div key={station.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{station.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.printer_id
                        ? "Printer assigned"
                        : "Kitchen screen only"}
                    </p>
                  </div>
                </div>
                <Select
                  value={station.printer_id?.toString() || "none"}
                  onValueChange={(value) =>
                    handleUpdateStationPrinter(station.id, value)
                  }
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Select printer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No printer</SelectItem>
                    {printers
                      .filter((printer) => printer.enabled)
                      .map((printer) => (
                        <SelectItem
                          key={printer.id}
                          value={printer.id.toString()}
                        >
                          {printer.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "hidden overflow-hidden rounded-xl border border-border md:block",
            stations.length === 0 && "md:hidden",
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-b border-border/40 hover:bg-muted/30">
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 w-[250px]">
                  Preparation Station
                </TableHead>
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">
                  Assigned Printer
                </TableHead>
                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 text-right">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((station) => (
                <TableRow key={station.id} className="border-border/40">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-sm tracking-tight uppercase">
                        {station.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Select
                      value={station.printer_id?.toString() || "none"}
                      onValueChange={(val) =>
                        handleUpdateStationPrinter(station.id, val)
                      }
                    >
                      <SelectTrigger className="h-8 w-[240px] text-[11px] font-bold border-border/40 bg-background/50 uppercase">
                        <SelectValue placeholder="Select Printer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="none"
                          className="text-[11px] font-bold uppercase"
                        >
                          None (Digital Only)
                        </SelectItem>
                        {printers
                          .filter((p) => p.enabled)
                          .map((p) => (
                            <SelectItem
                              key={p.id}
                              value={p.id.toString()}
                              className="text-[11px] font-bold uppercase"
                            >
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    {station.printer_id ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-0 text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest">
                        Routed
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest opacity-40"
                      >
                        KOT Screen Only
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Receipt terminals are work locations. Users route through their
          assigned terminal; the restaurant printer remains a fallback. */}
      <div className="space-y-3 pt-4 border-t border-border/20">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold">Receipt terminals</h2>
            <p className="text-sm text-muted-foreground">
              Route each user&apos;s receipts to the printer at their work
              location.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-11"
            onClick={openNewTerminal}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add terminal
          </Button>
        </div>

        {receiptTerminals.length === 0 ? (
          <EmptyState
            icon={<Monitor className="h-5 w-5" />}
            title="No receipt terminals"
            description="Create a terminal to route receipts by user and work location."
            actionLabel="Add terminal"
            onAction={openNewTerminal}
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {receiptTerminals.map((terminal) => {
              const printer = printers.find(
                (item) => item.id === terminal.printer_id,
              );
              return (
                <button
                  key={terminal.id}
                  type="button"
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    setEditingTerminal({ ...terminal });
                    setIsTerminalDialogOpen(true);
                  }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{terminal.name}</span>
                      {!terminal.is_active ? (
                        <Badge variant="secondary">Disabled</Badge>
                      ) : null}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {printer?.display_name ||
                        printer?.name ||
                        "Printer unavailable"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {terminal.user_ids.length}
                  </span>
                  <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">Fallback receipt printer</p>
            <p className="text-xs text-muted-foreground">
              Used only when the printing user has no terminal assignment.
            </p>
          </div>
          <div className="flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">
                Default receipt output
              </span>
            </div>
            <Select
              value={receiptPrinterId?.toString() || "none"}
              onValueChange={handleUpdateReceiptPrinter}
            >
              <SelectTrigger className="h-11 w-full sm:w-[260px]">
                <SelectValue placeholder="Select printer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use the default printer</SelectItem>
                {printers
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Local Device Settings */}
      <div className="space-y-3 pt-4 border-t border-border/20">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">This device</h2>
          <p className="text-sm text-muted-foreground">
            Choose which kitchen stations automatically print from this
            computer.
          </p>
          <p className="text-xs text-muted-foreground">
            Leave every station off when this device should not automatically
            print kitchen tickets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((station) => {
            const isSelected = localDeviceStations.includes(station.name);
            return (
              <div
                key={station.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4",
                  isSelected
                    ? "border-orange-500/50 bg-orange-500/10"
                    : "border-border bg-card",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      isSelected
                        ? "bg-orange-500/20 text-orange-500"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span
                    className={cn(
                      "font-bold text-sm tracking-tight uppercase",
                      isSelected
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-foreground",
                    )}
                  >
                    {station.name}
                  </span>
                </div>
                <Switch
                  checked={isSelected}
                  aria-label={`Auto-print ${station.name} tickets on this device`}
                  onCheckedChange={() => handleToggleLocalStation(station.name)}
                  className="data-[state=checked]:bg-orange-500"
                />
              </div>
            );
          })}
          {stations.length === 0 && (
            <div className="col-span-full p-6 text-center border border-dashed rounded-xl border-border/40 text-muted-foreground text-xs uppercase tracking-widest font-bold">
              Please configure KOT stations first
            </div>
          )}
        </div>
      </div>

      {/* Dialog for Add/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              {editingPrinter?.id ? "Edit printer" : "Add printer"}
            </DialogTitle>
            <DialogDescription>
              Configure the printer connection used by this restaurant.
            </DialogDescription>
          </DialogHeader>

          <div className="-mr-4 max-h-[60vh] space-y-8 overflow-y-auto py-4 pr-4 custom-scrollbar">
            {/* Section 1: Basic Info */}
            <div className="space-y-4">
              <h2 className="text-[11px] font-black tracking-[0.2em] text-muted-foreground/70 uppercase flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Basic Information
              </h2>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-[11px] font-bold uppercase tracking-tight">
                    Printer Hardware Name
                  </Label>
                  <Input
                    placeholder="E.g. Main Kitchen Printer"
                    value={editingPrinter?.name || ""}
                    onChange={(e) =>
                      setEditingPrinter({
                        ...editingPrinter,
                        name: e.target.value,
                      })
                    }
                    className="font-bold h-11 border-border/40 uppercase"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[11px] font-bold uppercase tracking-tight">
                    Transmission Type
                  </Label>
                  <Select
                    value={editingPrinter?.printer_type}
                    onValueChange={(val: any) =>
                      setEditingPrinter({
                        ...editingPrinter,
                        printer_type: val,
                      })
                    }
                  >
                    <SelectTrigger className="h-11 font-bold border-border/40 uppercase">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="network"
                        className="font-bold uppercase"
                      >
                        Network (Ethernet/Static IP)
                      </SelectItem>
                      <SelectItem
                        value="bluetooth"
                        className="font-bold uppercase"
                      >
                        Bluetooth Connection
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Connection Configuration */}
            <div className="space-y-4 pt-4 border-t border-border/10">
              <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-500 uppercase flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5" /> Connection Configuration
              </h2>
              <div className="grid gap-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 grid gap-2">
                    <Label className="text-[11px] font-bold uppercase tracking-tight">
                      {editingPrinter?.printer_type === "network"
                        ? "IP Address"
                        : "MAC Address"}
                    </Label>
                    <Input
                      placeholder={
                        editingPrinter?.printer_type === "network"
                          ? "192.168.1.100"
                          : "AA:BB:CC:DD:EE:FF"
                      }
                      value={editingPrinter?.address || ""}
                      onChange={(e) =>
                        setEditingPrinter({
                          ...editingPrinter,
                          address: e.target.value,
                        })
                      }
                      className="font-bold font-mono h-11 border-border/40 uppercase"
                    />
                  </div>
                  {editingPrinter?.printer_type === "network" && (
                    <div className="grid gap-2">
                      <Label className="text-[11px] font-bold uppercase tracking-tight">
                        Port
                      </Label>
                      <Input
                        placeholder="9100"
                        value={
                          editingPrinter?.connection_config?.port || "9100"
                        }
                        onChange={(e) =>
                          setEditingPrinter({
                            ...editingPrinter,
                            connection_config: {
                              ...editingPrinter.connection_config,
                              port: e.target.value,
                            },
                          })
                        }
                        className="font-bold font-mono h-11 border-border/40 text-center"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Settings */}
            <div className="space-y-4 pt-4 border-t border-border/10">
              <h2 className="text-[11px] font-black tracking-[0.2em] text-emerald-500 uppercase flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" /> System Settings
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-black uppercase tracking-tight">
                      Status
                    </Label>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">
                      {editingPrinter?.enabled ? "Active" : "Disabled"}
                    </p>
                  </div>
                  <Switch
                    checked={editingPrinter?.enabled}
                    onCheckedChange={(val) =>
                      setEditingPrinter({ ...editingPrinter, enabled: val })
                    }
                    className="scale-75"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-black uppercase tracking-tight">
                      Default
                    </Label>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">
                      {editingPrinter?.is_default ? "Main" : "Global"}
                    </p>
                  </div>
                  <Switch
                    checked={editingPrinter?.is_default}
                    onCheckedChange={(val) =>
                      setEditingPrinter({ ...editingPrinter, is_default: val })
                    }
                    className="scale-75 data-[state=checked]:bg-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-black uppercase tracking-widest text-[10px] border-border/40 hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTestPrinter(editingPrinter?.id);
                }}
                disabled={testingId === (editingPrinter?.id || 0)}
              >
                {testingId === editingPrinter?.id && testingId !== null ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Test Printer Hardware Connection
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t border-border/10 pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              className="font-bold uppercase tracking-widest text-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePrinter}
              disabled={formLoading}
              className="font-black uppercase tracking-widest text-[10px] px-8 h-11 bg-primary hover:bg-primary/90"
            >
              {formLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingPrinter?.id
                ? "Update Configuration"
                : "Register Hardware"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTerminalDialogOpen}
        onOpenChange={setIsTerminalDialogOpen}
      >
        <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingTerminal?.id
                ? "Edit receipt terminal"
                : "Add receipt terminal"}
            </DialogTitle>
            <DialogDescription>
              Assign a work location, its receipt printer, and the people who
              use it.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[62dvh] space-y-5 overflow-y-auto py-2 pr-1">
            <div className="space-y-2">
              <Label htmlFor="receipt-terminal-name">Terminal name</Label>
              <Input
                id="receipt-terminal-name"
                className="h-11"
                placeholder="Main counter"
                value={editingTerminal?.name || ""}
                onChange={(event) =>
                  setEditingTerminal((current) =>
                    current
                      ? { ...current, name: event.target.value }
                      : current,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt printer</Label>
              <Select
                value={editingTerminal?.printer_id?.toString() || ""}
                onValueChange={(value) =>
                  setEditingTerminal((current) =>
                    current
                      ? { ...current, printer_id: Number(value) }
                      : current,
                  )
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers
                    .filter((printer) => printer.enabled)
                    .map((printer) => (
                      <SelectItem
                        key={printer.id}
                        value={printer.id.toString()}
                      >
                        {printer.display_name || printer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div>
                <Label>Assigned users</Label>
                <p className="text-xs text-muted-foreground">
                  Users assigned to multiple terminals choose one before
                  printing.
                </p>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {staffUsers.map((staff) => {
                  const checked =
                    editingTerminal?.user_ids.includes(staff.id) ?? false;
                  return (
                    <label
                      key={staff.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2.5"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setEditingTerminal((current) => {
                            if (!current) return current;
                            return {
                              ...current,
                              user_ids: next
                                ? [...current.user_ids, staff.id]
                                : current.user_ids.filter(
                                    (id) => id !== staff.id,
                                  ),
                            };
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{staff.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {staff.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-3 border-t border-border pt-4">
              <span>
                <span className="block text-sm font-medium">
                  Terminal active
                </span>
                <span className="block text-xs text-muted-foreground">
                  Inactive terminals cannot be selected for printing.
                </span>
              </span>
              <Switch
                checked={editingTerminal?.is_active ?? true}
                onCheckedChange={(is_active) =>
                  setEditingTerminal((current) =>
                    current ? { ...current, is_active } : current,
                  )
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTerminalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTerminal} disabled={formLoading}>
              {formLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
