"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { cn } from "@/lib/utils";
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
  Maximize2,
  Minimize2,
} from "lucide-react";
import { DayCloseHistoryListCard } from "@/components/analytics/day-close-history-list-card";
import {
  resizableDialogContentClass,
  useResizableDialogStyle,
} from "@/lib/resizable-dialog";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { DayCloseSnapshotPanel } from "@/components/analytics/day-close-snapshot-panel";
import { DayCloseFinancialSummary } from "@/components/analytics/day-close-financial-summary";
import {
  formatDayCloseExportFilename,
  formatDayCloseListHeading,
  formatDayCloseSessionLabel,
  dayCloseSessionToListItem,
} from "@/lib/day-close-format";
import { fetchDayCloseSnapshotForDetail } from "@/lib/day-close-snapshot-fetch";
import {
  parseDayCloseDetail,
  parseDayCloseList,
  parseDayCloseSessions,
  parseDayCloseSnapshotData,
  type DayCloseDetail,
  type DayCloseListItem,
  type DayCloseSession,
  type DayCloseSnapshotResponse,
  type BusinessLine,
} from "@/types/day-close";

function humanizeKey(k: string) {
  return String(k)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
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
  if (s === "confirmed") return <Badge variant="success" className="h-7 px-3 rounded-full text-[10px] font-medium uppercase">Confirmed</Badge>;
  if (s === "pending") return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-medium uppercase bg-orange-500/10 text-orange-700 dark:text-orange-500 border-none">Pending</Badge>;
  if (s === "reopened") return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-medium uppercase bg-amber-500/10 text-amber-700 dark:text-amber-500 border-none">Reopened</Badge>;
  return <Badge variant="secondary" className="h-7 px-3 rounded-full text-[10px] font-medium uppercase">Open</Badge>;
}

