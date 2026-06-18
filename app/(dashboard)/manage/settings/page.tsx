"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import { useAuth } from "@/hooks/use-auth";
import { 
    ChevronLeft,
    Settings,
    CreditCard,
    FileText,
    Save,
    RefreshCw,
    Loader2,
    ToggleLeft,
    Printer,
    Key,
    ShieldCheck,
    QrCode,
    Banknote,
    Plus,
    Trash2,
    Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis, RestaurantApis } from "@/lib/api/endpoints";
import { useRouter, useSearchParams } from "next/navigation";
import { useRestaurant } from "@/hooks/use-restaurant";
import type { DrawerAssignment, DrawerCashier, DrawerConfiguration } from "@/types/day-close";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type DrawerConfigForm = {
    business_line: string;
    station: string;
    drawer_key: string;
    name: string;
    standard_float: string;
    opening_variance_tolerance: string;
    closing_variance_tolerance: string;
    blind_count_enabled: boolean;
    is_active: boolean;
};

const emptyDrawerForm = (): DrawerConfigForm => ({
    business_line: "restaurant",
    station: "general",
    drawer_key: "",
    name: "",
    standard_float: "0",
    opening_variance_tolerance: "0",
    closing_variance_tolerance: "100",
    blind_count_enabled: true,
    is_active: true,
});

