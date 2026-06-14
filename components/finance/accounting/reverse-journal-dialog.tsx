"use client";

import { FormEvent, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JournalEntryReverseInput } from "@/types/accounting";

type ReverseJournalDialogProps = {
  entryId: number;
  entryLabel: string;
  disabled?: boolean;
  onReverse: (entryId: number, payload: JournalEntryReverseInput) => Promise<void> | void;
};

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ReverseJournalDialog({
  entryId,
  entryLabel,
  disabled,
  onReverse,
}: ReverseJournalDialogProps) {
  const [open, setOpen] = useState(false);
  const [reversalDate, setReversalDate] = useState(todayInputValue);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanMemo = memo.trim();
    if (!reversalDate) {
      setError("Choose the accounting date for the reversal.");
      return;
    }
    if (!cleanMemo) {
      setError("Add a reason so the audit trail explains this reversal.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReverse(entryId, {
        reversal_date: reversalDate,
        memo: cleanMemo,
        allow_system_override: false,
      });
      setOpen(false);
      setMemo("");
      setReversalDate(todayInputValue());
    } catch {
      setError("The journal entry could not be reversed. Check the period status and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled || submitting}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reverse
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Reverse journal entry</DialogTitle>
            <DialogDescription>
              Create a new posted journal that swaps the debit and credit lines for {entryLabel}. The original
              entry stays visible for audit history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`reversal-date-${entryId}`}>Reversal date</Label>
            <Input
              id={`reversal-date-${entryId}`}
              type="date"
              value={reversalDate}
              onChange={(event) => setReversalDate(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reversal-memo-${entryId}`}>Reason</Label>
            <Textarea
              id={`reversal-memo-${entryId}`}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Example: Correct duplicate accrual posted in the locked May period."
              disabled={submitting}
            />
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Reverse journal entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
