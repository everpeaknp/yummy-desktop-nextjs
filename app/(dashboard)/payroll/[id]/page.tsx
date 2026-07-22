"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  XCircle,
  Plus,
  Trash2,
  Printer,
  Landmark,
  ShieldCheck,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { AccountingApis, DrawerSessionApis, PayrollApis, StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import {
  buildCashExpenseDrawerPayload,
  parseActiveCashDrawers,
  type ActiveCashDrawerSession,
} from "@/lib/cash-expense-drawer-selection";
import { getPaymentBankLabel } from "@/lib/payment-banks";
import {
  canUsePayrollSafe,
  payrollSafeFundingError,
  requiresPayrollBank,
  requiresPayrollReference,
  payrollRunPaymentErrorMessage,
  type PayrollCashSource,
  type PayrollPaymentMethod,
} from "@/lib/payroll/payment-form";
import type { DrawerCashControlSummary, PaymentBank } from "@/types/accounting";
import { hasPermission } from "@/lib/role-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useEntitlement } from "@/hooks/use-subscription";

import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PayrollSafeSourceSummary } from "@/components/payroll/payroll-safe-source-summary";

type PayrollStatus = "draft" | "approved" | "paid" | "cancelled" | string;

type PayrollAdjustment = {
  id: number;
  payroll_item_id: number;
  adjustment_type: "bonus" | "deduction" | string;
  amount: number;
  description?: string | null;
  created_at?: string | null;
};

type PayrollItem = {
  id: number;
  staff_id: number;
  salary_type: "monthly" | "daily" | string;
  base_salary: number;
  period_days: number;
  daily_rate: number;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  scheduled_days: number;
  payable_days: number;
  absent_days: number;
  regular_pay: number;
  overtime_pay: number;
  absence_deduction: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  paid_holiday_days: number;
  holiday_premium_pay: number;
  salary_history_id?: number | null;
  salary_effective_from?: string | null;
  policy_evidence?: Array<Record<string, unknown>>;
  earned_amount: number;
  bonus: number;
  deduction: number;
  tax_amount: number;
  net_pay: number;
  adjustments?: PayrollAdjustment[] | null;
};

type PayrollRunDetail = {
  id: number;
  date_from: string;
  date_to: string;
  period_days: number;
  status: PayrollStatus;
  tax_percentage: number;
  use_approved_attendance: boolean;
  total_payroll_amount: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  cancel_reason?: string | null;
  items: PayrollItem[];
};

type StaffUser = {
  id: number;
  full_name?: string;
  email?: string;
};

type StaffProfile = {
  id: number; // staff_id
  user_id: number;
};