export function DayCloseHistory({ restaurantId }: { restaurantId?: number }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DayCloseListItem[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  }));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendarMonths, setCalendarMonths] = useState(1);
  const [status, setStatus] = useState<string>(""); // open|pending|confirmed|reopened
  const [sessions, setSessions] = useState<DayCloseSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DayCloseDetail | null>(null);
  const [snapshot, setSnapshot] = useState<DayCloseSnapshotResponse | null>(null);
  const [audit, setAudit] = useState<any[] | null>(null);
  const [adjustments, setAdjustments] = useState<any[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMaximized, setDetailMaximized] = useState(false);
  const detailDialogStyle = useResizableDialogStyle(detailMaximized, "detail");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardBusinessLine, setWizardBusinessLine] = useState<BusinessLine>("restaurant");

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

  const fetchSessions = useCallback(async () => {
    if (!restaurantId) return;
    setSessionsLoading(true);
    try {
      const res = await apiClient.get(
        DayCloseApis.sessions({ restaurantId, businessLine, limit: 50 }),
      );
      if (res.data?.status === "success") {
        setSessions(parseDayCloseSessions(res.data.data));
      } else {
        setSessions([]);
      }
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [restaurantId, businessLine]);

  const fetchList = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const start = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const end = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const res = await apiClient.get(
        DayCloseApis.list({
          restaurantId,
          businessLine,
          start,
          end,
          status: status || undefined,
          limit: 100,
        }),
      );
      if (res.data?.status === "success") {
        setItems(parseDayCloseList(res.data.data));
      } else toast.error(res.data?.message || "Failed to load day closes");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load day closes");
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    businessLine,
    dateRange?.from,
    dateRange?.to,
    status,
  ]);

  useEffect(() => {
    setSelectedSessionId(null);
  }, [businessLine]);

  useEffect(() => {
    if (!canLoad) return;
    void fetchSessions();
  }, [canLoad, fetchSessions]);

  useEffect(() => {
    if (!canLoad) return;
    const t = setTimeout(() => {
      void fetchList();
    }, 250);
    return () => clearTimeout(t);
  }, [canLoad, fetchList]);

  const displayItems = useMemo(() => {
    if (!selectedSessionId) return items;
    const fromList = items.filter((it) => it.id === selectedSessionId);
    if (fromList.length) return fromList;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (session) return [dayCloseSessionToListItem(session)];
    return [];
  }, [items, selectedSessionId, sessions]);

  const openDetail = async (id: number) => {
    setDetailMaximized(true);
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
    setWizardBusinessLine("restaurant");
    try {
      const detailRes = await apiClient.get(DayCloseApis.get(id));
      if (detailRes.data?.status !== "success") {
        toast.error(detailRes.data?.message || "Failed to load day close");
        return;
      }
      const parsedDetail = parseDayCloseDetail(detailRes.data.data);
      setDetail(parsedDetail);
      const snap = await fetchDayCloseSnapshotForDetail(id, parsedDetail, {
        restaurantId,
        businessLine,
      });
      setSnapshot(snap);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to load day close");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.get(activeId));
      if (res.data?.status === "success") setDetail(parseDayCloseDetail(res.data.data));
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
      const snap = await fetchDayCloseSnapshotForDetail(activeId, detail, {
        restaurantId,
        businessLine,
      });
      if (snap) setSnapshot(snap);
      else toast.error("Snapshot not available");
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
        formatDayCloseExportFilename(detail, "pdf"),
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
        formatDayCloseExportFilename(detail, "xlsx"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast.success("Excel downloaded");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to download Excel");
    }
  };

  const parsedSnapshotData = useMemo(
    () => parseDayCloseSnapshotData(snapshot?.snapshot_data ?? snapshot),
    [snapshot],
  );

  const isConfirmed = String(detail?.status || "").toLowerCase() === "confirmed";

  const isPending = String(detail?.status || "").toLowerCase() === "pending";
  const isReopened = String(detail?.status || "").toLowerCase() === "reopened";
  const isOpen = String(detail?.status || "").toLowerCase() === "open";
  const showConfirmedActions = isConfirmed || isReopened;
  const showConfirmedActionsInHeader = detailMaximized && showConfirmedActions;

  const detailSubtitle = useMemo(() => {
    if (!detail) return null;
    if (detail.confirmed_at) {
      const confirmed = new Date(detail.confirmed_at);
      if (!Number.isNaN(confirmed.getTime())) {
        return `Confirmed ${confirmed.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`;
      }
    }
    return "Server snapshot — totals are not recalculated in the browser";
  }, [detail]);

  const setRangeAndClose = (next: DateRange) => {
    setDateRange(next);
    setDatePickerOpen(false);
  };

  return (
    <div className="day-close-ui space-y-4">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-6 lg:p-7">
          <div className="space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Day Close History</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Export reports, inspect snapshots, and review what changed.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                <p className="dc-eyebrow">Date Range</p>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="dc-btn-outline h-11 rounded-2xl gap-2 font-medium text-xs uppercase tracking-wide sm:tracking-widest px-4 w-full justify-start sm:justify-center"
                    >
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="truncate">
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
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[calc(100vw-2rem)] sm:w-auto max-w-[calc(100vw-2rem)] sm:max-w-none p-0 flex flex-col sm:flex-row shadow-2xl border border-border/40 rounded-2xl sm:rounded-[24px] overflow-hidden bg-background"
                    align="start"
                    sideOffset={8}
                    style={{ fontFamily: "inherit" }}
                  >
                    <div className="flex sm:flex-col gap-1 p-3 sm:p-5 border-b sm:border-b-0 sm:border-r border-border/40 bg-muted/20 sm:w-[140px] shrink-0 overflow-x-auto sm:overflow-x-visible no-scrollbar">
                      <p className="hidden sm:block text-[9px] font-semibold uppercase tracking-[0.3em] text-orange-500 mb-2 sm:mb-4 shrink-0">
                        Quick Select
                      </p>
                      <div className="flex sm:flex-col gap-1 flex-1 min-w-0">
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() => setRangeAndClose({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() => {
                            const d = subDays(new Date(), 1);
                            setRangeAndClose({ from: startOfDay(d), to: endOfDay(d) });
                          }}
                        >
                          Yesterday
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() =>
                            setRangeAndClose({
                              from: startOfWeek(new Date(), { weekStartsOn: 1 }),
                              to: endOfWeek(new Date(), { weekStartsOn: 1 }),
                            })
                          }
                        >
                          This Week
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() =>
                            setRangeAndClose({
                              from: startOfDay(subDays(new Date(), 7)),
                              to: endOfDay(new Date()),
                            })
                          }
                        >
                          Last 7 Days
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() =>
                            setRangeAndClose({
                              from: startOfDay(subDays(new Date(), 30)),
                              to: endOfDay(new Date()),
                            })
                          }
                        >
                          Last 30 Days
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() =>
                            setRangeAndClose({
                              from: startOfMonth(new Date()),
                              to: endOfMonth(new Date()),
                            })
                          }
                        >
                          This Month
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() => {
                            const d = subMonths(new Date(), 1);
                            setRangeAndClose({ from: startOfMonth(d), to: endOfMonth(d) });
                          }}
                        >
                          Last Month
                        </button>
                        <button
                          type="button"
                          className="shrink-0 sm:shrink px-3 py-2 rounded-xl text-xs font-medium hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                          onClick={() =>
                            setRangeAndClose({
                              from: startOfYear(new Date()),
                              to: endOfDay(new Date()),
                            })
                          }
                        >
                          Year To Date
                        </button>
                      </div>
                      <button
                        type="button"
                        className="hidden sm:block text-[9px] font-medium uppercase tracking-widest text-destructive/40 hover:text-destructive transition-colors mt-4 text-left"
                        onClick={() =>
                          setRangeAndClose({
                            from: startOfDay(subDays(new Date(), 30)),
                            to: endOfDay(new Date()),
                          })
                        }
                      >
                        Reset
                      </button>
                    </div>
                    <div className="p-2 sm:p-4 flex justify-center overflow-x-auto">
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

              <div className="space-y-1.5">
                <p className="dc-eyebrow">Business Line</p>
                <Select value={businessLine} onValueChange={(v) => setBusinessLine(v as BusinessLine)}>
                  <SelectTrigger className="h-11 rounded-2xl w-full font-medium dc-input-outline">
                    <SelectValue placeholder="Business line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                <p className="dc-eyebrow">
                  Confirmed Close
                </p>
                <Select
                  value={selectedSessionId ? String(selectedSessionId) : "all"}
                  onValueChange={(v) => setSelectedSessionId(v === "all" ? null : Number(v))}
                  disabled={sessionsLoading && sessions.length === 0}
                >
                  <SelectTrigger className="h-11 rounded-2xl w-full font-medium text-xs dc-input-outline">
                    <SelectValue
                      placeholder={sessionsLoading ? "Loading sessions…" : "All closes in range"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All closes in range</SelectItem>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        {formatDayCloseSessionLabel(session)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5 min-w-0 flex-1">
                <p className="dc-eyebrow">Status</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {(
                    [
                      { value: "", label: "All" },
                      { value: "open", label: "Open" },
                      { value: "confirmed", label: "Confirmed" },
                      { value: "pending", label: "Pending" },
                      { value: "reopened", label: "Reopened" },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "dc-btn-outline rounded-full h-9 px-3 sm:px-4 text-xs font-medium",
                        status === opt.value && "border-black/25 font-semibold text-neutral-900",
                      )}
                      onClick={() => setStatus(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => {
                  void fetchSessions();
                  void fetchList();
                }}
                variant="secondary"
                className="h-11 rounded-2xl px-5 font-medium w-full sm:w-auto shrink-0"
                disabled={!canLoad || loading}
              >
                <RefreshCw
                  className={
                    loading || sessionsLoading ? "w-4 h-4 mr-2 animate-spin" : "w-4 h-4 mr-2"
                  }
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canLoad ? (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-muted-foreground">
            Select a restaurant to view day close history.
          </CardContent>
        </Card>
      ) : displayItems.length === 0 ? (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-10 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No day closes found.</p>
            <p className="text-sm opacity-70">
              {selectedSessionId
                ? "This confirmed close is outside the current date range. Clear the session filter or widen the range."
                : "Try a different date range or status filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {displayItems.map((it) => (
            <DayCloseHistoryListCard
              key={it.id}
              item={it}
              onOpen={() => openDetail(it.id)}
              onClose={
                String(it.status || "").toLowerCase() === "open"
                  ? () => {
                      setWizardBusinessLine(
                        String(it.business_line ?? "restaurant").toLowerCase() === "hotel"
                          ? "hotel"
                          : "restaurant",
                      );
                      setWizardOpen(true);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailMaximized(false);
        }}
      >
        <DialogContent
          className={resizableDialogContentClass(
            detailMaximized,
            "day-close-ui bg-card border-border p-0 overflow-hidden shadow-2xl flex flex-col",
          )}
          style={detailDialogStyle}
        >
          <DialogHeader className="px-5 sm:px-6 py-3.5 pr-14 sm:pr-16 flex flex-row items-start justify-between gap-2 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight leading-snug break-words">
                {detail ? formatDayCloseListHeading(detail) : "Day Close"}
              </DialogTitle>
              {detailSubtitle ? (
                <p className="mt-1 text-xs text-muted-foreground leading-snug">{detailSubtitle}</p>
              ) : null}
              <DialogDescription className="sr-only">Day close details dialog.</DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-full">
              {showConfirmedActionsInHeader ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl font-medium h-8 text-xs sm:text-sm border-black/20 bg-white text-neutral-900 hover:bg-neutral-50"
                    onClick={() => {
                      setCashActual(String(detail?.actual_cash ?? detail?.expected_cash ?? ""));
                      setActionOpen("adjustCash");
                    }}
                  >
                    Adjust Cash Reconciliation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-medium h-8 text-xs sm:text-sm dc-btn-outline"
                    onClick={() => setActionOpen("addAdjustment")}
                  >
                    Add Adjustment
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl font-medium h-8 text-xs sm:text-sm bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => setActionOpen("reopen")}
                  >
                    Reopen Day
                  </Button>
                </div>
              ) : null}
              {detail?.status ? statusBadge(detail.status) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setDetailMaximized((v) => !v)}
                aria-label={detailMaximized ? "Minimize window" : "Maximize window"}
                title={detailMaximized ? "Minimize" : "Maximize"}
              >
                {detailMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-4 space-y-4 overflow-auto no-scrollbar flex-1 min-h-0">
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
                {(isOpen || isPending || (showConfirmedActions && !showConfirmedActionsInHeader)) ? (
                  <div className="dc-surface flex flex-wrap items-center justify-end gap-2 p-3 sm:p-4">
                    {isOpen ? (
                      <Button
                        className="rounded-2xl font-medium bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => {
                          setWizardBusinessLine(
                            String(detail.business_line ?? "restaurant").toLowerCase() === "hotel"
                              ? "hotel"
                              : "restaurant",
                          );
                          setWizardOpen(true);
                        }}
                      >
                        Close This Day
                      </Button>
                    ) : null}
                    {isPending ? (
                      <Button
                        variant="outline"
                        className="dc-btn-outline rounded-2xl font-medium"
                        onClick={() => setActionOpen("cancel")}
                      >
                        Cancel Pending Close
                      </Button>
                    ) : null}
                    {showConfirmedActions && !showConfirmedActionsInHeader ? (
                      <>
                        <Button
                          variant="secondary"
                          className="rounded-2xl font-medium"
                          onClick={() => {
                            setCashActual(String(detail.actual_cash ?? detail.expected_cash ?? ""));
                            setActionOpen("adjustCash");
                          }}
                        >
                          Adjust Cash Reconciliation
                        </Button>
                        <Button
                          variant="outline"
                          className="dc-btn-outline rounded-2xl font-medium"
                          onClick={() => setActionOpen("addAdjustment")}
                        >
                          Add Adjustment
                        </Button>
                        <Button
                          className="rounded-2xl font-medium bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => setActionOpen("reopen")}
                        >
                          Reopen Day
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {parsedSnapshotData ? (
                  <DayCloseFinancialSummary snapshot={parsedSnapshotData} />
                ) : null}

                <Tabs defaultValue="snapshot" className="w-full">
                  <TabsList className="bg-muted/20 border border-border/60 rounded-2xl p-1 h-11 sm:h-12 w-full grid grid-cols-3">
                    <TabsTrigger value="snapshot" className="rounded-xl px-2 sm:px-5 font-medium text-xs sm:text-sm" onClick={() => snapshot == null && loadSnapshot()}>
                      Snapshot
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="rounded-xl px-2 sm:px-5 font-medium text-xs sm:text-sm" onClick={() => audit == null && loadAudit()}>
                      Audit
                    </TabsTrigger>
                    <TabsTrigger value="adjustments" className="rounded-xl px-2 sm:px-5 font-medium text-xs sm:text-sm" onClick={() => adjustments == null && loadAdjustments()}>
                      Adjustments
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="snapshot" className="mt-4">
                    {!parsedSnapshotData ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 opacity-60" />
                          <p className="text-sm font-semibold">Snapshot not available for this day close.</p>
                        </div>
                        <Button variant="secondary" className="rounded-2xl font-medium" onClick={loadSnapshot}>
                          Retry Snapshot
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <p className="dc-eyebrow">
                            Generated{" "}
                            {snapshot?.generated_at
                              ? format(new Date(snapshot.generated_at), "MMM dd, yyyy HH:mm")
                              : "—"}
                          </p>
                          <Badge variant="secondary" className="rounded-full text-[10px] font-medium uppercase">
                            Saved Snapshot
                          </Badge>
                        </div>
                        <DayCloseSnapshotPanel snapshot={parsedSnapshotData} hideFinancialSummary />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-4">
                    {!audit ? (
                      <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex items-center justify-between">
                        <p className="text-sm font-semibold">Audit log not loaded yet.</p>
                        <Button variant="secondary" className="rounded-2xl font-medium" onClick={loadAudit}>
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
                                <p className="text-sm font-semibold text-foreground">{humanizeKey(a.action || "Action")}</p>
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
                        <Button variant="secondary" className="rounded-2xl font-medium" onClick={loadAdjustments}>
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
                                <p className="text-sm font-semibold text-foreground">
                                  {humanizeKey(adj.adjustment_type || "Adjustment")}
                                </p>
                                <p className="text-sm font-semibold text-foreground">
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

            <div className="pt-6 mt-2 border-t border-border/40 flex flex-col gap-3 shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button variant="outline" className="dc-btn-outline h-12 rounded-2xl flex-1" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="secondary"
                  className="h-12 rounded-2xl flex-1 font-medium"
                  onClick={exportExcel}
                  disabled={!detail}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  className="dc-btn-primary h-12 rounded-2xl flex-1"
                  onClick={exportPdf}
                  disabled={!detail}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium text-center sm:text-left pb-2">
                PDF and Excel are generated on the server from the saved day-close snapshot.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "cancel"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="day-close-ui w-[calc(100vw-1.5rem)] sm:max-w-[520px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-medium tracking-tight">Cancel Pending Close?</DialogTitle>
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
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="dc-btn-outline flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={cancelPending} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Cancel Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "reopen"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="day-close-ui w-[calc(100vw-1.5rem)] sm:max-w-[560px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-medium tracking-tight">Reopen Day Close</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Reopening is tracked in audit logs. Write a clear reason so the team understands what changed.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-2 overflow-auto flex-1 min-h-0 no-scrollbar">
            <p className="dc-eyebrow">Reason</p>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Example: Refund was recorded after close, reopening to include it."
              className="min-h-[120px] rounded-2xl"
            />
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="dc-btn-outline flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={reopenDay} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "adjustCash"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="day-close-ui w-[calc(100vw-1.5rem)] sm:max-w-[640px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-medium tracking-tight">Adjust Cash Reconciliation</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              This updates the confirmed close with a required reason and optional notes.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="dc-eyebrow">Actual Cash</p>
                <Input value={cashActual} onChange={(e) => setCashActual(e.target.value)} inputMode="decimal" className="h-11 rounded-2xl" placeholder="0" />
              </div>
              <div className="space-y-1">
                <p className="dc-eyebrow">Reason</p>
                <Input value={cashReason} onChange={(e) => setCashReason(e.target.value)} className="h-11 rounded-2xl" placeholder="Short reason" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="dc-eyebrow">Notes (optional)</p>
              <Textarea value={cashNotes} onChange={(e) => setCashNotes(e.target.value)} className="min-h-[110px] rounded-2xl" placeholder="Add context for the audit trail…" />
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="dc-btn-outline flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={adjustCash} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen === "addAdjustment"} onOpenChange={(o) => !o && setActionOpen(null)}>
        <DialogContent className="day-close-ui w-[calc(100vw-1.5rem)] sm:max-w-[720px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-medium tracking-tight">Add Adjustment</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Record a correction after close (income or expense) with payment method and description.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="dc-eyebrow">Type</p>
                <Select value={adjType} onValueChange={(v) => setAdjType(v as any)}>
                  <SelectTrigger className="h-11 rounded-2xl dc-input-outline">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="dc-eyebrow">Amount</p>
                <Input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} inputMode="decimal" className="h-11 rounded-2xl" placeholder="0" />
              </div>
              <div className="space-y-1">
                <p className="dc-eyebrow">Payment Method</p>
                <Select value={adjMethod} onValueChange={(v) => setAdjMethod(v as any)}>
                  <SelectTrigger className="h-11 rounded-2xl dc-input-outline">
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
                <p className="dc-eyebrow">Category ID (optional)</p>
                <Input value={adjCategoryId} onChange={(e) => setAdjCategoryId(e.target.value)} inputMode="numeric" className="h-11 rounded-2xl" placeholder="Leave blank" />
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="dc-eyebrow">Description</p>
              <Input value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} className="h-11 rounded-2xl" placeholder="Example: Supplier cash expense missed during the day" />
            </div>

            <div className="space-y-1">
              <p className="dc-eyebrow">Notes (optional)</p>
              <Textarea value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} className="min-h-[110px] rounded-2xl" placeholder="Anything to remember later…" />
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setActionOpen(null)} disabled={actionSaving} className="dc-btn-outline flex-1 h-12 rounded-2xl">
              Back
            </Button>
            <Button onClick={addAdjustment} disabled={actionSaving} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-medium">
              {actionSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {restaurantId && wizardOpen ? (
        <DayCloseModal
          isOpen={wizardOpen}
          onClose={async () => {
            setWizardOpen(false);
            await fetchList();
            if (activeId) {
              try {
                const res = await apiClient.get(DayCloseApis.get(activeId));
                if (res.data?.status === "success") {
                  setDetail(parseDayCloseDetail(res.data.data));
                }
              } catch {
                // ignore
              }
            }
          }}
          restaurantId={restaurantId}
          businessLine={wizardBusinessLine}
        />
      ) : null}
    </div>
  );
}