export default function RestaurantSettingsPage() {
    const user = useAuth(state => state.user);
    const setGlobalRestaurant = useRestaurant(state => state.setRestaurant);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const initialTab = searchParams?.get("tab") || "payments";
    const [activeTab, setActiveTab] = useState(initialTab);
    
    // FonePay State
    const [fonepay, setFonepay] = useState({
        merchant_code: "",
        api_password: "",
        api_user: "",
        api_secret: "",
        is_active: false
    });

    const [restaurant, setRestaurant] = useState<any>(null);


    // Static QR Manager State
    const [qrDialog, setQrDialog] = useState<{ open: boolean; index: number | null }>({
        open: false,
        index: null
    });
    const [qrForm, setQrForm] = useState({ name: "", payload: "" });
    const qrInputRef = useRef<HTMLInputElement>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [cardDialog, setCardDialog] = useState<{ open: boolean; index: number | null }>({
        open: false,
        index: null,
    });
    const [cardForm, setCardForm] = useState({ name: "", identifier: "" });
    const [drawerConfigs, setDrawerConfigs] = useState<DrawerConfiguration[]>([]);
    const [drawerAssignments, setDrawerAssignments] = useState<DrawerAssignment[]>([]);
    const [drawerCashiers, setDrawerCashiers] = useState<DrawerCashier[]>([]);
    const [drawerAssignSelection, setDrawerAssignSelection] = useState<Record<string, string>>({});
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [drawerDialog, setDrawerDialog] = useState<{ open: boolean; id: number | null }>({
        open: false,
        id: null,
    });
    const [drawerForm, setDrawerForm] = useState<DrawerConfigForm>(() => emptyDrawerForm());

    const canManageDrawers =
        user?.role === "admin" ||
        user?.role === "superadmin" ||
        user?.permissions?.includes("day_close.drawer.approve") ||
        user?.permissions?.includes("finance.accounting.setup");

    const loadDrawerConfigurations = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setDrawerLoading(true);
        try {
            const [configRes, assignmentRes, cashierRes] = await Promise.all([
                apiClient.get(DrawerSessionApis.configurations({
                    restaurantId: user.restaurant_id,
                    businessLine: "restaurant",
                })),
                apiClient.get(DrawerSessionApis.assignments({
                    restaurantId: user.restaurant_id,
                    businessLine: "restaurant",
                })),
                apiClient.get(DrawerSessionApis.cashiers({ restaurantId: user.restaurant_id })),
            ]);
            setDrawerConfigs(Array.isArray(configRes.data?.data) ? configRes.data.data : []);
            setDrawerAssignments(Array.isArray(assignmentRes.data?.data) ? assignmentRes.data.data : []);
            setDrawerCashiers(Array.isArray(cashierRes.data?.data) ? cashierRes.data.data : []);
        } catch (err: any) {
            const status = err?.response?.status;
            if (status !== 403) {
                toast.error("Failed to load cash drawers");
            }
            setDrawerConfigs([]);
            setDrawerAssignments([]);
            setDrawerCashiers([]);
        } finally {
            setDrawerLoading(false);
        }
    }, [user?.restaurant_id]);

    const drawerScopeKey = (station: string, drawerKey: string) => `${station}::${drawerKey}`;

    const activeAssignmentsForDrawer = (drawer: DrawerConfiguration) =>
        drawerAssignments.filter(
            (assignment) =>
                assignment.is_active &&
                assignment.station === drawer.station &&
                assignment.drawer_key === drawer.drawer_key,
        );

    const cashierLabel = (cashierId: number) => {
        const cashier = drawerCashiers.find((row) => Number(row.id) === Number(cashierId));
        return cashier ? `${cashier.name} (${cashier.email})` : `User #${cashierId}`;
    };

    function openDrawerDialog(config?: DrawerConfiguration) {
        if (!config) {
            setDrawerForm(emptyDrawerForm());
            setDrawerDialog({ open: true, id: null });
            return;
        }
        setDrawerForm({
            business_line: String(config.business_line || "restaurant"),
            station: String(config.station || "general"),
            drawer_key: String(config.drawer_key || ""),
            name: String(config.name || ""),
            standard_float: String(config.standard_float ?? 0),
            opening_variance_tolerance: String(config.opening_variance_tolerance ?? 0),
            closing_variance_tolerance: String(config.closing_variance_tolerance ?? 100),
            blind_count_enabled: config.blind_count_enabled !== false,
            is_active: config.is_active !== false,
        });
        setDrawerDialog({ open: true, id: config.id });
    }

    const handleDrawerSave = async () => {
        if (!user?.restaurant_id) return;
        const station = drawerForm.station.trim().toLowerCase();
        const drawerKey = drawerForm.drawer_key.trim().toLowerCase();
        const name = drawerForm.name.trim();
        if (!station || !drawerKey || !name) {
            toast.error("Drawer name, station, and key are required");
            return;
        }

        try {
            setSaving(true);
            await apiClient.put(DrawerSessionApis.saveConfiguration, {
                restaurant_id: user.restaurant_id,
                business_line: drawerForm.business_line,
                station,
                drawer_key: drawerKey,
                name,
                standard_float: Number(drawerForm.standard_float || 0),
                opening_variance_tolerance: Number(drawerForm.opening_variance_tolerance || 0),
                closing_variance_tolerance: Number(drawerForm.closing_variance_tolerance || 0),
                blind_count_enabled: drawerForm.blind_count_enabled,
                is_active: drawerForm.is_active,
            });
            toast.success("Cash drawer saved");
            setDrawerDialog({ open: false, id: null });
            setDrawerForm(emptyDrawerForm());
            await loadDrawerConfigurations();
        } catch (err) {
            console.error("Failed to save cash drawer", err);
            toast.error("Failed to save cash drawer");
        } finally {
            setSaving(false);
        }
    };

    const handleDrawerDeactivate = async (config: DrawerConfiguration) => {
        if (!user?.restaurant_id) return;
        try {
            setSaving(true);
            await apiClient.put(DrawerSessionApis.saveConfiguration, {
                restaurant_id: user.restaurant_id,
                business_line: config.business_line || "restaurant",
                station: config.station,
                drawer_key: config.drawer_key,
                name: config.name,
                standard_float: Number(config.standard_float ?? 0),
                opening_variance_tolerance: Number(config.opening_variance_tolerance ?? 0),
                closing_variance_tolerance: Number(config.closing_variance_tolerance ?? 0),
                blind_count_enabled: config.blind_count_enabled !== false,
                is_active: false,
            });
            toast.success("Cash drawer deactivated");
            await loadDrawerConfigurations();
        } catch (err) {
            console.error("Failed to deactivate cash drawer", err);
            toast.error("Failed to deactivate cash drawer");
        } finally {
            setSaving(false);
        }
    };

    const handleAssignCashier = async (drawer: DrawerConfiguration) => {
        if (!user?.restaurant_id) return;
        const key = drawerScopeKey(drawer.station, drawer.drawer_key);
        const cashierId = Number(drawerAssignSelection[key]);
        if (!cashierId) {
            toast.error("Select a cashier first");
            return;
        }
        try {
            setSaving(true);
            await apiClient.put(DrawerSessionApis.saveAssignment, {
                restaurant_id: user.restaurant_id,
                business_line: drawer.business_line || "restaurant",
                station: drawer.station,
                drawer_key: drawer.drawer_key,
                cashier_id: cashierId,
                is_active: true,
            });
            toast.success("Cashier assigned to drawer");
            setDrawerAssignSelection((current) => ({ ...current, [key]: "" }));
            await loadDrawerConfigurations();
        } catch (err) {
            console.error("Failed to assign cashier", err);
            toast.error("Failed to assign cashier");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveDrawerAssignment = async (assignment: DrawerAssignment) => {
        if (!user?.restaurant_id) return;
        try {
            setSaving(true);
            await apiClient.put(DrawerSessionApis.saveAssignment, {
                restaurant_id: user.restaurant_id,
                business_line: assignment.business_line || "restaurant",
                station: assignment.station,
                drawer_key: assignment.drawer_key,
                cashier_id: assignment.cashier_id,
                is_active: false,
            });
            toast.success("Cashier assignment removed");
            await loadDrawerConfigurations();
        } catch (err) {
            console.error("Failed to remove cashier assignment", err);
            toast.error("Failed to remove cashier assignment");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(RestaurantApis.getById(user.restaurant_id));

                if (res.data.status === "success") {
                    setRestaurant(res.data.data);
                    setGlobalRestaurant(res.data.data);
                    if (res.data.data.fonepay_config) {
                        setFonepay({
                            ...res.data.data.fonepay_config,
                            api_secret: res.data.data.fonepay_config.api_secret || ""
                        });
                    }
                }
                if (canManageDrawers) {
                    await loadDrawerConfigurations();
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.restaurant_id, canManageDrawers, loadDrawerConfigurations, setGlobalRestaurant]);

    useEffect(() => {
        const tabParam = searchParams?.get("tab");
        if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const handleFonePaySave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.restaurant_id) return;
        setSaving(true);
        try {
            await apiClient.put(RestaurantApis.updateFonepay(user.restaurant_id), fonepay);
            toast.success("Payment configuration updated");
        } catch (err) {
            toast.error("Failed to update payment settings");
        } finally {
            setSaving(false);
        }
    };


    const handleQrSave = async () => {
        if (!user?.restaurant_id || !qrForm.name || !qrForm.payload) return;
        
        const currentQrs = restaurant?.payment_qrs ? [...restaurant.payment_qrs] : [];
        if (qrDialog.index !== null) {
            currentQrs[qrDialog.index] = qrForm;
        } else {
            if (currentQrs.length >= 4) {
                toast.error("Maximum 4 QRs allowed");
                return;
            }
            currentQrs.push(qrForm);
        }

        try {
            setSaving(true);
            const res = await apiClient.put(RestaurantApis.update(user.restaurant_id), {
                payment_qrs: currentQrs
            });
            if (res.data.status === "success") {
                setRestaurant(res.data.data);
                setGlobalRestaurant(res.data.data);
                toast.success("QR configurations updated");
                setQrDialog({ open: false, index: null });
                setQrForm({ name: "", payload: "" });
            }
        } catch (err) {
            toast.error("Failed to update QR configurations");
        } finally {
            setSaving(false);
        }
    };

    const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageData = event.target?.result as string;
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) return;

                canvas.width = image.width;
                canvas.height = image.height;
                context.drawImage(image, 0, 0, image.width, image.height);

                const data = context.getImageData(0, 0, image.width, image.height);
                const code = jsQR(data.data, data.width, data.height);

                if (code) {
                    setQrForm(prev => ({ ...prev, payload: code.data }));
                    toast.success("QR data extracted successfully");
                } else {
                    toast.error("No QR code found in the image");
                }
                setIsExtracting(false);
            };
            image.src = imageData;
        };
        reader.readAsDataURL(file);
        // Clear input so same file can be uploaded again
        e.target.value = "";
    };

    const handleQrDelete = async (index: number) => {
        if (!user?.restaurant_id || !restaurant?.payment_qrs) return;
        
        const currentQrs = [...restaurant.payment_qrs];
        currentQrs.splice(index, 1);

        try {
            setSaving(true);
            const res = await apiClient.put(RestaurantApis.update(user.restaurant_id), {
                payment_qrs: currentQrs
            });
            if (res.data.status === "success") {
                setRestaurant(res.data.data);
                setGlobalRestaurant(res.data.data);
                toast.success("QR removed");
            }
        } catch (err) {
            toast.error("Failed to remove QR");
        } finally {
            setSaving(false);
        }
    };

    const handleCardSave = async () => {
        if (!user?.restaurant_id || !cardForm.name.trim()) return;

        const currentCards = Array.isArray(restaurant?.payment_cards)
            ? [...restaurant.payment_cards]
            : [];
        const payloadCard = {
            name: cardForm.name.trim(),
            identifier: cardForm.identifier.trim() || null,
        };

        if (cardDialog.index !== null) {
            currentCards[cardDialog.index] = payloadCard;
        } else {
            if (currentCards.length >= 20) {
                toast.error("Maximum 20 cards allowed");
                return;
            }
            currentCards.push(payloadCard);
        }

        try {
            setSaving(true);
            const res = await apiClient.put(RestaurantApis.update(user.restaurant_id), {
                payment_cards: currentCards,
            });
            if (res.data.status === "success") {
                setRestaurant(res.data.data);
                setGlobalRestaurant(res.data.data);
                toast.success("Card configurations updated");
                setCardDialog({ open: false, index: null });
                setCardForm({ name: "", identifier: "" });
            }
        } catch (err) {
            toast.error("Failed to update card configurations");
        } finally {
            setSaving(false);
        }
    };

    const handleCardDelete = async (index: number) => {
        if (!user?.restaurant_id || !Array.isArray(restaurant?.payment_cards)) return;

        const currentCards = [...restaurant.payment_cards];
        currentCards.splice(index, 1);

        try {
            setSaving(true);
            const res = await apiClient.put(RestaurantApis.update(user.restaurant_id), {
                payment_cards: currentCards,
            });
            if (res.data.status === "success") {
                setRestaurant(res.data.data);
                setGlobalRestaurant(res.data.data);
                toast.success("Card removed");
            }
        } catch (err) {
            toast.error("Failed to remove card");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-[1000px] mx-auto pb-24">
            {/* Header */}
            <div className="space-y-1">
                <button 
                    onClick={() => router.push('/manage')}
                    className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Manage
                </button>
                <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                <p className="text-muted-foreground text-sm">
                    Configure API integrations, operational behavior, and document templates.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="payments" className="gap-2">
                        <CreditCard className="w-4 h-4" />
                        Payments & POS
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Advanced
                    </TabsTrigger>
                </TabsList>

                {/* Payments Content */}
                <TabsContent value="payments" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-orange-600" />
                                FonePay Integration
                            </CardTitle>
                            <CardDescription>
                                Set up automated QR payments for your POS.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleFonePaySave} className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100 mb-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-orange-900 font-semibold">Enable FonePay Payments</Label>
                                        <p className="text-xs text-orange-700/70">Allow customers to pay via QR at checkout.</p>
                                    </div>
                                    <Switch 
                                        checked={fonepay.is_active} 
                                        onCheckedChange={(val) => setFonepay({...fonepay, is_active: val})}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Merchant Code (PID)</Label>
                                        <Input 
                                            value={fonepay.merchant_code} 
                                            onChange={(e) => setFonepay({...fonepay, merchant_code: e.target.value})}
                                            placeholder="Provided by FonePay"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API User</Label>
                                        <Input 
                                            value={fonepay.api_user} 
                                            onChange={(e) => setFonepay({...fonepay, api_user: e.target.value})}
                                            placeholder="FonePay Username"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API Secret</Label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input 
                                                type="password"
                                                className="pl-9"
                                                value={fonepay.api_secret} 
                                                onChange={(e) => setFonepay({...fonepay, api_secret: e.target.value})}
                                                placeholder="••••••••••••"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>API Password</Label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input 
                                                type="password"
                                                className="pl-9"
                                                value={fonepay.api_password} 
                                                onChange={(e) => setFonepay({...fonepay, api_password: e.target.value})}
                                                placeholder="••••••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={saving}>
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Configuration
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <QrCode className="w-5 h-5 text-primary" />
                                    Static QR Manager
                                </CardTitle>
                                <CardDescription>
                                    Add your static merchant QRs for manual scanning. (Max 4)
                                </CardDescription>
                            </div>
                            <Button 
                                size="sm" 
                                className="h-8"
                                disabled={restaurant?.payment_qrs?.length >= 4}
                                onClick={() => {
                                    setQrForm({ name: "", payload: "" });
                                    setQrDialog({ open: true, index: null });
                                }}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add QR
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {!restaurant?.payment_qrs?.length ? (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                    <QrCode className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-muted-foreground">No static QRs configured.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {restaurant.payment_qrs.map((qr: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                                                    <QrCode className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{qr.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{qr.payload}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-primary"
                                                    onClick={() => {
                                                        setQrForm(qr);
                                                        setQrDialog({ open: true, index: idx });
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleQrDelete(idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-primary" />
                                    Card Accounts Manager
                                </CardTitle>
                                <CardDescription>
                                    Add your card accounts/terminals to record exactly which card received payment.
                                </CardDescription>
                            </div>
                            <Button
                                size="sm"
                                className="h-8"
                                disabled={(restaurant?.payment_cards?.length || 0) >= 20}
                                onClick={() => {
                                    setCardForm({ name: "", identifier: "" });
                                    setCardDialog({ open: true, index: null });
                                }}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Card
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {!restaurant?.payment_cards?.length ? (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-muted-foreground">No card accounts configured.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {restaurant.payment_cards.map((card: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                                                    <CreditCard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{card.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                                        {card.identifier || "No identifier"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary"
                                                    onClick={() => {
                                                        setCardForm({
                                                            name: String(card?.name || ""),
                                                            identifier: String(card?.identifier || ""),
                                                        });
                                                        setCardDialog({ open: true, index: idx });
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleCardDelete(idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <Banknote className="w-5 h-5 text-emerald-600" />
                                    Cash Drawers
                                </CardTitle>
                                <CardDescription>
                                    Add drawer stations used by cashiers. Keep standard float at 0 for flexible daily opening cash.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => loadDrawerConfigurations()}
                                    disabled={drawerLoading || !canManageDrawers}
                                >
                                    {drawerLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                                    Refresh
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!canManageDrawers}
                                    onClick={() => openDrawerDialog()}
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Drawer
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!canManageDrawers ? (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                                    You need drawer approval or accounting setup permission to manage cash drawers.
                                </div>
                            ) : drawerLoading ? (
                                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading cash drawers...
                                </div>
                            ) : drawerConfigs.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                    <Banknote className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-muted-foreground">No cash drawers configured.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {drawerConfigs.map((drawer) => {
                                        const key = drawerScopeKey(drawer.station, drawer.drawer_key);
                                        const assignments = activeAssignmentsForDrawer(drawer);
                                        const selectedCashier = drawerAssignSelection[key] || "";
                                        return (
                                        <div key={drawer.id} className="space-y-3 p-3 border rounded-lg bg-muted/30 group">
                                            <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-semibold">{drawer.name}</p>
                                                    <Badge variant={drawer.is_active ? "default" : "secondary"} className="text-[10px]">
                                                        {drawer.is_active ? "Active" : "Inactive"}
                                                    </Badge>
                                                    {Number(drawer.standard_float || 0) === 0 && Number(drawer.opening_variance_tolerance || 0) === 0 ? (
                                                        <Badge variant="secondary" className="text-[10px]">Flexible opening</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px]">Fixed float</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {drawer.station} / {drawer.drawer_key}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Float {drawer.standard_float} · Open tol. {drawer.opening_variance_tolerance} · Close tol. {drawer.closing_variance_tolerance}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {drawer.blind_count_enabled ? "Blind closing count enabled" : "Expected closing shown to cashier"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-primary"
                                                    onClick={() => openDrawerDialog(drawer)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                {drawer.is_active ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        disabled={saving}
                                                        onClick={() => handleDrawerDeactivate(drawer)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                            <div className="space-y-2 rounded-md border bg-background/70 p-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {assignments.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            No cashier assigned. Any cashier with drawer permission can open this drawer.
                                                        </span>
                                                    ) : (
                                                        assignments.map((assignment) => (
                                                            <Badge key={assignment.id} variant="secondary" className="gap-1 pr-1">
                                                                {cashierLabel(assignment.cashier_id)}
                                                                <button
                                                                    type="button"
                                                                    className="ml-1 rounded px-1 text-muted-foreground hover:text-destructive"
                                                                    disabled={saving}
                                                                    onClick={() => handleRemoveDrawerAssignment(assignment)}
                                                                    aria-label="Remove cashier assignment"
                                                                >
                                                                    x
                                                                </button>
                                                            </Badge>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Select
                                                        value={selectedCashier}
                                                        onValueChange={(value) =>
                                                            setDrawerAssignSelection((current) => ({ ...current, [key]: value }))
                                                        }
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue placeholder="Assign cashier" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {drawerCashiers.map((cashier) => (
                                                                <SelectItem key={cashier.id} value={String(cashier.id)}>
                                                                    {cashier.name} ({cashier.email})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9"
                                                        disabled={saving || !selectedCashier}
                                                        onClick={() => handleAssignCashier(drawer)}
                                                    >
                                                        Assign
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* Advanced Content */}
                <TabsContent value="advanced">
                    <Card>
                        <CardHeader>
                            <CardTitle>Global Operational Settings</CardTitle>
                            <CardDescription>Critical flags that change POS behavior.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50 border-blue-100">
                                <div className="space-y-0.5">
                                    <Label className="flex items-center gap-2">
                                        Enable Kitchen Order Ticket (KOT)
                                        <Badge variant="secondary" className="text-[10px] h-4">Recommended</Badge>
                                    </Label>
                                    <p className="text-xs text-muted-foreground mr-8">
                                        When disabled, KOTs will be auto-printed instead of shown digitally.
                                        Kitchen screen will be hidden for all staff.
                                    </p>
                                </div>
                                <Switch 
                                    checked={restaurant?.kot_enabled ?? true} 
                                    onCheckedChange={async (val) => {
                                        if (!user?.restaurant_id) return;
                                        try {
                                            const updated = { ...restaurant, kot_enabled: val };
                                            setRestaurant(updated);
                                            await apiClient.put(RestaurantApis.update(user.restaurant_id), { kot_enabled: val });
                                            toast.success(`KOT ${val ? 'enabled' : 'disabled'}`);
                                        } catch (err) {
                                            toast.error("Failed to update KOT status");
                                            setRestaurant({...restaurant}); // revert
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Enable Tax (VAT)</Label>
                                    <p className="text-xs text-muted-foreground mr-8">Enable or disable global tax calculation for all orders.</p>
                                </div>
                                <Switch 
                                    checked={restaurant?.tax_enabled ?? false} 
                                    onCheckedChange={async (val) => {
                                        if (!user?.restaurant_id) return;
                                        try {
                                            const updated = { ...restaurant, tax_enabled: val };
                                            setRestaurant(updated);
                                            await apiClient.put(RestaurantApis.update(user.restaurant_id), { tax_enabled: val });
                                            toast.success(`Tax calculation ${val ? 'enabled' : 'disabled'}`);
                                        } catch (err) {
                                            toast.error("Failed to update tax status");
                                            setRestaurant({...restaurant}); // revert
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                                <div className="space-y-0.5">
                                    <Label>Enable Service Charge</Label>
                                    <p className="text-xs text-muted-foreground italic">Restricted: Service charges are not recommended.</p>
                                </div>
                                <Switch checked={false} disabled />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>Strict Inventory Mode</Label>
                                    <p className="text-xs text-muted-foreground">Prevent sales if stock is zero.</p>
                                </div>
                                <Switch checked={false} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={drawerDialog.open} onOpenChange={(open) => setDrawerDialog({ ...drawerDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{drawerDialog.id !== null ? "Edit Cash Drawer" : "Add Cash Drawer"}</DialogTitle>
                        <DialogDescription>
                            Use one drawer per physical cash till or cashier station. Set standard float to 0 for flexible daily opening cash.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Drawer Name</Label>
                                <Input
                                    value={drawerForm.name}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, name: e.target.value })}
                                    placeholder="e.g. Front Counter Drawer"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Station</Label>
                                <Input
                                    value={drawerForm.station}
                                    disabled={drawerDialog.id !== null}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, station: e.target.value })}
                                    placeholder="e.g. front-counter"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Drawer Key</Label>
                                <Input
                                    value={drawerForm.drawer_key}
                                    disabled={drawerDialog.id !== null}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, drawer_key: e.target.value })}
                                    placeholder="e.g. drawer-1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Standard Float</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={drawerForm.standard_float}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, standard_float: e.target.value })}
                                    placeholder="0.00"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Use 0 for flexible opening cash.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Opening Variance Tolerance</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={drawerForm.opening_variance_tolerance}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, opening_variance_tolerance: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Closing Variance Tolerance</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={drawerForm.closing_variance_tolerance}
                                    onChange={(e) => setDrawerForm({ ...drawerForm, closing_variance_tolerance: e.target.value })}
                                    placeholder="100.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label>Blind Closing Count</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Hide expected closing cash while cashier counts the drawer.
                                    </p>
                                </div>
                                <Switch
                                    checked={drawerForm.blind_count_enabled}
                                    onCheckedChange={(val) => setDrawerForm({ ...drawerForm, blind_count_enabled: val })}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label>Active</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive drawers cannot be selected for new sessions.
                                    </p>
                                </div>
                                <Switch
                                    checked={drawerForm.is_active}
                                    onCheckedChange={(val) => setDrawerForm({ ...drawerForm, is_active: val })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDrawerDialog({ open: false, id: null })}>Cancel</Button>
                        <Button
                            onClick={handleDrawerSave}
                            disabled={saving || !drawerForm.name.trim() || !drawerForm.station.trim() || !drawerForm.drawer_key.trim()}
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Save Drawer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QR Dialog */}
            <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog({ ...qrDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{qrDialog.index !== null ? "Edit QR Configuration" : "Add New static QR"}</DialogTitle>
                        <DialogDescription>
                            Enter the display name and actual text-payload for the merchant QR.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input 
                                value={qrForm.name}
                                onChange={(e) => setQrForm({ ...qrForm, name: e.target.value })}
                                placeholder="e.g. NIC Asia POS, FonePay QR..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>QR Payload (Text/URL)</Label>
                            <div className="flex gap-2 mb-2">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    className="w-full text-xs h-8"
                                    onClick={() => qrInputRef.current?.click()}
                                    disabled={isExtracting}
                                >
                                    {isExtracting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <QrCode className="w-3 h-3 mr-2" />}
                                    Upload QR Image
                                </Button>
                                <input 
                                    type="file" 
                                    ref={qrInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleQrImageUpload}
                                />
                            </div>
                            <Textarea 
                                value={qrForm.payload}
                                onChange={(e) => setQrForm({ ...qrForm, payload: e.target.value })}
                                placeholder="Paste the text encoded in your merchant QR here"
                                className="min-h-[100px] font-mono text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQrDialog({ open: false, index: null })}>Cancel</Button>
                        <Button onClick={handleQrSave} disabled={saving || !qrForm.name || !qrForm.payload}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {qrDialog.index !== null ? "Update QR" : "Save QR"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cardDialog.open} onOpenChange={(open) => setCardDialog({ ...cardDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{cardDialog.index !== null ? "Edit Card Configuration" : "Add New Card Configuration"}</DialogTitle>
                        <DialogDescription>
                            Set a clear card name and optional identifier (e.g., last 4 digits or terminal code).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Card Name</Label>
                            <Input
                                value={cardForm.name}
                                onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                                placeholder="e.g. Nabil Visa Terminal, NIC Debit POS"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Identifier (Optional)</Label>
                            <Input
                                value={cardForm.identifier}
                                onChange={(e) => setCardForm({ ...cardForm, identifier: e.target.value })}
                                placeholder="e.g. **** 4921 / Terminal-02"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCardDialog({ open: false, index: null })}>Cancel</Button>
                        <Button onClick={handleCardSave} disabled={saving || !cardForm.name.trim()}>
                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {cardDialog.index !== null ? "Update Card" : "Save Card"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
