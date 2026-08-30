"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
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
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import {
  FinanceReportingHeadRead,
  FinanceReportingGroupCreate,
} from "@/types/finance-reporting";

interface AccountGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  initialParentId?: number | null;
  parentOptions: FinanceReportingHeadRead[];
  onSuccess: () => void;
}

export function AccountGroupDialog({
  open,
  onOpenChange,
  restaurantId,
  initialParentId,
  parentOptions,
  onSuccess,
}: AccountGroupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [businessLineScope, setBusinessLineScope] = useState<string>("all");
  const [stationScope, setStationScope] = useState("");
  const [description, setDescription] = useState("");

  // Only non-postable groups can be parents of groups (Roots or Subgroups)
  const eligibleParents = parentOptions.filter((h) => !h.is_postable && h.is_active);
  const selectedParent = eligibleParents.find((p) => String(p.id) === parentId);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setParentId(
        initialParentId
          ? String(initialParentId)
          : eligibleParents[0]
          ? String(eligibleParents[0].id)
          : ""
      );
      setBusinessLineScope("all");
      setStationScope("");
      setDescription("");
    }
  }, [open, initialParentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (!parentId) {
      toast.error("Parent group is required");
      return;
    }

    setLoading(true);
    try {
      const payload: FinanceReportingGroupCreate = {
        name: name.trim(),
        parent_id: Number(parentId),
        code: code.trim() || null,
        business_line_scope: businessLineScope === "all" ? null : businessLineScope,
        station_scope: stationScope.trim() || null,
        description: description.trim() || null,
      };
      await financeReportingApi.createGroup(payload);
      toast.success(`Report group "${name.trim()}" created`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail || err.message || "Failed to create group";
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
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <DialogTitle>Create Roll-up Group</DialogTitle>
            </div>
            <DialogDescription>
              Create a non-postable hierarchy category for grouping leaves and
              structuring financial reports.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Parent Selection */}
            <div className="grid gap-1.5">
              <Label htmlFor="group-parent">Parent Category / Root *</Label>
              <Select value={parentId} onValueChange={setParentId} required>
                <SelectTrigger id="group-parent">
                  <SelectValue placeholder="Select parent category..." />
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

            {/* Derived Indicator */}
            {selectedParent && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="capitalize font-semibold">
                    {selectedParent.head_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Normal Side:</span>
                  <Badge variant="secondary" className="capitalize font-mono">
                    {selectedParent.normal_side}
                  </Badge>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Non-postable Group
                </Badge>
              </div>
            )}

            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Indirect Operating Expenses"
                required
                autoFocus
              />
            </div>

            {/* Code */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="group-code">Group Code (Optional)</Label>
                <span className="text-[11px] text-muted-foreground">
                  Leave empty to auto-generate
                </span>
              </div>
              <Input
                id="group-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={selectedParent ? `e.g. ${selectedParent.code}0` : "e.g. 5200"}
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="group-desc">Description (Optional)</Label>
              <Textarea
                id="group-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Audit notes or criteria for accounts grouped here..."
              />
            </div>
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
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
