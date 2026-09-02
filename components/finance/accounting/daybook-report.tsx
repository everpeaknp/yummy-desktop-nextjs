"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccountingDaybook } from "@/types/accounting";

type ReportRow = {
  label: string;
  bank: number;
  counter: number;
  owner: number;
  due: number;
};

type DaybookReportProps = {
  daybook: AccountingDaybook;
  outstandingReceivables?: number;
  title?: string;
};

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function amount(value: number) {
  return Math.abs(value) < 0.005 ? "—" : money(value);
}

function rowTotal(row: ReportRow) {
  return row.bank + row.counter + row.owner;
}

function totalRows(rows: ReportRow[]): ReportRow {
  return rows.reduce(
    (total, row) => ({
      label: "",
      bank: total.bank + row.bank,
      counter: total.counter + row.counter,
      owner: total.owner + row.owner,
      due: total.due + row.due,
    }),
    { label: "", bank: 0, counter: 0, owner: 0, due: 0 },
  );
}

function reportDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function periodLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return `${startDate.toLocaleString()} – ${endDate.toLocaleString()}`;
}

function SectionRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/45 hover:bg-muted/45">
      <TableCell colSpan={6} className="py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function MoneyRow({ row, strong = false }: { row: ReportRow; strong?: boolean }) {
  return (
    <TableRow className={strong ? "bg-muted/25 font-semibold hover:bg-muted/25" : undefined}>
      <TableCell className="min-w-[210px]">{row.label}</TableCell>
      <TableCell className="min-w-[130px] text-right tabular-nums">{amount(row.bank)}</TableCell>
      <TableCell className="min-w-[130px] text-right tabular-nums">{amount(row.counter)}</TableCell>
      <TableCell className="min-w-[130px] text-right tabular-nums">{amount(row.owner)}</TableCell>
      <TableCell className="min-w-[130px] text-right tabular-nums">{amount(rowTotal(row))}</TableCell>
      <TableCell className="min-w-[130px] text-right tabular-nums">{amount(row.due)}</TableCell>
    </TableRow>
  );
}

export function DaybookReport({
  daybook,
  outstandingReceivables = 0,
  title = "Day Book Report",
}: DaybookReportProps) {
  const model = useMemo(() => {
    const legacyReceipts: ReportRow[] = [
      {
        label: "Cash sales",
        bank: 0,
        counter: daybook.cash_control.cash_sales,
        owner: 0,
        due: 0,
      },
      {
        label: "Cash transferred in",
        bank: 0,
        counter: daybook.cash_control.transfers_in,
        owner: 0,
        due: 0,
      },
    ];
    const legacyPayments: ReportRow[] = [
      {
        label: "Cash refunds",
        bank: 0,
        counter: daybook.cash_control.cash_refunds,
        owner: 0,
        due: 0,
      },
      {
        label: "Expenses paid from drawers",
        bank: 0,
        counter: daybook.cash_control.drawer_expenses,
        owner: 0,
        due: 0,
      },
      {
        label: "Cash transferred out",
        bank: 0,
        counter: daybook.cash_control.transfers_out,
        owner: 0,
        due: 0,
      },
    ];

    for (const instrument of daybook.payment_instruments) {
      const label = instrument.instrument?.trim() || instrument.payment_method.replace(/_/g, " ");
      const signed = Number(instrument.expected_amount || 0);
      const row: ReportRow = {
        label,
        bank: Math.abs(signed),
        counter: 0,
        owner: 0,
        due: 0,
      };
      if (signed >= 0) legacyReceipts.push(row);
      else legacyPayments.push(row);
    }

    const toReportRow = (row: AccountingDaybook["receipts"][number]): ReportRow => ({
      label: row.label,
      bank: row.bank_digital,
      counter: row.counter_cash,
      owner: row.owner_other,
      due: row.credit_due,
    });
    const receipts = daybook.receipts?.length
      ? daybook.receipts.map(toReportRow)
      : legacyReceipts;
    const payments = daybook.payments?.length
      ? daybook.payments.map(toReportRow)
      : legacyPayments;

    if (!daybook.receipts?.some((row) => row.credit_due > 0) && outstandingReceivables > 0) {
      receipts.push({
        label: "Credit sales (due)",
        bank: 0,
        counter: 0,
        owner: 0,
        due: outstandingReceivables,
      });
    }

    return {
      opening: {
        label: "Opening counter balance",
        bank: 0,
        counter: daybook.cash_control.opening_balance,
        owner: 0,
        due: 0,
      } satisfies ReportRow,
      receipts,
      receiptTotal: totalRows(receipts),
      payments,
      paymentTotal: totalRows(payments),
      closing: {
        label: "Counted closing counter balance",
        bank: 0,
        counter: daybook.cash_control.closing_balance,
        owner: 0,
        due: outstandingReceivables,
      } satisfies ReportRow,
    };
  }, [daybook, outstandingReceivables]);

  const coveredPeriod = periodLabel(daybook.period_start_at, daybook.period_end_at);
  const balanced = Math.abs(daybook.ledger_impact.total_debit - daybook.ledger_impact.total_credit) < 0.005;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-background">
      <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {daybook.business_line} · {reportDate(daybook.business_date)}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          {coveredPeriod ? (
            <p className="mt-1 text-xs text-muted-foreground">Covered period: {coveredPeriod}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={daybook.status === "closed" ? "border-slate-300 bg-slate-500/10 text-slate-700" : "border-blue-300 bg-blue-500/10 text-blue-700"}>
            {daybook.status === "closed" ? "Closed Daybook" : "Live Daybook"}
          </Badge>
          <Badge variant="outline" className={balanced ? "border-emerald-300 bg-emerald-500/10 text-emerald-700" : "border-amber-300 bg-amber-500/10 text-amber-700"}>
            {balanced ? "Ledger balanced" : "Ledger attention required"}
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment account</TableHead>
              <TableHead className="text-right">Bank / Digital</TableHead>
              <TableHead className="text-right">Counter cash</TableHead>
              <TableHead className="text-right">Owner / Other</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Credit (due)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SectionRow label="Opening" />
            <MoneyRow row={model.opening} strong />
            <SectionRow label="Receipts" />
            {model.receipts.map((row, index) => (
              <MoneyRow key={`receipt-${row.label}-${index}`} row={row} />
            ))}
            <MoneyRow row={{ ...model.receiptTotal, label: "Total receipts [A]" }} strong />
            <SectionRow label="Payments" />
            {model.payments.map((row, index) => (
              <MoneyRow key={`payment-${row.label}-${index}`} row={row} />
            ))}
            <MoneyRow row={{ ...model.paymentTotal, label: "Total payments [B]" }} strong />
            <SectionRow label="Closing position" />
            <MoneyRow row={model.closing} strong />
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-px border-t border-border/70 bg-border/70 sm:grid-cols-4">
        {[
          ["Finance events", daybook.ledger_impact.finance_event_count.toLocaleString()],
          ["Posted journals", daybook.ledger_impact.journal_count.toLocaleString()],
          ["Total debit", money(daybook.ledger_impact.total_debit)],
          ["Total credit", money(daybook.ledger_impact.total_credit)],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
