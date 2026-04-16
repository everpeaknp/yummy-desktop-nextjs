"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { PeriodCloseApis } from "@/lib/api/endpoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Calendar,
  AlertCircle,
  FileText,
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  CheckCircle,
  Clock,
  DatabaseZap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getISOWeek, getYear, format, startOfISOWeek, endOfISOWeek, subWeeks, subMonths } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

const PERIOD_DOCS: Array<{
  key: string;
  title: string;
  blurb: string;
}> = [
  { key: "financial_summary", title: "Financial Summary", blurb: "Top-level sales, expenses, and key totals for the period." },
  { key: "profit_loss_statement", title: "Profit & Loss Statement", blurb: "Income vs expense breakdown so you can see profit or loss." },
  { key: "revenue_summary", title: "Revenue Summary", blurb: "Where revenue came from and how it changed." },
  { key: "payment_summary", title: "Payment Summary", blurb: "Cash, card, QR, and other payment method totals." },
  { key: "collections_summary", title: "Collections Summary", blurb: "Money collected during the period (by type/source)." },
  { key: "receivables_summary", title: "Receivables Summary", blurb: "What customers still owe (outstanding amounts)." },
  { key: "tax_summary", title: "Tax Summary", blurb: "Tax collected and tax-related breakdown." },
  { key: "refund_summary", title: "Refund Summary", blurb: "Refund totals and refund-related breakdown." },
  { key: "expense_summary", title: "Expense Summary", blurb: "Expenses grouped in a way that’s easy to audit." },
  { key: "cash_control_summary", title: "Cash Control", blurb: "Cash handling, expected vs actual, and controls." },
  { key: "coverage_summary", title: "Coverage Summary", blurb: "Coverage-style overview of activity across the period." },
  { key: "accounting_summary", title: "Accounting", blurb: "Accounting-friendly view of the numbers." },
  { key: "efficiency_kpis", title: "Efficiency KPIs", blurb: "Efficiency and performance indicators for quick health checks." },
  { key: "operational_summary", title: "Operational Summary", blurb: "Operational highlights and totals for the period." },
  { key: "exception_summary", title: "Exception Summary", blurb: "Anything unusual that needs attention or review." },
  { key: "period_extremes", title: "Period Extremes", blurb: "Best/worst days and extreme values inside the period." },
];

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
    lower.includes("charge");
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
    out.push({ label, value: formatMaybeCurrency(k, v) });
  }
  return out;
}

