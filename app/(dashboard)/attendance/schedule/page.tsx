"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceScheduleAudit, AttendanceScheduleWeek, AttendanceShiftTemplate, AttendanceStaffReport } from "@/lib/attendance/types";

const DAY_OFF = "day_off";
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function monday(value: Date) {
  const next = new Date(value);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return localDateKey(next);
}

function localDateKey(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type TemplateForm = { id: number | null; name: string; start_local_time: string; end_local_time: string; unpaid_break_minutes: string };
const emptyTemplate = (): TemplateForm => ({ id: null, name: "", start_local_time: "09:00", end_local_time: "17:00", unpaid_break_minutes: "0" });

export default function TeamSchedule() {
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [rows, setRows] = useState<AttendanceScheduleWeek[]>([]);
  const [templates, setTemplates] = useState<AttendanceShiftTemplate[]>([]);
  const [scheduleAudit, setScheduleAudit] = useState<AttendanceScheduleAudit[]>([]);
  const [report, setReport] = useState<AttendanceStaffReport[]>([]);
  const [reportFrom, setReportFrom] = useState(() => `${localDateKey(new Date()).slice(0, 7)}-01`);
  const [reportTo, setReportTo] = useState(() => localDateKey(new Date()));
  const [selectedStaff, setSelectedStaff] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<string[]>(Array(7).fill(DAY_OFF));
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplate);
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const week = useMemo(() => monday(new Date(`${selectedDate}T00:00:00`)), [selectedDate]);
  const today = localDateKey(new Date());
  const isPastWeek = week < today;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [team, shifts, audit] = await Promise.all([
        attendanceApi.teamSchedule(week),
        attendanceApi.listShiftTemplates(),
        attendanceApi.listScheduleAudit(),
      ]);
      setRows(team);
      setTemplates(shifts.filter((item) => item.is_active));
      setScheduleAudit(audit);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load team schedule"));
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (reportFrom > reportTo) return;
    void attendanceApi.staffReport(reportFrom, reportTo).then(setReport).catch(() => setReport([]));
  }, [reportFrom, reportTo]);

  const dates = rows[0]?.days.map((day) => day.date) || Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${week}T00:00:00`);
    date.setDate(date.getDate() + index);
    return localDateKey(date);
  });
  const selectedAll = rows.length > 0 && selectedStaff.length === rows.length;
  const sortedChanges = useMemo(
    () => [...scheduleAudit].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [scheduleAudit],
  );
  const recentChanges = sortedChanges.slice(0, 8);
  const staffNames = useMemo(() => new Map(rows.map((row) => [row.staff_id, row.staff_name])), [rows]);

  function selectStaff(staffId: number, checked: boolean) {
    setSelectedStaff((current) => checked
      ? (current.includes(staffId) ? current : [...current, staffId])
      : current.filter((id) => id !== staffId));
  }

  async function saveWeeklyRoster() {
    if (!selectedStaff.length) return toast.error("Select at least one staff member");
    setSaving(true);
    try {
      await attendanceApi.createWeeklySchedules({
        staff_ids: selectedStaff,
        effective_from: week,
        assignments: assignments.map((value, weekday) => ({
          weekday,
          shift_template_id: value === DAY_OFF ? null : Number(value),
          is_day_off: value === DAY_OFF,
        })),
      });
      toast.success(`Weekly roster applied to ${selectedStaff.length} staff member${selectedStaff.length === 1 ? "" : "s"}`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save weekly roster"));
    } finally {
      setSaving(false);
    }
  }

  async function saveCell(staffId: number, weekday: number, effectiveFrom: string, value: string) {
    setSaving(true);
    try {
      await attendanceApi.createSchedule({
        staff_id: staffId,
        weekday,
        effective_from: effectiveFrom,
        shift_template_id: value === DAY_OFF ? null : Number(value),
        is_day_off: value === DAY_OFF,
      });
      toast.success("Schedule updated");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update schedule"));
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (!templateForm.name.trim()) return toast.error("Enter a shift name");
    setSaving(true);
    try {
      const payload = {
        name: templateForm.name.trim(),
        start_local_time: templateForm.start_local_time,
        end_local_time: templateForm.end_local_time,
        unpaid_break_minutes: Number(templateForm.unpaid_break_minutes) || 0,
        is_active: true,
      };
      if (templateForm.id) await attendanceApi.updateShiftTemplate(templateForm.id, payload);
      else await attendanceApi.createShiftTemplate(payload);
      setTemplateForm(emptyTemplate());
      toast.success(templateForm.id ? "Shift template updated" : "Shift template created");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save shift template"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(template: AttendanceShiftTemplate) {
    if (!window.confirm(`Delete “${template.name}”? Existing schedules using it will need another shift.`)) return;
    setSaving(true);
    try {
      await attendanceApi.deleteShiftTemplate(template.id);
      toast.success("Shift template deleted");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete shift template"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Attendance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Team schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan a working week, apply it to a group, or adjust one person directly in the table.</p>
        </div>
        <label className="space-y-1 text-sm font-medium">Week containing
          <Input aria-label="Week containing" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Apply weekly roster</CardTitle>
          <CardDescription>{isPastWeek ? "Past weeks are locked. Select a future Monday to apply a full weekly roster." : `Select staff in the table, choose each day once, then apply it from Monday ${dateLabel(week)} onward.`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {weekDays.map((day, index) => <label key={day} className="space-y-1 text-sm font-medium">{day}
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={assignments[index]} onChange={(event) => setAssignments((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}>
                <option value={DAY_OFF}>Day off</option>
                {templates.map((template) => <option key={template.id} value={String(template.id)}>{template.name}</option>)}
              </select>
            </label>)}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">{selectedStaff.length ? `${selectedStaff.length} staff selected` : "Select staff from the team table below."}</p>
            <Button onClick={() => void saveWeeklyRoster()} disabled={saving || isPastWeek || !selectedStaff.length}><CalendarDays className="mr-2 h-4 w-4" />Apply weekly schedule</Button>
          </div>
        </CardContent>
      </Card>

      <section className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b bg-muted/30"><tr>
            <th className="sticky left-0 z-10 w-52 bg-muted/30 p-3 text-left font-medium"><div className="flex items-center gap-2"><Checkbox aria-label="Select all staff" checked={selectedAll} onCheckedChange={(checked) => setSelectedStaff(checked ? rows.map((row) => row.staff_id) : [])} />Staff</div></th>
            {dates.map((day) => <th key={day} className="min-w-36 p-3 text-left font-medium">{dateLabel(day)}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading team schedule…</td></tr> : rows.length ? rows.map((row) => <tr key={row.staff_id} className="border-b last:border-0">
            <td className="sticky left-0 z-10 bg-card p-3 font-medium"><div className="flex items-center gap-2"><Checkbox aria-label={`Select ${row.staff_name}`} checked={selectedStaff.includes(row.staff_id)} onCheckedChange={(checked) => selectStaff(row.staff_id, checked === true)} />{row.staff_name}</div></td>
            {row.days.map((day, index) => <td key={day.date} className="p-2 align-top"><ScheduleCell day={day} templates={templates} disabled={saving} locked={day.date < today} onChange={(value) => void saveCell(row.staff_id, index, day.date, value)} /></td>)}
          </tr>) : <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No staff schedules are available.</td></tr>}</tbody>
        </table>
      </section>

      <Card>
        <CardHeader><div className="flex flex-wrap items-end justify-between gap-3"><div><CardTitle>Attendance report</CardTitle><CardDescription>Approved attendance by staff for the selected period. Pending entries need review before they count as present.</CardDescription></div><div className="flex flex-wrap gap-2"><label className="text-sm font-medium">From<Input aria-label="Report start date" type="date" value={reportFrom} max={reportTo} onChange={(event) => setReportFrom(event.target.value)} /></label><label className="text-sm font-medium">To<Input aria-label="Report end date" type="date" value={reportTo} min={reportFrom} max={today} onChange={(event) => setReportTo(event.target.value)} /></label></div></div></CardHeader>
        <CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Staff</th><th className="p-2">Present days</th><th className="p-2">Regular hours</th><th className="p-2">Overtime</th><th className="p-2">Pending</th></tr></thead><tbody>{report.map((item) => <tr key={item.staff_id} className="border-b last:border-0"><td className="p-2 font-medium">{item.staff_name}</td><td className="p-2">{item.present_days}</td><td className="p-2">{(item.regular_minutes / 60).toFixed(1)}h</td><td className="p-2">{(item.overtime_minutes / 60).toFixed(1)}h</td><td className="p-2">{item.pending_entries || "—"}</td></tr>)}</tbody></table></CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader><CardTitle>Shift templates</CardTitle><CardDescription>Reusable hours for the roster. Changing a template does not rewrite completed attendance.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input aria-label="Shift name" name="shift-name" autoComplete="off" placeholder="Shift name…" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
              <Input type="time" aria-label="Shift start" name="shift-start" value={templateForm.start_local_time} onChange={(event) => setTemplateForm((current) => ({ ...current, start_local_time: event.target.value }))} />
              <Input type="time" aria-label="Shift end" name="shift-end" value={templateForm.end_local_time} onChange={(event) => setTemplateForm((current) => ({ ...current, end_local_time: event.target.value }))} />
              <Input type="number" min="0" inputMode="numeric" aria-label="Unpaid break minutes" name="unpaid-break-minutes" autoComplete="off" placeholder="Unpaid break (min)…" value={templateForm.unpaid_break_minutes} onChange={(event) => setTemplateForm((current) => ({ ...current, unpaid_break_minutes: event.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void saveTemplate()} disabled={saving}><Plus className="mr-2 h-4 w-4" />{templateForm.id ? "Save template" : "Add template"}</Button>{templateForm.id ? <Button variant="outline" onClick={() => setTemplateForm(emptyTemplate())}>Cancel</Button> : null}</div>
            <div className="divide-y rounded-lg border">{templates.length ? templates.map((template) => <div key={template.id} className="flex items-center justify-between gap-3 p-3"><button type="button" className="min-w-0 text-left" onClick={() => setTemplateForm({ id: template.id, name: template.name, start_local_time: template.start_local_time.slice(0, 5), end_local_time: template.end_local_time.slice(0, 5), unpaid_break_minutes: String(template.unpaid_break_minutes) })}><p className="font-medium">{template.name}</p><p className="text-xs text-muted-foreground">{template.start_local_time.slice(0, 5)}–{template.end_local_time.slice(0, 5)} · {template.unpaid_break_minutes} min break</p></button><Button size="icon" variant="ghost" aria-label={`Delete ${template.name}`} disabled={saving} onClick={() => void deleteTemplate(template)}><Trash2 className="h-4 w-4" /></Button></div>) : <p className="p-4 text-sm text-muted-foreground">Create a template before assigning a working shift.</p>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Schedule audit</CardTitle><CardDescription>Who changed a schedule and when. Only changes made after audit tracking was enabled appear here.</CardDescription></CardHeader>
          <CardContent className="space-y-3"><ScheduleChangeRows changes={recentChanges} templates={templates} staffNames={staffNames} />{sortedChanges.length > recentChanges.length ? <Button variant="outline" className="w-full" onClick={() => setShowAllChanges(true)}>View all {sortedChanges.length} changes</Button> : null}</CardContent>
        </Card>
      </div>
      <Dialog open={showAllChanges} onOpenChange={setShowAllChanges}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>All schedule changes</DialogTitle><DialogDescription>Every staff assignment recorded for this restaurant.</DialogDescription></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-2"><ScheduleChangeRows changes={sortedChanges} templates={templates} staffNames={staffNames} /></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduleCell({ day, templates, disabled, locked, onChange }: { day: AttendanceScheduleWeek["days"][number]; templates: AttendanceShiftTemplate[]; disabled: boolean; locked: boolean; onChange: (value: string) => void }) {
  const isOverride = day.kind === "leave" || day.kind === "holiday";
  const template = templates.find((item) => item.name === day.label);
  if (isOverride) return <div className={`rounded-md border p-2 ${day.kind === "leave" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"}`}><p className="font-medium">{day.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{day.detail || "Protected override"}</p></div>;
  if (locked) {
    const outcome = day.attendance_outcome;
    const tone = outcome === "present" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : outcome === "absent" ? "border-rose-300 bg-rose-50 dark:bg-rose-950/20" : outcome === "review" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "bg-muted/40";
    const label = outcome === "present" ? "Present" : outcome === "absent" ? "Absent" : outcome === "review" ? "Pending review" : "No attendance recorded";
    return <div className={`rounded-md border p-2 ${tone}`}><p className="font-medium">{day.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{label}{day.detail ? ` · ${day.detail}` : ""}</p></div>;
  }
  return <select aria-label={`Schedule for ${day.date}`} className="min-h-16 w-full rounded-md border bg-background px-2 text-sm text-foreground" disabled={disabled} value={day.kind === "day_off" ? DAY_OFF : template ? String(template.id) : DAY_OFF} onChange={(event) => onChange(event.target.value)}><option value={DAY_OFF}>Day off</option>{templates.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select>;
}

function ScheduleChangeRows({ changes, templates, staffNames }: { changes: AttendanceScheduleAudit[]; templates: AttendanceShiftTemplate[]; staffNames: Map<number, string> }) {
  if (!changes.length) return <p className="text-sm text-muted-foreground">No schedule changes recorded.</p>;
  return <div className="space-y-3">{changes.map((item) => {
    const value = (item.new_value || item.old_value || {}) as { staff_id?: number | null; shift_template_id?: number | null; weekday?: number; effective_from?: string; is_day_off?: boolean };
    const shiftName = value.is_day_off ? "Day off" : templates.find((template) => template.id === value.shift_template_id)?.name || "Shift unavailable";
    return <div key={item.id} className="border-b pb-3 text-sm last:border-0 last:pb-0"><p className="font-medium">{item.actor_name || "Unknown user"} {item.event === "deleted" ? "removed" : "scheduled"} {staffNames.get(value.staff_id || 0) || "Restaurant default"} · {value.weekday === undefined ? "Schedule" : weekDays[value.weekday]}</p><p className="mt-0.5">{shiftName}</p><p className="mt-0.5 text-xs text-muted-foreground">Starts {value.effective_from ? dateLabel(value.effective_from) : "—"} · recorded {dateLabel(item.created_at.slice(0, 10))}</p></div>;
  })}</div>;
}
