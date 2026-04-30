"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { PayrollApis, StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  const isPaid =
    (effectivePlan === "paid" || effectivePlan === "trial_paid") &&
    (planState === "paid" || planState === "trialing");

  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [usersById, setUsersById] = useState<Map<number, StaffUser>>(new Map()); // user_id -> user
  const [userIdByStaffId, setUserIdByStaffId] = useState<Map<number, number>>(new Map()); // staff_id -> user_id

  const [actionLoading, setActionLoading] = useState(false);

  const [paidOpen, setPaidOpen] = useState(false);
  const [paidMethod, setPaidMethod] = useState("");
  const [paidRef, setPaidRef] = useState("");
  const [paidAt, setPaidAt] = useState<string>("");

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
    if (!loading && !isPaid) router.push("/premium");
  }, [loading, isPaid, router]);

  const loadStaff = async () => {
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
  };

  const loadRun = async () => {
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
  };

  useEffect(() => {
    if (!user) return;
    if (!isPaid) {
      setLoading(false);
      return;
    }
    loadStaff();
    loadRun();
  }, [user, runId, isPaid]);

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
    setActionLoading(true);
    try {
      const payload: any = {
        payment_method: paidMethod || null,
        payment_reference: paidRef || null,
        paid_at: paidAt ? new Date(paidAt).toISOString() : null,
      };
      const res = await apiClient.post(PayrollApis.markPaid(run.id), payload);
      if (res.data?.status === "success") {
        toast.success("Payroll marked as paid");
        setPaidOpen(false);
        await loadRun();
      } else {
        toast.error(res.data?.message || "Failed to mark paid");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to mark paid");
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
    setPaidMethod(run.payment_method || "");
    setPaidRef(run.payment_reference || "");
    setPaidAt(toDatetimeLocalValue(run.paid_at));
  }, [run?.id]);

  if (loading) {
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
              <p className="text-lg font-semibold">Payroll is a Premium feature</p>
              <p className="text-sm text-muted-foreground">Upgrade to Premium to view payroll runs.</p>
            </div>
            <Link href="/premium">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">View Premium</Button>
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
  const canMarkPaid = run.status === "approved";
  const canCancel = run.status === "draft" || run.status === "approved";
  const canAdjust = run.status === "draft" || run.status === "approved";
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
          <Button variant="outline" onClick={() => setPaidOpen(true)} disabled={!canMarkPaid || actionLoading}>
            <FileText className="w-4 h-4 mr-2" />
            Mark Paid
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
                    <TableCell className="text-right">{formatMoney(item.earned_amount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.bonus)}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.deduction)}</TableCell>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payroll As Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)} placeholder="e.g. Cash, Bank, Wallet" />
            </div>
            <div className="space-y-2">
              <Label>Payment Reference</Label>
              <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Optional reference number" />
            </div>
            <div className="space-y-2">
              <Label>Paid At</Label>
              <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave empty to let the server decide.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={submitPaid} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Paid
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
