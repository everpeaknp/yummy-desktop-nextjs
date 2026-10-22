"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { StationPicker } from "@/components/stations/station-picker";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import {
  FinanceHeadType,
  FinanceReportingHeadRead,
  FinanceReportingHeadCreate,
  FinanceReportingHeadUpdate,
} from "@/types/finance-reporting";

export const TYPE_LABELS: Record<FinanceHeadType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  contra_income: "Income Adjustment",
  expense: "Expense",
};

interface AccountHeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  initialParentId?: number | null;
  editHead?: FinanceReportingHeadRead | null;
  parentOptions: FinanceReportingHeadRead[];
  onSuccess: () => void;
}

export function AccountHeadDialog({
  open,
  onOpenChange,
  restaurantId,
  initialParentId,
  editHead,
  parentOptions,
  onSuccess,
}: AccountHeadDialogProps) {
  const isEditing = !!editHead;
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [businessLineScope, setBusinessLineScope] = useState<string>("all");
  const [stationScope, setStationScope] = useState("");
  const [stationScopeId, setStationScopeId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Only groups (not individual categories) can contain a new category.
  const eligibleParents = parentOptions.filter((h) => !h.is_postable && h.is_active);

  const selectedParent = eligibleParents.find((p) => String(p.id) === parentId);

  useEffect(() => {
    if (open) {
      if (editHead) {
        setName(editHead.name);
        setCode(editHead.code);
        setParentId(editHead.parent_id ? String(editHead.parent_id) : "");
        setBusinessLineScope(editHead.business_line_scope || "all");
        setStationScope(editHead.station_scope || "");
        setStationScopeId(null);
        setDescription(editHead.description || "");
        setIsActive(editHead.is_active);
      } else {
        setName("");
        setCode("");
        setParentId(initialParentId ? String(initialParentId) : eligibleParents[0] ? String(eligibleParents[0].id) : "");
        setBusinessLineScope("all");
        setStationScope("");
        setStationScopeId(null);
        setDescription("");
        setIsActive(true);
      }
    }
  }, [open, editHead, initialParentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!isEditing && !parentId) {
      toast.error("Please choose a group");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editHead) {
        const updatePayload: FinanceReportingHeadUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          business_line_scope: businessLineScope === "all" ? null : businessLineScope,
          station_scope: stationScope.trim() || null,
          is_active: isActive,
        };
        await financeReportingApi.updateHead(editHead.id, updatePayload);
        toast.success(`"${name.trim()}" updated`);
      } else {
        const createPayload: FinanceReportingHeadCreate = {
          name: name.trim(),
          parent_id: Number(parentId),
          code: code.trim() || null,
          business_line_scope: businessLineScope === "all" ? null : businessLineScope,
          station_scope: stationScope.trim() || null,
          description: description.trim() || null,
        };
        await financeReportingApi.createHead(createPayload);
        toast.success(`"${name.trim()}" added`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Couldn't save this category";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update this category's details."
                : "Add a category you can pick when recording income, expenses, or other transactions."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Parent Selection (Only for creation) */}
            {!isEditing && (
              <div className="grid gap-1.5">
                <Label htmlFor="parent">Which group is this in? *</Label>
                <Select value={parentId} onValueChange={setParentId} required>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Choose a group" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {eligibleParents.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span>{p.hierarchy_path || p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Derived Type indicator */}
            {(selectedParent || editHead) && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline" className="font-semibold">
                  {TYPE_LABELS[(editHead?.head_type || selectedParent?.head_type) as FinanceHeadType]}
                </Badge>
              </div>
            )}

            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen Electricity"
                required
                autoFocus
              />
            </div>

            {/* Code */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="code">Code (optional)</Label>
                <span className="text-[11px] text-muted-foreground">
                  {isEditing ? "Can't be changed once used" : "Leave blank to generate automatically"}
                </span>
              </div>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={selectedParent ? `e.g. ${selectedParent.code}-01` : "e.g. 5110"}
                disabled={isEditing && Boolean(editHead?.system_role)}
              />
            </div>

            {/* Business Line Scope */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="bline">Applies to</Label>
                <Select
                  value={businessLineScope}
                  onValueChange={setBusinessLineScope}
                >
                  <SelectTrigger id="bline">
                    <SelectValue placeholder="Everywhere" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everywhere</SelectItem>
                    <SelectItem value="restaurant">Restaurant only</SelectItem>
                    <SelectItem value="hotel">Hotel only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Station Scope */}
              <div className="grid gap-1.5">
                <StationPicker
                  restaurantId={restaurantId}
                  value={stationScopeId}
                  onChange={(id, station) => {
                    setStationScopeId(id);
                    setStationScope(station?.name ?? "");
                  }}
                  onStationsLoaded={(stations) => {
                    if (!stationScopeId && stationScope) {
                      const match = stations.find(
                        (s) => s.name.toLowerCase() === stationScope.toLowerCase(),
                      );
                      if (match) setStationScopeId(match.id);
                    }
                  }}
                  label="Department (optional)"
                  placeholder="No specific department"
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="desc">Notes (optional)</Label>
              <Textarea
                id="desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this category is for..."
              />
            </div>

            {/* Active Toggle for editing */}
            {isEditing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is-active">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Turn off to hide this category from new transactions. Past records are kept.
                  </p>
                </div>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
