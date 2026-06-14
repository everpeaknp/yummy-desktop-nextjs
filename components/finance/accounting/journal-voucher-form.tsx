"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ChartAccount,
  JournalVoucherInput,
  JournalVoucherLineInput,
  JournalVoucherType,
} from "@/types/accounting";

type LineDraft = JournalVoucherLineInput & {
  row_key: string;
};

type JournalVoucherFormProps = {
  restaurantId: number;
  accounts: ChartAccount[];
  saving?: boolean;
  onSubmit: (payload: JournalVoucherInput) => Promise<void> | void;
};

const voucherTypes: Array<{ value: JournalVoucherType; label: string }> = [
  { value: "journal", label: "Journal" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment" },
  { value: "contra", label: "Contra" },
  { value: "adjustment", label: "Adjustment" },
];

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function newLine(): LineDraft {
  return {
    row_key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    account_id: 0,
    debit: 0,
    credit: 0,
    memo: "",
  };
}

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function JournalVoucherForm({
  restaurantId,
  accounts,
  saving = false,
  onSubmit,
}: JournalVoucherFormProps) {
  const [entryDate, setEntryDate] = useState(() => yyyyMmDd(new Date()));
  const [businessDate, setBusinessDate] = useState(() => yyyyMmDd(new Date()));
  const [voucherType, setVoucherType] = useState<JournalVoucherType>("journal");
  const [businessLine, setBusinessLine] = useState("restaurant");
  const [station, setStation] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine(), newLine()]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return {
      debit,
      credit,
      difference: Math.abs(debit - credit),
    };
  }, [lines]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const impactRows = useMemo(
    () =>
      lines
        .filter((line) => line.account_id > 0 && (Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0))
        .map((line) => {
          const account = accountById.get(line.account_id);
          return {
            row_key: line.row_key,
            account,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
            statement: account?.account_type === "revenue" || account?.account_type === "contra_revenue" || account?.account_type === "expense"
              ? "P&L"
              : "Balance Sheet",
          };
        }),
    [accountById, lines]
  );

  const updateLine = (rowKey: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.row_key === rowKey ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (rowKey: string) => {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.row_key !== rowKey)));
  };

  const reset = () => {
    const today = yyyyMmDd(new Date());
    setEntryDate(today);
    setBusinessDate(today);
    setVoucherType("journal");
    setBusinessLine("restaurant");
    setStation("");
    setExternalReference("");
    setMemo("");
    setLines([newLine(), newLine()]);
  };

  const createVoucher = async () => {
    const payloadLines = lines
      .filter((line) => line.account_id > 0 && (Number(line.debit || 0) > 0 || Number(line.credit || 0) > 0))
      .map((line) => ({
        account_id: line.account_id,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        memo: line.memo || null,
        business_line: businessLine || "restaurant",
        station: station || null,
      }));

    if (payloadLines.length < 2) {
      toast.error("A manual journal voucher needs at least two non-zero lines.");
      return;
    }
    if (totals.difference !== 0) {
      toast.error("Debit and credit totals must match before saving.");
      return;
    }

    const payload: JournalVoucherInput = {
      restaurant_id: restaurantId,
      entry_date: entryDate,
      business_date: businessDate || entryDate,
      voucher_type: voucherType,
      memo: memo || null,
      business_line: businessLine || "restaurant",
      station: station || null,
      external_reference: externalReference || null,
      lines: payloadLines,
    };

    await onSubmit(payload);
    reset();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entry date
          </label>
          <Input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Business date
          </label>
          <Input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Voucher type
          </label>
          <Select value={voucherType} onValueChange={(value) => setVoucherType(value as JournalVoucherType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {voucherTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Business line
          </label>
          <Input value={businessLine} onChange={(event) => setBusinessLine(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Station
          </label>
          <Input value={station} onChange={(event) => setStation(event.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            External reference
          </label>
          <Input
            value={externalReference}
            onChange={(event) => setExternalReference(event.target.value)}
            placeholder="Cheque, bank ref, approval ref"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Memo
          </label>
          <Textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Why this voucher is being posted"
            rows={2}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debit</div>
          <div className="mt-1 text-lg font-bold">{formatMoney(totals.debit)}</div>
        </div>
        <div className="border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit</div>
          <div className="mt-1 text-lg font-bold">{formatMoney(totals.credit)}</div>
        </div>
        <div className="border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Difference</div>
          <div className={totals.difference === 0 ? "mt-1 text-lg font-bold text-emerald-600" : "mt-1 text-lg font-bold text-red-600"}>
            {formatMoney(totals.difference)}
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <Button variant="outline" onClick={() => setLines((current) => [...current, newLine()])}>
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
          <Button onClick={createVoucher} disabled={saving || accounts.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Create voucher
          </Button>
        </div>
      </div>

      <div className="border border-border p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impact preview</div>
        {impactRows.length === 0 ? (
          <div className="mt-2 text-sm text-muted-foreground">Select accounts and amounts to preview the affected statements.</div>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {impactRows.map((row) => (
              <div key={row.row_key} className="border border-border/70 p-2 text-sm">
                <div className="font-medium">
                  {row.account ? `${row.account.code} - ${row.account.name}` : "Selected account"}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{row.statement}</span>
                  <span>Dr {formatMoney(row.debit)}</span>
                  <span>Cr {formatMoney(row.credit)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Account</th>
              <th className="w-36 px-3 py-2 font-semibold">Debit</th>
              <th className="w-36 px-3 py-2 font-semibold">Credit</th>
              <th className="px-3 py-2 font-semibold">Line memo</th>
              <th className="w-12 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.row_key} className="border-t border-border">
                <td className="px-3 py-2">
                  <Select
                    value={line.account_id ? String(line.account_id) : undefined}
                    onValueChange={(value) => updateLine(line.row_key, { account_id: Number(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit || ""}
                    onChange={(event) => updateLine(line.row_key, { debit: Number(event.target.value || 0) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit || ""}
                    onChange={(event) => updateLine(line.row_key, { credit: Number(event.target.value || 0) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={line.memo || ""}
                    onChange={(event) => updateLine(line.row_key, { memo: event.target.value })}
                    placeholder="Optional"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="icon" onClick={() => removeLine(line.row_key)} disabled={lines.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
