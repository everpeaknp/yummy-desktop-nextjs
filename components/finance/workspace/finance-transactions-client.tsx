"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";

import apiClient from "@/lib/api-client";
import { FinanceApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinanceReceivablesResponse, FinanceTransactionRow, FinanceTransactionsResponse } from "@/types/finance";

function yyyyMmDd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function money(value: number) {
  return `NPR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ownerLink(row: FinanceTransactionRow) {
  const source = `${row.source_type} ${row.event_type}`.toLowerCase();
  if (row.order_id || source.includes("order") || source.includes("sale") || source.includes("refund")) return "/finance/sales";
  if (source.includes("supplier") || source.includes("payable")) return "/suppliers";
  // Non-inventory purchases now record as Expense; check this before the
  // generic "purchase" match below.
  if (source.includes("non_inventory_purchase")) return "/finance/expenses";
  // New inventory-linked Purchase/PurchaseReturn records.
  if (source.includes("inventory_purchase")) return "/inventory/purchases";
  // Legacy GeneralPurchase-sourced records (general_purchase / general_purchase_return)
  // still live only in the old, still-functional workspace -- not the new
  // inventory Purchase screen, which has no knowledge of them.
  if (source.includes("purchase")) return "/finance/purchases";
  if (source.includes("inventory")) return "/inventory";
  if (source.includes("salary") || source.includes("payroll")) return "/attendance";
  if (source.includes("income")) return "/finance/other-income";
  if (source.includes("expense")) return "/finance/expenses";
  return null;
}

function EventTable({ rows, loading }: { rows: FinanceTransactionRow[]; loading: boolean }) {
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!rows.length) return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No financial events match this period.</div>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Source owner</TableHead>
            <TableHead>Settlement</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isIn = String(row.direction).toLowerCase() === "in";
            const href = ownerLink(row);
            return (
              <TableRow key={row.event_key || row.id}>
                <TableCell>
                  <p className="font-medium">{new Date(row.event_at).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">{new Date(row.event_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isIn ? <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-rose-600" />}
                    <span className="font-medium">{titleCase(row.event_type)}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{titleCase(row.source_type)}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[row.payment_method, row.instrument_name].filter(Boolean).join(" · ") || "Not a cash movement"}
                </TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                  {isIn ? "+" : "−"}{money(Math.abs(Number(row.amount)))}
                </TableCell>
                <TableCell>
                  {href ? <Button asChild variant="ghost" size="sm"><Link href={href}>Open <ExternalLink className="ml-1 h-3.5 w-3.5" /></Link></Button> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function FinanceTransactionsClient() {
  const user = useAuth((state) => state.user);
  const now = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(yyyyMmDd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(yyyyMmDd(now));
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<FinanceTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(FinanceApis.transactions({ restaurantId: Number(user.restaurant_id), dateFrom, dateTo, timezone: "Asia/Kathmandu", businessLine: "all", limit: 300, offset: 0 }));
      const data = (response.data?.data ?? response.data) as FinanceTransactionsResponse;
      setRows(data?.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, user?.restaurant_id]);

  useEffect(() => { void load(); }, [load]);
  const visibleRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) => `${row.event_type} ${row.source_type} ${row.payment_method || ""} ${row.instrument_name || ""}`.toLowerCase().includes(value));
  }, [query, rows]);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Transactions</h1><p className="mt-2 text-sm text-muted-foreground">One chronological audit trail. A payment that settles a bill remains a settlement; it does not become new income or expense.</p></header>
      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 md:flex-row md:items-end">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, source, or instrument" className="pl-9" /></div>
        <label className="grid gap-1 text-xs text-muted-foreground">From<Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">To<Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      <Card className="border-border shadow-none"><CardContent className="p-0"><EventTable rows={visibleRows} loading={loading} /></CardContent></Card>
    </div>
  );
}

export function FinanceReceivablesClient() {
  const user = useAuth((state) => state.user);
  const now = useMemo(() => new Date(), []);
  const [data, setData] = useState<FinanceReceivablesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.restaurant_id) return;
    const dateFrom = yyyyMmDd(new Date(now.getFullYear() - 1, 0, 1));
    apiClient.get(FinanceApis.receivables({ restaurantId: Number(user.restaurant_id), dateFrom, dateTo: yyyyMmDd(now), timezone: "Asia/Kathmandu", businessLine: "all" }))
      .then((response) => setData(response.data?.data ?? response.data ?? null))
      .finally(() => setLoading(false));
  }, [now, user?.restaurant_id]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Sales</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Customer receivables</h1><p className="mt-2 text-sm text-muted-foreground">Credit sales create receivables. Later customer payments reduce those balances without creating income again.</p></header>
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: "Credit sales", value: data?.credit_sales }, { label: "Collected later", value: data?.credit_repayments }, { label: "Still outstanding", value: data?.outstanding_receivables }].map((item) => <Card key={item.label} className="shadow-none"><CardContent className="p-5"><p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : money(Number(item.value || 0))}</p></CardContent></Card>)}
      </div>
      <Card className="border-border shadow-none"><CardContent className="p-0"><EventTable rows={data?.transactions ?? []} loading={loading} /></CardContent></Card>
    </div>
  );
}
