"use client";

import { Loader2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountingDrilldownResponse } from "@/types/accounting";

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function labelize(value: string | null | undefined) {
  return String(value || "-").replace(/_/g, " ");
}

type AccountingDrilldownDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: AccountingDrilldownResponse | null;
  loading?: boolean;
};

export function AccountingDrilldownDrawer({
  open,
  onOpenChange,
  title,
  data,
  loading,
}: AccountingDrilldownDrawerProps) {
  const tracePath = data?.trace_path?.length
    ? data.trace_path
    : ["Report", "Journal", "Finance Event", "Source"];
  const rows = data?.lines ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Source trace for the selected accounting number.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Trace path</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium">
              {tracePath.map((item, index) => (
                <span key={`${item}-${index}`} className="flex items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-1">{item}</span>
                  {index < tracePath.length - 1 ? <span className="text-muted-foreground">/</span> : null}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Debit total</div>
              <div className="mt-1 font-mono text-lg font-semibold">{formatMoney(data?.total_debit ?? 0)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Credit total</div>
              <div className="mt-1 font-mono text-lg font-semibold">{formatMoney(data?.total_credit ?? 0)}</div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-md border border-border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading source trace...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              No journal lines found for this drilldown.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Journal line</TableHead>
                    <TableHead className="min-w-[210px]">Account</TableHead>
                    <TableHead className="min-w-[190px]">Finance Event</TableHead>
                    <TableHead className="min-w-[180px]">Source</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.journal_line_id}>
                      <TableCell>
                        <div className="font-mono text-xs">#{row.journal_line_id}</div>
                        <div className="text-xs text-muted-foreground">Entry #{row.journal_entry_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.account_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.account_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="capitalize">{labelize(row.finance_event_type)}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.finance_event_id ? `Event #${row.finance_event_id}` : "No event"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{row.source_label}</div>
                        <div className="text-xs capitalize text-muted-foreground">{labelize(row.source_type)}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(row.debit)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(row.credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
