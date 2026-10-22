"use client";
import { MobileReportControls, mobileDetailClass } from "./mobile-report-controls";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendancePayrollPreview } from "@/lib/attendance/types";
import { calculationUnits, payrollEstimateCsv, payrollNumber, payrollReasons, payrollTotal, payrollWarnings, validatePayrollRows } from "@/lib/attendance/payroll-review";
import { localDate, rangeError, shiftDate } from "@/lib/attendance/register";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkforceMetricStrip, WorkforceSection } from "@/components/workforce/workforce-presentation";

type Props = { staffId?: number; own?: boolean; canExport?: boolean; canViewAttendance?: boolean; canOpenStaff?: boolean };
const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function PayrollPeriodReview({ staffId, own = false, canExport = false, canViewAttendance = false, canOpenStaff = false }: Props) {
  const today = localDate();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<AttendancePayrollPreview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AttendancePayrollPreview | null>(null);
  const [page, setPage] = useState(0);
  const zoneResolved = useRef(false);
  const changed = useRef(false);
  const invalid = rangeError(from, to);
  const individual = own || !!staffId;
  const filtered = (rows || []).filter(row => (row.staff_name || `Staff #${row.staff_id}`).toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const safePage = Math.min(page, pages - 1);
  const timezone = rows?.[0]?.timezone;

  function changeRange(start: string, end: string) { changed.current = true; setFrom(start); setTo(end); setDetail(null); setPage(0); }
  function preset(kind: "week" | "month") {
    const now = localDate(timezone);
    const weekday = new Date(`${now}T12:00:00Z`).getUTCDay();
    changeRange(kind === "month" ? `${now.slice(0, 7)}-01` : shiftDate(now, -((weekday + 6) % 7)), now);
  }
  useEffect(() => {
    if (invalid) { setLoading(false); return; }
    let live = true;
    setLoading(true); setError(null); setRows(null); setDetail(null);
    attendanceApi.payrollPeriod(from, to, { own, staffId }).then(result => {
      if (!live) return;
      validatePayrollRows(result);
      if (!zoneResolved.current && !changed.current && result[0]?.timezone) {
        zoneResolved.current = true;
        const now = localDate(result[0].timezone);
        setFrom(`${now.slice(0, 7)}-01`); setTo(now);
      }
      setRows(result);
    }).catch(reason => { if (live) setError(reason?.response?.data?.detail?.message || (typeof reason?.response?.data?.detail === "string" ? reason.response.data.detail : reason.message) || "Earnings could not be loaded. Retry the report."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [from, to, invalid, own, staffId, reload]);

  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", payrollEstimateCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `earnings-estimate-${from}-${to}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <WorkforceSection title={own ? "My earnings by period" : individual ? "Earnings by period" : "Payroll review"}
    description={individual ? "Estimated earnings for these dates, before payments and deductions." : "Choose the dates to review, then open the calculation for each employee."}>
    <div className="space-y-4">
      <MobileReportControls from={from} to={to} timezone={timezone} loading={loading} onChange={changeRange} onRefresh={() => setReload(value => value + 1)} onExport={canExport ? exportCsv : undefined} exportDisabled={loading || !!error || !!invalid || !filtered.length} />
      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <label className="space-y-1 text-sm font-medium">From<Input name="earnings-from" autoComplete="off" className="focus-visible:ring-2 focus-visible:ring-ring" type="date" value={from} onChange={event => changeRange(event.target.value, to)} /></label>
        <label className="space-y-1 text-sm font-medium">To<Input name="earnings-to" autoComplete="off" className="focus-visible:ring-2 focus-visible:ring-ring" type="date" min={from} value={to} onChange={event => changeRange(from, event.target.value)} /></label>
        <Button variant="outline" onClick={() => preset("week")}>This week</Button><Button variant="outline" onClick={() => preset("month")}>This month</Button>
        <Button variant="outline" disabled={loading || !!invalid} onClick={() => setReload(value => value + 1)}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Refresh</Button>
        {canExport && <Button variant="outline" disabled={loading || !!error || !!invalid || !filtered.length} onClick={exportCsv}><Download aria-hidden="true" className="mr-2 h-4 w-4" />Export earnings CSV</Button>}
      </div>
      {invalid ? <p role="alert" className="text-sm text-destructive">{invalid}</p> : error ? <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => setReload(value => value + 1)}>Retry</Button></div> : loading ? <p role="status" className="py-8 text-sm text-muted-foreground">Loading earnings…</p> : rows && <>
        <p className="text-xs text-muted-foreground">{dateLabel(from)} – {dateLabel(to)}{timezone ? ` · ${timezone}` : ""}. Earnings before payments and deductions. Outstanding salary covers all dates and appears in the salary account.</p>
        {!individual && <>
          <WorkforceMetricStrip items={[
            { label: "Staff", value: String(filtered.length) }, { label: "Estimated earnings", value: formatCurrency(payrollTotal(filtered)) },
            { label: "Entries to review", value: String(filtered.reduce((sum, row) => sum + row.review_count, 0)) },
          ]} />
          <label className="block max-w-sm space-y-1 text-sm font-medium">Find staff<Input name="payroll-search" autoComplete="off" type="search" className="focus-visible:ring-2 focus-visible:ring-ring" placeholder="Search by name…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
        </>}
        {!filtered.length ? <p className="rounded-lg border p-5 text-sm text-muted-foreground">No staff match this report.</p> : individual ? <PayCalculation row={filtered[0]} own={own} canViewAttendance={canViewAttendance} /> : <>
          <div className="divide-y rounded-xl border md:hidden">{filtered.slice(safePage * 25, safePage * 25 + 25).map(row => <button key={row.staff_id} className="block min-h-16 w-full space-y-2 p-3 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2" onClick={() => setDetail(row)}>
            <span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{row.staff_name || `Staff #${row.staff_id}`}</span><span className="shrink-0 font-semibold tabular-nums">{formatCurrency(row.estimated_payable)}</span></span>
            <span className="block text-xs text-muted-foreground">{formatCurrency(row.salary_amount)} / {row.salary_type} · {row.attendance_based_salary ? "Attendance" : "Calendar days"}</span>
            <span className="block text-xs text-muted-foreground">{row.review_count ? `${row.review_count} to review · ` : ""}View calculation</span>
          </button>)}</div>
          <div className="hidden overflow-x-auto rounded-xl border md:block"><table className="w-full min-w-[660px] text-left text-sm"><caption className="sr-only">Estimated earnings for the selected dates</caption>
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>{["Staff", "Pay agreement", "Method", "Review", "Estimated earnings"].map(title => <th scope="col" key={title} className="px-4 py-3 font-medium">{title}</th>)}</tr></thead>
            <tbody className="divide-y">{filtered.slice(safePage * 25, safePage * 25 + 25).map(row => <tr key={row.staff_id}>
              <td className="px-4 py-3"><button className="max-w-64 break-words text-left font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2" onClick={() => setDetail(row)}>{row.staff_name || `Staff #${row.staff_id}`}</button><p className="text-xs text-muted-foreground">View calculation</p></td>
              <td className="px-4 py-3 tabular-nums">{formatCurrency(row.salary_amount)} / {row.salary_type || "unspecified"}</td><td className="px-4 py-3">{row.attendance_based_salary ? "Attendance" : "Calendar days"}</td>
              <td className="px-4 py-3">{row.review_count ? <Badge variant="outline">{row.review_count} to review</Badge> : "—"}{row.warnings.some(code => code !== "current_agreement") && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Check calculation notes</p>}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{formatCurrency(row.estimated_payable)}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm [&_button]:min-h-11"><span>{filtered.length} staff · Page {safePage + 1} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</Button><Button variant="outline" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Next</Button></div></div>
          <p className="text-xs text-muted-foreground">Estimates use current pay agreements. Open a calculation to check pay rules, excluded attendance and future dates before using its amount.</p>
        </>}
      </>}
    </div>
    <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}><DialogContent className={`max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-3xl ${mobileDetailClass}`}><DialogHeader><DialogTitle>{detail?.staff_name || "Earnings calculation"}</DialogTitle><DialogDescription>How the selected period estimate was calculated.</DialogDescription></DialogHeader>{detail && <><PayCalculation row={detail} own={own} canViewAttendance={canViewAttendance} />{canOpenStaff && detail.user_id && <Button asChild variant="outline"><Link href={`/staff/${detail.user_id}?tab=financials`}>Open salary account</Link></Button>}</>}</DialogContent></Dialog>
  </WorkforceSection>;
}

function PayCalculation({ row, own, canViewAttendance }: { row: AttendancePayrollPreview; own: boolean; canViewAttendance: boolean }) {
  const [dailyOpen, setDailyOpen] = useState(false);
  const type = row.salary_type;
  const divisor = type === "monthly" ? 30 : type === "weekly" ? 7 : 1;
  return <div className="space-y-4">
    <WorkforceMetricStrip items={[{ label: "Estimated period earnings", value: formatCurrency(row.estimated_payable) }, { label: "Pay agreement", value: `${formatCurrency(row.salary_amount)} / ${type || "unspecified"}` }]} />
    <p className="text-xs text-muted-foreground">{dateLabel(row.date_from)} – {dateLabel(row.date_to)}{row.effective_from ? ` · Calculation starts ${dateLabel(row.effective_from)}` : " · Accrual has not started in this range"}</p>
    <p className="text-sm">{row.attendance_based_salary ? "Attendance-based salary is on." : "Attendance-based salary is off."} {type === "hourly" ? "Approved regular hours, paid leave and holiday rules determine hourly earnings when attendance-based salary is on." : `${formatCurrency(row.salary_amount)} ÷ ${divisor} = ${formatCurrency(row.daily_rate)} per calendar day.`}</p>
    <details className="rounded-lg border p-3" open={row.warnings.some(code => code !== "current_agreement")}><summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2">Calculation notes</summary><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{row.warnings.map(code => <li key={code}>{payrollWarnings[code] || code}</li>)}{row.review_count > 0 && <li>{row.review_count} completed attendance entries still need review. Their time is excluded from this estimate.</li>}<li>Payments and salary deductions are recorded against the cumulative salary account; they are not allocated to these dates.</li></ul></details>
    {canViewAttendance && !own && <Button asChild variant="outline"><Link href={`/attendance?tab=timesheets&staff_id=${row.staff_id}&from=${row.date_from}&to=${row.date_to}`}>Review attendance for these dates</Link></Button>}
    <Button variant="outline" className="min-h-11 w-full justify-between" onClick={() => setDailyOpen(true)}>View daily calculation<span className="text-muted-foreground">{row.days.length} days</span></Button>
    <Dialog open={dailyOpen} onOpenChange={setDailyOpen}><DialogContent aria-labelledby={undefined} aria-label="Daily earnings calculation" className={`max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-3xl ${mobileDetailClass}`}><DialogHeader><DialogTitle>Daily earnings calculation</DialogTitle><DialogDescription>{dateLabel(row.date_from)} – {dateLabel(row.date_to)} · {row.staff_name}. Estimated earnings before payments and deductions.</DialogDescription></DialogHeader><div className="divide-y border-t md:hidden">{row.days.map(day => <details key={day.date} className="p-3"><summary className="flex min-h-11 cursor-pointer items-start justify-between gap-3 focus-visible:outline focus-visible:outline-2"><span className="min-w-0"><span className="block text-sm font-medium">{dateLabel(day.date)}</span><span className="mt-1 block text-xs text-muted-foreground">{payrollReasons[day.reason] || day.reason}</span></span><span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(day.amount)}</span></summary><div className="space-y-2 border-t pt-3 text-sm"><p>{calculationUnits(day, type)} × {formatCurrency(day.rate)}{payrollNumber(day.multiplier) !== 1 ? ` × ${day.multiplier}` : ""}</p>{payrollNumber(day.overtime_amount) !== 0 && <p>Overtime: {formatCurrency(day.overtime_amount)}</p>}<p className="text-xs text-muted-foreground">{day.entry_ids.length} approved entries</p></div></details>)}<div className="flex justify-between gap-3 p-3 text-sm font-semibold"><span>Period total</span><span className="tabular-nums">{formatCurrency(row.estimated_payable)}</span></div></div>
    {row.days.length ? <div className="hidden max-h-[26rem] overflow-auto rounded-lg border md:block"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Day-by-day earnings calculation</caption><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>{["Date", "Pay rule", "Calculation", "Earnings"].map(title => <th scope="col" key={title} className="px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y">{row.days.map(day => <tr key={day.date}><td className="whitespace-nowrap px-3 py-3">{dateLabel(day.date)}</td><td className="max-w-48 px-3 py-3">{payrollReasons[day.reason] || day.reason}{day.entry_ids.length > 0 && <p className="text-xs text-muted-foreground">{day.entry_ids.length} approved entries</p>}</td><td className="px-3 py-3 text-xs tabular-nums">{calculationUnits(day, type)} × {formatCurrency(day.rate)}{payrollNumber(day.multiplier) !== 1 ? ` × ${day.multiplier}` : ""}{payrollNumber(day.overtime_amount) !== 0 && <span className="block">+ {formatCurrency(day.overtime_amount)} overtime</span>}</td><td className="px-3 py-3 font-medium tabular-nums">{formatCurrency(day.amount)}</td></tr>)}</tbody><tfoot className="border-t font-semibold"><tr><td colSpan={3} className="px-3 py-3">Period total</td><td className="px-3 py-3 tabular-nums">{formatCurrency(row.estimated_payable)}</td></tr></tfoot></table></div> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">No earnings days were calculated for this range. Check the accrual start date and hourly salary settings.</p>}
    </DialogContent></Dialog>
    <p className="text-xs text-muted-foreground">Daily amounts include cumulative rounding to two decimals. This is an estimate using current pay rules. A locked attendance record does not freeze the earnings calculation.</p>
  </div>;
}
