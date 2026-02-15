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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { SupplierApis } from "@/lib/api/endpoints";
import { Loader2 } from "lucide-react";

interface SupplierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplier?: any;
    onSuccess: () => void;
}

export function SupplierDialog({ open, onOpenChange, supplier, onSuccess }: SupplierDialogProps) {
    const user = useAuth(state => state.user);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        contact_name: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
        is_active: true,
    });

    useEffect(() => {
        if (supplier) {
            setFormData({
                name: supplier.name || "",
                contact_name: supplier.contact_name || "",
                phone: supplier.phone || "",
                email: supplier.email || "",
                address: supplier.address || "",
                notes: supplier.notes || "",
                is_active: supplier.is_active ?? true,
            });
        } else {
            setFormData({
                name: "",
                contact_name: "",
                phone: "",
                email: "",
                address: "",
                notes: "",
                is_active: true,
            });
        }
    }, [supplier, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.restaurant_id) return;

        setLoading(true);
        try {
            if (supplier) {
                const res = await apiClient.patch(
                    SupplierApis.updateSupplier(supplier.id, user.restaurant_id), 
                    formData
                );
                if (res.data.status === "success") {
                    toast.success("Supplier updated successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            } else {
                const res = await apiClient.post(SupplierApis.createSupplier, {
                    ...formData,
                    restaurant_id: user.restaurant_id,
                });
                if (res.data.status === "success") {
                    toast.success("Supplier created successfully");
                    onSuccess();
                    onOpenChange(false);
                }
            }
        } catch (error: any) {
            console.error("Failed to save supplier:", error);
            toast.error(error.response?.data?.detail || "Failed to save supplier");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{supplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Supplier Name*</Label>
                            <Input 
                                id="name" 
                                value={formData.name} 
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                placeholder="e.g. Acme Veggies"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_name">Contact Person</Label>
                            <Input 
                                id="contact_name" 
                                value={formData.contact_name} 
                                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} 
                                placeholder="Contact Name"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input 
                                id="phone" 
                                value={formData.phone} 
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                                placeholder="98XXXXXXXX"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input 
                                id="email" 
                                type="email"
                                value={formData.email} 
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                                placeholder="vendor@example.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input 
                            id="address" 
                            value={formData.address} 
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                            placeholder="Supplier location"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea 
                            id="notes" 
                            value={formData.notes} 
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                            placeholder="Bank details, delivery schedules, etc."
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 pt-2">
                        <Label htmlFor="is_active" className="flex flex-col space-y-1">
                            <span>Active Status</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Inactive suppliers won't appear in purchase forms.
                            </span>
                        </Label>
                        <Switch 
                            id="is_active" 
                            checked={formData.is_active} 
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-[100px]">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (supplier ? "Update" : "Create")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
