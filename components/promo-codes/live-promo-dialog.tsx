"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, Tag, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LivePromoCode, CreateLivePromoInput } from "@/lib/live-promo-types";

interface LivePromoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateLivePromoInput) => Promise<{ success: boolean; error?: string }>;
  editingPromo?: LivePromoCode | null;
}

export function LivePromoDialog({
  open,
  onOpenChange,
  onSubmit,
  editingPromo,
}: LivePromoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateLivePromoInput>({
    code: "",
    type: "offer",
    benefit: "",
    discountType: "percentage",
    discountValue: 10,
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
    usageLimit: 100,
    isActive: true,
  });

  // Initialize form when dialog opens or editing changes
  useEffect(() => {
    if (editingPromo) {
      setFormData({
        code: editingPromo.code,
        type: editingPromo.type,
        benefit: editingPromo.benefit,
        discountType: editingPromo.discountType,
        discountValue: editingPromo.discountValue,
        description: editingPromo.description,
        startDate: editingPromo.startDate.split("T")[0],
        endDate: editingPromo.endDate.split("T")[0],
        usageLimit: editingPromo.usageLimit,
        isActive: editingPromo.isActive,
      });
    } else {
      setFormData({
        code: "",
        type: "offer",
        benefit: "",
        discountType: "percentage",
        discountValue: 10,
        description: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        usageLimit: 100,
        isActive: true,
      });
    }
    setError(null);
  }, [editingPromo, open]);

  const handleGenerateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await onSubmit(formData);

    if (result.success) {
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to save promo code.");
    }

    setLoading(false);
  };

  // Auto-generate benefit text
  useEffect(() => {
    if (formData.discountType === "percentage") {
      setFormData((prev) => ({
        ...prev,
        benefit: `${prev.discountValue}% OFF`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        benefit: `Rs. ${prev.discountValue} OFF`,
      }));
    }
  }, [formData.discountType, formData.discountValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPromo ? "Edit Promo Code" : "Add Promo Code"}</DialogTitle>
          <DialogDescription>
            {editingPromo
              ? "Update the promo code details below."
              : "Create a new promotional code for your customers."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Live Preview */}
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Preview
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="font-mono text-2xl font-bold tracking-wide text-primary">
                  {formData.code || "YOUR-CODE"}
                </p>
                <Badge variant="outline" className="text-xs">
                  {formData.type === "referral" ? "Referral" : "Offer"}
                </Badge>
              </div>
              <p className="text-xl font-bold text-foreground">
                {formData.benefit || "Discount"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formData.description || "No description"}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Code */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="code">Promo Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="SUMMER2024"
                  className="font-mono uppercase"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateCode}
                  className="shrink-0"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "referral" | "offer") =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Type */}
            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type *</Label>
              <Select
                value={formData.discountType}
                onValueChange={(value: "percentage" | "fixed") =>
                  setFormData((prev) => ({ ...prev, discountType: value }))
                }
              >
                <SelectTrigger id="discountType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value */}
            <div className="space-y-2">
              <Label htmlFor="discountValue">
                {formData.discountType === "percentage" ? "Percentage *" : "Amount (Rs.) *"}
              </Label>
              <Input
                id="discountValue"
                type="number"
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, discountValue: Number(e.target.value) }))
                }
                min={formData.discountType === "percentage" ? 1 : 0}
                max={formData.discountType === "percentage" ? 100 : undefined}
                step={formData.discountType === "percentage" ? 1 : 10}
                required
              />
            </div>

            {/* Usage Limit */}
            <div className="space-y-2">
              <Label htmlFor="usageLimit">Usage Limit *</Label>
              <Input
                id="usageLimit"
                type="number"
                value={formData.usageLimit}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, usageLimit: Number(e.target.value) }))
                }
                min={1}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe when and how this code can be used..."
                rows={3}
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between sm:col-span-2 p-4 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base cursor-pointer">
                  Active
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable this code immediately after creation
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="min-w-24">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingPromo ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
