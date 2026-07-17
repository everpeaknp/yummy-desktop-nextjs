"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plus, Users } from "lucide-react";

import apiClient from "@/lib/api-client";
import { PayrollApis, StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type StaffUser = {
  id: number; // user_id
  full_name?: string;
  email?: string;
  role?: string;
  restaurant_id?: number | null;
};

type StaffProfile = {
  id: number; // staff_id
  user_id: number;
};

type PayrollStaffOption = {
  staff_id: number;
  user_id: number;
  label: string;
  sublabel: string;
  role?: string;
};

type PayrollReadinessBlocker = {
  code: string;
  message: string;
  staff_id?: number | null;
  entry_ids?: number[];
  record_type?: string | null;
  record_ids?: number[];
};

type PayrollPreviewItem = {
  staff_id: number;
  salary_type: string;
  scheduled_days: number;
  payable_days: number;
  absent_days: number;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  regular_pay: number;
  overtime_pay: number;
  absence_deduction: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  paid_holiday_days: number;
  holiday_premium_pay: number;
  salary_effective_from?: string | null;
  policy_evidence: Array<Record<string, unknown>>;
  net_pay: number;
};

type PayrollPreview = {
  ready: boolean;
  blockers: PayrollReadinessBlocker[];
  items: PayrollPreviewItem[];
  total_amount: number;
};

function formatMoney(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatMinutes(value: number) {
  const minutes = Number(value || 0);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function yyyyMmDd(d: Date) {
  // Local date input expects YYYY-MM-DD in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PayrollCreatePage() {
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
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staff, setStaff] = useState<PayrollStaffOption[]>([]);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(yyyyMmDd(today));
  const [dateTo, setDateTo] = useState(yyyyMmDd(today));
  const [taxPercentage, setTaxPercentage] = useState<string>("0");

  const [includeAllStaff, setIncludeAllStaff] = useState(true);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(new Set()); // staff_id
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [reviewedSignature, setReviewedSignature] = useState("");
  const [automaticSource, setAutomaticSource] = useState(false);

  const selectionSignature = includeAllStaff
    ? "all"
    : Array.from(selectedStaffIds).sort((a, b) => a - b).join(",");
  const previewSignature = `${dateFrom}|${dateTo}|${taxPercentage}|${selectionSignature}`;
  const previewIsCurrent = reviewedSignature === previewSignature;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const suggestedFrom = params.get("date_from");
    const suggestedTo = params.get("date_to");
    const suggestedStaffId = Number(params.get("staff_id"));
    if (suggestedFrom && suggestedTo && Number.isInteger(suggestedStaffId) && suggestedStaffId > 0) {
      setDateFrom(suggestedFrom);
      setDateTo(suggestedTo);
      setIncludeAllStaff(false);
      setSelectedStaffIds(new Set([suggestedStaffId]));
      setAutomaticSource(params.get("automatic") === "1");
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [user, me, router]);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      // Payroll requires Staff profiles. Users without a Staff profile will fail with:
      // "Staff not found for IDs: [...]"
      const [staffRes, usersRes] = await Promise.all([
        apiClient.get(StaffProfileApis.list({ skip: 0, limit: 500 })),
        apiClient.get(StaffApis.list()),
      ]);

      if (staffRes.data?.status !== "success") {
        toast.error(staffRes.data?.message || "Failed to load staff profiles");
        return;
      }
      if (usersRes.data?.status !== "success") {
        toast.error(usersRes.data?.message || "Failed to load user list");
        return;
      }

      const profiles = (staffRes.data.data || []) as StaffProfile[];
      const users = (usersRes.data.data || []) as StaffUser[];
      const usersById = new Map<number, StaffUser>(users.map((u) => [u.id, u]));

      const options: PayrollStaffOption[] = profiles.map((p) => {
        const u = usersById.get(p.user_id);
        const label = u?.full_name || u?.email || `User #${p.user_id}`;
        const sublabel = `${u?.email || "No email"}${u?.role ? ` • ${u.role}` : ""}`;
        return { staff_id: p.id, user_id: p.user_id, label, sublabel, role: u?.role };
      });

      setStaff(options);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to load staff list");
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !isPaid) router.push("/premium");
  }, [loading, isPaid, router]);

  useEffect(() => {
    if (!user) return;
    if (!isPaid) return;
    if (!includeAllStaff) fetchStaff();
  }, [user, includeAllStaff, isPaid]);

  const toggleStaff = (id: number) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildPayload = () => {
    const tax = Number(taxPercentage);
    if (!dateFrom || !dateTo) throw new Error("Please select a date range");
    if (dateTo < dateFrom) throw new Error("The end date must be on or after the start date");
    if (Number.isNaN(tax) || tax < 0 || tax > 100) throw new Error("Tax % must be between 0 and 100");
    if (!includeAllStaff && selectedStaffIds.size === 0) throw new Error("Select at least one staff member");
    const payload: Record<string, unknown> = {
      date_from: dateFrom,
      date_to: dateTo,
      tax_percentage: tax,
      use_approved_attendance: true,
    };
    if (!includeAllStaff) payload.staff_ids = Array.from(selectedStaffIds);
    return payload;
  };

  const handleReview = async () => {
    let payload: Record<string, unknown>;
    try {
      payload = buildPayload();
    } catch (error: any) {
      toast.error(error?.message || "Payroll details are invalid");
      return;
    }
    setReviewing(true);
    try {
      const res = await apiClient.post(PayrollApis.previewRun, payload);
      if (res.data?.status !== "success") {
        toast.error(res.data?.message || "Failed to review payroll readiness");
        return;
      }
      const nextPreview = res.data.data as PayrollPreview;
      setPreview(nextPreview);
      setReviewedSignature(previewSignature);
      if (nextPreview.ready) toast.success("Attendance is ready for payroll");
      else toast.error("Resolve the attendance blockers before creating payroll");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail?.message || e?.response?.data?.detail || "Failed to review payroll readiness");
    } finally {
      setReviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!previewIsCurrent || !preview?.ready) {
      await handleReview();
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      const res = await apiClient.post(PayrollApis.createRun, payload);
      if (res.data?.status === "success" && res.data?.data?.id) {
        toast.success("Payroll run created");
        router.push(`/payroll/${res.data.data.id}`);
        return;
      }
      toast.error(res.data?.message || "Failed to create payroll run");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.response?.data?.detail || "Failed to create payroll run");
    } finally {
      setSubmitting(false);
    }
  };

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
              <p className="text-sm text-muted-foreground">Upgrade to Premium to create payroll runs.</p>
            </div>
            <Link href="/premium">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">View Premium</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4">
        <Link href="/payroll">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{automaticSource ? "Review Suggested Payroll" : "Create Off-cycle Payroll"}</h1>
          <p className="text-muted-foreground">{automaticSource ? "The system selected the oldest completed unpaid period. Review attendance before creating the draft." : "Use a custom period for corrections, advances, or exceptional payroll. Normal payroll is prepared from the due dashboard."}</p>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">{automaticSource ? "Suggested payroll period" : "Custom payroll period"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tax Percentage</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Applied to payroll calculations.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff Selection
            </CardTitle>
            <p className="text-sm text-muted-foreground">Include everyone by default, or choose staff.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">All staff</span>
            <Switch checked={includeAllStaff} onCheckedChange={setIncludeAllStaff} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {includeAllStaff ? (
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
              <div className="space-y-1">
                <p className="font-medium">All staff included</p>
                <p className="text-sm text-muted-foreground">Payroll will include every eligible staff member.</p>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Default</Badge>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select staff ({selectedStaffIds.size} selected)
                </p>
                <Button variant="outline" onClick={fetchStaff} disabled={staffLoading}>
                  {staffLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Refresh
                </Button>
              </div>

              <ScrollArea className="h-72 rounded-xl border bg-white dark:bg-slate-950">
                <div className="p-3 space-y-2">
                  {staffLoading ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading staff...
                    </div>
                  ) : staff.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      No staff found.
                    </div>
                  ) : (
                    staff.map((s) => (
                      <label
                        key={s.staff_id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/20 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedStaffIds.has(s.staff_id)}
                            onCheckedChange={() => toggleStaff(s.staff_id)}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {s.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.sublabel}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline">Staff #{s.staff_id}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && previewIsCurrent ? (
        <Card className={preview.ready ? "border-emerald-300" : "border-red-300"}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {preview.ready ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              {preview.ready ? "Attendance ready" : "Attendance blockers"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.blockers.length > 0 ? (
              <div className="space-y-2">
                {preview.blockers.map((blocker, index) => {
                  const option = staff.find((candidate) => candidate.staff_id === blocker.staff_id);
                  const staffIssue = Boolean(option) && (blocker.code.includes("SALARY") || blocker.code.includes("SCHEDULE") || blocker.code.includes("WORK_HOURS"));
                  const payrollIssue = blocker.code.includes("OVERLAP");
                  const fixHref = staffIssue ? `/staff/${option?.user_id}` : payrollIssue ? "/payroll" : "/attendance";
                  return (
                    <div key={`${blocker.code}-${blocker.staff_id || "all"}-${index}`} className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{option?.label ? `${option.label}: ${blocker.message}` : blocker.message}</p>
                        {blocker.entry_ids?.length ? <p className="mt-1 text-xs">Attendance entries: {blocker.entry_ids.join(", ")}</p> : null}
                        {blocker.record_ids?.length ? <p className="mt-1 text-xs">{blocker.record_type || "Policy"} records: {blocker.record_ids.join(", ")}</p> : null}
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0 bg-background text-foreground">
                        <Link href={fixHref}>{staffIssue ? "Open staff" : payrollIssue ? "View payroll runs" : "Fix attendance"}</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {preview.items.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="p-3">Staff</th>
                      <th className="p-3">Attendance</th>
                      <th className="p-3 text-right">Regular</th>
                      <th className="p-3 text-right">Overtime</th>
                      <th className="p-3 text-right">Net pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => {
                      const option = staff.find((candidate) => candidate.staff_id === item.staff_id);
                      return (
                        <tr key={item.staff_id} className="border-t align-top">
                          <td className="p-3"><p className="font-medium">{option?.label || `Staff #${item.staff_id}`}</p><p className="text-xs capitalize text-muted-foreground">{item.salary_type}</p></td>
                          <td className="p-3"><p>{Number(item.payable_days).toFixed(2)} / {Number(item.scheduled_days).toFixed(2)} payable days</p><p className="text-xs text-muted-foreground">{formatMinutes(item.regular_minutes)} regular • {formatMinutes(item.overtime_minutes)} OT • {formatMinutes(item.break_minutes)} break</p><p className="mt-1 text-xs text-muted-foreground">{Number(item.paid_leave_days || 0).toFixed(2)} paid leave • {Number(item.unpaid_leave_days || 0).toFixed(2)} unpaid leave • {Number(item.paid_holiday_days || 0).toFixed(2)} holidays</p>{item.salary_effective_from ? <p className="mt-1 text-xs text-muted-foreground">Salary effective {item.salary_effective_from}</p> : null}</td>
                          <td className="p-3 text-right"><p>{formatMoney(item.regular_pay)}</p>{Number(item.holiday_premium_pay || 0) > 0 ? <p className="text-xs text-muted-foreground">+ {formatMoney(item.holiday_premium_pay)} holiday premium</p> : null}</td>
                          <td className="p-3 text-right">{formatMoney(item.overtime_pay)}</td>
                          <td className="p-3 text-right font-semibold">{formatMoney(item.net_pay)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="text-right text-base font-semibold">Total {formatMoney(preview.total_amount)}</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link href="/payroll">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSubmit}
          disabled={submitting || reviewing}
        >
          {submitting || reviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {previewIsCurrent && preview?.ready ? "Create Payroll Draft" : "Review Attendance Readiness"}
        </Button>
      </div>
    </div>
  );
}