export default function PeriodReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [periodType, setPeriodType] = useState("weekly");
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));
  const [previewData, setPreviewData] = useState<any>(null);
  const [activePeriodData, setActivePeriodData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewingHistorical, setViewingHistorical] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [snapshotReport, setSnapshotReport] = useState<any>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildTarget, setRebuildTarget] = useState<any>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "open" | "closed">("all");
  const [historicalSnapshotLoading, setHistoricalSnapshotLoading] = useState(false);
  const [historicalSnapshot, setHistoricalSnapshot] = useState<any>(null);
  const [expandedDocKey, setExpandedDocKey] = useState<string | null>(null);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchReports = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    try {
      const api =
        periodType === "weekly"
          ? PeriodCloseApis.listWeekly
          : PeriodCloseApis.listMonthly;
      const response = await apiClient.get(api(user.restaurant_id, selectedYear));
      if (response.data.status === "success") {
        setReports(response.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch period reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchReports();
      fetchActivePeriod();
    }
  }, [user, periodType, selectedYear]);

  const fetchActivePeriod = async () => {
    if (!user?.restaurant_id) return;
    try {
      const now = new Date();
      const year = getYear(now);
      const week = getISOWeek(now);
      const month = now.getMonth() + 1;

      const api = periodType === "weekly"
        ? PeriodCloseApis.weeklyPreview(user.restaurant_id, year, week)
        : PeriodCloseApis.monthlyPreview(user.restaurant_id, year, month);

      const response = await apiClient.get(api);
      if (response.data.status === "success") {
        setActivePeriodData(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch active period data:", err);
    }
  };

  const handlePreview = async (period?: { year: number; week?: number; month?: number }) => {
    if (!user?.restaurant_id) return;
    setViewingHistorical(false);
    setHistoricalSnapshot(null);
    setHistoricalSnapshotLoading(false);
    setExpandedDocKey(null);
    setLoading(true);
    try {
      const now = new Date();
      let year = period?.year || getYear(now);
      let week = period?.week || getISOWeek(now);
      let month = period?.month || now.getMonth() + 1;

      // Ensure we don't preview future weeks/months
      if (periodType === "weekly" && year === getYear(now) && week > getISOWeek(now)) {
        week = getISOWeek(now);
      }
      if (periodType === "monthly" && year === getYear(now) && month > (now.getMonth() + 1)) {
        month = now.getMonth() + 1;
      }

      const api =
        periodType === "weekly"
          ? PeriodCloseApis.weeklyPreview(user.restaurant_id, year, week)
          : PeriodCloseApis.monthlyPreview(user.restaurant_id, year, month);

      const response = await apiClient.get(api);
      if (response.data.status === "success") {
        setPreviewData(response.data.data);
        setShowPreview(true);
      }
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      toast.error(err.response?.data?.detail || "Failed to load period preview");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalSnapshot = async (report: any) => {
    setHistoricalSnapshot(null);
    setHistoricalSnapshotLoading(true);
    try {
      const url =
        periodType === "weekly"
          ? PeriodCloseApis.weeklySnapshot(report.id)
          : PeriodCloseApis.monthlySnapshot(report.id);
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setHistoricalSnapshot(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load snapshot");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load snapshot");
    } finally {
      setHistoricalSnapshotLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!user?.restaurant_id || !previewData) return;
    setConfirming(true);
    try {
      const api =
        periodType === "weekly"
          ? PeriodCloseApis.confirmWeekly(user.restaurant_id, previewData.year, previewData.week_number)
          : PeriodCloseApis.confirmMonthly(user.restaurant_id, previewData.year, previewData.month);

      const response = await apiClient.post(api);
      if (response.data.status === "success") {
        toast.success(`${periodType === "weekly" ? "Weekly" : "Monthly"} close confirmed!`);
        setShowPreview(false);
        fetchReports();
        fetchActivePeriod();
      }
    } catch (err: any) {
      console.error("Failed to confirm period close:", err);
      toast.error(err.response?.data?.detail || "Failed to confirm period close");
    } finally {
      setConfirming(false);
    }
  };

  const generatePdfClientSide = async ({
    docKey,
    docTitle,
    periodTitle,
    periodRange,
    section,
    fallbackName,
  }: {
    docKey: string;
    docTitle: string;
    periodTitle: string;
    periodRange: string;
    section: any;
    fallbackName: string;
  }) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 44;
    let y = 56;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(docTitle, marginX, y);
    y += 18;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(90);
    pdf.text(periodTitle, marginX, y);
    y += 14;
    pdf.text(periodRange, marginX, y);
    y += 18;

    pdf.setTextColor(20);
    pdf.setFontSize(11);

    const rows = flattenSection(section);
    for (const r of rows) {
      const left = r.label;
      const right = r.value;
      const maxLeftWidth = pageWidth - marginX * 2 - 140;
      const leftLines = pdf.splitTextToSize(left, maxLeftWidth);

      if (y > 760) {
        pdf.addPage();
        y = 56;
      }

      pdf.setFont("helvetica", "normal");
      pdf.text(leftLines, marginX, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(right), pageWidth - marginX, y, { align: "right" });
      y += 14 + (leftLines.length - 1) * 12;
    }

    pdf.save(fallbackName);
    toast.success("PDF downloaded");
  };

  const downloadPdfFromUrl = async ({
    url,
    fallbackName,
    fallbackDocKey,
    fallbackDocTitle,
    fallbackSection,
    fallbackPeriodTitle,
    fallbackPeriodRange,
  }: {
    url: string;
    fallbackName: string;
    fallbackDocKey: string;
    fallbackDocTitle: string;
    fallbackSection: any;
    fallbackPeriodTitle: string;
    fallbackPeriodRange: string;
  }) => {
    try {
      const res = await apiClient.get(url, { responseType: "blob" });
      const contentDisposition = (res as any)?.headers?.["content-disposition"] as string | undefined;
      const filename = getFilenameFromContentDisposition(contentDisposition) || fallbackName;
      const blob = new Blob([res.data], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("PDF downloaded");
    } catch (err: any) {
      console.error("PDF download failed:", err);
      // If the backend route isn't deployed (404), fall back to a client-generated PDF from the snapshot.
      if (err?.response?.status === 404 && fallbackSection && typeof fallbackSection === "object") {
        await generatePdfClientSide({
          docKey: fallbackDocKey,
          docTitle: fallbackDocTitle,
          periodTitle: fallbackPeriodTitle,
          periodRange: fallbackPeriodRange,
          section: fallbackSection,
          fallbackName,
        });
        return;
      }
      toast.error(err?.response?.data?.detail || "Failed to download PDF");
    }
  };

  const downloadPreviewPdf = async (docKey: string) => {
    if (!user?.restaurant_id || !previewData) return;
    const year = previewData.year || selectedYear;
    const url =
      periodType === "weekly"
        ? PeriodCloseApis.weeklyPreviewPdf(user.restaurant_id, year, previewData.week_number, docKey)
        : PeriodCloseApis.monthlyPreviewPdf(user.restaurant_id, year, previewData.month, docKey);
    const fallbackName =
      periodType === "weekly"
        ? `period_week_${year}_W${String(previewData.week_number).padStart(2, "0")}_${docKey}.pdf`
        : `period_month_${year}_M${String(previewData.month).padStart(2, "0")}_${docKey}.pdf`;
    const docTitle = PERIOD_DOCS.find((d) => d.key === docKey)?.title || humanizeKey(docKey);
    const section = (previewData?.period_snapshot || {})?.[docKey];
    const periodTitle =
      periodType === "weekly"
        ? `Week ${previewData.week_number}, ${year}`
        : `${format(new Date(year, previewData.month - 1, 1), "MMMM")} ${year}`;
    const periodRange =
      previewData?.start_date && previewData?.end_date
        ? `${String(previewData.start_date)} - ${String(previewData.end_date)}`
        : "Period Range";
    await downloadPdfFromUrl({
      url,
      fallbackName,
      fallbackDocKey: docKey,
      fallbackDocTitle: docTitle,
      fallbackSection: section,
      fallbackPeriodTitle: periodTitle,
      fallbackPeriodRange: periodRange,
    });
  };

  const downloadClosePdf = async (report: any, docKey: string) => {
    if (!report?.id) return;
    const url =
      periodType === "weekly"
        ? PeriodCloseApis.weeklyClosePdf(report.id, docKey)
        : PeriodCloseApis.monthlyClosePdf(report.id, docKey);
    const year = report.year || selectedYear;
    const periodPart =
      periodType === "weekly"
        ? `W${String(report.week_number).padStart(2, "0")}`
        : `M${String(report.month).padStart(2, "0")}`;
    const fallbackName = `period_${periodType}_${year}_${periodPart}_${docKey}.pdf`;
    const docTitle = PERIOD_DOCS.find((d) => d.key === docKey)?.title || humanizeKey(docKey);
    const section = (historicalSnapshot?.snapshot_data || {})?.[docKey];
    const periodTitle =
      periodType === "weekly"
        ? `Week ${report.week_number}, ${year}`
        : `${format(new Date(year, report.month - 1, 1), "MMMM")} ${year}`;
    const periodRange =
      report?.week_start_date && report?.week_end_date
        ? `${String(report.week_start_date)} - ${String(report.week_end_date)}`
        : report?.confirmed_at
          ? `Confirmed ${format(new Date(report.confirmed_at), "MMM dd, yyyy")}`
          : "Period Range";
    await downloadPdfFromUrl({
      url,
      fallbackName,
      fallbackDocKey: docKey,
      fallbackDocTitle: docTitle,
      fallbackSection: section,
      fallbackPeriodTitle: periodTitle,
      fallbackPeriodRange: periodRange,
    });
  };

  const handleViewHistorical = (report: any) => {
     setPreviewData(report);
     setViewingHistorical(true);
     setExpandedDocKey(null);
     setShowPreview(true);
     fetchHistoricalSnapshot(report);
  };

  const handleViewSnapshot = async (report: any) => {
    setSnapshotOpen(true);
    setSnapshotLoading(true);
    setSnapshotData(null);
    setSnapshotReport(report);
    try {
      const url =
        periodType === "weekly"
          ? PeriodCloseApis.weeklySnapshot(report.id)
          : PeriodCloseApis.monthlySnapshot(report.id);
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setSnapshotData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load snapshot");
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      if (status === 404) {
        toast.error("Snapshot not found for this close. Try Rebuild to generate one.");
      } else {
        toast.error(detail || "Failed to load snapshot");
      }
    } finally {
      setSnapshotLoading(false);
    }
  };

  const openRebuild = (report: any) => {
    setRebuildTarget(report);
    setRebuildOpen(true);
  };

  const handleRebuild = async () => {
    if (!user?.restaurant_id || !rebuildTarget) return;
    setRebuilding(true);
    try {
      const year = rebuildTarget.year || selectedYear;
      const api =
        periodType === "weekly"
          ? PeriodCloseApis.weeklyRebuild(user.restaurant_id, year, rebuildTarget.week_number)
          : PeriodCloseApis.monthlyRebuild(user.restaurant_id, year, rebuildTarget.month);
      const res = await apiClient.post(api);
      if (res.data?.status === "success") {
        toast.success(`${periodType === "weekly" ? "Weekly" : "Monthly"} close rebuilt`);
        setRebuildOpen(false);
        setRebuildTarget(null);
        fetchReports();
        fetchActivePeriod();
      } else {
        toast.error(res.data?.message || "Failed to rebuild period close");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || "Failed to rebuild period close");
    } finally {
      setRebuilding(false);
    }
  };

  const currentWeekNum = getISOWeek(new Date());
  const currentMonthNum = new Date().getMonth() + 1;

  // Find active report (current week/month if not in historical list)
  const isActiveClosed = reports.some(r => 
    (periodType === "weekly" && r.week_number === currentWeekNum) || 
    (periodType === "monthly" && r.month === currentMonthNum)
  );

  const openPeriods = (() => {
    const now = new Date();
    const closedKeys = new Set(
      (reports || [])
        .map((r) => {
          const y = r.year || selectedYear;
          if (periodType === "weekly") return `${y}-W${r.week_number}`;
          return `${y}-M${r.month}`;
        })
        .filter(Boolean),
    );

    if (periodType === "weekly") {
      const anchor = selectedYear === getYear(now) ? now : new Date(selectedYear, 11, 31);
      const candidates = Array.from({ length: 12 }).map((_, i) => subWeeks(anchor, i));
      const items = candidates
        .map((d) => {
          const y = getYear(d);
          const w = getISOWeek(d);
          const key = `${y}-W${w}`;
          if (y !== selectedYear) return null;
          if (selectedYear === getYear(now) && (y > getYear(now) || w > getISOWeek(now))) return null;
          if (closedKeys.has(key)) return null;
          return {
            key,
            year: y,
            week_number: w,
            title: `Week ${w}`,
            startDate: startOfISOWeek(d),
            endDate: endOfISOWeek(d),
            subtitle: `${format(startOfISOWeek(d), "MMM dd")} - ${format(endOfISOWeek(d), "MMM dd")}`,
          };
        })
        .filter(Boolean) as any[];
      return items;
    }

    const anchor = selectedYear === getYear(now) ? now : new Date(selectedYear, 11, 15);
    const candidates = Array.from({ length: 6 }).map((_, i) => subMonths(anchor, i));
      const items = candidates
        .map((d) => {
          const y = getYear(d);
          const m = d.getMonth() + 1;
          const key = `${y}-M${m}`;
          if (y !== selectedYear) return null;
          if (selectedYear === getYear(now) && m > (now.getMonth() + 1)) return null;
          if (closedKeys.has(key)) return null;
          const startDate = new Date(y, m - 1, 1);
          const endDate = new Date(y, m, 0);
          return {
            key,
            year: y,
            month: m,
            title: format(new Date(y, m - 1, 1), "MMMM"),
            startDate,
            endDate,
            subtitle: `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd")}`,
          };
        })
        .filter(Boolean) as any[];
    return items;
  })();

  const timelineItems = (() => {
    const parseDate = (v: any) => (v ? new Date(v) : null);

    const open = (openPeriods || []).map((p: any) => ({
      kind: "open" as const,
      key: p.key,
      title: p.title,
      subtitle: p.subtitle,
      year: p.year,
      week_number: p.week_number,
      month: p.month,
      startDate: p.startDate ? new Date(p.startDate) : null,
      endDate: p.endDate ? new Date(p.endDate) : null,
    }));

    const closed = (reports || []).map((r: any) => {
      const year = r.year || selectedYear;
      const title =
        periodType === "weekly"
          ? `Week ${r.week_number || "?"}`
          : r.month
            ? format(new Date(selectedYear, r.month - 1), "MMMM")
            : "Monthly Close";

      const startDate =
        periodType === "weekly"
          ? parseDate(r.week_start_date) || parseDate(r.confirmed_at)
          : parseDate(r.confirmed_at) || parseDate(r.created_at);

      const subtitle = r.confirmed_at
        ? format(new Date(r.confirmed_at), "MMM dd, yyyy")
        : r.week_start_date && r.week_end_date
          ? `${format(new Date(r.week_start_date), "MMM dd")} - ${format(new Date(r.week_end_date), "MMM dd")}`
          : "Finalized Record";

      return {
        kind: "closed" as const,
        key: `closed-${r.id}`,
        report: r,
        title,
        subtitle,
        year,
        startDate,
      };
    });

    const all = [...open, ...closed].sort((a: any, b: any) => {
      const at = a.startDate ? a.startDate.getTime() : 0;
      const bt = b.startDate ? b.startDate.getTime() : 0;
      return bt - at;
    });

    if (historyFilter === "all") return all;
    return all.filter((x: any) => x.kind === historyFilter);
  })();

  const docData = useMemo(() => {
    if (viewingHistorical) {
      return (historicalSnapshot?.snapshot_data || {}) as Record<string, any>;
    }
    return (previewData?.period_snapshot || {}) as Record<string, any>;
  }, [historicalSnapshot?.snapshot_data, previewData?.period_snapshot, viewingHistorical]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Period Close</h1>
          <p className="text-muted-foreground mt-1">
            Store #52 • Yummy Restaurant Group
          </p>
        </div>
      </div>

      <Tabs
        value={periodType}
        onValueChange={(v) => {
          setPeriodType(v);
          setShowPreview(false);
        }}
        className="w-full"
      >
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 gap-8">
          <TabsTrigger
            value="weekly"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-0 pb-4 pt-2 font-semibold text-base transition-all"
          >
            Weekly
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-0 pb-4 pt-2 font-semibold text-base transition-all"
          >
            Monthly
          </TabsTrigger>
        </TabsList>

        <div className="space-y-8 mt-8">
          {/* Active Period Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
              <h2 className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground/70">
                Live Period Monitor
              </h2>
            </div>

            <Card className="bg-card border-border shadow-sm hover:shadow-md hover:border-orange-500/40 transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden" onClick={() => { setViewingHistorical(false); handlePreview(); }}>
              <CardContent className="p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
                  <div className="space-y-3">
                    <h3 className="text-4xl font-bold tracking-tight group-hover:text-orange-600 transition-colors">
                      {periodType === "weekly" ? `Week ${currentWeekNum}` : format(new Date(), 'MMMM')}
                    </h3>
                    <div className="flex items-center gap-2.5 text-muted-foreground/80">
                       <Calendar className="w-4 h-4" />
                       <p className="text-sm font-semibold">
                        {periodType === "weekly" 
                          ? `${format(startOfISOWeek(new Date()), 'MMM dd')} - ${format(endOfISOWeek(new Date()), 'MMM dd')}`
                          : `${format(new Date(), 'MMMM 01')} - ${format(new Date(), 'MMM dd')}`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-1.5">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider opacity-60">Real-time Revenue</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-muted-foreground font-semibold">Rs.</span>
                       <p className="text-6xl font-bold tracking-tight">
                        {Number(activePeriodData?.net_sales || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-10 pt-8 border-t border-border/60 flex justify-between items-center">
                   <div className="flex items-center gap-8">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-muted-foreground/50">
                        <Clock className="w-4 h-4" />
                        <span>Aggregated {activePeriodData ? 'just now' : '...'}</span>
                      </div>
                      {activePeriodData?.blockers?.length > 0 && (
                        <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[10px] font-bold uppercase text-amber-600 shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{activePeriodData.blockers.length} System Warnings</span>
                        </div>
                      )}
                   </div>
                   <div className="flex gap-4">
                      <Button 
                        onClick={(e) => { e.stopPropagation(); fetchActivePeriod(); }} 
                        variant="secondary" 
                        size="icon" 
                        className="h-11 w-11 text-muted-foreground hover:text-orange-600 hover:bg-orange-50/50 rounded-full border border-border/60 shadow-sm"
                      >
                         <RefreshCw className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"} />
                      </Button>
                      <Button
                        onClick={() => handlePreview()}
                        className="bg-orange-600 hover:bg-orange-700 text-white border-none h-12 px-10 font-bold uppercase text-xs tracking-normal shadow-xl shadow-orange-500/20 transition-all rounded-xl transform active:scale-[0.98]"
                      >
                        Review & Confirm Close
                      </Button>
                   </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Periods</h2>
              </div>
              <div className="flex items-center bg-card border border-border rounded-lg px-2 h-9">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold px-3 min-w-[60px] text-center">{selectedYear}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSelectedYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={historyFilter === "all" ? "secondary" : "ghost"}
                    className="rounded-full"
                    onClick={() => setHistoryFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={historyFilter === "open" ? "secondary" : "ghost"}
                    className="rounded-full"
                    onClick={() => setHistoryFilter("open")}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant={historyFilter === "closed" ? "secondary" : "ghost"}
                    className="rounded-full"
                    onClick={() => setHistoryFilter("closed")}
                  >
                    Closed
                  </Button>
                </div>

                {timelineItems.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl bg-muted/5">
                    <FileText className="w-10 h-10 mb-4 opacity-10" />
                    <p className="text-sm font-semibold opacity-60">No periods found for {selectedYear}</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {timelineItems.map((it: any) => {
                      if (it.kind === "open") {
                        return (
                          <Card
                            key={it.key}
                            className="bg-card border-border/60 hover:border-orange-500/30 hover:bg-muted/10 transition-all duration-200 group rounded-2xl overflow-hidden"
                            onClick={() =>
                              handlePreview(
                                periodType === "weekly"
                                  ? { year: it.year, week: it.week_number }
                                  : { year: it.year, month: it.month },
                              )
                            }
                          >
                            <CardContent className="p-5 flex items-center justify-between gap-6">
                              <div className="flex items-center gap-6">
                                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500/15 transition-colors">
                                  <Calendar className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-foreground group-hover:text-orange-500 transition-colors">{it.title}</h3>
                                  <p className="text-[11px] text-muted-foreground/70 font-bold uppercase tracking-wider">{it.subtitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-500 border-none font-bold uppercase text-[10px] tracking-normal h-8 px-4 rounded-full">
                                  Open
                                </Badge>
                                <Button
                                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-6 text-xs uppercase tracking-normal rounded-xl shadow-lg shadow-orange-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreview(
                                      periodType === "weekly"
                                        ? { year: it.year, week: it.week_number }
                                        : { year: it.year, month: it.month },
                                    );
                                  }}
                                >
                                  Review & Close
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      const report = it.report;
                      return (
                        <Card
                          key={it.key}
                          className="bg-card border-border/60 hover:border-emerald-500/20 hover:bg-muted/10 transition-all duration-200 group cursor-pointer rounded-2xl overflow-hidden"
                          onClick={() => handleViewHistorical(report)}
                        >
                          <CardContent className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="p-2.5 rounded-xl bg-muted border border-border group-hover:bg-background transition-colors">
                                <Calendar className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div>
                                <h3 className="font-bold text-foreground group-hover:text-emerald-500 transition-colors">{it.title}</h3>
                                <p className="text-[11px] text-muted-foreground/70 font-bold uppercase tracking-wider">{it.subtitle}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-10">
                              <div className="text-right hidden sm:block">
                                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-normal opacity-60 mb-0.5">Total Revenue</p>
                                <p className="text-lg font-bold text-foreground/90">Rs. {Number(report.net_sales || report.total_net_income || 0).toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="success" className="h-8 px-4 rounded-full text-[10px] font-bold uppercase tracking-normal">
                                  Closed
                                </Badge>
                                <div className="flex gap-1">
                                  <Button
                                    onClick={(e) => { e.stopPropagation(); handleViewSnapshot(report); }}
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground hover:bg-background rounded-full"
                                  >
                                    <DatabaseZap className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={(e) => { e.stopPropagation(); openRebuild(report); }}
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10 rounded-full"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-background rounded-full">
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={(e) => { e.stopPropagation(); downloadClosePdf(report, "financial_summary"); }}
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5 rounded-full"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </Tabs>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[560px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 flex flex-row flex-wrap items-start justify-between gap-3 bg-muted/20 border-b border-border/40">
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {periodType === "weekly" 
                  ? `Week ${previewData?.week_number || '?'}` 
                  : (previewData?.month ? format(new Date(selectedYear, previewData.month - 1), 'MMMM') : 'Period')} Close
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-normal opacity-80">
                {viewingHistorical ? 'Historical Financial Statement' : 'Preview Final Financials'}
              </p>
              <DialogDescription className="sr-only">
                Period close documents and final confirmation dialog.
              </DialogDescription>
            </div>
            <Badge variant="secondary" className={`${viewingHistorical ? 'bg-emerald-500/10 text-emerald-700' : 'bg-orange-500/10 text-orange-700'} border-none font-bold uppercase text-[10px] tracking-normal h-8 px-5 rounded-full`}>
              {viewingHistorical ? 'Confirmed' : 'Pending'}
            </Badge>
          </DialogHeader>

          <div className="p-6 sm:p-8 space-y-8 overflow-y-auto no-scrollbar flex-1 min-h-0">
            {previewData && previewData.can_close === false ? (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-500 space-y-2">
                <p className="text-sm font-bold uppercase tracking-wider">Cannot confirm yet</p>
                <p className="text-xs font-semibold opacity-90">
                  Fix the blockers below, then try closing again.
                </p>
                <div className="space-y-1">
                  {(previewData.blockers || []).length ? (
                    (previewData.blockers || []).map((b: any, idx: number) => (
                      <div key={idx} className="text-sm font-semibold">
                        • {String(b)}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm font-semibold">• Unknown reason</div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20 p-6 rounded-2xl space-y-1.5 transition-colors group hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-normal opacity-80">Net Sales</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight">Rs. {Number(previewData?.net_sales || previewData?.total_net_income || 0).toLocaleString()}</p>
              </div>
              <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20 p-6 rounded-2xl space-y-1.5 transition-colors group hover:bg-red-50 dark:hover:bg-red-500/10">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-500 uppercase tracking-normal opacity-80">Total Expenses</p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-400 tracking-tight">Rs. {Number(previewData?.expense_total || previewData?.total_expenses || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-muted/40 p-6 rounded-2xl border border-border/60 shadow-sm">
               <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Total Days</span>
                  <p className="text-lg font-bold text-foreground">{previewData?.total_days || 0}</p>
               </div>
               <div className="space-y-1 text-right">
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Confirmed Days</span>
                  <p className="text-lg font-bold text-foreground">{previewData?.confirmed_days_count || 0}</p>
               </div>
            </div>

            <div className="space-y-5">
               <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-1">Payment Breakdown</h4>
               <div className="grid grid-cols-1 gap-4 bg-muted/20 p-2 rounded-2xl border border-border/40">
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Cash Sales</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.cash_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Card Sales</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.card_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Digital / QR</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.digital_sales || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-semibold text-muted-foreground">Fonepay</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.fonepay_sales || 0).toLocaleString()}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-5">
               <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-1">Adjustments & Compliance</h4>
               <div className="grid grid-cols-1 gap-4 bg-muted/20 p-2 rounded-2xl border border-border/40">
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Tax Collected</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.tax_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors border-b border-border/20 last:border-none">
                    <span className="text-sm font-semibold text-muted-foreground">Discounts Applied</span>
                    <span className="text-sm font-bold text-foreground">Rs. {Number(previewData?.discount_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-semibold text-muted-foreground">Refunds Processed</span>
                    <span className="text-sm font-bold text-red-500">Rs. {Number(previewData?.refund_total || 0).toLocaleString()}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Documents</h4>
                {viewingHistorical && historicalSnapshotLoading ? (
                  <div className="flex items-center text-xs text-muted-foreground font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading…
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 bg-muted/20 p-2 rounded-2xl border border-border/40">
                {PERIOD_DOCS.map((doc) => {
                  const section = docData?.[doc.key];
                  const available = typeof section === "object" && section !== null;
                  const isLoadingHistorical = viewingHistorical && historicalSnapshotLoading && !historicalSnapshot;
                  const canDownloadPdf = viewingHistorical ? true : available;
                  const expanded = expandedDocKey === doc.key;
                  return (
                    <div key={doc.key} className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                      <div className="px-4 py-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground truncate">{doc.title}</p>
                            <Badge
                              variant="secondary"
                              className={
                                isLoadingHistorical
                                  ? "bg-muted text-muted-foreground border-none font-bold uppercase text-[10px] h-6 px-2.5 rounded-full"
                                  : available
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-none font-bold uppercase text-[10px] h-6 px-2.5 rounded-full"
                                  : "bg-muted text-muted-foreground border-none font-bold uppercase text-[10px] h-6 px-2.5 rounded-full"
                              }
                            >
                              {isLoadingHistorical ? "Loading" : available ? "Available" : "Missing"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-semibold mt-1 line-clamp-2">{doc.blurb}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-xl text-xs font-bold"
                            disabled={!canDownloadPdf}
                            onClick={() =>
                              viewingHistorical
                                ? downloadClosePdf(previewData, doc.key)
                                : downloadPreviewPdf(doc.key)
                            }
                          >
                            <Download className="w-4 h-4 mr-2" />
                            PDF
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
                            disabled={!available}
                            onClick={() => setExpandedDocKey((v) => (v === doc.key ? null : doc.key))}
                          >
                            {expanded ? "Hide" : "Details"}
                          </Button>
                        </div>
                      </div>

                      {expanded && available ? (
                        <div className="px-4 pb-4">
                          <div className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
                            <div className="max-h-[280px] overflow-auto no-scrollbar">
                              {flattenSection(section).map((row, idx) => (
                                <div
                                  key={`${doc.key}-${idx}`}
                                  className="px-4 py-3 flex items-start justify-between gap-6 border-b border-border/30 last:border-none"
                                >
                                  <p className="text-xs font-semibold text-muted-foreground leading-5">{row.label}</p>
                                  <p className="text-xs font-bold text-foreground text-right whitespace-nowrap">{row.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 sm:p-8 pt-4 flex flex-col gap-4 bg-muted/30 border-t border-border/40">
            {!viewingHistorical ? (
              <Button 
                  onClick={handleConfirm} 
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-sm uppercase tracking-normal shadow-xl shadow-orange-500/10 rounded-2xl transition-all hover:translate-y-[-1px] active:translate-y-[1px]"
                  disabled={confirming || !previewData?.can_close}
              >
                {confirming ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                Authorize Final Period Close
              </Button>
            ) : (
                <Button 
                   onClick={() => downloadClosePdf(previewData, "financial_summary")} 
                   className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-14 text-sm uppercase tracking-normal rounded-2xl shadow-lg transition-all"
                >
                   <Download className="w-5 h-5 mr-3" />
                   Download Financial Summary (PDF)
                </Button>
            )}
            <Button 
                variant="ghost" 
                onClick={() => setShowPreview(false)} 
                className="w-full text-muted-foreground hover:text-foreground font-semibold h-11 text-xs tracking-wider"
            >
              {viewingHistorical ? 'Back to Dashboard' : 'Review Documents Later'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[760px] bg-card border-border p-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-4 sm:pb-5 flex flex-row flex-wrap items-start justify-between gap-3 bg-muted/20 border-b border-border/40">
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-bold tracking-tight">Snapshot</DialogTitle>
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-normal opacity-80">
                {periodType === "weekly" ? "Weekly close snapshot" : "Monthly close snapshot"}
              </p>
            </div>
          </DialogHeader>

          <div className="p-6 sm:p-8 pt-6 space-y-5 overflow-auto no-scrollbar flex-1 min-h-0">
            {snapshotLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading snapshot...
              </div>
            ) : !snapshotData ? (
              <div className="p-6 rounded-2xl border border-border/60 bg-muted/10 text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 opacity-60" />
                  <div>
                    <p className="text-sm font-semibold">Snapshot not available.</p>
                    <p className="text-xs opacity-70 mt-1">
                      This usually happens when the close was confirmed before snapshots were enabled, or the snapshot was never generated.
                    </p>
                  </div>
                </div>
                {snapshotReport ? (
                  <Button
                    variant="secondary"
                    className="rounded-2xl font-bold"
                    onClick={() => openRebuild(snapshotReport)}
                  >
                    Rebuild & Generate Snapshot
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-6 rounded-2xl border border-border/60">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Generated At</span>
                    <p className="text-sm font-semibold text-foreground">
                      {snapshotData.generated_at ? format(new Date(snapshotData.generated_at), 'MMM dd, yyyy HH:mm') : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Source Day Closes</span>
                    <p className="text-sm font-semibold text-foreground">{(snapshotData.source_day_close_ids || []).length}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">Source Hash</span>
                    <p className="text-xs font-mono text-muted-foreground break-all">{snapshotData.source_hash || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-1">Snapshot Data</h4>
                  <div className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
                    <div className="max-h-[420px] overflow-auto no-scrollbar">
                      {flattenSection(snapshotData.snapshot_data || {}).map((row, idx) => (
                        <div
                          key={idx}
                          className="px-5 py-3 flex items-start justify-between gap-6 border-b border-border/30 last:border-none"
                        >
                          <p className="text-xs font-semibold text-muted-foreground leading-5">{row.label}</p>
                          <p className="text-xs font-bold text-foreground text-right whitespace-nowrap">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="p-6 sm:p-8 pt-4 flex flex-col gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="ghost" onClick={() => setSnapshotOpen(false)} className="w-full text-muted-foreground hover:text-foreground font-semibold h-11 text-xs tracking-wider">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rebuildOpen} onOpenChange={setRebuildOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[520px] bg-card border-border rounded-2xl sm:rounded-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-muted/20 border-b border-border/40">
            <DialogTitle className="text-xl font-bold tracking-tight">Rebuild Close?</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              This will regenerate the snapshot from confirmed day-closes and re-confirm the period.
            </p>
          </DialogHeader>
          <div className="p-6 sm:p-8 pt-6 space-y-4 overflow-auto flex-1 min-h-0 no-scrollbar">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-500 text-sm font-semibold">
              Use this only if the underlying day-closes changed after the period was closed.
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-8 pt-4 flex gap-3 bg-muted/30 border-t border-border/40">
            <Button variant="outline" onClick={() => setRebuildOpen(false)} disabled={rebuilding} className="flex-1 h-12 rounded-2xl">
              Cancel
            </Button>
            <Button onClick={handleRebuild} disabled={rebuilding} className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rebuild"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
