"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";

import apiClient from "@/lib/api-client";
import { StaffApis, TransactionsApis } from "@/lib/api/endpoints";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { useRestaurant } from "@/hooks/use-restaurant";
import {
  AnalyticsAccessDenied,
  AnalyticsAccessLoading,
} from "@/components/analytics/analytics-access-states";
import { TransactionCard } from "@/components/transactions/transaction-card";
import {
  ALL_TRANSACTION_TYPES,
  TYPE_META,
  buildTransactionsListQuery,
  getTransactionAmount,
  getTransactionNavigation,
  getInventoryDelta,
  orderIdFromTransactionId,
  staffLabel,
  type StaffOption,
  type TransactionItem,
  type TransactionType,
  type TransactionsResponse,
} from "@/lib/transactions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";

function humanizeKey(k: string) {
  return String(k)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function flattenSection(
  obj: unknown,
  prefix = ""
): Array<{ label: string; value: string }> {
  if (!obj || typeof obj !== "object") return [];
  const out: Array<{ label: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
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

function parseDateParam(s: string | null): Date | undefined {
  if (!s) return undefined;
  try {
    const d = parseISO(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

function renderAmount(it: TransactionItem) {
  if (it.type === "inventory") {
    const delta = getInventoryDelta(it);
    return delta ? <span className="text-blue-400">{delta}</span> : "—";
  }
  const n = getTransactionAmount(it);
  if (n === null) return "—";
  const isExpense = it.type === "expense";
  return (
    <span className={isExpense ? "text-red-500" : undefined}>
      Rs. {n.toLocaleString()}
    </span>
  );
}

const STAFF_ALL = "__all__";

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);
  const restaurantId = restaurant?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDateParam(searchParams?.get("date_from") ?? null);
    const to = parseDateParam(searchParams?.get("date_to") ?? null);
    if (from || to) {
      return { from: from ?? undefined, to: to ?? endOfDay(new Date()) };
    }
    return {
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date()),
    };
  });

  const [types, setTypes] = useState<Set<TransactionType>>(() => {
    const raw = searchParams?.get("types");
    if (!raw) return new Set();
    const parsed = raw
      .split(",")
      .filter((t): t is TransactionType =>
        ALL_TRANSACTION_TYPES.includes(t as TransactionType)
      );
    return new Set(parsed);
  });

  const [createdByUserId, setCreatedByUserId] = useState(
    () => searchParams?.get("user_id") ?? STAFF_ALL
  );
  const [paymentUserId, setPaymentUserId] = useState(
    () => searchParams?.get("payment_user_id") ?? STAFF_ALL
  );

  const [skip, setSkip] = useState(() => {
    const n = Number(searchParams?.get("skip") ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [limit, setLimit] = useState(() => {
    const n = Number(searchParams?.get("limit") ?? 50);
    return Number.isFinite(n) ? Math.max(10, Math.min(500, n)) : 50;
  });

  const [active, setActive] = useState<TransactionItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const txParam = searchParams?.get("tx") ?? "";

  const paymentFilterActive = paymentUserId !== STAFF_ALL;
  const parsedPaymentUserId =
    paymentFilterActive && Number.isFinite(Number(paymentUserId))
      ? Number(paymentUserId)
      : undefined;
  const parsedCreatedByUserId =
    createdByUserId !== STAFF_ALL && Number.isFinite(Number(createdByUserId))
      ? Number(createdByUserId)
      : undefined;

  const paymentAddedByLabel = useMemo(() => {
    if (!parsedPaymentUserId) return null;
    return staffLabel(staff, parsedPaymentUserId, null);
  }, [staff, parsedPaymentUserId]);

  const syncUrl = useCallback(
    (nextSkip: number) => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("date_from", yyyyMmDd(dateRange.from));
      if (dateRange?.to) params.set("date_to", yyyyMmDd(dateRange.to));
      if (createdByUserId !== STAFF_ALL) params.set("user_id", createdByUserId);
      if (paymentUserId !== STAFF_ALL) {
        params.set("payment_user_id", paymentUserId);
      }
      const typeList = paymentFilterActive
        ? ["order"]
        : Array.from(types);
      if (typeList.length) params.set("types", typeList.join(","));
      if (nextSkip > 0) params.set("skip", String(nextSkip));
      if (limit !== 50) params.set("limit", String(limit));
      const q = params.toString();
      router.replace(q ? `/transactions?${q}` : "/transactions", { scroll: false });
    },
    [
      router,
      dateRange?.from,
      dateRange?.to,
      createdByUserId,
      paymentUserId,
      paymentFilterActive,
      types,
      limit,
    ]
  );

  const fetchStaff = useCallback(async () => {
    try {
      const response = await apiClient.get(StaffApis.list());
      if (response.data?.status === "success") {
        const rows = (response.data.data || []) as Array<{
          id: number;
          name?: string;
          full_name?: string;
          email?: string;
        }>;
        setStaff(
          rows.map((s) => ({
            id: s.id,
            name: s.name || s.full_name || s.email || `User #${s.id}`,
          }))
        );
      }
    } catch {
      /* staff list optional for filters */
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!canViewAnalytics || !restaurantId) return;
    setLoading(true);
    try {
      const dateFrom = dateRange?.from ? yyyyMmDd(dateRange.from) : undefined;
      const dateTo = dateRange?.to ? yyyyMmDd(dateRange.to) : undefined;
      const typeList = paymentFilterActive
        ? undefined
        : types.size
          ? Array.from(types)
          : undefined;

      const url = TransactionsApis.list(
        buildTransactionsListQuery({
          restaurantId,
          userId: parsedCreatedByUserId,
          paymentUserId: parsedPaymentUserId,
          types: typeList,
          dateFrom,
          dateTo,
          skip,
          limit,
        })
      );
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data as TransactionsResponse);
      } else {
        toast.error(res.data?.message || "Failed to fetch transactions");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to fetch transactions"
      );
    } finally {
      setLoading(false);
    }
  }, [
    canViewAnalytics,
    restaurantId,
    dateRange?.from,
    dateRange?.to,
    parsedCreatedByUserId,
    parsedPaymentUserId,
    paymentFilterActive,
    types,
    skip,
    limit,
  ]);

  useEffect(() => {
    if (!ready || !canViewAnalytics) return;
    fetchStaff();
  }, [ready, canViewAnalytics, fetchStaff]);

  const filterSignature = useMemo(
    () =>
      [
        restaurantId,
        dateRange?.from?.getTime(),
        dateRange?.to?.getTime(),
        createdByUserId,
        paymentUserId,
        Array.from(types).sort().join(","),
        limit,
      ].join("|"),
    [
      restaurantId,
      dateRange?.from,
      dateRange?.to,
      createdByUserId,
      paymentUserId,
      types,
      limit,
    ]
  );

  const lastFilterRef = useRef(filterSignature);

  useEffect(() => {
    if (!ready || !canViewAnalytics || !restaurantId) return;
    if (lastFilterRef.current !== filterSignature) {
      lastFilterRef.current = filterSignature;
      if (skip !== 0) {
        setSkip(0);
        return;
      }
    }
    const t = setTimeout(() => {
      fetchTransactions();
      syncUrl(skip);
    }, 200);
    return () => clearTimeout(t);
  }, [
    ready,
    canViewAnalytics,
    restaurantId,
    filterSignature,
    skip,
    fetchTransactions,
    syncUrl,
  ]);

  useEffect(() => {
    if (!txParam) return;

    const orderIdFromPath = orderIdFromTransactionId(txParam);
    if (orderIdFromPath != null) {
      router.replace(`/orders/${orderIdFromPath}`);
      return;
    }

    const it = (data?.items || []).find((x) => String(x.id) === String(txParam));
    if (!it) return;

    const nav = getTransactionNavigation(it);
    if (nav.kind === "order") {
      router.replace(nav.href);
      return;
    }

    setActive(it);
    setDetailOpen(true);
  }, [txParam, data?.items, router]);

  const handleTransactionClick = (it: TransactionItem) => {
    const nav = getTransactionNavigation(it);
    if (nav.kind === "order") {
      router.push(nav.href);
      return;
    }
    setActive(it);
    setDetailOpen(true);
    router.replace(`/transactions?tx=${encodeURIComponent(it.id)}`);
  };

  const handlePaymentUserChange = (value: string) => {
    setPaymentUserId(value);
    if (value !== STAFF_ALL) {
      setTypes(new Set<TransactionType>(["order"]));
    }
  };

  const toggleType = (t: TransactionType) => {
    if (paymentFilterActive) return;
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const total = data?.total ?? 0;
  const canPrev = skip > 0;
  const canNext = skip + limit < total;

  if (!ready) return <AnalyticsAccessLoading />;
  if (!canViewAnalytics) return <AnalyticsAccessDenied />;

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
            <p className="text-muted-foreground">
              Audit timeline: who created each record and who collected order payments.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchTransactions()} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2 lg:col-span-2">
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
                        {format(dateRange.from, "LLL dd")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Select Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background"
                align="center"
              >
                <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[140px] shrink-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">
                    Quick Select
                  </p>
                  <div className="flex flex-col gap-1 flex-1">
                    <button
                      type="button"
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() =>
                        setDateRange({
                          from: startOfDay(new Date()),
                          to: endOfDay(new Date()),
                        })
                      }
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() =>
                        setDateRange({
                          from: startOfDay(subDays(new Date(), 7)),
                          to: endOfDay(new Date()),
                        })
                      }
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
                      onClick={() =>
                        setDateRange({
                          from: startOfDay(subDays(new Date(), 30)),
                          to: endOfDay(new Date()),
                        })
                      }
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

          <div className="space-y-2">
            <Label>Created By</Label>
            <Select value={createdByUserId} onValueChange={setCreatedByUserId}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAFF_ALL}>All staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Added By</Label>
            <Select value={paymentUserId} onValueChange={handlePaymentUserChange}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Any staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAFF_ALL}>Any staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={`pay-${s.id}`} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentFilterActive ? (
              <p className="text-[11px] text-muted-foreground font-medium">
                Showing order payments only (types locked to Order).
              </p>
            ) : null}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Types</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_TRANSACTION_TYPES.map((t) => {
                const locked = paymentFilterActive && t !== "order";
                const active = paymentFilterActive
                  ? t === "order"
                  : types.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleType(t)}
                    className={[
                      "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-colors",
                      active
                        ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                      locked ? "opacity-40 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Page Size</Label>
            <Input
              value={String(limit)}
              onChange={(e) =>
                setLimit(Math.max(10, Math.min(500, Number(e.target.value || 50))))
              }
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
        <CardContent className="p-4 pt-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
              Loading…
            </div>
          ) : (data?.items || []).length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No transactions found.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(data?.items || []).map((it) => (
                <TransactionCard
                  key={it.id}
                  item={it}
                  staff={staff}
                  paymentAddedByLabel={
                    paymentFilterActive ? paymentAddedByLabel : null
                  }
                  amountDisplay={renderAmount(it)}
                  onClick={() => handleTransactionClick(it)}
                />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 flex items-center justify-between border-t border-border/40">
            <div className="text-xs text-muted-foreground font-semibold">
              Showing {total === 0 ? 0 : Math.min(total, skip + 1)}-
              {Math.min(total, skip + limit)} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSkip((s) => Math.max(0, s - limit))}
                disabled={loading || !canPrev}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSkip((s) => s + limit)}
                disabled={loading || !canNext}
              >
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
          if (!open) {
            const params = new URLSearchParams(window.location.search);
            params.delete("tx");
            const q = params.toString();
            router.replace(q ? `/transactions?${q}` : "/transactions", {
              scroll: false,
            });
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[760px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Transaction
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Non-order audit details (expense, inventory, manual income).
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 sm:p-8 pt-6 space-y-5 overflow-auto no-scrollbar flex-1 min-h-0">
            {!active ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground">
                No transaction selected.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-6 rounded-2xl border border-border/60">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Type
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {TYPE_META[active.type]?.label || active.type}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {active.type === "inventory" ? "Quantity" : "Amount"}
                    </p>
                    <p className="text-sm font-black text-foreground">
                      {renderAmount(active)}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Title
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {active.title || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Created by
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {staffLabel(staff, active.user_id, active.user_name)}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      Created
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {active.created_at
                        ? format(new Date(active.created_at), "MMM dd, yyyy HH:mm")
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      ID
                    </p>
                    <p className="text-xs font-mono text-muted-foreground break-all">
                      {active.id}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                    Details
                  </p>
                  {!active.details ? (
                    <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground">
                      No details available.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                      <div className="max-h-[360px] overflow-auto no-scrollbar">
                        {flattenSection(active.details).map((row, idx) => (
                          <div
                            key={idx}
                            className="px-5 py-3 flex items-start justify-between gap-6 border-b border-border/30 last:border-none"
                          >
                            <p className="text-xs font-semibold text-muted-foreground leading-5">
                              {row.label}
                            </p>
                            <p className="text-xs font-bold text-foreground text-right whitespace-nowrap">
                              {row.value}
                            </p>
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
            <Button
              variant="outline"
              className="h-12 rounded-2xl w-full"
              onClick={() => setDetailOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
