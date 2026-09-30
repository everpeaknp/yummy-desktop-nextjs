"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";

import apiClient from "@/lib/api-client";
import { StaffApis } from "@/lib/api/endpoints";
import { attendanceApi } from "@/lib/attendance/api";
import type {
  AttendanceEntry,
  AttendanceOverview,
} from "@/lib/attendance/types";
import { staffCreditApi, type StaffBalanceRow } from "@/lib/staff/credit";
import { PayAllPreviewDialog } from "@/components/staff/pay-all-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { formatCurrency } from "@/lib/utils";
import {
  WorkforceMetricStrip,
  WorkforceSection,
} from "@/components/workforce/workforce-presentation";

type StaffUser = { id: number; is_active?: boolean };

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function money(value: number) {
  return formatCurrency(value);
}

export default function WorkforcePage() {
  const today = useMemo(todayIso, []);
  const [loading, setLoading] = useState(true);
  const [payAllPreviewOpen, setPayAllPreviewOpen] = useState(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [balances, setBalances] = useState<StaffBalanceRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [attendanceSummaryAvailable, setAttendanceSummaryAvailable] =
    useState(false);
  const [attendanceEntriesAvailable, setAttendanceEntriesAvailable] =
    useState(false);
  const [salaryBalancesAvailable, setSalaryBalancesAvailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [staffResult, overviewResult, entriesResult, balancesResult] =
      await Promise.allSettled([
        apiClient.get(StaffApis.list()),
        attendanceApi.overview(today, today),
        attendanceApi.listEntries({
          dateFrom: today,
          dateTo: today,
          limit: 300,
        }),
        staffCreditApi.balances(),
      ]);

    const nextWarnings: string[] = [];
    if (staffResult.status === "fulfilled")
      setStaff((staffResult.value.data?.data || []) as StaffUser[]);
    else nextWarnings.push("Staff directory is unavailable.");
    setAttendanceSummaryAvailable(overviewResult.status === "fulfilled");
    if (overviewResult.status === "fulfilled")
      setOverview(overviewResult.value);
    else nextWarnings.push("Attendance summary is unavailable.");
    setAttendanceEntriesAvailable(entriesResult.status === "fulfilled");
    if (entriesResult.status === "fulfilled") setEntries(entriesResult.value);
    else nextWarnings.push("Attendance entries are unavailable.");
    setSalaryBalancesAvailable(balancesResult.status === "fulfilled");
    if (balancesResult.status === "fulfilled")
      setBalances(balancesResult.value);
    else nextWarnings.push("Salary balances are unavailable.");

    setWarnings(nextWarnings);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStaff = staff.filter(
    (member) => member.is_active !== false,
  ).length;
  const workingNow = entries.filter(
    (entry) => entry.status === "open" || !entry.clock_out_at,
  ).length;
  const attendanceReview = entries.filter(
    (entry) =>
      ["draft", "pending", "needs_correction"].includes(
        entry.approval_status,
      ) || Boolean(entry.exception_code),
  );
  const totalToPay = balances.reduce(
    (sum, row) => sum + Number(row.payroll_due || 0),
    0,
  );

  const workspaceActions = (
    <>
      <Button asChild variant="outline">
        <Link href="/staff">
          <Users className="mr-2 h-4 w-4" />
          Staff
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/attendance">
          <CalendarCheck className="mr-2 h-4 w-4" />
          Attendance
        </Link>
      </Button>
      <Button
        onClick={() => setPayAllPreviewOpen(true)}
        disabled={totalToPay <= 0}
      >
        <Banknote className="mr-2 h-4 w-4" />
        Pay outstanding salaries
      </Button>
    </>
  );

  return (
    <AppPage width="wide" className="pb-20">
      <PageHeader
        className="hidden lg:flex"
        title="Workforce"
        description="Today’s staffing, attendance review, and salary status in one place."
        actions={workspaceActions}
      />
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href="/staff">
            <Users className="mr-2 h-4 w-4" />
            Staff
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href="/attendance">
            <CalendarCheck className="mr-2 h-4 w-4" />
            Attendance
          </Link>
        </Button>
        <Button
          onClick={() => setPayAllPreviewOpen(true)}
          disabled={totalToPay <= 0}
          className="col-span-2 h-11 rounded-xl"
        >
          <Banknote className="mr-2 h-4 w-4" />
          Pay outstanding salaries
        </Button>
      </div>
      <PayAllPreviewDialog
        open={payAllPreviewOpen}
        onOpenChange={setPayAllPreviewOpen}
        onPaid={load}
      />
      {warnings.length ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Some workforce data could not be loaded
          </div>
          <p className="mt-1 text-muted-foreground">{warnings.join(" ")}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-52 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-7 lg:space-y-8">
          <WorkforceSection
            title="Today"
            description="Current staffing, attendance review, and salary position."
          >
            <WorkforceMetricStrip
              items={[
                {
                  icon: Users,
                  label: "Active employees",
                  value: String(activeStaff),
                  helper: `${staff.length - activeStaff} inactive`,
                },
                {
                  icon: Clock3,
                  label: "Working now",
                  value: attendanceEntriesAvailable
                    ? String(workingNow)
                    : "Unavailable",
                  helper: attendanceEntriesAvailable
                    ? `${attendanceSummaryAvailable ? overview?.total_entries || entries.length : entries.length} entries today`
                    : "Attendance entries could not be loaded",
                },
                {
                  icon: AlertTriangle,
                  label: "Attendance review",
                  value: attendanceEntriesAvailable
                    ? String(attendanceReview.length)
                    : "Unavailable",
                  helper: attendanceEntriesAvailable
                    ? "Needs a look before salary is paid"
                    : "Attendance entries could not be loaded",
                  attention:
                    attendanceEntriesAvailable && attendanceReview.length > 0,
                },
                {
                  icon: Banknote,
                  label: "Salary due",
                  value: salaryBalancesAvailable
                    ? money(totalToPay)
                    : "Unavailable",
                  helper: !salaryBalancesAvailable
                    ? "Salary balances could not be loaded"
                    : totalToPay > 0
                      ? "Owed to the team right now"
                      : "Everyone is paid up",
                  className: "col-span-2 lg:col-span-1",
                  valueClassName: "whitespace-nowrap",
                },
              ]}
            />
          </WorkforceSection>

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:gap-8">
            <WorkforceSection
              title="Needs attention"
              description="Resolve these items before the next salary run."
              contentClassName="divide-y rounded-xl border"
            >
              {!attendanceEntriesAvailable ? (
                <UnavailableRow text="Attendance review unavailable. Attendance entries could not be loaded." />
              ) : attendanceReview.length ? (
                <ActionRow
                  icon={AlertTriangle}
                  title={`${attendanceReview.length} attendance record${attendanceReview.length === 1 ? "" : "s"} need review`}
                  description="Correct missing times, resolve exceptions, and approve payable attendance."
                  href="/attendance"
                  action="Review attendance"
                />
              ) : (
                <ReadyRow text="Attendance has no obvious review items for today." />
              )}
              {attendanceEntriesAvailable &&
              !attendanceReview.length &&
              salaryBalancesAvailable &&
              totalToPay <= 0 ? (
                <ReadyRow text="No outstanding salary is waiting to be paid." />
              ) : null}
            </WorkforceSection>

            <WorkforceSection title="Quick tasks" contentClassName="grid gap-2">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/staff">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add or manage employees
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/attendance">
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  Review timesheets and leave
                </Link>
              </Button>
            </WorkforceSection>
          </div>
        </div>
      )}
    </AppPage>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

function ReadyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 p-4 text-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      <span>{text}</span>
      <Badge variant="outline" className="ml-auto">
        Ready
      </Badge>
    </div>
  );
}

function UnavailableRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 bg-muted/30 p-4 text-sm">
      <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span>{text}</span>
      <Badge variant="outline" className="ml-auto shrink-0">
        Unavailable
      </Badge>
    </div>
  );
}
