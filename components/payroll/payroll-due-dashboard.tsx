"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Settings2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import {
  payrollPayablesApi,
  type PayrollDueSummary,
  type PayrollSchedule,
  type PayrollStaffBalance,
} from "@/lib/payroll/payables";

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateOnly(value?: string | null) {
  if (!value) return "Not paid yet";
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function apiError(error: any) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return detail?.message || error?.response?.data?.message || error?.message || "Request failed";
}

export function PayrollDueDashboard({ onChanged }: { onChanged?: () => void }) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const canManage = hasPermission(user, "finance.payroll.manage");
  const [summary, setSummary] = useState<PayrollDueSummary | null>(null);
  const [schedules, setSchedules] = useState<PayrollSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<PayrollStaffBalance | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [periodStartDay, setPeriodStartDay] = useState("1");
  const [paymentDelayDays, setPaymentDelayDays] = useState("0");
  const [trackingStart, setTrackingStart] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextSchedules] = await Promise.all([
        payrollPayablesApi.dueSummary(),
        payrollPayablesApi.schedules(),
      ]);
      setSummary(nextSummary);
      setSchedules(nextSchedules);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultSchedule = useMemo(
    () => schedules.find((row) => row.staff_id == null),
    [schedules],
  );

  const openSettings = () => {
    setFrequency(defaultSchedule?.frequency || "monthly");
    setPeriodStartDay(String(defaultSchedule?.period_start_day ?? 1));
    setPaymentDelayDays(String(defaultSchedule?.payment_delay_days ?? 0));
    setTrackingStart(defaultSchedule?.effective_from || "");
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    const startDay = Number(periodStartDay);
    const delay = Number(paymentDelayDays);
    if (!Number.isInteger(startDay) || startDay < (frequency === "monthly" ? 1 : 0) || startDay > (frequency === "monthly" ? 31 : 6)) {
      toast.error(frequency === "monthly" ? "Monthly start day must be 1–31" : "Weekly start day must be 0–6");
      return;
    }
    if (!Number.isInteger(delay) || delay < 0 || delay > 90) {
      toast.error("Payment delay must be between 0 and 90 days");
      return;
    }
    setSaving(true);
    try {
      await payrollPayablesApi.saveSchedule({
        frequency,
        period_start_day: startDay,
        payment_delay_days: delay,
        effective_from: trackingStart || undefined,
        is_active: true,
      });
      toast.success("Automatic payroll schedule saved");
      setSettingsOpen(false);
      await load();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (staff: PayrollStaffBalance) => {
    const approvedOutstanding = staff.outstanding_items.reduce(
      (total, item) => total + Number(item.outstanding_amount || 0),
      0,
    );
    setPaying(staff);
    setAmount(approvedOutstanding.toFixed(2));
    setMethod("cash");
    setReference("");
    setNotes("");
    const local = new Date();
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setPaidAt(local.toISOString().slice(0, 16));
  };

  const recordPayment = async () => {
    if (!paying) return;
    const numericAmount = Number(amount);
    const approvedOutstanding = paying.outstanding_items.reduce(
      (total, item) => total + Number(item.outstanding_amount || 0),
      0,
    );
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a payment amount greater than zero");
      return;
    }
    if (numericAmount > approvedOutstanding + 0.001) {
      toast.error("Payment cannot exceed the approved outstanding salary");
      return;
    }
    setSaving(true);
    try {
      await payrollPayablesApi.recordPayment({
        staff_id: paying.staff_id,
        amount: numericAmount,
        payment_method: method,
        payment_reference: reference.trim() || undefined,
        paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(
        numericAmount < approvedOutstanding
          ? "Partial salary payment recorded"
          : "Outstanding salary paid",
      );
      setPaying(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setSaving(false);
    }
  };

  const preparePeriod = (staff: PayrollStaffBalance) => {
    const period = staff.suggested_periods.find((row) => row.ready);
    if (!period) return;
    const params = new URLSearchParams({
      date_from: period.date_from,
      date_to: period.date_to,
      staff_id: String(staff.staff_id),
      automatic: "1",
    });
    router.push(`/payroll/create?${params.toString()}`);
  };

  if (loading && !summary) {
    return <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>;
  }
  if (!summary) return null;

  const overdueStaff = summary.staff.filter((row) => row.overdue_period_count > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Salary due now</h2>
          <p className="text-sm text-muted-foreground">Completed periods and approved balances are calculated automatically. Current-period accrual is shown separately.</p>
        </div>
        {canManage ? <Button variant="outline" onClick={openSettings}><Settings2 className="mr-2 h-4 w-4" />Pay schedule</Button> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Outstanding" value={money(summary.total_outstanding)} icon={WalletCards} tone="text-red-600" />
        <SummaryCard label="Employees overdue" value={String(overdueStaff)} icon={AlertTriangle} tone="text-amber-600" />
        <SummaryCard label="Current accrual" value={money(summary.total_current_accrual)} icon={CalendarClock} tone="text-blue-600" />
        <SummaryCard label="Payments recorded" value={money(summary.total_paid)} icon={CheckCircle2} tone="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Employee balances</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Paid through</TableHead><TableHead>Periods</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Current accrual</TableHead><TableHead className="text-right">Next action</TableHead></TableRow></TableHeader>
              <TableBody>
                {summary.staff.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Create staff employment profiles to start automatic payroll.</TableCell></TableRow> : summary.staff.map((staff) => {
                  const approvedOutstanding = staff.outstanding_items.reduce((total, item) => total + Number(item.outstanding_amount || 0), 0);
                  const nextReady = staff.suggested_periods.find((row) => row.ready);
                  const blocked = staff.suggested_periods.find((row) => !row.ready);
                  return <TableRow key={staff.staff_id}>
                    <TableCell><Link href={`/staff/${staff.user_id}`} className="font-semibold hover:underline">{staff.staff_name}</Link><p className="text-xs capitalize text-muted-foreground">{staff.salary_type} salary</p></TableCell>
                    <TableCell>{dateOnly(staff.paid_through)}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{staff.overdue_period_count > 0 ? <Badge variant="destructive">{staff.overdue_period_count} overdue</Badge> : <Badge variant="outline">Up to date</Badge>}{staff.suggested_periods.length ? <Badge variant="outline">{staff.suggested_periods.length} calculated</Badge> : null}{blocked ? <Badge variant="secondary">Needs review</Badge> : null}</div></TableCell>
                    <TableCell className="text-right font-semibold">{money(staff.total_outstanding)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{money(staff.current_accrual)}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-2">{canManage && approvedOutstanding > 0 ? <Button size="sm" onClick={() => openPayment(staff)}><Banknote className="mr-1.5 h-4 w-4" />Pay</Button> : null}{canManage && nextReady ? <Button size="sm" variant="outline" onClick={() => preparePeriod(staff)}><Clock3 className="mr-1.5 h-4 w-4" />Prepare {dateOnly(nextReady.date_to)}</Button> : null}{blocked && !nextReady ? <Button asChild size="sm" variant="outline"><Link href={blocked.blockers.some((row) => row.code.includes("SALARY") || row.code.includes("WORK_HOURS")) ? `/staff/${staff.user_id}` : "/attendance"}>Resolve blocker</Link></Button> : null}</div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record salary payment</DialogTitle><DialogDescription>{paying ? `${paying.staff_name} has ${money(paying.outstanding_items.reduce((total, item) => total + Number(item.outstanding_amount || 0), 0))} approved and ready to pay. Payments are allocated to the oldest period first.` : ""}</DialogDescription></DialogHeader>
          {paying ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>Payment method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="wallet">Digital wallet</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Paid at</Label><Input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></div><div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank reference, cheque number…" /></div><div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment note" /></div><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">After this payment</p><p className="text-muted-foreground">Remaining approved balance: {money(Math.max(0, paying.outstanding_items.reduce((total, item) => total + Number(item.outstanding_amount || 0), 0) - Number(amount || 0)))}</p></div></div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button><Button onClick={recordPayment} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Automatic payroll schedule</DialogTitle><DialogDescription>Set this once. Payroll will calculate completed unpaid periods from the tracking date; the manual date picker remains available for off-cycle payroll.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="space-y-2"><Label>Pay cycle</Label><Select value={frequency} onValueChange={(value: "monthly" | "weekly") => { setFrequency(value); setPeriodStartDay(value === "monthly" ? "1" : "0"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>{frequency === "monthly" ? "Period starts on day" : "Week starts on (0 Monday – 6 Sunday)"}</Label><Input type="number" value={periodStartDay} onChange={(event) => setPeriodStartDay(event.target.value)} /></div><div className="space-y-2"><Label>Track unpaid payroll from</Label><Input type="date" value={trackingStart} onChange={(event) => setTrackingStart(event.target.value)} /><p className="text-xs text-muted-foreground">For existing businesses, use the first unpaid date. This avoids treating salaries already paid outside Yummy as outstanding.</p></div><div className="space-y-2"><Label>Payment due after period ends (days)</Label><Input type="number" min="0" max="90" value={paymentDelayDays} onChange={(event) => setPaymentDelayDays(event.target.value)} /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Banknote; tone: string }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div><div className={`rounded-xl bg-muted p-3 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}