function formatMoney(n: number) {
  const v = Number(n || 0);
  return `Rs. ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  const runId = Number(params.id);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const restaurant = useRestaurant((s) => s.restaurant);

  const planState = restaurant?.plan_state?.toLowerCase() || "free";
  const effectivePlan = restaurant?.effective_plan?.toLowerCase() || "free";
  const legacyPayrollEnabled =
    (effectivePlan === "paid" || effectivePlan === "trial_paid") &&
    (planState === "paid" || planState === "trialing");
  const { allowed: isPaid, loading: subscriptionLoading } = useEntitlement(
    "payroll.enabled",
    legacyPayrollEnabled,
  );

  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [usersById, setUsersById] = useState<Map<number, StaffUser>>(new Map()); // user_id -> user
  const [userIdByStaffId, setUserIdByStaffId] = useState<Map<number, number>>(new Map()); // staff_id -> user_id

  const [actionLoading, setActionLoading] = useState(false);

  const [paidOpen, setPaidOpen] = useState(false);
  const [paidMethod, setPaidMethod] =
    useState<PayrollPaymentMethod>("cash");
  const [paidCashSource, setPaidCashSource] =
    useState<PayrollCashSource>("drawer");
  const [paidRef, setPaidRef] = useState("");
  const [paidAt, setPaidAt] = useState<string>("");
  const [paidBankId, setPaidBankId] = useState("");
  const [paidDrawerSessionId, setPaidDrawerSessionId] = useState("");
  const [paymentBanks, setPaymentBanks] = useState<PaymentBank[]>([]);
  const [cashDrawers, setCashDrawers] = useState<ActiveCashDrawerSession[]>([]);
  const [drawerControlsEnabled, setDrawerControlsEnabled] = useState(false);
  const [cashSummary, setCashSummary] =
    useState<DrawerCashControlSummary | null>(null);
  const [bankLoadFailed, setBankLoadFailed] = useState(false);
  const [drawerLoadFailed, setDrawerLoadFailed] = useState(false);
  const [safeLoadFailed, setSafeLoadFailed] = useState(false);
  const [paymentSourcesLoading, setPaymentSourcesLoading] = useState(false);
  const [paymentSourcesLoaded, setPaymentSourcesLoaded] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjStaffId, setAdjStaffId] = useState<string>("");
  const [adjType, setAdjType] = useState<"bonus" | "deduction">("bonus");
  const [adjAmount, setAdjAmount] = useState<string>("");
  const [adjDescription, setAdjDescription] = useState<string>("");

  const [printLoading, setPrintLoading] = useState(false);
  const [pdfData, setPdfData] = useState<PayrollRunDetail | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  useEffect(() => {
    if (!loading && !subscriptionLoading && !isPaid) router.push("/premium");
  }, [loading, subscriptionLoading, isPaid, router]);

  const loadStaff = useCallback(async () => {
    try {
      const [profilesRes, usersRes] = await Promise.all([
        apiClient.get(StaffProfileApis.list({ skip: 0, limit: 500 })),
        apiClient.get(StaffApis.list()),
      ]);

      if (usersRes.data?.status === "success") {
        const map = new Map<number, StaffUser>();
        for (const u of usersRes.data.data || []) map.set(u.id, u);
        setUsersById(map);
      }

      if (profilesRes.data?.status === "success") {
        const map = new Map<number, number>();
        for (const p of (profilesRes.data.data || []) as StaffProfile[]) map.set(p.id, p.user_id);
        setUserIdByStaffId(map);
      }
    } catch {
      // Not fatal; we'll show staff IDs instead.
    }
  }, []);

  const loadRun = useCallback(async () => {
    if (!runId || Number.isNaN(runId)) {
      toast.error("Invalid payroll run id");
      router.push("/payroll");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.get(PayrollApis.getRun(runId));
      if (res.data?.status === "success") {
        setRun(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load payroll run");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to load payroll run");
    } finally {
      setLoading(false);
    }
  }, [router, runId]);

  useEffect(() => {
    if (!user) return;
    if (subscriptionLoading || !isPaid) {
      setLoading(false);
      return;
    }
    loadStaff();
    loadRun();
  }, [isPaid, loadRun, loadStaff, subscriptionLoading, user]);

  const statusBadge = useMemo(() => {
    const s = (run?.status || "").toLowerCase();
    if (s === "paid")
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
        </Badge>
      );
    if (s === "approved")
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    if (s === "draft")
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200">
          <Clock className="w-3 h-3 mr-1" /> Draft
        </Badge>
      );
    if (s === "cancelled")
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" /> Cancelled
        </Badge>
      );
    return <Badge variant="outline">{run?.status || "Unknown"}</Badge>;
  }, [run?.status]);

  const allAdjustments = useMemo(() => {
    const list: Array<{ adj: PayrollAdjustment; staff_id: number }> = [];
    for (const item of run?.items || []) {
      for (const adj of item.adjustments || []) list.push({ adj, staff_id: item.staff_id });
    }
    return list.sort((a, b) => (b.adj.id || 0) - (a.adj.id || 0));
  }, [run?.items]);

  const hasSafePermission = hasPermission(
    user,
    "finance.cash.safe.disburse",
  );
  const canUseSafe = canUsePayrollSafe({
    summary: cashSummary,
    hasDisbursementPermission: hasSafePermission,
  });

  const approveRun = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(PayrollApis.approveRun(run.id));
      if (res.data?.status === "success") {
        toast.success("Payroll run approved");
        await loadRun();
      } else {
        toast.error(res.data?.message || "Failed to approve run");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to approve run");
    } finally {
      setActionLoading(false);
    }
  };

  const submitPaid = async () => {
    if (!run) return;
    if (!paymentSourcesLoaded) {
      toast.error("Payment sources are still loading. Try again in a moment.");
      return;
    }
    const selectedBank = paymentBanks.find((bank) => String(bank.id) === paidBankId);
    if (requiresPayrollBank(paidMethod) && bankLoadFailed) {
      toast.error("Configured banks could not be loaded. Refresh before paying by bank.");
      return;
    }
    if (requiresPayrollBank(paidMethod) && !selectedBank) {
      toast.error("Select the restaurant bank account funding this payroll.");
      return;
    }
    if (requiresPayrollBank(paidMethod) && paidRef.trim().length < 2) {
      toast.error("Enter the bank transfer reference.");
      return;
    }
    let drawerPayload: { drawer_session_id?: number } = {};
    if (paidMethod === "cash" && paidCashSource === "drawer") {
      try {
        drawerPayload = buildCashExpenseDrawerPayload({
          paymentMethod: paidMethod,
          controlsEnabled: drawerControlsEnabled,
          selectedDrawerSessionId: paidDrawerSessionId,
        });
      } catch {
        toast.error("Select the cash drawer funding this payroll payment.");
        return;
      }
    }
    if (paidMethod === "cash" && paidCashSource === "safe") {
      const safeError = payrollSafeFundingError({
        summary: cashSummary,
        hasDisbursementPermission: hasSafePermission,
        reference: paidRef,
        amount:
          run.status === "partially_paid"
            ? null
            : Number(run.total_payroll_amount || 0),
      });
      if (safeLoadFailed || safeError) {
        toast.error(
          safeError || "The Main Cash / Safe balance could not be verified.",
        );
        return;
      }
    }
    setActionLoading(true);
    try {
      const payload: any = {
        payment_method: paidMethod,
        payment_bank_id: requiresPayrollBank(paidMethod)
          ? selectedBank?.id
          : undefined,
        cash_source: paidMethod === "cash" ? paidCashSource : undefined,
        ...drawerPayload,
        payment_reference: paidRef.trim() || null,
        paid_at: paidAt ? new Date(paidAt).toISOString() : null,
      };
      const res = await apiClient.post(PayrollApis.markPaid(run.id), payload);
      if (res.data?.status === "success") {
        toast.success("Payroll marked as paid");
        setPaidOpen(false);
        await loadRun();
      } else {
        toast.error(
          `Payroll run payment failed. No employee payments were recorded.${
            res.data?.message ? ` ${res.data.message}` : ""
          }`,
        );
      }
    } catch (e: any) {
      toast.error(payrollRunPaymentErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const submitCancel = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const payload: any = { cancel_reason: cancelReason || null };
      const res = await apiClient.post(PayrollApis.cancelRun(run.id), payload);
      if (res.data?.status === "success") {
        toast.success("Payroll run cancelled");
        setCancelOpen(false);
        await loadRun();
      } else {
        toast.error(res.data?.message || "Failed to cancel run");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to cancel run");
    } finally {
      setActionLoading(false);
    }
  };

  const submitAdjustment = async () => {
    if (!run) return;
    const staffId = Number(adjStaffId);
    const amount = Number(adjAmount);
    if (!staffId) return toast.error("Select a staff member");
    if (!amount || Number.isNaN(amount) || amount <= 0) return toast.error("Amount must be greater than 0");

    setActionLoading(true);
    try {
      const payload = {
        adjustments: [
          {
            staff_id: staffId,
            adjustment_type: adjType,
            amount,
            description: adjDescription || null,
          },
        ],
      };
      const res = await apiClient.post(PayrollApis.addAdjustments(run.id), payload);
      if (res.data?.status === "success") {
        toast.success("Adjustment added");
        setAdjustOpen(false);
        setAdjStaffId("");
        setAdjAmount("");
        setAdjDescription("");
        await loadRun();
      } else {
        toast.error(res.data?.message || "Failed to add adjustment");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to add adjustment");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteAdjustment = async (adjustmentId: number) => {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await apiClient.delete(PayrollApis.deleteAdjustment(adjustmentId));
      if (res.data?.status === "success") {
        toast.success("Adjustment removed");
        await loadRun();
      } else {
        toast.error(res.data?.message || "Failed to remove adjustment");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to remove adjustment");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!run) return;
    setPrintLoading(true);
    try {
      const res = await apiClient.get(PayrollApis.runPdf(run.id));
      if (res.data?.status !== "success") {
        toast.error(res.data?.message || "Failed to load payroll PDF payload");
        return;
      }

      setPdfData(res.data.data);
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      if (!printRef.current) {
        toast.error("Print layout not ready");
        return;
      }

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;

      let y = 0;
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
      while (y + imgHeight > pageHeight) {
        y -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
      }

      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, "_blank");
      if (w) {
        w.addEventListener("load", () => w.print());
      }
    } catch (e: any) {
      console.error("Payroll PDF print failed", e);
      toast.error("Failed to print payroll PDF");
    } finally {
      setPrintLoading(false);
      // Keep pdfData; it’s useful for a “re-print” without refetch, but can be cleaned later if needed.
    }
  };

  useEffect(() => {
    if (!run) return;
    setPaidMethod(
      ["bank", "bank_transfer", "bank transfer", "transfer"].includes(
        String(run.payment_method || "").trim().toLowerCase(),
      )
        ? "bank_transfer"
        : "cash",
    );
    setPaidRef(run.payment_reference || "");
    setPaidAt(toDatetimeLocalValue(run.paid_at));
    setPaidCashSource("drawer");
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    if (!paidOpen || !restaurant?.id) return;

    const loadPaymentSources = async () => {
      setPaymentSourcesLoading(true);
      setPaymentSourcesLoaded(false);
      setBankLoadFailed(false);
      setDrawerLoadFailed(false);
      setSafeLoadFailed(false);
      const [bankResult, drawerResult, cashSummaryResult] =
        await Promise.allSettled([
        apiClient.get(AccountingApis.paymentBanks(restaurant.id)),
        apiClient.get(
          DrawerSessionApis.active({
            restaurantId: restaurant.id,
            businessLine: "restaurant",
          }),
        ),
        apiClient.get(
          DrawerSessionApis.cashControlSummary({
            restaurantId: restaurant.id,
            businessLine: "restaurant",
          }),
        ),
      ]);
      if (cancelled) return;

      if (bankResult.status === "fulfilled") {
        const activeBanks = ((bankResult.value.data?.data || []) as PaymentBank[]).filter(
          (bank) => bank.is_active,
        );
        setPaymentBanks(activeBanks);
        setPaidBankId((current) =>
          current && activeBanks.some((bank) => String(bank.id) === current)
            ? current
            : activeBanks[0]?.id
              ? String(activeBanks[0].id)
              : "",
        );
      } else {
        setPaymentBanks([]);
        setBankLoadFailed(true);
      }

      if (drawerResult.status === "fulfilled") {
        const parsed = parseActiveCashDrawers(drawerResult.value.data);
        setDrawerControlsEnabled(parsed.controlsEnabled);
        setCashDrawers(parsed.sessions);
        setPaidDrawerSessionId((current) =>
          current && parsed.sessions.some((drawer) => String(drawer.id) === current)
            ? current
            : parsed.sessions[0]?.id
              ? String(parsed.sessions[0].id)
              : "",
        );
      } else {
        // The backend may still resolve the manager's single assigned drawer.
        setDrawerControlsEnabled(false);
        setCashDrawers([]);
        setPaidDrawerSessionId("");
        setDrawerLoadFailed(true);
      }
      if (cashSummaryResult.status === "fulfilled") {
        setCashSummary(cashSummaryResult.value.data?.data || null);
      } else {
        setCashSummary(null);
        setSafeLoadFailed(true);
      }
      setPaymentSourcesLoading(false);
      setPaymentSourcesLoaded(true);
    };

    void loadPaymentSources();
    return () => {
      cancelled = true;
    };
  }, [paidOpen, restaurant?.id]);

  if (loading || subscriptionLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="border-border">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Payroll is not included in your plan</p>
              <p className="text-sm text-muted-foreground">Choose a plan that includes payroll to view payroll runs.</p>
            </div>
            <Link href="/premium">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">View plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Payroll run not found</p>
              <p className="text-sm text-muted-foreground">It may have been deleted or you may not have access.</p>
            </div>
            <Link href="/payroll">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canApprove = run.status === "draft";
  const canMarkPaid = run.status === "approved" || run.status === "partially_paid";
  const canCancel = run.status === "draft" || run.status === "approved";
  const canAdjust = run.status === "draft";
  const canPrint = run.status === "paid";

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/payroll">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Payroll Run</h1>
              <Badge variant="outline">#PR-{run.id}</Badge>
              {statusBadge}
            </div>
            <p className="text-muted-foreground">
              {new Date(run.date_from).toLocaleDateString()} – {new Date(run.date_to).toLocaleDateString()} • {run.period_days} days
            </p>
            <p className="text-xs text-muted-foreground">
              {run.use_approved_attendance ? "Calculated from approved attendance" : "Attendance calculation disabled"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAdjustOpen(true)}
            disabled={!canAdjust || actionLoading}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Adjustment
          </Button>
          <Button variant="outline" onClick={approveRun} disabled={!canApprove || actionLoading}>
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve
          </Button>
          <Button variant="outline" onClick={() => { setPaymentSourcesLoaded(false); setPaidOpen(true); }} disabled={!canMarkPaid || actionLoading}>
            <FileText className="w-4 h-4 mr-2" />
            {run.status === "partially_paid" ? "Pay remaining" : "Mark Paid"}
          </Button>
          <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!canCancel || actionLoading}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handlePrintPdf}
            disabled={!canPrint || printLoading}
          >
            {printLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
            Print PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Total Payroll" value={formatMoney(run.total_payroll_amount)} />
        <MetricCard label="Tax %" value={`${Number(run.tax_percentage || 0).toFixed(2)}%`} />
        <MetricCard label="Staff Items" value={run.items.length} />
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Run Items</CardTitle>
          <Badge variant="outline">{run.items.length} staff</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Deduction</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.items.map((item) => {
                const userId = userIdByStaffId.get(item.staff_id);
                const u = userId ? usersById.get(userId) : undefined;
                const name = u?.full_name || u?.email || `Staff #${item.staff_id}`;
                return (
                  <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{name}</span>
                        <span className="text-xs text-muted-foreground">
                          Staff ID: {item.staff_id}{userId ? ` • User ID: ${userId}` : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{item.salary_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <p>{Number(item.payable_days || 0).toFixed(2)} / {Number(item.scheduled_days || 0).toFixed(2)} days</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(Number(item.regular_minutes || 0) / 60)}h {Number(item.regular_minutes || 0) % 60}m regular • {Math.floor(Number(item.overtime_minutes || 0) / 60)}h {Number(item.overtime_minutes || 0) % 60}m OT
                      </p>
                      <p className="text-xs text-muted-foreground">{Number(item.paid_leave_days || 0).toFixed(2)} paid leave • {Number(item.unpaid_leave_days || 0).toFixed(2)} unpaid leave • {Number(item.paid_holiday_days || 0).toFixed(2)} paid holidays</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p>{formatMoney(item.earned_amount)}</p>
                      <p className="text-xs text-muted-foreground">Regular {formatMoney(item.regular_pay)} • OT {formatMoney(item.overtime_pay)} • holiday premium {formatMoney(item.holiday_premium_pay)}</p>
                      {item.salary_effective_from ? <p className="text-xs text-muted-foreground">Salary effective {item.salary_effective_from}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(item.bonus)}</TableCell>
                    <TableCell className="text-right">
                      <p>{formatMoney(item.deduction)}</p>
                      {Number(item.absence_deduction || 0) > 0 ? <p className="text-xs text-muted-foreground">Absence {formatMoney(item.absence_deduction)}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(item.tax_amount)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatMoney(item.net_pay)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Adjustments</CardTitle>
          <Badge variant="outline">{allAdjustments.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAdjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No adjustments in this run.
                  </TableCell>
                </TableRow>
              ) : (
                allAdjustments.map(({ adj, staff_id }) => {
                  const userId = userIdByStaffId.get(staff_id);
                  const u = userId ? usersById.get(userId) : undefined;
                  const name = u?.full_name || u?.email || `Staff #${staff_id}`;
                  return (
                    <TableRow key={adj.id}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <Badge variant={adj.adjustment_type === "deduction" ? "destructive" : "outline"} className="capitalize">
                          {adj.adjustment_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(adj.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{adj.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAdjustment(adj.id)}
                          disabled={!canAdjust || actionLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mark Paid Dialog */}
      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{run.status === "partially_paid" ? "Pay remaining payroll" : "Pay payroll run"}</DialogTitle>
            <DialogDescription>
              Record the actual bank account or cash drawer funding this run. The source remains visible in the payroll audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Payroll run total</p>
              <p className="mt-1 text-xl font-bold">{formatMoney(run.total_payroll_amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(run.date_from).toLocaleDateString()} - {new Date(run.date_to).toLocaleDateString()}</p>
              {run.status === "partially_paid" ? <p className="mt-2 text-xs text-muted-foreground">Only the remaining employee balances will be settled.</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paidMethod}
                onValueChange={(value) =>
                  setPaidMethod(value as PayrollPaymentMethod)
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentSourcesLoading ? (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading payment sources...
              </div>
            ) : null}

            {paidMethod === "cash" && !paymentSourcesLoading ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Cash source</Label>
                  <Select
                    value={paidCashSource}
                    onValueChange={(value) =>
                      setPaidCashSource(value as PayrollCashSource)
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drawer">Open cash drawer</SelectItem>
                      <SelectItem value="safe" disabled={!canUseSafe}>
                        Main Cash / Safe (1005){!canUseSafe ? " - unavailable" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!canUseSafe ? (
                    <p className="text-xs text-muted-foreground">
                      Safe funding requires safe-disbursement permission and a ready accounting ledger.
                    </p>
                  ) : null}
                </div>

                {paidCashSource === "safe" ? (
                  <PayrollSafeSourceSummary
                    summary={cashSummary}
                    loading={paymentSourcesLoading}
                    loadFailed={safeLoadFailed}
                    amount={run.status === "partially_paid" ? 0 : run.total_payroll_amount}
                  />
                ) : drawerLoadFailed ? (
                  <Alert>
                    Your role cannot list drawers. The server will use your single assigned open drawer, or stop if one cannot be resolved.
                  </Alert>
                ) : drawerControlsEnabled ? (
                  <div className="space-y-2">
                    <Label>Open cash drawer</Label>
                    {cashDrawers.length ? (
                      <Select value={paidDrawerSessionId} onValueChange={setPaidDrawerSessionId}>
                        <SelectTrigger><SelectValue placeholder="Select an open cash drawer" /></SelectTrigger>
                        <SelectContent>
                          {cashDrawers.map((drawer) => (
                            <SelectItem key={drawer.id} value={String(drawer.id)}>
                              {drawer.name || drawer.drawer_key || `Drawer #${drawer.id}`}{drawer.station ? ` - ${drawer.station}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Alert>
                        No open cash drawer is available. Open one from <Link href="/cash-drawers" className="font-semibold underline">Cash Drawers</Link> first.
                      </Alert>
                    )}
                  </div>
                ) : (
                  <Alert>Cash drawer controls are disabled. The run will be recorded as general cash.</Alert>
                )}
              </div>
            ) : null}

            {requiresPayrollBank(paidMethod) && !paymentSourcesLoading ? (
              <div className="space-y-2">
                <Label>Pay from bank</Label>
                {bankLoadFailed ? (
                  <Alert variant="destructive">Configured banks could not be loaded. Refresh and try again.</Alert>
                ) : paymentBanks.length ? (
                  <Select value={paidBankId} onValueChange={setPaidBankId}>
                    <SelectTrigger><SelectValue placeholder="Select a configured bank" /></SelectTrigger>
                    <SelectContent>
                      {paymentBanks.map((bank) => (
                        <SelectItem key={bank.id} value={String(bank.id)}>{getPaymentBankLabel(bank)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Alert>No active bank is configured. Add one in <Link href="/manage/settings" className="font-semibold underline">Payment settings</Link> first.</Alert>
                )}
                {paidBankId ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Landmark className="h-3.5 w-3.5" /> This run will be paid from {getPaymentBankLabel(paymentBanks.find((bank) => String(bank.id) === paidBankId))}.</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Payment reference {requiresPayrollReference(paidMethod, paidCashSource) ? "(required)" : "(optional)"}</Label>
              <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder={paidMethod === "bank_transfer" ? "Transfer reference" : paidCashSource === "safe" ? "Safe withdrawal voucher or reference" : "Receipt or voucher number"} />
            </div>
            <div className="space-y-2">
              <Label>Paid at</Label>
              <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={submitPaid} disabled={actionLoading || !paymentSourcesLoaded || paymentSourcesLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : paidMethod === "cash" && paidCashSource === "safe" ? <ShieldCheck className="w-4 h-4 mr-2" /> : null}
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Payroll Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Optional reason for cancellation" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={actionLoading}>Back</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cancel Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={adjStaffId} onValueChange={setAdjStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {(run.items || []).map((item) => {
                    const userId = userIdByStaffId.get(item.staff_id);
                    const u = userId ? usersById.get(userId) : undefined;
                    const name = u?.full_name || u?.email || `Staff #${item.staff_id}`;
                    return (
                      <SelectItem key={item.staff_id} value={String(item.staff_id)}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjType} onValueChange={(v) => setAdjType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={0} step={0.01} value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={adjDescription} onChange={(e) => setAdjDescription(e.target.value)} placeholder="Optional note" />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              Adjustments are applied to a staff member’s net pay for this run.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={submitAdjustment} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print layout */}
      <div className="fixed left-[-10000px] top-0">
        <div ref={printRef} className="w-[794px] bg-white text-black p-8">
          {pdfData ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Payroll Run</h2>
                  <p className="text-sm">Run ID: PR-{pdfData.id}</p>
                  <p className="text-sm">
                    Period: {new Date(pdfData.date_from).toLocaleDateString()} – {new Date(pdfData.date_to).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">Total</p>
                  <p className="text-xl font-bold">{formatMoney(pdfData.total_payroll_amount)}</p>
                  <p className="text-xs text-gray-600">Tax: {Number(pdfData.tax_percentage || 0).toFixed(2)}%</p>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 border-b">Staff</th>
                      <th className="text-right p-2 border-b">Earned</th>
                      <th className="text-right p-2 border-b">Bonus</th>
                      <th className="text-right p-2 border-b">Deduction</th>
                      <th className="text-right p-2 border-b">Tax</th>
                      <th className="text-right p-2 border-b">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfData.items.map((it) => {
                      const userId = userIdByStaffId.get(it.staff_id);
                      const u = userId ? usersById.get(userId) : undefined;
                      const name = u?.full_name || u?.email || `Staff #${it.staff_id}`;
                      return (
                        <tr key={it.id}>
                          <td className="p-2 border-b">{name}</td>
                          <td className="p-2 border-b text-right">{formatMoney(it.earned_amount)}</td>
                          <td className="p-2 border-b text-right">{formatMoney(it.bonus)}</td>
                          <td className="p-2 border-b text-right">{formatMoney(it.deduction)}</td>
                          <td className="p-2 border-b text-right">{formatMoney(it.tax_amount)}</td>
                          <td className="p-2 border-b text-right font-semibold">{formatMoney(it.net_pay)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500">
                Generated from Yummy Desktop Web on {new Date().toLocaleString()}.
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <Card className="border-border">
      <CardContent className="p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
