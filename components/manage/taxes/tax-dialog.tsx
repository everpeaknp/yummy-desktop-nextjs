"use client";

import { useEffect, useState } from "react";
import { Loader2, Percent } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import apiClient from "@/lib/api-client";
import { TaxConfigApis } from "@/lib/api/endpoints";

export type TaxConfiguration = {
  id: number;
  name: string;
  rate: number;
  is_active: boolean;
};

interface TaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tax?: TaxConfiguration | null;
  onSuccess: () => void;
  restaurantId: number;
}

export function TaxDialog({
  open,
  onOpenChange,
  tax,
  onSuccess,
  restaurantId,
}: TaxDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    percentage: "",
    is_active: true,
  });

  useEffect(() => {
    setFormData(
      tax
        ? {
            name: tax.name || "",
            percentage: tax.rate?.toString() || "",
            is_active: tax.is_active ?? true,
          }
        : { name: "", percentage: "", is_active: true },
    );
  }, [tax, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        rate: Number.parseFloat(formData.percentage),
        type: "percentage",
        applicable_to: "all",
        is_active: formData.is_active,
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
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response &&
        typeof error.response.data === "object" &&
        error.response.data !== null &&
        "detail" in error.response.data
          ? String(error.response.data.detail)
          : "Failed to save tax";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {tax ? "Edit tax or fee" : "Add tax or fee"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tax-name">Name</Label>
            <Input
              id="tax-name"
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              placeholder="VAT"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-percentage">Percentage</Label>
            <div className="relative">
              <Input
                id="tax-percentage"
                className="pr-10 tabular-nums"
                type="number"
                step="0.01"
                min="0"
                value={formData.percentage}
                onChange={(event) =>
                  setFormData({ ...formData, percentage: event.target.value })
                }
                placeholder="0.00"
                required
              />
              <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="flex min-h-14 items-center justify-between gap-4 border-y py-3">
            <div>
              <Label htmlFor="tax-active">Active</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Inactive rules are not applied to new orders.
              </p>
            </div>
            <Switch
              id="tax-active"
              checked={formData.is_active}
              onCheckedChange={(isActive) =>
                setFormData({ ...formData, is_active: isActive })
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tax ? "Save changes" : "Add tax"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
