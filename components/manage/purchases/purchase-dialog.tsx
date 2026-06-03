"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { GeneralPurchaseApis, SupplierApis } from "@/lib/api/endpoints";
import { Loader2 } from "lucide-react";

interface PurchaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchase?: any;
    onSuccess: () => void;
}

const STATUS_OPTIONS = [
    { label: "Draft", value: "draft" },
    { label: "Received", value: "received" },
];

const PAYMENT_STATUS_OPTIONS = [
    { label: "Unpaid", value: "unpaid" },
    { label: "Paid", value: "paid" },
];

export function PurchaseDialog({ open, onOpenChange, purchase, onSuccess }: PurchaseDialogProps) {
    const user = useAuth(state => state.user);
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        purchase_name: "",
        unit: "",
        total_cost: "",
        supplier_id: "",
        payment_status: "unpaid",
        status: "draft",
        notes: "",
        purchased_date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        const fetchSuppliers = async () => {
            if (!user?.restaurant_id) return;
            try {
                const res = await apiClient.get(SupplierApis.listSuppliers(user.restaurant_id, true));
                if (res.data.status === "success") {
                    setSuppliers(res.data.data.suppliers);
                }
            } catch (err) {
                console.error("Failed to load suppliers", err);
            }
        };

        if (open) {
            fetchSuppliers();
            if (purchase) {
                setFormData({
                    purchase_name: purchase.purchase_name || "",
                    unit: purchase.unit || "",
                    total_cost: purchase.total_cost?.toString() || "",
                    supplier_id: purchase.supplier_id?.toString() || "",
                    payment_status: purchase.payment_status || "unpaid",
                    status: purchase.status || "draft",
                    notes: purchase.notes || "",
                    purchased_date: purchase.purchased_date ? new Date(purchase.purchased_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                });
            } else {
                setFormData({
                    purchase_name: "",
                    unit: "",
                    total_cost: "",
                    supplier_id: "",
                    payment_status: "unpaid",
                    status: "draft",
                    notes: "",
                    purchased_date: new Date().toISOString().split('T')[0],
                });
            }
        }
    }, [purchase, open, user?.restaurant_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.restaurant_id) return;

        setLoading(true);
        try {
            const payload = {
                ...formData,
                restaurant_id: user.restaurant_id,
                total_cost: parseFloat(formData.total_cost),
                supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
                purchased_date: formData.purchased_date + "T00:00:00Z"
            };

            if (purchase) {
                const res = await apiClient.patch(
                    GeneralPurchaseApis.update(purchase.id), 
                    payload
                );
                if (res.data.status === "success") {
                    toast.success("Purchase updated successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            } else {
                const res = await apiClient.post(GeneralPurchaseApis.create, payload);
                if (res.data.status === "success") {
                    toast.success("Purchase recorded successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            }
        } catch (error: any) {
            console.error("Failed to save purchase:", error);
            toast.error(error.response?.data?.detail || "Failed to save purchase");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{purchase ? "Edit Purchase" : "New General Purchase"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="purchase_name">Item/Service Name*</Label>
                        <Input 
                            id="purchase_name" 
                            value={formData.purchase_name} 
                            onChange={(e) => setFormData({ ...formData, purchase_name: e.target.value })} 
                            placeholder="e.g. New Blender, Rent, Repairs"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="total_cost">Total Cost*</Label>
                            <Input 
                                id="total_cost" 
                                type="number"
                                step="0.01"
                                value={formData.total_cost} 
                                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })} 
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">Unit (Optional)</Label>
                            <Input 
                                id="unit" 
                                value={formData.unit} 
                                onChange={(e) => setFormData({ ...formData, unit: e.target.value })} 
                                placeholder="e.g. 2 pieces, 1 month"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="purchased_date">Date</Label>
                            <Input 
                                id="purchased_date" 
                                type="date"
                                value={formData.purchased_date} 
                                onChange={(e) => setFormData({ ...formData, purchased_date: e.target.value })} 
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supplier_id">Supplier</Label>
                            <Select 
                                value={formData.supplier_id} 
                                onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="payment_status">Payment Status</Label>
                            <Select 
                                value={formData.payment_status} 
                                onValueChange={(val) => setFormData({ ...formData, payment_status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Purchase Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => setFormData({ ...formData, status: val })}
                                disabled={purchase && purchase.status !== 'draft'}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea 
                            id="notes" 
                            value={formData.notes} 
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                            placeholder="Reason for purchase, warranty info, etc."
                            rows={2}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-[100px]">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (purchase ? "Update" : "Record Purchase")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
