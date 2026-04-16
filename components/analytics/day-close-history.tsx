"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Download,
  FileText,
  RefreshCw,
  Calendar,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { DayCloseModal } from "@/components/analytics/day-close-modal";

function humanizeKey(k: string) {
  return String(k)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatMaybeCurrency(key: string, value: unknown) {
  if (typeof value !== "number") return String(value ?? "");
  const asNum = Number.isFinite(value) ? value : 0;
  const lower = key.toLowerCase();
  const looksLikeMoney =
    lower.includes("amount") ||
    lower.includes("sales") ||
    lower.includes("revenue") ||
    lower.includes("income") ||
    lower.includes("expense") ||
    lower.includes("profit") ||
    lower.includes("loss") ||
    lower.includes("total") ||
    lower.includes("tax") ||
    lower.includes("discount") ||
    lower.includes("refund") ||
    lower.includes("charge") ||
    lower.includes("cash") ||
    lower.includes("receivable") ||
    lower.includes("collection");
  const n = asNum.toLocaleString();
  return looksLikeMoney ? `Rs. ${n}` : n;
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
    const numeric = typeof v === "number" ? v : Number(v);
    const asValue = Number.isFinite(numeric) ? formatMaybeCurrency(k, numeric) : String(v ?? "");
    out.push({ label, value: asValue });
  }
  return out;
}

