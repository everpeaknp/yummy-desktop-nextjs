"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { financeReportingApi } from "@/lib/api/finance-reporting-api";
import {
  FinanceReportingHeadRead,
  OpeningBalanceCreate,
  OpeningBalanceLineInput,
} from "@/types/finance-reporting";

interface OpeningBalanceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  eligibleLeaves: FinanceReportingHeadRead[];
  onSuccess: () => void;
}

interface WizardLine {
  id: string;
  reportingHeadId: string;
  debit: string;
  credit: string;
  description: string;
}

export function OpeningBalanceWizard({
  open,
  onOpenChange,
  restaurantId: _restaurantId,
  eligibleLeaves,
  onSuccess,
}: OpeningBalanceWizardProps) {
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [memo, setMemo] = useState("Fiscal Year Opening Balance Setup");
  const [counterpartHeadId, setCounterpartHeadId] = useState<string>("");

  const [lines, setLines] = useState<WizardLine[]>([
    { id: "1", reportingHeadId: "", debit: "", credit: "", description: "" },
    { id: "2", reportingHeadId: "", debit: "", credit: "", description: "" },
  ]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        reportingHeadId: "",
        debit: "",
        credit: "",
        description: "",
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      toast.error("At least one opening balance line is required");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof WizardLine, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "debit" && value) {
          return { ...l, debit: value, credit: "" };
        }
        if (field === "credit" && value) {
          return { ...l, credit: value, debit: "" };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const totalDebit = lines.reduce(
    (sum, l) => sum + (parseFloat(l.debit) || 0),
    0
  );
  const totalCredit = lines.reduce(
    (sum, l) => sum + (parseFloat(l.credit) || 0),
    0
  );
  const imbalance = Math.abs(totalDebit - totalCredit);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
  const canAutoBalance = !isBalanced && Boolean(counterpartHeadId);

  // Filter eligible counterpart heads (Equity or Asset/Liability)
  const equityLeaves = eligibleLeaves.filter(
    (h) => h.head_type === "equity" && h.is_postable && h.is_active
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines: OpeningBalanceLineInput[] = [];
    for (const line of lines) {
      if (!line.reportingHeadId) continue;
      const d = parseFloat(line.debit) || 0;
      const c = parseFloat(line.credit) || 0;
      if (d <= 0 && c <= 0) continue;

      validLines.push({
        reporting_head_id: Number(line.reportingHeadId),
        debit: d > 0 ? d : null,
        credit: c > 0 ? c : null,
        description: line.description.trim() || undefined,
      });
    }

    if (validLines.length === 0) {
      toast.error("Add at least one line with an amount");
      return;
    }

    if (!isBalanced && !counterpartHeadId) {
      toast.error(
        `Batch does not balance (Imbalance: ${imbalance.toFixed(
          2
        )}). Provide balanced lines or select a counterpart equity head.`
      );
      return;
    }

    setLoading(true);
    try {
      const payload: OpeningBalanceCreate = {
        as_of_date: asOfDate,
        lines: validLines,
        counterpart_head_id: counterpartHeadId
          ? Number(counterpartHeadId)
          : null,
        memo: memo.trim() || null,
      };

      const entry = await financeReportingApi.postOpeningBalances(payload);
      toast.success(
        `Opening balance posted successfully (Entry #${entry.id}, Key: ${entry.source_key})`
      );
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        "Failed to post opening balance";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <DialogTitle>Post Opening Balances</DialogTitle>
            </div>
            <DialogDescription>
              Finance-admin conversion wizard for posting balanced opening
              balances into the independent reporting ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="as-of-date">Effective As-of Date *</Label>
                <Input
                  id="as-of-date"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="memo">Memo / Authorization Reference</Label>
                <Input
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Auditor approved FY opening balance"
                />
              </div>
            </div>

            {/* Counterpart auto-balance helper */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Auto-Balance Counterpart Head (Optional)
                  </span>
                </div>
                <div className="w-full sm:w-72">
                  <Select
                    value={counterpartHeadId}
                    onValueChange={setCounterpartHeadId}
                  >
                    <SelectTrigger className="h-11 bg-background text-sm sm:h-9 sm:text-xs">
                      <SelectValue placeholder="Select Equity Head (e.g. Owner Equity)..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None (Manual Balanced Lines) --</SelectItem>
                      {equityLeaves.map((h) => (
                        <SelectItem key={h.id} value={String(h.id)}>
                          {h.code} - {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                If specified, any net difference between Total Debits and
                Total Credits will be balanced automatically against this head.
              </p>
            </div>

            {/* Mobile line entry keeps every value reachable without a table scroll. */}
            <div className="space-y-3 md:hidden">
              {lines.map((line, index) => (
                <div key={line.id} className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Line {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => removeLine(line.id)}
                      aria-label={`Remove opening balance line ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select
                    value={line.reportingHeadId}
                    onValueChange={(value) => updateLine(line.id, "reportingHeadId", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select account head" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {eligibleLeaves.map((head) => (
                        <SelectItem key={head.id} value={String(head.id)}>
                          {head.code} - {head.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Debit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(event) => updateLine(line.id, "debit", event.target.value)}
                        placeholder="0.00"
                        className="h-11 text-right font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Credit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(event) => updateLine(line.id, "credit", event.target.value)}
                        placeholder="0.00"
                        className="h-11 text-right font-mono"
                      />
                    </div>
                  </div>
                  <Input
                    value={line.description}
                    onChange={(event) => updateLine(line.id, "description", event.target.value)}
                    placeholder="Line memo (optional)"
                    className="h-11"
                  />
                </div>
              ))}
            </div>

            {/* Desktop retains the dense accounting table. */}
            <div className="hidden overflow-x-auto rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-64">Account Head *</TableHead>
                    <TableHead className="w-36 text-right">Debit (Dr)</TableHead>
                    <TableHead className="w-36 text-right">Credit (Cr)</TableHead>
                    <TableHead>Line Memo</TableHead>
                    <TableHead className="w-12 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="p-2">
                        <Select
                          value={line.reportingHeadId}
                          onValueChange={(val) =>
                            updateLine(line.id, "reportingHeadId", val)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select head..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {eligibleLeaves.map((h) => (
                              <SelectItem key={h.id} value={String(h.id)}>
                                <span className="font-mono text-muted-foreground mr-1">
                                  {h.code}
                                </span>{" "}
                                {h.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) =>
                            updateLine(line.id, "debit", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) =>
                            updateLine(line.id, "credit", e.target.value)
                          }
                          placeholder="0.00"
                          className="h-8 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.id, "description", e.target.value)
                          }
                          placeholder="Optional note"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Add Line & Summary */}
            <div className="space-y-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={addLine}
                className="h-11 w-full gap-1.5 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Add line
              </Button>

              <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                <div className="rounded-xl bg-muted/40 p-2.5">
                  <span className="block text-muted-foreground">Debits</span>
                  <span className="font-mono font-bold text-foreground">
                    {totalDebit.toFixed(2)}
                  </span>
                </div>
                <div className="rounded-xl bg-muted/40 p-2.5">
                  <span className="block text-muted-foreground">Credits</span>
                  <span className="font-mono font-bold text-foreground">
                    {totalCredit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-center rounded-xl border p-2">
                  {isBalanced ? (
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-300 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Balanced
                    </Badge>
                  ) : canAutoBalance ? (
                    <Badge className="bg-blue-500/20 text-blue-600 border-blue-300 gap-1">
                      <RotateCcw className="h-3 w-3" /> Auto-balances diff:{" "}
                      {imbalance.toFixed(2)}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" /> Imbalance:{" "}
                      {imbalance.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background p-4 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-11 flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (!isBalanced && !canAutoBalance)}
              className="h-11 flex-1 gap-1 sm:flex-none"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Post Opening Balances
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
