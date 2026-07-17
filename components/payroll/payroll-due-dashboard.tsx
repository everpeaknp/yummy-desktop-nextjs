"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasPermission } from "@/lib/role-permissions";
import { PayrollPaymentDialog } from "@/components/payroll/payroll-payment-dialog";
import { PayrollSetupWizard } from "@/components/payroll/payroll-setup-wizard";
import { SalaryCalculationBreakdown } from "@/components/payroll/salary-calculation-breakdown";
import { PayrollTaxLiabilityCard } from "@/components/payroll/payroll-tax-liability-card";
import {
  payrollPayablesApi,
  type PayrollDueSummary,
  type PayrollSchedule,
  type PayrollSetupReadiness,
  type PayrollStaffBalance,
} from "@/lib/payroll/payables";
import {
  staffWorkforceApi,
  type PayrollHistoryRecord,
} from "@/lib/staff/workforce";

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
  const storedRestaurantId = useRestaurant((state) => state.restaurant?.id);
  const restaurantId = storedRestaurantId ?? user?.restaurant_id;
  const canManage = hasPermission(user, "finance.payroll.manage");
  const [summary, setSummary] = useState<PayrollDueSummary | null>(null);
  const [readiness, setReadiness] = useState<PayrollSetupReadiness | null>(null);
  const [schedules, setSchedules] = useState<PayrollSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<PayrollStaffBalance | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);
  const [historyLoadingStaffId, setHistoryLoadingStaffId] = useState<number | null>(null);
  const [historyByStaffId, setHistoryByStaffId] = useState<Record<number, PayrollHistoryRecord[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSummary, nextSchedules, nextReadiness] = await Promise.all([
        payrollPayablesApi.dueSummary(),
        payrollPayablesApi.schedules(),
        payrollPayablesApi.setupReadiness(),
      ]);
      setSummary(nextSummary);
      setSchedules(nextSchedules);
      setReadiness(nextReadiness);
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
    setSetupOpen(true);
  };

  const bulkPrepare = async () => {
    setBulkBusy(true);
    try {
      const result = await payrollPayablesApi.bulkPrepare();
      toast.success(`${result.created_run_count} payroll run${result.created_run_count === 1 ? "" : "s"} prepared for ${result.prepared_staff_count} employees`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleDetails = async (staffId: number) => {
    if (expandedStaffId === staffId) {
      setExpandedStaffId(null);
      return;
    }
    setExpandedStaffId(staffId);
    if (historyByStaffId[staffId]) return;
    setHistoryLoadingStaffId(staffId);
    try {
      const history = await staffWorkforceApi.payrollHistory(staffId);
      setHistoryByStaffId((current) => ({ ...current, [staffId]: history }));
    } catch (error) {
      toast.error(apiError(error));
      setHistoryByStaffId((current) => ({ ...current, [staffId]: [] }));
    } finally {
      setHistoryLoadingStaffId(null);
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
  const readyPeriods = summary.staff.reduce((total, staff) => total + staff.suggested_periods.filter((period) => period.ready).length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Salary due now</h2>
          <p className="text-sm text-muted-foreground">Completed periods and approved balances are calculated automatically. Current-period accrual is shown separately.</p>
        </div>
        {canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={openSettings}><Settings2 className="mr-2 h-4 w-4" />Set up payroll</Button><Button onClick={bulkPrepare} disabled={bulkBusy || readyPeriods === 0}>{bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Prepare all ready ({readyPeriods})</Button></div> : null}
      </div>

      {readiness ? <Card className={readiness.all_ready ? "border-emerald-500/30" : "border-amber-500/30"}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-semibold">{readiness.all_ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}Payroll setup: {readiness.staff_ready} of {readiness.staff_total} employees ready</div><p className="mt-1 text-sm text-muted-foreground">{readiness.all_ready ? "Automatic payroll is configured and staff checks pass." : `${readiness.blocking_staff_count} employees or the pay cycle still need attention.`}</p></div>{canManage ? <Button variant="outline" onClick={() => setSetupOpen(true)}>{readiness.all_ready ? "Review setup" : "Continue setup"}</Button> : null}</CardContent></Card> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Outstanding" value={money(summary.total_outstanding)} icon={WalletCards} tone="text-red-600" />
        <SummaryCard label="Employees overdue" value={String(overdueStaff)} icon={AlertTriangle} tone="text-amber-600" />
        <SummaryCard label="Current accrual" value={money(summary.total_current_accrual)} icon={CalendarClock} tone="text-blue-600" />
        <SummaryCard label="Payments recorded" value={money(summary.total_paid)} icon={CheckCircle2} tone="text-emerald-600" />
      </div>

      <PayrollTaxLiabilityCard
        restaurantId={restaurantId}
        canManage={canManage}
        onChanged={onChanged}
      />

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
                  const blocked = staff.suggested_periods.find((row) => !row.ready) || (staff.current_period && !staff.current_period.ready ? staff.current_period : undefined);
                  const expanded = expandedStaffId === staff.staff_id;
                  const history = historyByStaffId[staff.staff_id] || [];
                  return <Fragment key={staff.staff_id}>
                    <TableRow className={expanded ? "bg-muted/20" : undefined}>
                      <TableCell><Link href={`/staff/${staff.user_id}?tab=payroll`} className="font-semibold hover:underline">{staff.staff_name}</Link><p className="text-xs capitalize text-muted-foreground">{staff.salary_type} salary</p></TableCell>
                      <TableCell>{dateOnly(staff.paid_through)}</TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{staff.overdue_period_count > 0 ? <Badge variant="destructive">{staff.overdue_period_count} overdue</Badge> : <Badge variant="outline">Up to date</Badge>}{staff.suggested_periods.length ? <Badge variant="outline">{staff.suggested_periods.length} calculated</Badge> : null}{blocked ? <Badge variant="secondary">Needs review</Badge> : null}</div></TableCell>
                      <TableCell className="text-right font-semibold">{money(staff.total_outstanding)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{money(staff.current_accrual)}</TableCell>
                      <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">{canManage && approvedOutstanding > 0 ? <Button size="sm" onClick={() => setPaying(staff)}><Banknote className="mr-1.5 h-4 w-4" />Pay</Button> : null}{canManage && nextReady ? <Button size="sm" variant="outline" onClick={() => preparePeriod(staff)}><Clock3 className="mr-1.5 h-4 w-4" />Prepare {dateOnly(nextReady.date_to)}</Button> : null}{blocked && !nextReady ? <Button asChild size="sm" variant="outline"><Link href={blocked.blockers[0]?.action === "staff_profile" ? `/staff/${staff.user_id}?tab=employment` : blocked.blockers[0]?.action === "attendance_timesheets" ? `/attendance?tab=timesheets&staff_id=${staff.staff_id}` : `/attendance?tab=schedules&staff_id=${staff.staff_id}`}>Fix {blocked.blockers[0]?.action === "attendance_schedule" ? "schedule" : "blocker"}</Link></Button> : null}<Button size="sm" variant="ghost" onClick={() => void toggleDetails(staff.staff_id)}>{expanded ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}Details</Button></div></TableCell>
                    </TableRow>
                    {expanded ? <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="bg-muted/10 p-4 sm:p-6"><EmployeePayrollDetails staff={staff} history={history} loading={historyLoadingStaffId === staff.staff_id} canManage={canManage} onPay={() => setPaying(staff)} /></TableCell></TableRow> : null}
                  </Fragment>;
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PayrollPaymentDialog
        staff={paying}
        restaurantId={restaurantId}
        onOpenChange={(open) => !open && setPaying(null)}
        onRecorded={async () => {
          await load();
          onChanged?.();
        }}
      />

      {readiness ? <PayrollSetupWizard open={setupOpen} onOpenChange={setSetupOpen} readiness={readiness} schedule={defaultSchedule} onReload={load} onBulkPrepare={bulkPrepare} bulkBusy={bulkBusy} /> : null}
    </div>
  );
}

function EmployeePayrollDetails({
  staff,
  history,
  loading,
  canManage,
  onPay,
}: {
  staff: PayrollStaffBalance;
  history: PayrollHistoryRecord[];
  loading: boolean;
  canManage: boolean;
  onPay: () => void;
}) {
  const approvedOutstanding = staff.outstanding_items.reduce(
    (total, item) => total + Number(item.outstanding_amount || 0),
    0,
  );
  const latestCalculation = history[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">{staff.staff_name}&apos;s salary details</h3>
          <p className="text-sm text-muted-foreground">
            Review periods here, then open the staff payroll workspace for the
            complete payment and correction history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && approvedOutstanding > 0 ? (
            <Button size="sm" onClick={onPay}>
              <Banknote className="mr-2 h-4 w-4" /> Pay {money(approvedOutstanding)}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/staff/${staff.user_id}?tab=payroll`}>Full payroll history</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-xl border bg-background p-4">
          <h4 className="text-sm font-semibold">Salary periods</h4>
          <div className="mt-3 space-y-2">
            {staff.outstanding_items.map((item) => (
              <div key={item.payroll_item_id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/payroll/${item.payroll_run_id}`} className="text-sm font-medium hover:underline">
                      {dateOnly(item.date_from)} - {dateOnly(item.date_to)}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Net {money(item.net_pay)} · paid {money(item.paid_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{money(item.outstanding_amount)}</p>
                    <p className="text-xs text-muted-foreground">remaining</p>
                  </div>
                </div>
              </div>
            ))}
            {staff.suggested_periods.map((period) => (
              <div key={`${period.date_from}-${period.date_to}`} className="rounded-lg border border-dashed p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {dateOnly(period.date_from)} - {dateOnly(period.date_to)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {period.ready ? "Calculated; waiting for review" : period.blockers[0]?.message || "Needs attention"}
                    </p>
                  </div>
                  <p className="font-semibold">{money(period.net_pay)}</p>
                </div>
              </div>
            ))}
            {!staff.outstanding_items.length && !staff.suggested_periods.length ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No unpaid completed salary periods.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-2">
            <h4 className="text-sm font-semibold">Latest prepared calculation</h4>
            <p className="text-xs text-muted-foreground">
              Expand to see the attendance and salary arithmetic.
            </p>
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border bg-background">
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            </div>
          ) : latestCalculation ? (
            <SalaryCalculationBreakdown item={latestCalculation.item} />
          ) : (
            <div className="rounded-xl border border-dashed bg-background p-5 text-sm text-muted-foreground">
              Prepare and approve a salary period to lock its detailed calculation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Banknote; tone: string }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div><div className={`rounded-xl bg-muted p-3 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}
