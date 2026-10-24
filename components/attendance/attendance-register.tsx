"use client";
import { MobileReportControls, mobileDetailClass } from "./mobile-report-controls";
import { QrPunchDevices } from "./qr-punch-devices";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { attendanceApi } from "@/lib/attendance/api";
import { AttendanceRegister as Register, RegisterDay, RegisterStaff, duration, localDate, presenceLabels, rangeError, registerCsv, shiftDate, timesheetRange } from "@/lib/attendance/register";
import { attendanceApprovalLabel, attendanceExceptionLabel } from "@/lib/presentation/workforce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkforceMetricStrip, WorkforceSection } from "@/components/workforce/workforce-presentation";

type Props = { daily?: boolean; own?: boolean; staffId?: number; canExport?: boolean };

export function AttendanceRegister({ daily = false, own = false, staffId, canExport = false }: Props) {
  const initial = localDate();
  const [from, setFrom] = useState(daily ? initial : `${initial.slice(0, 7)}-01`);
  const [to, setTo] = useState(initial);
  const [data, setData] = useState<Register | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ staff: RegisterStaff; day: RegisterDay } | null>(null);
  const [page, setPage] = useState(0);
  const [showAllDays, setShowAllDays] = useState(false);
  const userChangedRange = useRef(false);
  const zoneResolved = useRef(false);
  const invalid = rangeError(from, daily ? from : to);
  function range(start: string, end: string) {
    userChangedRange.current = true;
    setFrom(start); setTo(end); setPage(0); setDetail(null); setShowAllDays(false);
  }
  useEffect(() => {
    if (invalid) { setLoading(false); return; }
    let live = true;
    setLoading(true); setError(null); setData(null); setDetail(null);
    attendanceApi.register({ dateFrom: from, dateTo: daily ? from : to, own, staffId }).then(result => {
      if (!live) return;
      if (!zoneResolved.current && !userChangedRange.current) {
        zoneResolved.current = true;
        const today = localDate(result.timezone);
        setFrom(daily ? today : `${today.slice(0, 7)}-01`); setTo(today);
      }
      setData(result);
    }).catch(() => { if (live) setError("Attendance could not be loaded. Retry to see the selected period; no totals have been assumed."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [from, to, daily, own, staffId, reload, invalid]);
  useEffect(() => { setPage(0); }, [search, filter, selectedStaff, data]);

  const rows = useMemo(() => (data?.rows || []).filter(s => s.staff_name.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const focused = own || staffId ? rows[0]?.staff_id : selectedStaff;
  const dayMode = daily || focused != null;
  const scopedRows = rows.filter(s => focused == null || s.staff_id === focused);
  const allDays = scopedRows.flatMap(staff => staff.days.map(day => ({ staff, day })));
  const dayRows = allDays
    .filter(({ day }) => filter === "all" || (filter === "review" ? day.review_count > 0 : day.presence === filter))
    .sort((a, b) => b.day.date.localeCompare(a.day.date));
  const compactIndividual = !daily && (own || !!staffId);
  const visibleStaff = rows.filter(s => filter !== "review" || s.summary.review_count > 0);
  const total = dayMode ? dayRows.length : visibleStaff.length;
  const pages = Math.max(1, Math.ceil(total / 25));
  const safePage = Math.min(page, pages - 1);
  const mobileDays = compactIndividual ? dayRows.slice(0, 7) : dayRows.slice(safePage * 25, safePage * 25 + 25);
  const zone = data?.timezone;
  const time = (v: string | null) => v ? new Intl.DateTimeFormat(undefined, { timeZone: zone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "—";
  const dateLabel = (v: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${v}T12:00:00Z`));
  const sum = (key: string) => scopedRows.reduce((n, s) => n + (s.summary[key] || 0), 0);
  const metrics = daily ? [
    ["Working now", allDays.filter(r => r.day.presence === "working").length],
    ["Not arrived", allDays.filter(r => r.day.presence === "not_arrived").length],
    ["Absent", allDays.filter(r => r.day.presence === "absent").length],
    ["Needs review", allDays.reduce((n, r) => n + r.day.review_count, 0)],
  ] : [["Attended days", sum("attended_days")], ["Absent days", sum("absent_days")], ["Paid / unpaid leave", `${sum("paid_leave_days")} / ${sum("unpaid_leave_days")}`], ["Approved time", duration(sum("eligible_regular_minutes") + sum("eligible_overtime_minutes"))]];
  function preset(kind: "today" | "week" | "month") {
    const today = localDate(zone);
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    range(kind === "today" ? today : kind === "month" ? `${today.slice(0, 7)}-01` : shiftDate(today, -((weekday + 6) % 7)), today);
  }
  function exportReport() {
    const exported = dayMode ? rows.map(staff => ({ ...staff, days: dayRows.filter(r => r.staff.staff_id === staff.staff_id).map(r => r.day) })).filter(s => s.days.length) : visibleStaff;
    const url = URL.createObjectURL(new Blob(["\uFEFF", registerCsv(exported)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${from}-${daily ? from : to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <WorkforceSection title={daily ? "Daily attendance" : own ? "My attendance report" : staffId ? "Attendance" : "Attendance report"}
    description={daily ? "Who is expected, who arrived, and which records need attention." : "Attendance and approved time for the selected dates. These hours are not a salary calculation."}>
    <div className="space-y-4">
      <MobileReportControls from={from} to={daily ? from : to} daily={daily} timezone={zone} loading={loading} onChange={range} onRefresh={() => setReload(v => v + 1)} onExport={canExport ? exportReport : undefined} exportDisabled={!data || loading || !!invalid || !!error || !total} />
      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <label className="space-y-1 text-sm font-medium">{daily ? "Date" : "From"}<Input className="focus-visible:ring-2 focus-visible:ring-ring" name="attendance-from" autoComplete="off" type="date" value={from} onChange={e => range(e.target.value, daily ? e.target.value : to)} /></label>
        {!daily && <label className="space-y-1 text-sm font-medium">To<Input className="focus-visible:ring-2 focus-visible:ring-ring" name="attendance-to" autoComplete="off" type="date" value={to} min={from} onChange={e => range(from, e.target.value)} /></label>}
        {daily && <><Button variant="outline" aria-label="Previous day" disabled={!!invalid} onClick={() => range(shiftDate(from, -1), shiftDate(from, -1))}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button><Button variant="outline" aria-label="Next day" disabled={!!invalid} onClick={() => range(shiftDate(from, 1), shiftDate(from, 1))}><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button></>}
        <Button variant="outline" onClick={() => preset("today")}>Today</Button>
        {!daily && <><Button variant="outline" onClick={() => preset("week")}>This week</Button><Button variant="outline" onClick={() => preset("month")}>This month</Button></>}
        <Button variant="outline" onClick={() => setReload(v => v + 1)} disabled={loading || !!invalid}><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />Refresh</Button>
        {canExport && <Button variant="outline" disabled={!data || loading || !!invalid || !!error || !total} onClick={exportReport}><Download aria-hidden="true" className="mr-2 h-4 w-4" />Export CSV</Button>}
      </div>
      {invalid ? <p role="alert" className="text-sm text-destructive">{invalid}</p> : error ? <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-2" onClick={() => setReload(v => v + 1)}>Retry</Button></div> : loading ? <p role="status" className="py-10 text-sm text-muted-foreground">Loading attendance…</p> : data && <>
        <p className="text-xs text-muted-foreground">{dateLabel(data.date_from)} – {dateLabel(data.date_to)} · {data.timezone} · Updated {time(data.as_of)}</p>
<div className={daily ? "hidden md:block" : ""}><WorkforceMetricStrip items={metrics.map(([label, count]) => ({ label: String(label), value: String(count) }))} /></div>
        {daily && <div className="grid grid-cols-2 gap-2 md:hidden">{metrics.map(([label, count], index) => <button key={String(label)} aria-pressed={filter === ["working", "not_arrived", "absent", "review"][index]} className="min-h-14 rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 aria-pressed:border-primary aria-pressed:bg-primary/5" onClick={() => setFilter(filter === ["working", "not_arrived", "absent", "review"][index] ? "all" : ["working", "not_arrived", "absent", "review"][index])}><span className="block text-xs text-muted-foreground">{label}</span><span className="text-lg font-semibold tabular-nums">{count}</span></button>)}</div>}
        {!daily && sum("review_count") > 0 && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{sum("review_count")} attendance entries need review. Recorded presence does not mean their time is approved for pay.</p>}
        {!daily && <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2">Leave, holidays & other statistics</summary><div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>Days off: {sum("day_off_days")}</span><span>Holidays: {sum("holiday_days")}</span><span>No schedule: {sum("unassigned_days")}</span><span>Late: {duration(sum("late_minutes"))}</span><span>Early departure: {duration(sum("early_minutes"))}</span><span>To review: {sum("review_count")}</span></div></details>}
        <details className="text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">How to read this report</summary>        <p className="text-xs text-muted-foreground">Totals cover {focused != null ? scopedRows[0]?.staff_name : "the staff matching your search"} for the selected dates, before the status filter.</p>
        <p className="text-xs text-muted-foreground">Attendance recorded means a punch exists, not that pay is approved. Leave, holidays and work may overlap. Open-shift time is not included in completed hours. Missing schedules are not counted as absence.</p></details>
        <div className="flex flex-wrap items-end gap-3">
          {!own && !staffId && <label className="flex-1 space-y-1 text-sm font-medium">Find staff<Input className="focus-visible:ring-2 focus-visible:ring-ring" name="attendance-search" autoComplete="off" type="search" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} /></label>}
          <label className="space-y-1 text-sm font-medium">Show<select name="attendance-status" className="block h-10 rounded-md border bg-background text-foreground px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All records</option><option value="review">Needs review</option>
            {dayMode && Object.entries(presenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          {selectedStaff != null && !staffId && !own && <Button variant="outline" onClick={() => { setSelectedStaff(null); setFilter("all"); }}>All staff</Button>}
        </div>
        {!total ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">No matching attendance. Try another date range or filter.</p> : <>
          <div className="divide-y rounded-xl border md:hidden">
            {dayMode ? mobileDays.map(({ staff, day }) => <button key={`${staff.staff_id}-${day.date}`} className="block min-h-16 w-full space-y-1.5 p-3 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2" onClick={() => setDetail({ staff, day })}>
              <span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm font-medium">{own || staffId ? dateLabel(day.date) : staff.staff_name}</span><PresenceBadge day={day} /></span>
              <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{day.clock_in_at ? `${time(day.clock_in_at)}${day.clock_out_at ? ` – ${time(day.clock_out_at)}` : " · Open shift"}` : day.presence === "day_off" ? "Scheduled day off" : day.presence === "holiday" ? (day.holiday || "Holiday") : day.presence === "leave" ? "Approved leave" : "No clock-in"}</span>
                {day.clock_in_at && <span className="tabular-nums">{duration(day.regular_minutes + day.overtime_minutes)}</span>}
              </span>
              {(day.review_count > 0 || day.late_minutes > 0 || day.early_minutes > 0) && <span className="block text-xs text-amber-800 dark:text-amber-300">{[day.review_count > 0 ? `${day.review_count} to review` : "", day.late_minutes > 0 ? `Late ${duration(day.late_minutes)}` : "", day.early_minutes > 0 ? `Left early ${duration(day.early_minutes)}` : ""].filter(Boolean).join(" · ")}</span>}
            </button>) : visibleStaff.slice(safePage * 25, safePage * 25 + 25).map(staff => <button key={staff.staff_id} className="block min-h-16 w-full space-y-2 p-3 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2" onClick={() => setSelectedStaff(staff.staff_id)}>
              <span className="flex justify-between gap-3"><span className="break-words font-medium">{staff.staff_name}</span><span className="shrink-0 text-sm tabular-nums">{staff.summary.attended_days} attended</span></span>
              <span className="block text-sm text-muted-foreground">{staff.summary.absent_days} absent · {duration(staff.summary.eligible_regular_minutes + staff.summary.eligible_overtime_minutes)} approved</span>
              <span className="block text-xs text-muted-foreground">{staff.summary.review_count ? `${staff.summary.review_count} to review · ` : ""}View daily breakdown</span>
            </button>)}
          </div>
          {compactIndividual && dayRows.length > 7 && <Button variant="outline" className="min-h-11 w-full md:hidden" onClick={() => { setShowAllDays(true); setPage(0); }}>{`View all ${dayRows.length} days`}</Button>}
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">{dayMode ? "Daily attendance register" : "Attendance by staff"}</caption>
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>{(dayMode ? ["Staff / date", "Planned", "Attendance", "In / out", "Completed time", "Review"] : ["Staff", "Attended / scheduled", "Absent", "Leave paid / unpaid", "Approved regular / OT", "Review"]).map(h => <th scope="col" key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y">{dayMode ? dayRows.slice(safePage * 25, safePage * 25 + 25).map(({ staff, day }) => <tr key={`${staff.staff_id}-${day.date}`}>
                <td className="px-4 py-3"><button className="max-w-64 break-words text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" onClick={() => setDetail({ staff, day })}>{staff.staff_name}<span className="block text-xs font-normal text-muted-foreground">{dateLabel(day.date)}</span></button></td>
                <td className="px-4 py-3">{day.shift_name || (day.schedule_kind === "day_off" ? "Day off" : "No schedule")}<span className="block text-xs text-muted-foreground">{day.holiday || (day.paid_leave_days + day.unpaid_leave_days ? `${day.paid_leave_days + day.unpaid_leave_days} day leave` : day.scheduled_start_at ? `${time(day.scheduled_start_at)} – ${time(day.scheduled_end_at)}` : "")}</span></td>
                <td className="px-4 py-3"><PresenceBadge day={day} />{day.carryover && <p className="mt-1 text-xs text-muted-foreground">Shift started earlier</p>}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{time(day.clock_in_at)}<br />{time(day.clock_out_at)}</td>
                <td className="px-4 py-3 tabular-nums">{duration(day.regular_minutes)}<span className="block text-xs text-muted-foreground">OT {duration(day.overtime_minutes)}</span></td>
                <td className="px-4 py-3">{day.review_count ? `${day.review_count} to review` : "—"}{day.excluded_count > 0 && <span className="block text-xs text-muted-foreground">{day.excluded_count} excluded</span>}</td>
              </tr>) : visibleStaff.slice(safePage * 25, safePage * 25 + 25).map(staff => <tr key={staff.staff_id}>
                <td className="px-4 py-3"><button className="max-w-64 break-words text-left font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2" onClick={() => setSelectedStaff(staff.staff_id)}>{staff.staff_name}</button><p className="text-xs text-muted-foreground">View daily breakdown</p></td>
                <td className="px-4 py-3 tabular-nums">{staff.summary.attended_days} / {staff.summary.scheduled_days}</td>
                <td className="px-4 py-3 tabular-nums">{staff.summary.absent_days}</td>
                <td className="px-4 py-3 tabular-nums">{staff.summary.paid_leave_days} / {staff.summary.unpaid_leave_days}</td>
                <td className="px-4 py-3 tabular-nums">{duration(staff.summary.eligible_regular_minutes)} / {duration(staff.summary.eligible_overtime_minutes)}</td>
                <td className="px-4 py-3">{staff.summary.review_count || "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-2 text-sm [&_button]:min-h-11 ${compactIndividual ? "hidden md:flex" : ""}`}><span>{total} {dayMode ? "daily records" : "staff"} · Page {safePage + 1} of {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</Button><Button variant="outline" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Next</Button></div></div>
        </>}
      </>}
    </div>
    <Dialog open={showAllDays} onOpenChange={setShowAllDays}><DialogContent aria-labelledby={undefined} aria-label="Attendance history" className={`max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-2xl ${mobileDetailClass}`}>
      <DialogHeader><DialogTitle>Attendance history</DialogTitle><DialogDescription>{dateLabel(from)} – {dateLabel(to)} · {scopedRows[0]?.staff_name}. Showing the current status filter.</DialogDescription></DialogHeader>
      <div className="divide-y rounded-xl border">{dayRows.slice(safePage * 25, safePage * 25 + 25).map(({ staff, day }) => <button key={`${staff.staff_id}-${day.date}`} className="block min-h-16 w-full space-y-2 p-3 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2" onClick={() => setDetail({ staff, day })}>
        <span className="flex justify-between gap-3"><span className="text-sm font-medium">{dateLabel(day.date)}</span><PresenceBadge day={day} /></span>
        <span className="block text-xs text-muted-foreground">{day.clock_in_at ? `${time(day.clock_in_at)} – ${day.clock_out_at ? time(day.clock_out_at) : "Open shift"}` : presenceLabels[day.presence]}{day.review_count > 0 ? ` · ${day.review_count} to review` : ""}</span>
      </button>)}</div>
      {pages > 1 && <div className="flex items-center justify-between gap-2 text-sm"><span>Page {safePage + 1} of {pages}</span><Button variant="outline" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</Button><Button variant="outline" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Next</Button></div>}
    </DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}><DialogContent className={`max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-2xl ${mobileDetailClass}`}><DialogHeader><DialogTitle>{detail?.staff.staff_name}</DialogTitle><DialogDescription>{detail ? dateLabel(detail.day.date) : "Attendance detail"}</DialogDescription></DialogHeader>
      {detail && <div className="space-y-4"><PresenceBadge day={detail.day} /><dl className="grid grid-cols-2 gap-4 text-sm">
        {[["Recorded regular", duration(detail.day.regular_minutes)], ["Recorded overtime", duration(detail.day.overtime_minutes)], ["Approved regular", duration(detail.day.eligible_regular_minutes)], ["Approved overtime", duration(detail.day.eligible_overtime_minutes)], ["Late / early", `${duration(detail.day.late_minutes)} / ${duration(detail.day.early_minutes)}`], ["Breaks", duration(detail.day.break_minutes)], ["Paid / unpaid leave", `${detail.day.paid_leave_days} / ${detail.day.unpaid_leave_days} day`], ["Holiday", detail.day.holiday || "None"]].map(([label, val]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{val}</dd></div>)}
      </dl><div className="divide-y rounded-lg border">{detail.day.entries.length ? detail.day.entries.map(e => <div key={e.id} className="space-y-1 p-3 text-sm"><p>{time(e.clock_in_at)} – {e.clock_out_at ? time(e.clock_out_at) : "Open shift"}</p><QrPunchDevices entry={e} /><p>{attendanceApprovalLabel(e.approval_status as Parameters<typeof attendanceApprovalLabel>[0])}</p>{e.exception_code && <p className="text-xs text-muted-foreground">{attendanceExceptionLabel(e.exception_code)}{["approved", "payroll_exported"].includes(e.approval_status) ? " · accepted record" : ""}</p>}</div>) : <p className="p-3 text-sm text-muted-foreground">{detail.day.carryover ? "This open shift belongs to an earlier work date. View that date for its record." : "No attendance entries for this work date."}</p>}</div>
      {!own && <Button asChild variant="outline"><Link href={`/attendance?tab=timesheets&staff_id=${detail.staff.staff_id}&from=${timesheetRange(detail.day, zone).from}&to=${timesheetRange(detail.day, zone).to}`}>View timesheets</Link></Button>}
      <p className="text-xs text-muted-foreground">Approved time is not a salary statement. Earnings depend on the employee’s pay agreement and payroll policy.</p></div>}
    </DialogContent></Dialog>
  </WorkforceSection>;
}

function PresenceBadge({ day }: { day: RegisterDay }) {
  const color = day.presence === "absent" ? "text-red-700 dark:text-red-400 border-red-500/30" : day.review_count || day.excluded_count ? "text-amber-800 dark:text-amber-300 border-amber-500/30" : day.attended || day.presence === "working" ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "text-muted-foreground";
  return <Badge variant="outline" className={color}>{presenceLabels[day.presence]}</Badge>;
}
