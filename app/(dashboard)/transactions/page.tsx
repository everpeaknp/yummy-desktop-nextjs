"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

import apiClient from "@/lib/api-client";
import { TransactionsApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

type TransactionType = "order" | "expense" | "inventory" | "manualIncome";

type TransactionItem = {
  id: string;
  type: TransactionType;
  title: string;
  amount?: number | string | null;
  user_id?: number | null;
  user_name?: string | null;
  created_at: string;
  details?: Record<string, any> | null;
};

type TransactionsResponse = {
  items: TransactionItem[];
  total: number;
};

function parseParenSuffix(title: string): string | null {
  const t = String(title || "").trim();
  const m = t.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

function formatMaybeNumberPrefix(s: string): string {
  const raw = String(s || "").trim();
  if (!raw) return raw;

  // Common inventory titles embed a leading numeric delta like "-10.000 pieces".
  const parts = raw.split(/\s+/);
  const n = Number(parts[0]);
  if (!Number.isFinite(n)) return raw;

  const unit = parts.slice(1).join(" ");
  const pretty =
    Number.isInteger(n)
      ? n.toString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${pretty} ${unit}` : pretty;
}

function getInventoryDelta(it: TransactionItem): string | null {
  if (it.type !== "inventory") return null;
  const suffix = parseParenSuffix(it.title);
  if (suffix) return formatMaybeNumberPrefix(suffix);

  // Fallback: try a couple common fields when titles don't embed qty.
  const d = (it.details || {}) as Record<string, any>;
  const qty = d.qty ?? d.quantity ?? d.delta ?? d.change ?? d.units ?? d.pieces;
  const unit = d.unit ?? d.uom ?? d.measurement ?? d.unit_name;
  const n = coerceNumber(qty);
  if (n === null) return null;
  const pretty =
    Number.isInteger(n)
      ? n.toString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${pretty} ${unit}` : pretty;
}

function humanizeKey(k: string) {
  return String(k)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function flattenSection(obj: any, prefix = ""): Array<{ label: string; value: string }> {
  if (!obj || typeof obj !== "object") return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const label = prefix ? `${prefix} • ${humanizeKey(k)}` : humanizeKey(k);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenSection(v, label));
      continue;
    }
    if (Array.isArray(v)) {
      out.push({ label, value: `${v.length} items` });
      continue;
    }
    out.push({ label, value: String(v ?? "") });
  }
  return out;
}

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TYPE_META: Record<TransactionType, { label: string; badge: string }> = {
  order: { label: "Order", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500" },
  expense: { label: "Expense", badge: "bg-red-500/10 text-red-700 dark:text-red-500" },
  inventory: { label: "Inventory", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  manualIncome: { label: "Manual Income", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-500" },
};

function coerceNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getTransactionAmount(it: TransactionItem): number | null {
  // Inventory transactions are stock movements, not money.
  if (it.type === "inventory") return null;

  const direct = coerceNumber((it as any).amount);
  if (direct !== null) return direct;

  const d = (it.details || {}) as Record<string, any>;
  const keys = [
    "amount",
    "total_amount",
    "total",
    "net_total",
    "grand_total",
    "paid_total",
    "order_total",
    "total_cost",
    "cost",
    "value",
  ];
  for (const k of keys) {
    const n = coerceNumber(d[k]);
    if (n !== null) return n;
  }

  const nestedCandidates: any[] = [
    d.order,
    d.expense,
    d.income,
    d.payment,
    d.transaction,
    d.data,
    d.payload,
  ].filter(Boolean);

  for (const obj of nestedCandidates) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
    for (const k of keys) {
      const n = coerceNumber((obj as any)[k]);
      if (n !== null) return n;
    }
  }

  for (const v of Object.values(d)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const k of keys) {
      const n = coerceNumber((v as any)[k]);
      if (n !== null) return n;
    }
  }

  return null;
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;

  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TransactionsResponse | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  }));

  const [types, setTypes] = useState<Set<TransactionType>>(new Set());
  const [userId, setUserId] = useState<string>("");

  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(50);

  const [active, setActive] = useState<TransactionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const txParam = searchParams?.get("tx") || "";

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
      setAuthLoading(false);
    };
    checkAuth();
  }, [user, me, router]);

  const fetchTransactions = async () => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    setLoading(true);
    try {
      const dateFrom = dateRange?.from ? yyyyMmDd(dateRange.from) : undefined;
      const dateTo = dateRange?.to ? yyyyMmDd(dateRange.to) : undefined;
      const parsedUserId = userId.trim() ? Number(userId) : undefined;
      const typeList = Array.from(types);

      const url = TransactionsApis.list({
        restaurantId,
        userId: Number.isFinite(parsedUserId as any) ? (parsedUserId as number) : undefined,
        types: typeList.length ? typeList : undefined,
        dateFrom,
        dateTo,
        skip,
        limit,
      });
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to fetch transactions");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && restaurantId) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, restaurantId]);

  // Auto-apply filter changes.
  useEffect(() => {
    if (authLoading || !restaurantId) return;
    const t = setTimeout(() => {
      setSkip(0);
      fetchTransactions();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime(), limit, userId, Array.from(types).join("|")]);

  useEffect(() => {
    if (authLoading || !restaurantId) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  useEffect(() => {
    if (!txParam) return;
    const it = (data?.items || []).find((x) => String(x.id) === String(txParam));
    if (!it) return;
    setActive(it);
    setDetailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txParam, data?.items?.length]);

  const total = data?.total || 0;
  const canPrev = skip > 0;
  const canNext = skip + limit < total;

  const toggleType = (t: TransactionType) => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/finance/income">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">Orders, expenses, and inventory events in one timeline.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchTransactions()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Date Range</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest w-full justify-start"
                >
                  <Calendar className="h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Select Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background" align="center">
                <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[140px] shrink-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">Quick Select</p>
                  <div className="flex flex-col gap-1 flex-1">
                    <button
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                    >
                      Today
                    </button>
                    <button
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                    >
                      Last 7 Days
                    </button>
                    <button
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) })}
                    >
                      Last 30 Days
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from || new Date()}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    className="p-0"
                    weekStartsOn={1}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Types</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_META) as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={[
                    "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-colors",
                    types.has(t)
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                  ].join(" ")}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Staff/User ID</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Page Size</Label>
            <Input
              value={String(limit)}
              onChange={(e) => setLimit(Math.max(10, Math.min(500, Number(e.target.value || 50))))}
              inputMode="numeric"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Results</CardTitle>
            <Badge variant="outline">{total.toLocaleString()} items</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (data?.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                (data?.items || []).map((it) => (
                  <TableRow
                    key={it.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setActive(it);
                      setDetailOpen(true);
                      router.replace(`/transactions?tx=${encodeURIComponent(it.id)}`);
                    }}
                  >
                    <TableCell className="font-semibold">
                      {it.created_at ? format(new Date(it.created_at), "MMM dd, yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-none font-bold uppercase text-[10px] ${TYPE_META[it.type]?.badge || "bg-muted text-muted-foreground"}`}>
                        {TYPE_META[it.type]?.label || it.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{it.title || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {it.user_name || (it.user_id ? `User #${it.user_id}` : "—")}
                    </TableCell>
	                    <TableCell className="text-right font-bold">
	                      {(() => {
	                        if (it.type === "inventory") {
	                          const delta = getInventoryDelta(it);
	                          return delta ? <span className="text-blue-400">{delta}</span> : "—";
	                        }

	                        const n = getTransactionAmount(it);
	                        if (n === null) return "—";
	                        const isExpense = it.type === "expense";
	                        return <span className={isExpense ? "text-red-500" : undefined}>Rs. {n.toLocaleString()}</span>;
	                      })()}
	                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActive(it);
                          setDetailOpen(true);
                          router.replace(`/transactions?tx=${encodeURIComponent(it.id)}`);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="p-4 flex items-center justify-between border-t border-border/40">
            <div className="text-xs text-muted-foreground font-semibold">
              Showing {Math.min(total, skip + 1)}-{Math.min(total, skip + limit)} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSkip((s) => Math.max(0, s - limit))} disabled={loading || !canPrev}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSkip((s) => s + limit)} disabled={loading || !canNext}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) router.replace("/transactions");
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[760px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-2xl font-bold tracking-tight">Transaction</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Details for this transaction event.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 sm:p-8 pt-6 space-y-5 overflow-auto no-scrollbar flex-1 min-h-0">
            {!active ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground">No transaction selected.</div>
            ) : (
              <>
	                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-6 rounded-2xl border border-border/60">
	                  <div className="space-y-1">
	                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Type</p>
	                    <p className="text-sm font-black text-foreground">{TYPE_META[active.type]?.label || active.type}</p>
	                  </div>
	                  <div className="space-y-1 text-right">
	                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
	                      {active.type === "inventory" ? "Quantity" : "Amount"}
	                    </p>
	                    <p className="text-sm font-black text-foreground">
	                      {(() => {
	                        if (active.type === "inventory") {
	                          const delta = getInventoryDelta(active);
	                          return delta ? <span className="text-blue-400">{delta}</span> : "—";
	                        }

	                        const n = getTransactionAmount(active);
	                        if (n === null) return "—";
	                        const isExpense = active.type === "expense";
	                        return <span className={isExpense ? "text-red-500" : undefined}>Rs. {n.toLocaleString()}</span>;
	                      })()}
	                    </p>
	                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Title</p>
                    <p className="text-sm font-semibold text-foreground">{active.title || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Staff</p>
                    <p className="text-sm font-semibold text-foreground">
                      {active.user_name || (active.user_id ? `User #${active.user_id}` : "—")}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Created</p>
                    <p className="text-sm font-semibold text-foreground">
                      {active.created_at ? format(new Date(active.created_at), "MMM dd, yyyy HH:mm") : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">ID</p>
                    <p className="text-xs font-mono text-muted-foreground break-all">{active.id}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">Details</p>
                  {!active.details ? (
                    <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground">
                      No details available.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                      <div className="max-h-[360px] overflow-auto no-scrollbar">
                        {flattenSection(active.details).map((row, idx) => (
                          <div key={idx} className="px-5 py-3 flex items-start justify-between gap-6 border-b border-border/30 last:border-none">
                            <p className="text-xs font-semibold text-muted-foreground leading-5">{row.label}</p>
                            <p className="text-xs font-bold text-foreground text-right whitespace-nowrap">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="p-6 sm:p-8 pt-4 bg-muted/30 border-t border-border/40">
            <Button variant="outline" className="h-12 rounded-2xl w-full" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
