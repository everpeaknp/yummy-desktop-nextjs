"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  payrollPayablesApi,
  type PayrollPayment,
  type PayrollPeriodSuggestion,
  type PayrollStaffBalance,
} from "@/lib/payroll/payables";

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString();
}

function message(error: any) {
  const detail = error?.response?.data?.detail;
  return (typeof detail === "string" ? detail : detail?.message) || error?.response?.data?.message || error?.message || "Request failed";
}

export function StaffPayrollBalanceCard({ staffId, canManage }: { staffId: number; canManage: boolean }) {
  const router = useRouter();
  const [balance, setBalance] = useState<PayrollStaffBalance | null>(null);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBalance, nextPayments] = await Promise.all([
        payrollPayablesApi.staffBalance(staffId),
        payrollPayablesApi.payments(staffId),
      ]);
      setBalance(nextBalance);
      setPayments(nextPayments);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => { void load(); }, [load]);

  const approvedOutstanding = useMemo(
    () => balance?.outstanding_items.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0) || 0,
    [balance],
  );

  const prepare = (period?: PayrollPeriodSuggestion) => {
    const selectedPeriod = period ?? balance?.suggested_periods.find((row) => row.ready);
    if (!selectedPeriod) return;
    const params = new URLSearchParams({ date_from: selectedPeriod.date_from, date_to: selectedPeriod.date_to, staff_id: String(staffId), automatic: "1" });
    router.push(`/payroll/create?${params.toString()}`);
  };

  const openPayment = () => {
    setAmount(approvedOutstanding.toFixed(2));
    setMethod("cash");
    setReference("");
    setNotes("");
    setDialogOpen(true);
  };

  const savePayment = async () => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > approvedOutstanding + 0.001) {
      toast.error(`Enter an amount between Rs. 0.01 and ${money(approvedOutstanding)}`);
      return;
    }
    setSaving(true);
    try {
      await payrollPayablesApi.recordPayment({ staff_id: staffId, amount: numeric, payment_method: method, payment_reference: reference.trim() || undefined, notes: notes.trim() || undefined });
      toast.success(numeric < approvedOutstanding ? "Partial salary payment recorded" : "Outstanding salary paid");
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !balance) return <Card><CardContent className="flex h-36 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></CardContent></Card>;
  if (!balance) return null;
  const nextReady = balance.suggested_periods.find((row) => row.ready);
  const blocked = balance.suggested_periods.filter((row) => !row.ready);

  return <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Salary balance</CardTitle><CardDescription>Earned salary, payments, and remaining obligations for this employee.</CardDescription></div><div className="flex flex-wrap justify-end gap-2">{canManage && approvedOutstanding > 0 ? <Button onClick={openPayment}><Banknote className="mr-2 h-4 w-4" />Pay outstanding</Button> : null}{canManage && nextReady ? <Button variant="outline" onClick={() => prepare()}><CalendarClock className="mr-2 h-4 w-4" />Prepare next period</Button> : null}</div></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Outstanding" value={money(balance.total_outstanding)} /><Metric label="Approved to pay" value={money(approvedOutstanding)} /><Metric label="Current accrual" value={money(balance.current_accrual)} /><Metric label="Paid through" value={displayDate(balance.paid_through)} /></div>
        {balance.suggested_periods.length ? <CalculatedPeriods periods={balance.suggested_periods} canManage={canManage} onPrepare={prepare} /> : null}
        {blocked.length ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" />{blocked.length} payroll period{blocked.length === 1 ? "" : "s"} need attention</div><div className="mt-2 space-y-1 text-sm text-muted-foreground">{blocked.slice(0, 3).flatMap((period) => period.blockers.slice(0, 1).map((row) => <p key={`${period.date_from}-${row.code}`}>{displayDate(period.date_from)}–{displayDate(period.date_to)}: {row.message}</p>))}</div></div> : null}
        <div className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Outstanding periods</h3><div className="space-y-2">{balance.outstanding_items.length ? balance.outstanding_items.map((item) => <div key={item.payroll_item_id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{displayDate(item.date_from)} – {displayDate(item.date_to)}</p><p className="text-xs text-muted-foreground">Net {money(item.net_pay)} • paid {money(item.paid_amount)}</p></div><div className="text-right"><p className="font-semibold">{money(item.outstanding_amount)}</p><Badge variant={item.run_status === "partially_paid" ? "secondary" : "outline"}>{item.run_status.replaceAll("_", " ")}</Badge></div></div>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No approved outstanding payroll.</p>}</div></div><div><h3 className="mb-2 text-sm font-semibold">Payment history</h3><div className="space-y-2">{payments.length ? payments.slice(0, 6).map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium capitalize">{payment.payment_method} • {displayDate(payment.paid_at)}</p><p className="text-xs text-muted-foreground">{payment.payment_reference || "No reference"}{payment.notes ? ` • ${payment.notes}` : ""}</p></div><div className="text-right"><p className="font-semibold">{money(payment.amount)}</p><Badge variant={payment.status === "posted" ? "default" : "destructive"}>{payment.status}</Badge></div></div>) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No salary payments recorded yet.</p>}</div></div></div>
      </CardContent>
    </Card>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>Pay {balance.staff_name}</DialogTitle><DialogDescription>Approved balance {money(approvedOutstanding)}. A smaller amount records a partial payment and leaves the remainder outstanding.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label>Payment method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="wallet">Digital wallet</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} /></div><div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} /></div><div className="rounded-lg bg-muted p-3 text-sm">Remaining approved balance: <strong>{money(Math.max(0, approvedOutstanding - Number(amount || 0)))}</strong></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={savePayment} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record payment</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>;
}

function CalculatedPeriods({ periods, canManage, onPrepare }: { periods: PayrollPeriodSuggestion[]; canManage: boolean; onPrepare: (period: PayrollPeriodSuggestion) => void }) {
  return <div>
    <div className="mb-2">
      <h3 className="text-sm font-semibold">Calculated unpaid periods</h3>
      <p className="text-xs text-muted-foreground">These completed periods are included in outstanding salary. Review and approve a period before recording its payment.</p>
    </div>
    <div className="space-y-2">
      {periods.map((period) => <div key={`${period.date_from}-${period.date_to}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-medium">{displayDate(period.date_from)} – {displayDate(period.date_to)}</p><p className="text-xs text-muted-foreground">Due {displayDate(period.due_date)} • {period.frequency}</p></div>
        <div className="flex items-center gap-2 sm:justify-end"><span className="font-semibold">{money(period.net_pay)}</span><Badge variant={period.ready ? "outline" : "secondary"}>{period.ready ? "ready to review" : "needs attention"}</Badge>{canManage && period.ready ? <Button size="sm" variant="outline" onClick={() => onPrepare(period)}>Prepare</Button> : null}</div>
      </div>)}
    </div>
  </div>;
}