function getFilenameFromContentDisposition(v: string | undefined | null) {
  if (!v) return null;
  const m = /filename\*?=(?:UTF-8''|\"?)([^\";]+)/i.exec(v);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].replace(/\"/g, ""));
  } catch {
    return m[1].replace(/\"/g, "");
  }
}

async function downloadBlobFromApi(url: string, fallbackName: string, mime: string) {
  const res = await apiClient.get(url, { responseType: "blob" });
  const contentDisposition = (res as any)?.headers?.["content-disposition"] as string | undefined;
  const filename = getFilenameFromContentDisposition(contentDisposition) || fallbackName;
  const blob = new Blob([res.data], { type: mime });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function statusBadge(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") return <Badge variant="success" className="h-7 px-3 rounded-full text-[10px] font-bold uppercase">Confirmed</Badge>;
  if (s === "pending") return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-bold uppercase bg-orange-500/10 text-orange-700 dark:text-orange-500 border-none">Pending</Badge>;
  if (s === "reopened") return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-500 border-none">Reopened</Badge>;
  return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-bold uppercase">Open</Badge>;
}

export function DayCloseHistory({ restaurantId }: { restaurantId?: number }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  }));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonths, setCalendarMonths] = useState(1);
  const [status, setStatus] = useState<string>(""); // open|pending|confirmed|reopened

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [audit, setAudit] = useState<any[] | null>(null);
  const [adjustments, setAdjustments] = useState<any[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDate, setWizardDate] = useState<string | undefined>(undefined);

  const [actionOpen, setActionOpen] = useState<null | "reopen" | "adjustCash" | "addAdjustment" | "cancel">(null);
  const [actionSaving, setActionSaving] = useState(false);

  const [reopenReason, setReopenReason] = useState("");
  const [cashActual, setCashActual] = useState<string>("");
  const [cashReason, setCashReason] = useState("");
  const [cashNotes, setCashNotes] = useState("");

  const [adjType, setAdjType] = useState<"income" | "expense">("expense");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjMethod, setAdjMethod] = useState<"cash" | "card" | "digital" | "fonepay" | "credit">("cash");
  const [adjDesc, setAdjDesc] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [adjCategoryId, setAdjCategoryId] = useState<string>("");

  const canLoad = !!restaurantId;

  useEffect(() => {
    // 2 months on >=sm screens, 1 month on mobile.
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setCalendarMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const fetchList = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const start = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const end = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await apiClient.get(
        DayCloseApis.list({
          restaurantId,
          start,
          end,
          status: status || undefined,
        }),
      );
      if (res.data?.status === "success") setItems(res.data.data || []);
      else toast.error(res.data?.message || "Failed to load day closes");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load day closes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canLoad) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  // Auto-apply filter changes so users don't have to guess when it takes effect.
  useEffect(() => {
    if (!canLoad) return;
    const t = setTimeout(() => {
      fetchList();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dateRange?.from?.getTime(), dateRange?.to?.getTime(), canLoad]);

  const openDetail = async (id: number) => {
    setActiveId(id);
    setDetailOpen(true);
    setDetail(null);
    setSnapshot(null);
    setAudit(null);
    setAdjustments(null);
    setDetailLoading(true);
    setActionOpen(null);
    setActionSaving(false);
    setReopenReason("");
    setCashActual("");
    setCashReason("");
    setCashNotes("");
    setAdjType("expense");
    setAdjAmount("");
    setAdjMethod("cash");
    setAdjDesc("");
    setAdjNotes("");
    setAdjCategoryId("");
    setWizardOpen(false);
    setWizardDate(undefined);
    try {
      const res = await apiClient.get(DayCloseApis.detail(id));
      if (res.data?.status === "success") setDetail(res.data.data);
      else toast.error(res.data?.message || "Failed to load day close");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load day close");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.detail(activeId));
      if (res.data?.status === "success") setDetail(res.data.data);
    } catch {
      // ignore
    }
    fetchList();
  };

  const cancelPending = async () => {
    if (!activeId) return;
    setActionSaving(true);
    try {
      const res = await apiClient.post(DayCloseApis.cancel(activeId));
      if (res.data?.status === "success") {
        toast.success("Day close canceled");
        setActionOpen(null);
        await refreshAfterMutation();
      } else {
        toast.error(res.data?.message || "Failed to cancel day close");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to cancel day close");
    } finally {
      setActionSaving(false);
    }
  };

  const reopenDay = async () => {
    if (!activeId) return;
    const reason = reopenReason.trim();
    if (reason.length < 5) {
      toast.error("Please write a clear reason (at least 5 characters).");
      return;
    }
    setActionSaving(true);
    try {
      const res = await apiClient.post(DayCloseApis.reopen(activeId), { reopen_reason: reason });
      if (res.data?.status === "success") {
        toast.success("Day reopened. You can correct and re-confirm.");
        setActionOpen(null);
        await refreshAfterMutation();
      } else {
        toast.error(res.data?.message || "Failed to reopen day");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to reopen day");
    } finally {
      setActionSaving(false);
    }
  };

  const adjustCash = async () => {
    if (!activeId) return;
    const actual = Number(cashActual);
    if (!Number.isFinite(actual) || actual < 0) {
      toast.error("Enter a valid actual cash amount.");
      return;
    }
    const reason = cashReason.trim();
    if (reason.length < 5) {
      toast.error("Please write a clear reason (at least 5 characters).");
      return;
    }
    setActionSaving(true);
    try {
      const payload: any = {
        actual_cash: actual,
        adjustment_reason: reason,
      };
      const notes = cashNotes.trim();
      if (notes) payload.adjustment_notes = notes;
      const res = await apiClient.post(DayCloseApis.adjustCashReconciliation(activeId), payload);
      if (res.data?.status === "success") {
        toast.success("Cash reconciliation updated with audit trail");
        setActionOpen(null);
        await refreshAfterMutation();
      } else {
        toast.error(res.data?.message || "Failed to update cash reconciliation");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update cash reconciliation");
    } finally {
      setActionSaving(false);
    }
  };

  const addAdjustment = async () => {
    if (!activeId) return;
    const amount = Number(adjAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }
    const description = adjDesc.trim();
    if (description.length < 5) {
      toast.error("Description must be at least 5 characters.");
      return;
    }
    setActionSaving(true);
    try {
      const payload: any = {
        amount,
        payment_method: adjMethod,
        description,
      };
      const notes = adjNotes.trim();
      if (notes) payload.notes = notes;
      if (adjType === "expense") {
        const cid = Number(adjCategoryId);
        if (adjCategoryId.trim() && Number.isFinite(cid) && cid > 0) payload.category_id = cid;
      }

      const url =
        adjType === "expense" ? DayCloseApis.addExpenseAdjustment(activeId) : DayCloseApis.addIncomeAdjustment(activeId);
      const res = await apiClient.post(url, payload);
      if (res.data?.status === "success") {
        toast.success(`${adjType === "expense" ? "Expense" : "Income"} adjustment added`);
        setActionOpen(null);
        setAdjustments(null);
        await refreshAfterMutation();
      } else {
        toast.error(res.data?.message || "Failed to add adjustment");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add adjustment");
    } finally {
      setActionSaving(false);
    }
  };

  const loadSnapshot = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.savedSnapshot(activeId));
      if (res.data?.status === "success") setSnapshot(res.data.data);
      else toast.error(res.data?.message || "Snapshot not available");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Snapshot not available");
    }
  };

  const loadAudit = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.auditLog(activeId));
      if (res.data?.status === "success") setAudit(res.data.data || []);
      else toast.error(res.data?.message || "Failed to load audit");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load audit");
    }
  };

  const loadAdjustments = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.listAdjustments(activeId));
      if (res.data?.status === "success") setAdjustments(res.data.data || []);
      else toast.error(res.data?.message || "Failed to load adjustments");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load adjustments");
    }
  };

  const exportPdf = async () => {
    if (!activeId || !detail) return;
    try {
      await downloadBlobFromApi(
        DayCloseApis.exportPdf(activeId),
        `day_close_${String(detail.business_date || "").slice(0, 10)}.pdf`,
        "application/pdf",
      );
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to download PDF");
    }
  };

  const exportExcel = async () => {
    if (!activeId || !detail) return;
    try {
      await downloadBlobFromApi(
        DayCloseApis.exportExcel(activeId),
        `day_close_${String(detail.business_date || "").slice(0, 10)}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast.success("Excel downloaded");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to download Excel");
    }
  };

  const summaryRows = useMemo(() => {
    if (!detail) return [];
    const keys = [
      "gross_sales",
      "discount_total",
      "tax_total",
      "service_charge_total",
      "net_sales",
      "expense_total",
      "refund_total",
      "expected_cash",
      "actual_cash",
      "cash_discrepancy",
    ];
    return keys
      .map((k) => ({ label: humanizeKey(k), value: formatMaybeCurrency(k, Number(detail[k] ?? 0)) }))
      .filter(Boolean);
  }, [detail]);

  const isConfirmed = String(detail?.status || "").toLowerCase() === "confirmed";
  const isPending = String(detail?.status || "").toLowerCase() === "pending";
  const isReopened = String(detail?.status || "").toLowerCase() === "reopened";
  const isOpen = String(detail?.status || "").toLowerCase() === "open";

  const filteredItems = useMemo(() => {
    const from = dateRange?.from ? startOfDay(dateRange.from) : null;
    const to = dateRange?.to ? endOfDay(dateRange.to) : null;
    if (!from || !to) return items;
    return (items || []).filter((it) => {
      const dRaw = it?.business_date;
      if (!dRaw) return true;
      const d = new Date(String(dRaw).slice(0, 10) + "T00:00:00");
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [items, dateRange?.from, dateRange?.to]);

  const setRangeAndClose = (next: DateRange) => {
    setDateRange(next);
    setDatePickerOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
        <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-1">
              <h2 className="text-lg font-black tracking-tight">Day Close History</h2>
              <p className="text-sm text-muted-foreground">
                Export reports, inspect snapshots, and review what changed.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
	              <div className="space-y-1">
	                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Date Range</p>
	                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
	                  <PopoverTrigger asChild>
	                    <Button
	                      variant="outline"
	                      className="h-11 rounded-2xl gap-2 font-bold text-xs uppercase tracking-widest px-4 w-full sm:w-auto sm:min-w-[260px]"
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
	                  <PopoverContent
	                    className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background"
	                    align="center"
	                    style={{ fontFamily: "inherit" }}
	                  >
	                    <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[140px] shrink-0">
	                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">Quick Select</p>
	                      <div className="flex flex-col gap-1 flex-1">
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
	                        >
	                          Today
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => {
	                            const d = subDays(new Date(), 1);
	                            setRangeAndClose({ from: startOfDay(d), to: endOfDay(d) });
	                          }}
	                        >
	                          Yesterday
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) })}
	                        >
	                          This Week
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
	                        >
	                          Last 7 Days
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) })}
	                        >
	                          Last 30 Days
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
	                        >
	                          This Month
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => {
	                            const d = subMonths(new Date(), 1);
	                            setRangeAndClose({ from: startOfMonth(d), to: endOfMonth(d) });
	                          }}
	                        >
	                          Last Month
	                        </button>
	                        <button
	                          className="text-left px-3 py-2 rounded-xl text-xs font-bold hover:bg-orange-500/10 transition-colors"
	                          onClick={() => setRangeAndClose({ from: startOfYear(new Date()), to: endOfDay(new Date()) })}
	                        >
	                          Year To Date
	                        </button>
	                      </div>
	                      <button
	                        className="text-[9px] font-bold uppercase tracking-widest text-destructive/40 hover:text-destructive transition-colors mt-4 text-left"
	                        onClick={() => setRangeAndClose({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) })}
	                      >
	                        Reset
	                      </button>
	                    </div>
	                    <div className="p-4">
	                      <CalendarComponent
	                        initialFocus
	                        mode="range"
	                        defaultMonth={dateRange?.from || new Date()}
	                        selected={dateRange}
	                        onSelect={(next) => {
	                          setDateRange(next);
	                          if (next?.from && next?.to) setDatePickerOpen(false);
	                        }}
	                        numberOfMonths={calendarMonths}
	                        className="p-0"
	                        weekStartsOn={1}
	                      />
	                    </div>
	                  </PopoverContent>
	                </Popover>
	              </div>
              <div className="flex gap-2 items-center">
                <Button
                  type="button"
                  variant={status === "" ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatus("")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={status === "open" ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatus("open")}
                >
                  Open
                </Button>
                <Button
                  type="button"
                  variant={status === "confirmed" ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatus("confirmed")}
                >
                  Confirmed
                </Button>
                <Button
                  type="button"
                  variant={status === "pending" ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatus("pending")}
                >
                  Pending
                </Button>
                <Button
                  type="button"
                  variant={status === "reopened" ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setStatus("reopened")}
                >
                  Reopened
                </Button>
              </div>
              <Button
                onClick={fetchList}
                variant="secondary"
                className="h-11 rounded-2xl px-5 font-bold"
                disabled={!canLoad || loading}
              >
                <RefreshCw className={loading ? "w-4 h-4 mr-2 animate-spin" : "w-4 h-4 mr-2"} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canLoad ? (
        <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
          <CardContent className="p-8 text-muted-foreground">
            Select a restaurant to view day close history.
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="bg-card border-border/60 rounded-3xl overflow-hidden">
          <CardContent className="p-10 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No day closes found.</p>
            <p className="text-sm opacity-70">Try a different date range.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((it) => (
            <Card
              key={it.id}
              className="bg-card border-border/60 rounded-2xl overflow-hidden hover:bg-muted/10 hover:border-orange-500/20 transition-colors cursor-pointer"
              onClick={() => openDetail(it.id)}
            >
              <CardContent className="p-5 flex items-center justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-foreground truncate">
                      {it.business_date ? format(new Date(it.business_date), "MMM dd, yyyy") : `Day #${it.id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 font-bold uppercase tracking-wider">
                      {it.total_orders ?? 0} orders • Net {Number(it.net_sales || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(it.status)}
                  {String(it.status || "").toLowerCase() === "open" ? (
                    <Button
                      className="h-9 px-4 rounded-2xl font-bold bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        const d = it?.business_date ? String(it.business_date).slice(0, 10) : undefined;
                        setWizardDate(d);
                        setWizardOpen(true);
                      }}
                    >
                      Close
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(it.id);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[860px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 flex flex-row flex-wrap items-start justify-between gap-3 bg-muted/20 border-b border-border/40">
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {detail?.business_date ? format(new Date(detail.business_date), "MMMM do") : "Day Close"}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-normal opacity-80">
                Daily financial summary, snapshot, and exports
              </p>
              <DialogDescription className="sr-only">Day close details dialog.</DialogDescription>
            </div>
            {detail?.status ? statusBadge(detail.status) : null}
          </DialogHeader>

          <div className="p-6 sm:p-8 pt-6 space-y-6 overflow-auto no-scrollbar flex-1 min-h-0">
            {detailLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : !detail ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                Day close not available.
              </div>
            ) : (
              <>
                <div className="p-5 rounded-2xl border border-border/60 bg-muted/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Actions</p>
                    <p className="text-sm text-muted-foreground">
                      Open days can be closed, pending closes can be canceled, and confirmed closes can be corrected with an audit trail.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOpen ? (
                      <Button
                        className="rounded-2xl font-bold bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => {
                          const d = detail?.business_date ? String(detail.business_date).slice(0, 10) : undefined;
                          setWizardDate(d);
                          setWizardOpen(true);
                        }}
                      >
                        Close This Day
                      </Button>
                    ) : null}
                    {isPending ? (
                      <Button
                        variant="outline"
                        className="rounded-2xl font-bold"
                        onClick={() => setActionOpen("cancel")}
                      >
                        Cancel Pending Close
                      </Button>
                    ) : null}
                    {isConfirmed || isReopened ? (
                      <>
                        <Button
                          variant="secondary"
                          className="rounded-2xl font-bold"
                          onClick={() => {
                            setCashActual(String(detail.actual_cash ?? detail.expected_cash ?? ""));
                            setActionOpen("adjustCash");
                          }}
                        >
                          Adjust Cash Reconciliation
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl font-bold"
                          onClick={() => setActionOpen("addAdjustment")}
                        >
                          Add Adjustment
                        </Button>
                        <Button
                          className="rounded-2xl font-bold bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => setActionOpen("reopen")}
                        >
                          Reopen Day
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20 p-6 rounded-2xl space-y-1.5">
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-normal opacity-80">Net Sales</p>
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                      Rs. {Number(detail.net_sales || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20 p-6 rounded-2xl space-y-1.5">
                    <p className="text-[11px] font-bold text-red-700 dark:text-red-500 uppercase tracking-normal opacity-80">Total Expenses</p>
                    <p className="text-3xl font-black text-red-700 dark:text-red-400 tracking-tight">
                      Rs. {Number(detail.expense_total || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-2 rounded-2xl border border-border/40">
                  {summaryRows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                      <p className="text-sm font-semibold text-muted-foreground">{r.label}</p>
                      <p className="text-sm font-black text-foreground">{r.value}</p>
                    </div>
                  ))}
                </div>

                <Tabs defaultValue="snapshot" className="w-full">
                  <TabsList className="bg-muted/20 border border-border/60 rounded-2xl p-1 h-12">
                    <TabsTrigger value="snapshot" className="rounded-xl px-5 font-bold" onClick={() => snapshot == null && loadSnapshot()}>
                      Snapshot
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="rounded-xl px-5 font-bold" onClick={() => audit == null && loadAudit()}>
                      Audit
                    </TabsTrigger>
                    <TabsTrigger value="adjustments" className="rounded-xl px-5 font-bold" onClick={() => adjustments == null && loadAdjustments()}>
                      Adjustments
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="snapshot" className="mt-4">
                    {!snapshot ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 opacity-60" />
                          <p className="text-sm font-semibold">Snapshot not loaded yet.</p>
                        </div>
                        <Button variant="secondary" className="rounded-2xl font-bold" onClick={loadSnapshot}>
                          Load Snapshot
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                            Generated {snapshot.generated_at ? format(new Date(snapshot.generated_at), "MMM dd, yyyy HH:mm") : "—"}
                          </p>
                          <Badge variant="secondary" className="rounded-full text-[10px] font-bold uppercase">
                            Saved Snapshot
                          </Badge>
                        </div>
                        <div className="max-h-[340px] overflow-auto no-scrollbar">
                          {flattenSection(snapshot.snapshot_data || {}).map((row, idx) => (
                            <div key={idx} className="px-5 py-3 flex items-start justify-between gap-6 border-b border-border/30 last:border-none">
                              <p className="text-xs font-semibold text-muted-foreground leading-5">{row.label}</p>
                              <p className="text-xs font-black text-foreground text-right whitespace-nowrap">{row.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-4">
                    {!audit ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex items-center justify-between">
                        <p className="text-sm font-semibold">Audit log not loaded yet.</p>
                        <Button variant="secondary" className="rounded-2xl font-bold" onClick={loadAudit}>
                          Load Audit
                        </Button>
                      </div>
                    ) : audit.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground">
                        No audit entries.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                        <div className="max-h-[340px] overflow-auto no-scrollbar">
                          {audit.map((a, idx) => (
                            <div key={idx} className="px-5 py-4 border-b border-border/30 last:border-none">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-foreground">{humanizeKey(a.action || "Action")}</p>
                                <p className="text-xs font-semibold text-muted-foreground">
                                  {a.created_at ? format(new Date(a.created_at), "MMM dd, yyyy HH:mm") : "—"}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {a.user_name ? `${a.user_name}${a.user_role ? ` • ${a.user_role}` : ""}` : "System"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="adjustments" className="mt-4">
                    {!adjustments ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex items-center justify-between">
                        <p className="text-sm font-semibold">Adjustments not loaded yet.</p>
                        <Button variant="secondary" className="rounded-2xl font-bold" onClick={loadAdjustments}>
                          Load Adjustments
                        </Button>
                      </div>
                    ) : adjustments.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground">
                        No adjustments recorded for this day close.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
                        <div className="max-h-[340px] overflow-auto no-scrollbar">
                          {adjustments.map((adj, idx) => (
                            <div key={idx} className="px-5 py-4 border-b border-border/30 last:border-none">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-foreground">
                                  {humanizeKey(adj.adjustment_type || "Adjustment")}
                                </p>
                                <p className="text-sm font-black text-foreground">
                                  Rs. {Number(adj.amount || 0).toLocaleString()}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {adj.description || "—"} {adj.payment_method ? `• ${String(adj.payment_method).toUpperCase()}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>

          <DialogFooter className="p-6 sm:p-8 pt-4 flex flex-col sm:flex-row gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" className="h-12 rounded-2xl flex-1" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" className="h-12 rounded-2xl flex-1 font-bold" onClick={exportExcel} disabled={!detail}>
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button className="h-12 rounded-2xl flex-1 font-bold bg-orange-600 hover:bg-orange-700 text-white" onClick={exportPdf} disabled={!detail}>
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "cancel"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[520px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-bold tracking-tight">Cancel Pending Close?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              This will cancel the pending day close so you can re-initiate when ready.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 text-sm font-semibold flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <p>Use this if you started a close by mistake or need to fix blockers first.</p>
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={cancelPending} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Cancel Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "reopen"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[560px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-bold tracking-tight">Reopen Day Close</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Reopening is tracked in audit logs. Write a clear reason so the team understands what changed.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-2 overflow-auto flex-1 min-h-0 no-scrollbar">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Reason</p>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Example: Refund was recorded after close, reopening to include it."
              className="min-h-[120px] rounded-2xl"
            />
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={reopenDay} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "adjustCash"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[640px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-bold tracking-tight">Adjust Cash Reconciliation</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              This updates the confirmed close with a required reason and optional notes.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Actual Cash</p>
                <Input value={cashActual} onChange={(e) => setCashActual(e.target.value)} inputMode="decimal" className="h-11 rounded-2xl" placeholder="0" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Reason</p>
                <Input value={cashReason} onChange={(e) => setCashReason(e.target.value)} className="h-11 rounded-2xl" placeholder="Short reason" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Notes (optional)</p>
              <Textarea value={cashNotes} onChange={(e) => setCashNotes(e.target.value)} className="min-h-[110px] rounded-2xl" placeholder="Add context for the audit trail…" />
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={adjustCash} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "addAdjustment"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[720px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-bold tracking-tight">Add Adjustment</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Record a correction after close (income or expense) with payment method and description.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Type</p>
                <Select value={adjType} onValueChange={(v) => setAdjType(v as any)}>
                  <SelectTrigger className="h-11 rounded-2xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Amount</p>
                <Input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} inputMode="decimal" className="h-11 rounded-2xl" placeholder="0" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Payment Method</p>
                <Select value={adjMethod} onValueChange={(v) => setAdjMethod(v as any)}>
                  <SelectTrigger className="h-11 rounded-2xl">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="digital">Digital / QR</SelectItem>
                    <SelectItem value="fonepay">Fonepay</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {adjType === "expense" ? (
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Category ID (optional)</p>
                <Input value={adjCategoryId} onChange={(e) => setAdjCategoryId(e.target.value)} inputMode="numeric" className="h-11 rounded-2xl" placeholder="Leave blank" />
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Description</p>
              <Input value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} className="h-11 rounded-2xl" placeholder="Example: Supplier cash expense missed during the day" />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Notes (optional)</p>
              <Textarea value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} className="min-h-[110px] rounded-2xl" placeholder="Anything to remember later…" />
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={addAdjustment} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {restaurantId && wizardDate ? (
        <DayCloseModal
          isOpen={wizardOpen}
          onClose={async () => {
            setWizardOpen(false);
            setWizardDate(undefined);
            await fetchList();
            if (activeId) {
              // Refresh detail if user is still on the same record.
              try {
                const res = await apiClient.get(DayCloseApis.detail(activeId));
                if (res.data?.status === "success") setDetail(res.data.data);
              } catch {
                // ignore
              }
            }
          }}
          restaurantId={restaurantId}
          businessDate={wizardDate}
        />
      ) : null}
    </div>
  );
}
