"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  format,
  isToday,
  isYesterday,
  subDays,
  startOfDay,
  endOfDay,
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
import type { DayCloseSnapshotTab } from "@/lib/day-close-snapshot-view";
import {
  parseDayCloseDetail,
  parseDayCloseList,
  parseDayCloseSessions,
  parseDayCloseSnapshotData,
  type DayCloseCurrent,
  type DayCloseDetail,
  type DayCloseListItem,
  type DayCloseSession,
  type DayCloseSnapshotData,
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

function getDayCloseActionErrorMessage(err: any, fallback: string) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    if (detail.error_code === "DAY_CLOSED_LOCKED") {
      const businessDate = detail.business_date ? ` ${detail.business_date}` : "";
      return `Day close${businessDate} is already finalized. You cannot reopen older confirmed days. Use Adjust Cash Reconciliation or Add Adjustment instead.`;
    }
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
  }
  return err?.response?.data?.message || fallback;
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

function PresetButton({ label, onClick, active, className }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center w-full px-3 py-2.5 rounded-xl text-left text-[10px] font-semibold transition-all duration-200",
        active
          ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
          : "hover:bg-accent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}

function ConfirmedDayCloseActionButtons({
  compact = false,
  onAdjustCash,
  onAddAdjustment,
  onReopen,
}: {
  compact?: boolean;
  onAdjustCash: () => void;
  onAddAdjustment: () => void;
  onReopen: () => void;
}) {
  const buttonClass = cn(
    "border-0 shadow-none font-medium shrink-0",
    compact
      ? "flex-1 h-auto min-h-10 py-2.5 px-2 rounded-2xl text-xs sm:text-sm text-center leading-snug"
      : "h-8 rounded-xl text-xs sm:text-sm whitespace-nowrap",
  );

  return (
    <div
      className={cn(
        "flex gap-2",
        compact ? "flex-row items-stretch w-full" : "flex-nowrap items-center shrink-0",
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        className={cn("dc-action-secondary", buttonClass)}
        onClick={onAdjustCash}
      >
        Adjust Cash Reconciliation
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn("dc-action-outline", buttonClass)}
        onClick={onAddAdjustment}
      >
        Add Adjustment
      </Button>
      <Button size="sm" className={cn("dc-btn-close-day", buttonClass)} onClick={onReopen}>
        Reopen Day
      </Button>
    </div>
  );
}

function ReopenedDayCloseActionButtons({
  compact = false,
  onReconfirm,
}: {
  compact?: boolean;
  onReconfirm: () => void;
}) {
  const buttonClass = cn(
    "font-medium shrink-0",
    compact
      ? "w-full h-auto min-h-10 py-2.5 px-3 rounded-2xl text-xs sm:text-sm text-center leading-snug"
      : "h-8 rounded-xl text-xs sm:text-sm whitespace-nowrap",
  );

  return (
    <Button size="sm" className={cn("dc-btn-close-day", buttonClass)} onClick={onReconfirm}>
      Re-confirm Day Close
    </Button>
  );
}

function DetailMaximizeToggleButton({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-full"
      onClick={onToggle}
      aria-label={maximized ? "Minimize window" : "Maximize window"}
      title={maximized ? "Minimize" : "Maximize"}
    >
      {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  );
}

function SkeletonMetricCard({ dense = false }: { dense?: boolean }) {
  return (
    <div
      className={cn(
        "dc-card rounded-2xl border border-border/50 bg-card/80 space-y-3",
        dense ? "p-3" : "p-4",
      )}
    >
      <Skeleton className={cn("h-3", dense ? "w-16" : "w-20")} />
      <Skeleton className={cn(dense ? "h-6 w-24" : "h-7 w-28")} />
    </div>
  );
}

function DayCloseDetailDialogSkeleton({ compact = false }: { compact?: boolean }) {
  const primaryCount = 4;
  const secondaryCount = 5;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <section className="space-y-3">
        <Skeleton className="h-4 w-36" />
        {compact ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
            {Array.from({ length: primaryCount + secondaryCount }).map((_, index) => (
              <SkeletonMetricCard key={index} dense />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              {Array.from({ length: primaryCount }).map((_, index) => (
                <SkeletonMetricCard key={`primary-${index}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 pt-1">
              {Array.from({ length: secondaryCount }).map((_, index) => (
                <SkeletonMetricCard key={`secondary-${index}`} dense />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9 rounded-xl" />
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-2xl" />
          <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 mt-2 border-t border-border/40 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 flex-1 rounded-2xl" />
        </div>
        <Skeleton className="mx-auto h-3 w-64 max-w-full" />
      </div>
    </div>
  );
}

type DayCloseHistoryProps = {
  restaurantId?: number;
  liveCurrentClose?: DayCloseCurrent | null;
  liveSnapshotPreview?: DayCloseSnapshotData | null;
  onLiveCurrentRefresh?: () => Promise<void> | void;
};

export type DayCloseHistoryHandle = {
  openDayCloseDetail: (id: number) => Promise<void>;
};

export const DayCloseHistory = forwardRef<DayCloseHistoryHandle, DayCloseHistoryProps>(function DayCloseHistory({
  restaurantId,
  liveCurrentClose,
  liveSnapshotPreview,
  onLiveCurrentRefresh,
}: DayCloseHistoryProps, ref) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DayCloseListItem[]>([]);
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  }));
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
  const [detailTab, setDetailTab] = useState<"snapshot" | "audit" | "adjustments">("snapshot");
  const [snapshotTab, setSnapshotTab] = useState<DayCloseSnapshotTab>("payments");
  const snapshotSectionRef = useRef<HTMLDivElement>(null);
  const detailDialogStyle = useResizableDialogStyle(detailMaximized, "detail");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardBusinessLine, setWizardBusinessLine] = useState<BusinessLine>("restaurant");
  const [wizardDayCloseId, setWizardDayCloseId] = useState<number | null>(null);
  const [wizardBusinessDate, setWizardBusinessDate] = useState<string | null>(null);

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
    const liveBusinessLine = String(liveCurrentClose?.business_line ?? businessLine).toLowerCase();
    const currentBusinessLine = String(businessLine ?? "restaurant").toLowerCase();
    const canOverlayLiveCurrent =
      !!liveCurrentClose?.id &&
      liveBusinessLine === currentBusinessLine &&
      ["open", "pending", "reopened"].includes(String(liveCurrentClose?.status ?? "").toLowerCase());

    const withLiveOverlay = items.map((it) => {
      if (!canOverlayLiveCurrent || it.id !== liveCurrentClose?.id) return it;
      return {
        ...it,
        status: liveCurrentClose?.status ?? it.status,
        business_line: liveCurrentClose?.business_line ?? it.business_line,
        business_date: liveCurrentClose?.business_date ?? it.business_date,
        period_start_at: liveCurrentClose?.period_start_at ?? it.period_start_at,
        period_end_at: liveCurrentClose?.period_end_at ?? it.period_end_at,
        net_sales:
          typeof liveSnapshotPreview?.net_sales === "number"
            ? liveSnapshotPreview.net_sales
            : it.net_sales,
        expected_cash:
          typeof liveSnapshotPreview?.expected_cash === "number"
            ? liveSnapshotPreview.expected_cash
            : it.expected_cash,
        actual_cash: undefined,
      } satisfies DayCloseListItem;
    });

    if (!selectedSessionId) return withLiveOverlay;
    const fromList = withLiveOverlay.filter((it) => it.id === selectedSessionId);
    if (fromList.length) return fromList;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (session) return [dayCloseSessionToListItem(session)];
    return [];
  }, [items, selectedSessionId, sessions, liveCurrentClose, liveSnapshotPreview, businessLine]);

  const openDetail = useCallback(async (id: number) => {
    setDetailMaximized(true);
    setActiveId(id);
    setDetailOpen(true);
    setDetail(null);
    setSnapshot(null);
    setAudit(null);
    setAdjustments(null);
    setDetailTab("snapshot");
    setSnapshotTab("payments");
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
      if (!parsedDetail) {
        toast.error("Invalid day close detail from server");
        return;
      }
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
  }, [businessLine, restaurantId]);

  useImperativeHandle(ref, () => ({
    openDayCloseDetail: openDetail,
  }), [openDetail]);

  const refreshAfterMutation = async () => {
    if (!activeId) return;
    try {
      const res = await apiClient.get(DayCloseApis.get(activeId));
      if (res.data?.status === "success") {
        const parsedDetail = parseDayCloseDetail(res.data.data);
        setDetail(parsedDetail);
        if (parsedDetail) {
          const snap = await fetchDayCloseSnapshotForDetail(activeId, parsedDetail, {
            restaurantId,
            businessLine,
          });
          setSnapshot(snap);
        }
      }
    } catch {
      // ignore
    }
    if (adjustments != null) {
      await loadAdjustments();
    }
    if (audit != null) {
      await loadAudit();
    }
    await Promise.all([
      fetchList(),
      Promise.resolve(onLiveCurrentRefresh?.()),
    ]);
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
      toast.error(getDayCloseActionErrorMessage(err, "Failed to reopen day"));
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
      toast.error(
        getDayCloseActionErrorMessage(err, "Failed to update cash reconciliation"),
      );
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
        setAdjType("expense");
        setAdjAmount("");
        setAdjMethod("cash");
        setAdjDesc("");
        setAdjNotes("");
        setAdjCategoryId("");
        await refreshAfterMutation();
      } else {
        toast.error(res.data?.message || "Failed to add adjustment");
      }
    } catch (err: any) {
      toast.error(getDayCloseActionErrorMessage(err, "Failed to add adjustment"));
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

  const handleFinancialMetricNavigate = useCallback(
    (tab: DayCloseSnapshotTab) => {
      setDetailTab("snapshot");
      setSnapshotTab(tab);
      if (!snapshot && activeId) void loadSnapshot();
      window.requestAnimationFrame(() => {
        snapshotSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [activeId, snapshot, loadSnapshot],
  );

  const isConfirmed = String(detail?.status || "").toLowerCase() === "confirmed";

  const isPending = String(detail?.status || "").toLowerCase() === "pending";
  const isReopened = String(detail?.status || "").toLowerCase() === "reopened";
  const isOpen = String(detail?.status || "").toLowerCase() === "open";
  const showConfirmedActions = isConfirmed;
  const showReopenedActions = isReopened;
  const showConfirmedActionsInHeader = detailMaximized && showConfirmedActions;
  const showReopenedActionsInHeader = detailMaximized && showReopenedActions;

  const openCloseWizard = useCallback(() => {
    if (!detail) return;
    setWizardBusinessLine(
      String(detail.business_line ?? "restaurant").toLowerCase() === "hotel"
        ? "hotel"
        : "restaurant",
    );
    setWizardDayCloseId(detail.id);
    setWizardBusinessDate(detail.business_date ?? null);
    setWizardOpen(true);
  }, [detail]);

  const detailSubtitle = useMemo(() => {
    if (!detail) return null;
    if (isReopened) {
      return "This day close was reopened. Review the numbers, then use Re-confirm Day Close to save a fresh close.";
    }
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
  }, [detail, isReopened]);

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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-11 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest w-full justify-start",
                      )}
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
                    className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background"
                    align="center"
                    style={{ fontFamily: "inherit" }}
                  >
                    <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[140px] shrink-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">Quick Select</p>
                      <div className="flex flex-col gap-1 flex-1">
                        <PresetButton
                          label="Today"
                          onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                          active={dateRange?.from && isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))}
                        />
                        <PresetButton
                          label="Yesterday"
                          onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) })}
                          active={dateRange?.from && isYesterday(dateRange.from)}
                        />
                        <PresetButton
                          label="Last 7 Days"
                          onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                          active={dateRange?.from && format(dateRange.from, "yyyy-MM-dd") === format(subDays(new Date(), 7), "yyyy-MM-dd")}
                        />
                        <PresetButton
                          label="Last 30 Days"
                          onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) })}
                          active={dateRange?.from && format(dateRange.from, "yyyy-MM-dd") === format(subDays(new Date(), 30), "yyyy-MM-dd")}
                        />
                      </div>
                      <button
                        className="text-[9px] font-bold uppercase tracking-widest text-destructive/40 hover:text-destructive transition-colors mt-4 text-left"
                        onClick={() =>
                          setDateRange({
                            from: startOfDay(subDays(new Date(), 30)),
                            to: endOfDay(new Date()),
                          })
                        }
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
                        onSelect={setDateRange}
                        numberOfMonths={1}
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
                  <SelectTrigger className="dc-filter-control dc-filter-control-active h-11 rounded-2xl w-full font-medium">
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
                  <SelectTrigger className="dc-filter-control dc-filter-control-active h-11 rounded-2xl w-full font-medium text-xs">
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
                      variant="ghost"
                      className={cn(
                        "dc-filter-chip",
                        status === opt.value && "dc-filter-chip-active",
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
                variant="ghost"
                className="dc-filter-refresh h-11 rounded-2xl px-5 font-medium w-full sm:w-auto shrink-0"
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
                      setWizardDayCloseId(null);
                      setWizardBusinessDate(null);
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
            "day-close-ui relative bg-card border-border p-0 overflow-hidden shadow-2xl flex flex-col",
          )}
          style={detailDialogStyle}
        >
          {detailLoading ? (
            <div
              className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/10 backdrop-blur-[2px]"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="h-9 w-9 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-foreground">Please wait</p>
            </div>
          ) : null}
          <DialogHeader className="px-5 sm:px-6 py-3.5 pr-14 sm:pr-16 flex flex-row items-start justify-between gap-2 border-b border-border/40 bg-muted/20 shrink-0">
            <div className="min-w-0 flex-1">
              {detailLoading ? (
                <div className="space-y-2 py-0.5">
                  <Skeleton className="h-6 w-full max-w-md" />
                  <Skeleton className="h-3 w-44" />
                </div>
              ) : (
                <>
                  <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight leading-snug break-words">
                    {detail ? formatDayCloseListHeading(detail) : "Day Close"}
                  </DialogTitle>
                  {detailSubtitle ? (
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">{detailSubtitle}</p>
                  ) : null}
                </>
              )}
              <DialogDescription className="sr-only">Day close details dialog.</DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-end max-w-full">
              {detailLoading ? (
                <>
                  <Skeleton className="hidden sm:block h-8 w-40 rounded-xl" />
                  <Skeleton className="hidden sm:block h-8 w-28 rounded-xl" />
                  <Skeleton className="h-8 w-24 rounded-xl" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <DetailMaximizeToggleButton
                    maximized={detailMaximized}
                    onToggle={() => setDetailMaximized((v) => !v)}
                  />
                </>
              ) : showConfirmedActionsInHeader ? (
                <>
                  <ConfirmedDayCloseActionButtons
                    onAdjustCash={() => {
                      setCashActual(String(detail?.actual_cash ?? detail?.expected_cash ?? ""));
                      setActionOpen("adjustCash");
                    }}
                    onAddAdjustment={() => setActionOpen("addAdjustment")}
                    onReopen={() => setActionOpen("reopen")}
                  />
                  {detail?.status ? statusBadge(detail.status) : null}
                  <DetailMaximizeToggleButton
                    maximized={detailMaximized}
                    onToggle={() => setDetailMaximized((v) => !v)}
                  />
                </>
              ) : showReopenedActionsInHeader ? (
                <>
                  <ReopenedDayCloseActionButtons onReconfirm={openCloseWizard} />
                  {detail?.status ? statusBadge(detail.status) : null}
                  <DetailMaximizeToggleButton
                    maximized={detailMaximized}
                    onToggle={() => setDetailMaximized((v) => !v)}
                  />
                </>
              ) : (
                <>
                  {isOpen ? (
                    <Button
                      size="sm"
                      className="dc-btn-close-day rounded-xl font-medium h-8 shrink-0 text-xs sm:text-sm whitespace-nowrap"
                      onClick={openCloseWizard}
                    >
                      Close This Day
                    </Button>
                  ) : null}
                  {detail?.status ? statusBadge(detail.status) : null}
                  <DetailMaximizeToggleButton
                    maximized={detailMaximized}
                    onToggle={() => setDetailMaximized((v) => !v)}
                  />
                </>
              )}
            </div>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-4 space-y-4 overflow-auto no-scrollbar flex-1 min-h-0">
            {detailLoading ? (
              <DayCloseDetailDialogSkeleton compact={!detailMaximized} />
            ) : !detail ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                Day close not available.
              </div>
            ) : (
              <>
                {(isPending || (showConfirmedActions && !showConfirmedActionsInHeader) || (showReopenedActions && !showReopenedActionsInHeader)) ? (
                  <div
                    className={cn(
                      isPending && detailMaximized && "dc-surface p-3 sm:p-4",
                      isPending && !detailMaximized && "w-full",
                      showConfirmedActions && !showConfirmedActionsInHeader && "w-full",
                      showReopenedActions && !showReopenedActionsInHeader && "w-full",
                    )}
                  >
                    {isPending ? (
                      <Button
                        variant="outline"
                        className="dc-btn-outline border-0 shadow-none rounded-2xl font-medium w-full sm:w-auto"
                        onClick={() => setActionOpen("cancel")}
                      >
                        Cancel Pending Close
                      </Button>
                    ) : null}
                    {showReopenedActions && !showReopenedActionsInHeader ? (
                      <ReopenedDayCloseActionButtons compact onReconfirm={openCloseWizard} />
                    ) : null}
                    {showConfirmedActions && !showConfirmedActionsInHeader ? (
                      <ConfirmedDayCloseActionButtons
                        compact
                        onAdjustCash={() => {
                          setCashActual(String(detail.actual_cash ?? detail.expected_cash ?? ""));
                          setActionOpen("adjustCash");
                        }}
                        onAddAdjustment={() => setActionOpen("addAdjustment")}
                        onReopen={() => setActionOpen("reopen")}
                      />
                    ) : null}
                  </div>
                ) : null}

                {isReopened ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                    This close is reopened. Make any corrections you need, then use <span className="font-semibold">Re-confirm Day Close</span> to save the updated close for this business day.
                  </div>
                ) : null}

                {parsedSnapshotData ? (
                  <DayCloseFinancialSummary
                    snapshot={parsedSnapshotData}
                    detail={detail}
                    compact={!detailMaximized}
                    onMetricNavigate={handleFinancialMetricNavigate}
                  />
                ) : null}

                <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as typeof detailTab)} className="w-full">
                  <TabsList className="dc-tabs-list grid grid-cols-3 rounded-2xl">
                    <TabsTrigger value="snapshot" className="dc-tab-trigger" onClick={() => snapshot == null && loadSnapshot()}>
                      Snapshot
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="dc-tab-trigger" onClick={() => audit == null && loadAudit()}>
                      Audit
                    </TabsTrigger>
                    <TabsTrigger value="adjustments" className="dc-tab-trigger" onClick={() => adjustments == null && loadAdjustments()}>
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
                      <div ref={snapshotSectionRef} className="space-y-3 scroll-mt-4">
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
                        <DayCloseSnapshotPanel
                          snapshot={parsedSnapshotData}
                          detail={detail}
                          hideFinancialSummary
                          compact={!detailMaximized}
                          activeTab={snapshotTab}
                          onTabChange={setSnapshotTab}
                        />
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

            {!detailLoading ? (
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
            ) : null}
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
            setWizardDayCloseId(null);
            setWizardBusinessDate(null);
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
          targetDayCloseId={wizardDayCloseId}
          targetBusinessDate={wizardBusinessDate}
        />
      ) : null}
    </div>
  );
});
