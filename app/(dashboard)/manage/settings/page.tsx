"use client";

import { useState, useEffect, useRef } from "react";
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
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function RestaurantSettingsPage() {
    const user = useAuth(state => state.user);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
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

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(RestaurantApis.getById(user.restaurant_id));

                if (res.data.status === "success") {
                    setRestaurant(res.data.data);
                    if (res.data.data.fonepay_config) {
                        setFonepay({
                            ...res.data.data.fonepay_config,
                            api_secret: res.data.data.fonepay_config.api_secret || ""
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user?.restaurant_id]);

    const handleFonePaySave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.restaurant_id) return;
        setSaving(true);
        try {
            await apiClient.put(RestaurantApis.updateFonePay(user.restaurant_id), fonepay);
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
                toast.success("QR removed");
            }
        } catch (err) {
            toast.error("Failed to remove QR");
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

            <Tabs defaultValue="payments" className="space-y-6">
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
                                        Enabling KOT will allow the system to generate kitchen order tickets for orders. 
                                        Make sure your printers are configured correctly.
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
                                    <Label>Enable Service Charge</Label>
                                    <p className="text-xs text-muted-foreground">Automatically add service charge to all bills.</p>
                                </div>
                                <Switch checked={true} />
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
        </div>
    );
}
