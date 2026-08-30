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
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import {
  FinanceReportingHeadRead,
  FinanceReportingHeadCreate,
  FinanceReportingHeadUpdate,
} from "@/types/finance-reporting";

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
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Eligible parent nodes (non-postable groups)
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
        setDescription(editHead.description || "");
        setIsActive(editHead.is_active);
      } else {
        setName("");
        setCode("");
        setParentId(initialParentId ? String(initialParentId) : eligibleParents[0] ? String(eligibleParents[0].id) : "");
        setBusinessLineScope("all");
        setStationScope("");
        setDescription("");
        setIsActive(true);
      }
    }
  }, [open, editHead, initialParentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Account head name is required");
      return;
    }

    if (!isEditing && !parentId) {
      toast.error("Parent group is required");
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
        toast.success(`Account head "${name.trim()}" updated`);
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
        toast.success(`Account head "${name.trim()}" created successfully`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to save account head";
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
              {isEditing ? "Edit Account Head" : "Create Account Head"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update account head metadata, scope, and active status."
                : "Add a new postable account head under an active report group."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Parent Selection (Only for creation) */}
            {!isEditing && (
              <div className="grid gap-1.5">
                <Label htmlFor="parent">Parent Report Group *</Label>
                <Select value={parentId} onValueChange={setParentId} required>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Select parent group..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {eligibleParents.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {p.code}
                        </span>
                        <span>{p.hierarchy_path || p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Derived Type & Normal Side indicator */}
            {(selectedParent || editHead) && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="capitalize font-semibold">
                    {editHead?.head_type || selectedParent?.head_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Normal Side:</span>
                  <Badge variant="secondary" className="capitalize font-mono">
                    {editHead?.normal_side || selectedParent?.normal_side}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                    Postable Leaf
                  </Badge>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="name">Head Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitchen Electricity Expense"
                required
                autoFocus
              />
            </div>

            {/* Code */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="code">Account Code</Label>
                <span className="text-[11px] text-muted-foreground">
                  {isEditing ? "Immutable once posted" : "Leave empty to auto-generate from parent"}
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
                <Label htmlFor="bline">Business Line Scope</Label>
                <Select
                  value={businessLineScope}
                  onValueChange={setBusinessLineScope}
                >
                  <SelectTrigger id="bline">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lines</SelectItem>
                    <SelectItem value="restaurant">Restaurant Only</SelectItem>
                    <SelectItem value="hotel">Hotel Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Station Scope */}
              <div className="grid gap-1.5">
                <Label htmlFor="station">Station Scope (Optional)</Label>
                <Input
                  id="station"
                  value={stationScope}
                  onChange={(e) => setStationScope(e.target.value)}
                  placeholder="e.g. kitchen, bar, reception"
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="desc">Description / Purpose (Optional)</Label>
              <Textarea
                id="desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief note for accounting team or auditors..."
              />
            </div>

            {/* Active Toggle for editing */}
            {isEditing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is-active">Active Status</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive heads remain in history but cannot receive new entries.
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
              {isEditing ? "Save Changes" : "Create Head"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
