"use client";

import React, { useMemo, useState } from "react";
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
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import type { FinanceHeadType, FinanceReportingHeadRead } from "@/types/finance-reporting";

export interface AllocationLineItem {
  reporting_head_id: number;
  amount: number;
  description?: string;
}

export interface EligibleHead {
  id: number;
  code?: string;
  name: string;
  path?: string;
  head_type?: string;
}

const ADD_NEW_HEAD_VALUE = "__add_new_head__";

interface AllocationLinesEditorProps {
  totalAmount: number;
  eligibleHeads: EligibleHead[];
  lines: AllocationLineItem[];
  onChange: (lines: AllocationLineItem[]) => void;
  headTypeLabel?: string;
  disabled?: boolean;
  restaurantId?: number;
  headType?: FinanceHeadType;
  canCreateHead?: boolean;
  onHeadCreated?: (head: EligibleHead) => void;
}

export function AllocationLinesEditor({
  totalAmount,
  eligibleHeads,
  lines,
  onChange,
  headTypeLabel = "Account",
  disabled = false,
  restaurantId,
  headType,
  canCreateHead = false,
  onHeadCreated,
}: AllocationLinesEditorProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForLineIndex, setCreateForLineIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newHeadName, setNewHeadName] = useState("");
  const [newHeadCode, setNewHeadCode] = useState("");
  const [parentGroups, setParentGroups] = useState<FinanceReportingHeadRead[]>([]);
  const [parentGroupId, setParentGroupId] = useState("");
  const [loadingParentGroups, setLoadingParentGroups] = useState(false);
  // Integer minor-unit arithmetic (cents/paisa) to avoid floating point math bugs
  const targetCents = Math.round((Number(totalAmount) || 0) * 100);

  const allocatedCents = useMemo(() => {
    return lines.reduce(
      (sum, l) => sum + Math.round((Number(l.amount) || 0) * 100),
      0
    );
  }, [lines]);

  const remainingCents = targetCents - allocatedCents;
  const isBalanced = targetCents > 0 && targetCents === allocatedCents;
  const isOver = remainingCents < 0;

  const handleAddLine = () => {
    const firstAvailableHead = eligibleHeads[0];
    if (!firstAvailableHead) return;

    const defaultAmount = remainingCents > 0 ? remainingCents / 100 : 0;
    onChange([
      ...lines,
      {
        reporting_head_id: firstAvailableHead.id,
        amount: defaultAmount,
        description: "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    const updated = lines.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleHeadChange = (index: number, headIdStr: string) => {
    if (headIdStr === ADD_NEW_HEAD_VALUE) {
      openCreateDialogForLine(index);
      return;
    }
    const headId = parseInt(headIdStr, 10);
    if (isNaN(headId)) return;
    const updated = [...lines];
    updated[index] = { ...updated[index], reporting_head_id: headId };
    onChange(updated);
  };

  const openCreateDialogForLine = async (index: number) => {
    setCreateForLineIndex(index);
    setNewHeadName("");
    setNewHeadCode("");
    setParentGroupId("");
    setCreateDialogOpen(true);
    if (!restaurantId) return;
    setLoadingParentGroups(true);
    try {
      const groups = await financeReportingApi.listHeads(restaurantId, {
        head_type: headType,
        is_postable: false,
        is_active: true,
      });
      setParentGroups(groups);
      if (groups.length > 0) setParentGroupId(String(groups[0].id));
    } catch {
      setParentGroups([]);
      toast.error("Could not load account groups.");
    } finally {
      setLoadingParentGroups(false);
    }
  };

  const handleCreateHead = async () => {
    if (!newHeadName.trim()) {
      toast.error("Account head name is required.");
      return;
    }
    if (!parentGroupId) {
      toast.error("Select a parent group.");
      return;
    }
    setCreating(true);
    try {
      const created = await financeReportingApi.createHead({
        name: newHeadName.trim(),
        parent_id: Number(parentGroupId),
        code: newHeadCode.trim() || undefined,
      });
      const mapped: EligibleHead = {
        id: created.id,
        code: created.code,
        name: created.name,
        path: created.hierarchy_path,
        head_type: created.head_type,
      };
      onHeadCreated?.(mapped);
      if (createForLineIndex !== null) {
        const updated = [...lines];
        updated[createForLineIndex] = {
          ...updated[createForLineIndex],
          reporting_head_id: created.id,
        };
        onChange(updated);
      }
      toast.success("Account head created");
      setCreateDialogOpen(false);
      setCreateForLineIndex(null);
      setNewHeadName("");
      setNewHeadCode("");
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || err.message || "Failed to create account head"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleAmountChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const updated = [...lines];
    updated[index] = { ...updated[index], amount: val };
    onChange(updated);
  };

  const handleDescriptionChange = (index: number, desc: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], description: desc };
    onChange(updated);
  };

  return (
    <>
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold">
            Account Allocation Lines
          </Label>
          <p className="text-xs text-muted-foreground">
            Split total amount ({totalAmount.toFixed(2)}) across reporting heads.
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% Allocated
            </span>
          ) : isOver ? (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Exceeds Total by Rs.{" "}
              {Math.abs(remainingCents / 100).toFixed(2)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Remaining: Rs.{" "}
              {(remainingCents / 100).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Allocation rows */}
      {lines.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
          No custom allocation lines added yet.
          <br />
          Click below to split this transaction across specific account heads.
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-background p-3 rounded-md border"
            >
              {/* Head Select */}
              <div className="flex-1 w-full sm:w-auto">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={line.reporting_head_id}
                  onChange={(e) => handleHeadChange(idx, e.target.value)}
                  disabled={disabled}
                >
                  {eligibleHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.path ? `${h.path}` : `${h.name} (${h.code || h.id})`}
                    </option>
                  ))}
                  {canCreateHead && (
                    <option value={ADD_NEW_HEAD_VALUE}>
                      + Add new account head
                    </option>
                  )}
                </select>
              </div>

              {/* Amount */}
              <div className="w-full sm:w-36">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount"
                  value={line.amount || ""}
                  onChange={(e) => handleAmountChange(idx, e.target.value)}
                  disabled={disabled}
                  className="h-9"
                />
              </div>

              {/* Description */}
              <div className="flex-1 w-full sm:w-auto">
                <Input
                  type="text"
                  placeholder="Line note (optional)"
                  value={line.description || ""}
                  onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                  disabled={disabled}
                  className="h-9"
                />
              </div>

              {/* Delete button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveLine(idx)}
                disabled={disabled}
                className="h-9 w-9 text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Line button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddLine}
        disabled={disabled || eligibleHeads.length === 0}
        className="w-full sm:w-auto gap-1 text-xs"
      >
        <Plus className="h-3.5 w-3.5" /> Add {headTypeLabel} Allocation Line
      </Button>
    </div>

    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add New Account Head</DialogTitle>
          <DialogDescription>
            Create a reporting head under an existing account group.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="head_name">Head name *</Label>
            <Input
              id="head_name"
              value={newHeadName}
              onChange={(e) => setNewHeadName(e.target.value)}
              placeholder="e.g. Rent Expense"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="head_code">Code (optional)</Label>
            <Input
              id="head_code"
              value={newHeadCode}
              onChange={(e) => setNewHeadCode(e.target.value)}
              placeholder="e.g. RENT"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="head_parent">Parent group *</Label>
            <select
              id="head_parent"
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={parentGroupId}
              onChange={(e) => setParentGroupId(e.target.value)}
              disabled={loadingParentGroups}
            >
              <option value="">
                {loadingParentGroups ? "Loading groups..." : "Select a parent group"}
              </option>
              {parentGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.hierarchy_path || group.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreateHead} disabled={creating || loadingParentGroups}>
            {creating ? "Creating..." : "Create Account Head"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
