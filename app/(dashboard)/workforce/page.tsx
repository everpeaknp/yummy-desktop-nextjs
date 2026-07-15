"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, CalendarCheck, CheckCircle2, Clock3, Loader2, RefreshCw, UserPlus, Users } from "lucide-react";

import apiClient from "@/lib/api-client";
import { PayrollApis, StaffApis } from "@/lib/api/endpoints";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceEntry, AttendanceOverview } from "@/lib/attendance/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StaffUser = { id: number; is_active?: boolean };
type PayrollRun = { id: number; status: string; date_from: string; date_to: string; total_amount?: number; total_payroll_amount?: number };

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function money(value: number) {
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function WorkforcePage() {
  const today = useMemo(todayIso, []);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [staffResult, overviewResult, entriesResult, payrollResult] = await Promise.allSettled([
      apiClient.get(StaffApis.list()),
      attendanceApi.overview(today, today),
      attendanceApi.listEntries({ dateFrom: today, dateTo: today, limit: 300 }),
      apiClient.get(PayrollApis.listRuns()),
    ]);

    const nextWarnings: string[] = [];
    if (staffResult.status === "fulfilled") setStaff((staffResult.value.data?.data || []) as StaffUser[]);
    else nextWarnings.push("Staff directory is unavailable.");
    if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
    else nextWarnings.push("Attendance summary is unavailable.");
    if (entriesResult.status === "fulfilled") setEntries(entriesResult.value);
    else nextWarnings.push("Attendance entries are unavailable.");
    if (payrollResult.status === "fulfilled") setPayrollRuns((payrollResult.value.data?.data || []) as PayrollRun[]);
    else nextWarnings.push("Payroll summary is unavailable or not enabled for this plan.");

    setWarnings(nextWarnings);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStaff = staff.filter((member) => member.is_active !== false).length;
  const workingNow = entries.filter((entry) => entry.status === "open" || !entry.clock_out_at).length;
  const attendanceReview = entries.filter((entry) => ["draft", "pending", "needs_correction"].includes(entry.approval_status) || Boolean(entry.exception_code));
  const payrollAction = payrollRuns.filter((run) => run.status === "draft" || run.status === "approved");
  const latestRun = payrollRuns[0];
  const latestTotal = Number(latestRun?.total_payroll_amount || latestRun?.total_amount || 0);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce</h1>
          <p className="mt-1 text-muted-foreground">Today&apos;s staffing, attendance review, and payroll readiness in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/staff"><Users className="mr-2 h-4 w-4" />Staff</Link></Button>
          <Button asChild variant="outline"><Link href="/attendance"><CalendarCheck className="mr-2 h-4 w-4" />Attendance</Link></Button>
          <Button asChild><Link href="/payroll/create"><Banknote className="mr-2 h-4 w-4" />Run payroll</Link></Button>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} aria-label="Refresh workforce"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {warnings.length ? <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Some workforce data could not be loaded</div><p className="mt-1 text-muted-foreground">{warnings.join(" ")}</p></div> : null}

      {loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Active employees" value={String(activeStaff)} helper={`${staff.length - activeStaff} inactive`} />
          <Metric icon={Clock3} label="Working now" value={String(workingNow)} helper={`${overview?.total_entries || entries.length} entries today`} />
          <Metric icon={AlertTriangle} label="Attendance review" value={String(attendanceReview.length)} helper="Must be resolved before payroll" attention={attendanceReview.length > 0} />
          <Metric icon={Banknote} label="Latest payroll" value={latestRun ? money(latestTotal) : "No runs"} helper={latestRun ? `${latestRun.status} • ${latestRun.date_from} to ${latestRun.date_to}` : "Create the first payroll run"} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card>
            <CardHeader><CardTitle>Needs attention</CardTitle><CardDescription>Complete these items before the next payroll run.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {attendanceReview.length ? <ActionRow icon={AlertTriangle} title={`${attendanceReview.length} attendance record${attendanceReview.length === 1 ? "" : "s"} need review`} description="Correct missing times, resolve exceptions, and approve payable attendance." href="/attendance" action="Review attendance" /> : <ReadyRow text="Attendance has no obvious review items for today." />}
              {payrollAction.map((run) => <ActionRow key={run.id} icon={Banknote} title={`Payroll #${run.id} is ${run.status}`} description={`${run.date_from} to ${run.date_to} • ${money(Number(run.total_payroll_amount || run.total_amount || 0))}`} href={`/payroll/${run.id}`} action={run.status === "draft" ? "Review draft" : "Mark paid"} />)}
              {!payrollAction.length ? <ReadyRow text="No draft or approved payroll run is waiting for action." /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common workforce tasks.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline" className="justify-start"><Link href="/staff"><UserPlus className="mr-2 h-4 w-4" />Add or manage employees</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href="/attendance"><CalendarCheck className="mr-2 h-4 w-4" />Review timesheets and leave</Link></Button>
              <Button asChild variant="outline" className="justify-start"><Link href="/payroll"><Banknote className="mr-2 h-4 w-4" />View payroll runs</Link></Button>
            </CardContent>
          </Card>
        </div>
      </>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, helper, attention = false }: { icon: typeof Users; label: string; value: string; helper: string; attention?: boolean }) {
  return <Card className={attention ? "border-amber-400/60" : undefined}><CardContent className="flex items-start gap-3 p-4"><div className={`rounded-xl p-2 ${attention ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div></CardContent></Card>;
}

function ActionRow({ icon: Icon, title, description, href, action }: { icon: typeof Users; title: string; description: string; href: string; action: string }) {
  return <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><Icon className="h-4 w-4" /></div><div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div></div><Button asChild size="sm" variant="outline"><Link href={href}>{action}</Link></Button></div>;
}

function ReadyRow({ text }: { text: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span>{text}</span><Badge variant="outline" className="ml-auto border-emerald-500/30">Ready</Badge></div>;
}
