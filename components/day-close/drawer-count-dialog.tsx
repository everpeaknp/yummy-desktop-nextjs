"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  DrawerClosingCountInput,
  DrawerClosingPrompt,
  DrawerSession,
  DrawerVarianceApprovalInput,
} from "@/types/day-close";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type DrawerCountDialogProps = {
  session: DrawerSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (session: DrawerSession) => void;
};

export function DrawerCountDialog({
  session,
  open,
  onOpenChange,
  onUpdated,
}: DrawerCountDialogProps) {
  const [prompt, setPrompt] = useState<DrawerClosingPrompt | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [reason, setReason] = useState("");
  const [retainedFloat, setRetainedFloat] = useState("");
  const [denominations, setDenominations] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const needsApproval = session?.status === "variance_review_required";

  useEffect(() => {
    if (!open || !session?.id) return;
    setPrompt(null);
    setCountedCash("");
    setReason("");
    setRetainedFloat(session.retained_float != null ? String(session.retained_float) : "");
    setDenominations("");
    setLoading(true);
    apiClient
      .get<BaseResponse<DrawerClosingPrompt>>(DrawerSessionApis.closingPrompt(session.id))
      .then((res) => setPrompt(res.data?.data ?? null))
      .catch((error) => {
        console.error("Failed to load drawer closing prompt", error);
        toast.error("Failed to load drawer closing prompt");
      })
      .finally(() => setLoading(false));
  }, [open, session?.id, session?.retained_float]);

  const parsedDenominations = useMemo(() => {
    if (!denominations.trim()) return null;
    return { notes: denominations.trim() };
  }, [denominations]);

  const submitCount = async () => {
    if (!session?.id) return;
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid closing cash count.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: DrawerClosingCountInput = {
        counted_closing_cash: amount,
        denominations_json: parsedDenominations,
        reason: reason.trim() || null,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(
        DrawerSessionApis.closingCount(session.id),
        payload,
      );
      const updated = res.data?.data;
      if (updated) onUpdated(updated);
      toast.success("Drawer closing count submitted.");
      if (updated?.status !== "variance_review_required") {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to submit drawer count", error);
      toast.error("Failed to submit drawer count");
    } finally {
      setSubmitting(false);
    }
  };

  const approveVariance = async () => {
    if (!session?.id) return;
    const retained = Number(retainedFloat || 0);
    if (!reason.trim()) {
      toast.error("Variance approval requires a reason.");
      return;
    }
    setApproving(true);
    try {
      const payload: DrawerVarianceApprovalInput = {
        reason: reason.trim(),
        retained_float: Number.isFinite(retained) ? retained : 0,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(
        DrawerSessionApis.approveVariance(session.id),
        payload,
      );
      const updated = res.data?.data;
      if (updated) onUpdated(updated);
      toast.success("Drawer variance approved.");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to approve drawer variance", error);
      toast.error("Failed to approve drawer variance");
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>DrawerCountDialog</DialogTitle>
          <DialogDescription>
            Blind closing count: the expected amount is hidden from the cashier when the drawer is configured for blind counts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drawer count prompt...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="font-medium">Blind closing count</div>
              <div className="mt-1 text-muted-foreground">
                {prompt?.blind_count_enabled
                  ? "The expected amount is hidden until the count is submitted."
                  : "Expected closing cash is visible for this drawer."}
              </div>
              {!prompt?.blind_count_enabled && prompt?.expected_closing_cash != null ? (
                <div className="mt-2 font-semibold">
                  Expected: {formatDayCloseCurrency(prompt.expected_closing_cash)}
                </div>
              ) : null}
            </div>

            <label className="grid gap-1 text-sm font-medium">
              Closing cash count
              <Input
                type="number"
                min="0"
                step="0.01"
                value={countedCash}
                onChange={(event) => setCountedCash(event.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              denominations
              <Textarea
                value={denominations}
                onChange={(event) => setDenominations(event.target.value)}
                placeholder="Optional denomination notes, e.g. 1000x3, 500x4"
                rows={3}
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Reason / note
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required for variance approval"
                rows={3}
              />
            </label>

            {needsApproval ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                This drawer has a variance and needs manager approval before day close can use it.
              </div>
            ) : null}

            {needsApproval ? (
              <label className="grid gap-1 text-sm font-medium">
                Retained float
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={retainedFloat}
                  onChange={(event) => setRetainedFloat(event.target.value)}
                  placeholder="0.00"
                />
              </label>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {needsApproval ? (
            <Button onClick={approveVariance} disabled={approving}>
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Request variance approval
            </Button>
          ) : (
            <Button onClick={submitCount} disabled={submitting || loading}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Submit count
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
