"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { TaxConfigApis } from "@/lib/api/endpoints";
import { Loader2, Percent } from "lucide-react";

interface TaxDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tax?: any;
    onSuccess: () => void;
    restaurantId: number;
}

export function TaxDialog({ open, onOpenChange, tax, onSuccess, restaurantId }: TaxDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        percentage: "",
        is_active: true,
        is_service_charge: false,
    });

    useEffect(() => {
        if (tax) {
            setFormData({
                name: tax.name || "",
                percentage: tax.percentage?.toString() || "",
                is_active: tax.is_active ?? true,
                is_service_charge: tax.is_service_charge ?? false,
            });
        } else {
            setFormData({
                name: "",
                percentage: "",
                is_active: true,
                is_service_charge: false,
            });
        }
    }, [tax, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                percentage: parseFloat(formData.percentage),
                restaurant_id: restaurantId,
            };

            if (tax) {
                await apiClient.patch(TaxConfigApis.update(tax.id), payload);
                toast.success("Tax configuration updated");
            } else {
                await apiClient.post(TaxConfigApis.create, payload);
                toast.success("Tax added successfully");
            }
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Failed to save tax");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{tax ? "Edit Tax/Fee" : "Add New Tax/Fee"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tax Name</Label>
                        <Input 
                            id="name" 
                            value={formData.name} 
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                            placeholder="e.g. VAT, Service Charge"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="percentage">Percentage (%)</Label>
                        <div className="relative">
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                id="percentage" 
                                type="number"
                                step="0.01"
                                value={formData.percentage} 
                                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} 
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                            <Label>Is Service Charge?</Label>
                            <p className="text-[10px] text-muted-foreground">Applies before VAT calculation.</p>
                        </div>
                        <Switch 
                            checked={formData.is_service_charge} 
                            onCheckedChange={(val) => setFormData({...formData, is_service_charge: val})}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-0.5">
                            <Label>Active Status</Label>
                            <p className="text-[10px] text-muted-foreground">Inactive taxes won't apply to new orders.</p>
                        </div>
                        <Switch 
                            checked={formData.is_active} 
                            onCheckedChange={(val) => setFormData({...formData, is_active: val})}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (tax ? "Update" : "Add Tax")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
