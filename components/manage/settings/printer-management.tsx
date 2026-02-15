"use client";

import { useState, useEffect, useCallback } from "react";
import { 
    Printer, 
    Plus, 
    Trash2, 
    Power, 
    Settings2, 
    Wifi, 
    Bluetooth, 
    RefreshCw, 
    Check, 
    X, 
    Loader2,
    Save,
    MapPin,
    LayoutGrid,
    Info,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { PrinterApis } from "@/lib/api/endpoints";

import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Printer {
    id: number;
    name: string;
    display_name: string;
    address: string;
    printer_type: 'bluetooth' | 'network';
    connection_config: any;
    enabled: boolean;
    is_default: boolean;
}

interface StationConfigItem {
    id: string;
    name: string;
    printer_id: number | null;
}

interface StationConfig {
    stations: StationConfigItem[];
}

interface PrinterManagementProps {
    restaurantId: number;
}

export function PrinterManagement({ restaurantId }: PrinterManagementProps) {
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [stations, setStations] = useState<StationConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [testingId, setTestingId] = useState<number | null>(null);
    
    // Create/Edit Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<Partial<Printer> | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [printersRes, stationRes] = await Promise.all([
                apiClient.get(PrinterApis.list(restaurantId)),
                apiClient.get(PrinterApis.stationConfig(restaurantId))
            ]);
            
            if (printersRes.data.status === 'success') {
                setPrinters(printersRes.data.data);
            }
            if (stationRes.data.status === 'success') {
                // Handle the backend station config format (list of stations)
                setStations(stationRes.data.data.stations || []);
            }
        } catch (err) {
            toast.error("Failed to load printer settings");
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleEnabled = async (printer: Printer) => {
        try {
            const updated = { ...printer, enabled: !printer.enabled };
            await apiClient.put(PrinterApis.update(printer.id), { enabled: updated.enabled });
            setPrinters(prev => prev.map(p => p.id === printer.id ? updated : p));
            toast.success(`Printer ${updated.enabled ? 'enabled' : 'disabled'}`);
        } catch (err) {
            toast.error("Failed to update printer");
        }
    };

    const handleSetDefault = async (printer: Printer) => {
        try {
            await apiClient.put(PrinterApis.update(printer.id), { is_default: true });
            setPrinters(prev => prev.map(p => ({
                ...p,
                is_default: p.id === printer.id
            })));
            toast.success(`${printer.name} is now the default printer`);
        } catch (err) {
            toast.error("Failed to set default printer");
        }
    };

    const handleTestPrinter = async (id: number | undefined) => {
        if (!id) {
            toast.info("Please register the printer configuration before testing the hardware connection.");
            return;
        }

        try {
            setTestingId(id);
            toast.loading("Testing printer connectivity...", { id: `test-${id}` });
            const response = await apiClient.post(PrinterApis.test(id));
            toast.dismiss(`test-${id}`);
            
            if (response.data.status === 'success') {
                toast.success("Connection Successful", {
                    description: response.data.message
                });
            } else {
                toast.error("Connection Failed", {
                    description: response.data.message || "Could not reach printer."
                });
            }
        } catch (err) {
            toast.dismiss(`test-${id}`);
            toast.error("Network Error", {
                description: "Failed to communicate with printer service."
            });
        } finally {
            setTestingId(null);
        }
    };

    const handleDeletePrinter = async (id: number) => {
        if (!confirm("Are you sure you want to delete this printer?")) return;
        try {
            await apiClient.delete(PrinterApis.delete(id));
            setPrinters(prev => prev.filter(p => p.id !== id));
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
                connection_config: editingPrinter.printer_type === 'network' 
                    ? { 
                        ip_address: editingPrinter.address, 
                        port: parseInt((editingPrinter.connection_config?.port || '9100').toString()) 
                      }
                    : { 
                        mac_address: editingPrinter.address 
                      }
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

    const handleUpdateStationConfig = async (stationId: string, printerId: string) => {
        try {
            const updatedStations = stations.map(s => 
                s.id === stationId ? { ...s, printer_id: printerId === 'none' ? null : parseInt(printerId) } : s
            );
            
            // Check if it's already there or not (backend expects the whole stations list)
            const payload = { stations: updatedStations };
            
            await apiClient.put(PrinterApis.stationConfig(restaurantId), payload);
            setStations(updatedStations);
            toast.success("Station configuration updated");
        } catch (err) {
            toast.error("Failed to update station config");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-6 py-2">
            {/* Printers Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <h2 className="text-[11px] font-black tracking-[0.2em] text-muted-foreground/70 uppercase">Configured Printers</h2>
                        <p className="text-sm font-bold tracking-tight">Management for billing & KOT hardware</p>
                    </div>
                    <Button 
                        size="sm" 
                        onClick={() => {
                            setEditingPrinter({ printer_type: 'network', enabled: true, is_default: false });
                            setIsDialogOpen(true);
                        }}
                        className="font-bold uppercase tracking-widest text-[10px] h-9"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add Printer
                    </Button>
                </div>

                <div className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 border-b border-border/40 hover:bg-muted/30">
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">Hardware</TableHead>
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">Connection</TableHead>
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">Status</TableHead>
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printers.map((printer) => (
                                <TableRow key={printer.id} className="border-border/40">
                                    <TableCell className="py-2.5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/5",
                                                printer.printer_type === 'network' ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                                            )}>
                                                {printer.printer_type === 'network' ? <Wifi className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm tracking-tight">{printer.name}</span>
                                                    {printer.is_default && (
                                                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-0 text-[8px] font-black h-4 px-1 p-0 uppercase tracking-widest">Default</Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase opacity-60">{printer.printer_type}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        <div className="space-y-1">
                                            <code className="text-[11px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{printer.address}</code>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        <div className="flex items-center gap-2">
                                            <Switch 
                                                checked={printer.enabled} 
                                                onCheckedChange={() => handleToggleEnabled(printer)}
                                                className="scale-75"
                                            />
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-tight",
                                                printer.enabled ? "text-emerald-500" : "text-muted-foreground opacity-50"
                                            )}>
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
                                                {testingId === printer.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
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
                            {printers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2 opacity-30">
                                            <Printer className="w-8 h-8" />
                                            <p className="text-[11px] font-bold uppercase tracking-widest">No printers registered</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Station Routing Section */}
            <div className="space-y-3 pt-4 border-t border-border/20">
                <div className="space-y-0.5">
                    <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-500 uppercase">KOT Station Routing</h2>
                    <p className="text-sm font-bold tracking-tight">Route orders from specific stations to physical hardware</p>
                </div>

                <div className="rounded-xl border border-border/40 overflow-hidden bg-card/50">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 border-b border-border/40 hover:bg-muted/30">
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 w-[250px]">Preparation Station</TableHead>
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9">Assigned Printer</TableHead>
                                <TableHead className="text-[10px] font-black tracking-widest uppercase opacity-60 h-9 text-right">Status</TableHead>
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
                                            <span className="font-bold text-sm tracking-tight uppercase">{station.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        <Select 
                                            value={station.printer_id?.toString() || 'none'}
                                            onValueChange={(val) => handleUpdateStationConfig(station.id, val)}
                                        >
                                            <SelectTrigger className="h-8 w-[240px] text-[11px] font-bold border-border/40 bg-background/50 uppercase">
                                                <SelectValue placeholder="Select Printer" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-[11px] font-bold uppercase">None (Digital Only)</SelectItem>
                                                {printers.filter(p => p.enabled).map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()} className="text-[11px] font-bold uppercase">
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
                                            <Badge variant="outline" className="text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest opacity-40">
                                                KOT Screen Only
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {stations.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2 opacity-30">
                                            <LayoutGrid className="w-8 h-8" />
                                            <p className="text-[11px] font-bold uppercase tracking-widest">No stations configured</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Dialog for Add/Edit */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px] border-border/40 backdrop-blur-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2">
                            {editingPrinter?.id ? "Edit Printer" : "Register Printer"}
                        </DialogTitle>
                        <DialogDescription className="font-bold text-muted-foreground/80">
                            Configure hardware connection and system preferences.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-8 py-4 overflow-y-auto max-h-[60vh] pr-4 -mr-4 custom-scrollbar">
                        {/* Section 1: Basic Info */}
                        <div className="space-y-4">
                            <h2 className="text-[11px] font-black tracking-[0.2em] text-muted-foreground/70 uppercase flex items-center gap-2">
                                <Info className="w-3.5 h-3.5" /> Basic Information
                            </h2>
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-tight">Printer Hardware Name</Label>
                                    <Input 
                                        placeholder="E.g. Main Kitchen Printer" 
                                        value={editingPrinter?.name || ""}
                                        onChange={(e) => setEditingPrinter({ ...editingPrinter, name: e.target.value })}
                                        className="font-bold h-11 border-border/40 uppercase"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-tight">Transmission Type</Label>
                                    <Select 
                                        value={editingPrinter?.printer_type}
                                        onValueChange={(val: any) => setEditingPrinter({ ...editingPrinter, printer_type: val })}
                                    >
                                        <SelectTrigger className="h-11 font-bold border-border/40 uppercase">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="network" className="font-bold uppercase">Network (Ethernet/Static IP)</SelectItem>
                                            <SelectItem value="bluetooth" className="font-bold uppercase">Bluetooth Connection</SelectItem>
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
                                            {editingPrinter?.printer_type === 'network' ? 'IP Address' : 'MAC Address'}
                                        </Label>
                                        <Input 
                                            placeholder={editingPrinter?.printer_type === 'network' ? "192.168.1.100" : "AA:BB:CC:DD:EE:FF"} 
                                            value={editingPrinter?.address || ""}
                                            onChange={(e) => setEditingPrinter({ ...editingPrinter, address: e.target.value })}
                                            className="font-bold font-mono h-11 border-border/40 uppercase"
                                        />
                                    </div>
                                    {editingPrinter?.printer_type === 'network' && (
                                        <div className="grid gap-2">
                                            <Label className="text-[11px] font-bold uppercase tracking-tight">Port</Label>
                                            <Input 
                                                placeholder="9100" 
                                                value={editingPrinter?.connection_config?.port || "9100"}
                                                onChange={(e) => setEditingPrinter({ 
                                                    ...editingPrinter, 
                                                    connection_config: { ...editingPrinter.connection_config, port: e.target.value } 
                                                })}
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
                                        <Label className="text-[10px] font-black uppercase tracking-tight">Status</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{editingPrinter?.enabled ? 'Active' : 'Disabled'}</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter?.enabled} 
                                        onCheckedChange={(val) => setEditingPrinter({ ...editingPrinter, enabled: val })}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                                    <div className="space-y-0.5">
                                        <Label className="text-[10px] font-black uppercase tracking-tight">Default</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{editingPrinter?.is_default ? 'Main' : 'Global'}</p>
                                    </div>
                                    <Switch 
                                        checked={editingPrinter?.is_default} 
                                        onCheckedChange={(val) => setEditingPrinter({ ...editingPrinter, is_default: val })}
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
                                {testingId === editingPrinter?.id && testingId !== null ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
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
                            {formLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingPrinter?.id ? "Update Configuration" : "Register Hardware"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
