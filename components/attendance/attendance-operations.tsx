"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { attendanceApi } from "@/lib/attendance/api";
import type { Diagnostics, ExceptionItem, LeaveBalance, LeaveCategory, Page, RawPunch } from "@/lib/attendance/operations-types";
import type { AttendanceShiftTemplate } from "@/lib/attendance/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkforceSection } from "@/components/workforce/workforce-presentation";

export function operationError(error: unknown) {
  const e = error as { message?: string; response?: { data?: { detail?: string | { message?: string }; message?: string } } };
  const detail = e.response?.data?.detail;
  return (typeof detail === "string" ? detail : detail?.message) || e.response?.data?.message || e.message || "Request failed. Retry after checking the backend.";
}
const stamp = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";
const selectClass = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const localTime = (value: string) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export function AttendanceReviewQueue({ from, to, canDevices }: { from: string; to: string; canDevices: boolean }) {
  const [page, setPage] = useState<Page<ExceptionItem> | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ExceptionItem | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => { const version = ++request.current; setLoading(true); setError(""); try { const result = await attendanceApi.operationsPage("exceptions", { date_from: from, date_to: to, offset, limit: 25 }); if (version === request.current) setPage(result); } catch (e) { if (version === request.current) { setError(operationError(e)); setPage(null); } } finally { if (version === request.current) setLoading(false); } }, [from, to, offset]);
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
  useEffect(() => { setOffset(0); }, [from, to]);
  return <WorkforceSection title="Needs attention" description="Unfinished attendance and unapplied device evidence. Nothing here is automatically approved for pay." actions={<Button variant="outline" disabled={loading} onClick={() => void load()}>Refresh exceptions</Button>}>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">Loading exceptions…</p> : page && <><div className="divide-y rounded-lg border">{!page.items.length && <p className="p-4 text-sm text-muted-foreground">No exceptions in this period.</p>}{page.items.map(item => <div key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{item.kind === "raw" ? `Device ${item.device_id} · PIN ${item.device_user_id}` : `Staff #${item.staff_id} · Entry #${item.id}`}</p><p className="break-words text-xs text-muted-foreground">{stamp(item.at)} · {item.code.replaceAll("_", " ")}</p></div>{item.kind === "entry" ? <Button variant="outline" asChild><Link href={`/attendance?tab=timesheets&staff_id=${item.staff_id}&from=${from}&to=${to}`}>Review attendance</Link></Button> : canDevices && <Button variant="outline" onClick={() => setSelected(item)}>Inspect evidence</Button>}</div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{page.total} exceptions · Page {Math.floor(offset / 25) + 1}</span><div className="flex gap-2"><Button variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button variant="outline" disabled={offset + 25 >= page.total} onClick={() => setOffset(offset + 25)}>Next</Button></div></div></>}
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Review device evidence</DialogTitle><DialogDescription>Confirm the PIN mapping in Devices first. Recovery creates pending attendance and keeps the original evidence.</DialogDescription></DialogHeader>{selected && <RawEvidence item={selected} onDone={() => { setSelected(null); void load(); }} />}</DialogContent></Dialog>
  </WorkforceSection>;
}

function RawEvidence({ item, onDone }: { item: ExceptionItem; onDone: () => void }) {
  const [raw, setRaw] = useState<RawPunch[]>([]);
  const [endId, setEndId] = useState("");
  const [start, setStart] = useState(localTime(item.at));
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState("0");
  const [templates, setTemplates] = useState<AttendanceShiftTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [workDate, setWorkDate] = useState(localTime(item.at).slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => { let live = true; attendanceApi.listShiftTemplates().then(rows => { if (live) setTemplates(rows); }).catch(e => { if (live) setError(operationError(e)); }); return () => { live = false; }; }, []);
  useEffect(() => { let live = true; attendanceApi.rawPunches(item.device_id!, item.device_user_id).then(rows => { if (live) { setRaw(rows); setHasMore(rows.length === 100); } }).catch(e => { if (live) setError(operationError(e)); }); return () => { live = false; }; }, [item]);
  async function older() { setBusy(true); try { const rows = await attendanceApi.rawPunches(item.device_id!, item.device_user_id, raw.length); setRaw(current => [...current, ...rows.filter(r => !current.some(c => c.id === r.id))]); setHasMore(rows.length === 100); } catch (e) { setError(operationError(e)); } finally { setBusy(false); } }
  async function act(dismiss: boolean) {
    if (dismiss && !window.confirm("Dismiss this unapplied punch? Its evidence will be retained, but it will leave the review queue.")) return;
    setBusy(true); setError("");
    try {
      if (reason.trim().length < 3) throw new Error("Enter a meaningful reason.");
      if (dismiss) await attendanceApi.dismissPunch(item.device_id!, item.id, reason.trim());
      else {
        if (!endId || !start || !end || new Date(end) <= new Date(start)) throw new Error("Select distinct checkout evidence and verify both times.");
        await attendanceApi.recoverPunches(item.device_id!, { clock_in_raw_id: item.id, clock_out_raw_id: Number(endId), clock_in_at: new Date(start).toISOString(), clock_out_at: new Date(end).toISOString(), break_minutes: Number(minutes), reason: reason.trim(), ...(templateId ? { shift_template_id: Number(templateId), work_date: workDate } : {}) });
      }
      onDone();
    } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-3 text-sm"><p>Check-in evidence #{item.id} · PIN {item.device_user_id}</p><p className="text-xs text-muted-foreground">Times below use this browser’s timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Correct device-clock errors explicitly. {raw.length} punches loaded.</p>{hasMore && <Button variant="outline" disabled={busy} onClick={() => void older()}>Load older evidence</Button>}
    <label className="block space-y-1">Assigned shift<select className={selectClass} value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Match automatically from the roster</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.start_local_time}–{t.end_local_time}</option>)}</select></label>{templateId && <label className="block">Shift work date<Input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} /></label>}
    <label className="block space-y-1">Checkout evidence<select className={selectClass} value={endId} onChange={e => { setEndId(e.target.value); const row = raw.find(r => String(r.id) === e.target.value); if (row) setEnd(localTime(row.punch_time)); }}><option value="">Choose a punch</option>{raw.filter(r => r.id !== item.id && !r.processed_entry_id && r.outcome !== "dismissed").map(r => <option key={r.id} value={r.id}>#{r.id} · {stamp(r.punch_time)} · {r.outcome}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label>Confirmed check-in<Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label><label>Confirmed checkout<Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label></div><label className="block">Unpaid break minutes<Input type="number" min={0} max={1440} value={minutes} onChange={e => setMinutes(e.target.value)} /></label><label className="block">Reason<Input autoComplete="off" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert" className="text-destructive">{error}</p>}<div className="flex flex-wrap gap-2"><Button disabled={busy || !endId} onClick={() => void act(false)}>Recover for review</Button><Button variant="outline" disabled={busy} onClick={() => void act(true)}>Dismiss this punch</Button></div></div>;
}

export function AttendanceDeviceDiagnostics() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ token: string; expires_at: string } | null>(null);
  const [token, setToken] = useState(""); const [message, setMessage] = useState("");
  const load = useCallback(async () => { try { setData(await attendanceApi.diagnostics()); setError(""); } catch (e) { setError(operationError(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function transfer(id?: number) {
    if (id && !window.confirm("Deactivate this device and issue a 10-minute transfer code? Previous attendance and PIN mappings stay in this restaurant.")) return;
    setBusy(true); setError(""); setMessage("");
    try { if (id) setIssued(await attendanceApi.issueDeviceTransfer(id)); else { const result = await attendanceApi.acceptDeviceTransfer(token.trim()); setToken(""); setMessage(result.message); } await load(); } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <WorkforceSection title="Device health and ownership" description="A heartbeat confirms server contact, not that every scan was applied to attendance." actions={<Button variant="outline" onClick={() => void load()}>Refresh diagnostics</Button>}><div className="space-y-4 text-sm">{error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}{data && <>{!data.security.restriction_configured && <p role="alert" className="rounded-lg border border-destructive/40 p-3">ADMS has no trusted network or gateway configured. Configure the server boundary before accepting physical-device traffic.</p>}<div className="divide-y rounded-lg border">{data.devices.map(d => <div key={d.id} className="space-y-2 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{d.name} · {d.state.replaceAll("_", " ")}</p><Button variant="outline" disabled={busy} onClick={() => void transfer(d.id)}>Transfer device</Button></div><p className="break-words text-xs text-muted-foreground">{d.serial_number} · {d.timezone}</p><dl className="grid gap-2 text-xs sm:grid-cols-3"><div><dt>Heartbeat</dt><dd>{stamp(d.last_heartbeat_at)}</dd></div><div><dt>Last upload</dt><dd>{stamp(d.last_upload_at)}</dd></div><div><dt>Last applied upload</dt><dd>{stamp(d.last_applied_upload_at)}</dd></div></dl><p className="break-words text-xs">Last 24h: {Object.entries(d.outcomes_24h).map(([key, count]) => `${key}: ${count}`).join(" · ") || "No uploads"}</p>{d.future_timestamp_count_24h > 0 && <p role="alert" className="text-destructive">{d.future_timestamp_count_24h} future-dated punches. Verify terminal time and device timezone before recovery.</p>}{d.last_error && <p className="break-words text-destructive">{d.last_error}</p>}</div>)}</div><p className="text-xs text-muted-foreground">Updated {stamp(data.as_of)}. No independent terminal-clock measurement is available.</p></>}
    {issued && <div role="status" className="space-y-2 rounded-lg border p-3"><p>Switch to the destination restaurant, then paste this code there. Expires {stamp(issued.expires_at)}. Treat it as a secret.</p><Input aria-label="Transfer code" readOnly value={issued.token} autoComplete="off" /><Button variant="outline" onClick={() => setIssued(null)}>Hide code</Button></div>}
    <details className="border-t pt-3"><summary className="min-h-11 cursor-pointer font-medium">Accept a device from another restaurant</summary><p className="mb-3 text-xs text-muted-foreground">Only use a code provided by the source device manager. Staff PINs must be mapped again here.</p><label className="block">Transfer code<Input autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label><Button className="mt-3" disabled={busy || token.trim().length < 32} onClick={() => void transfer()}>Accept transfer</Button></details>
  </div></WorkforceSection>;
}

export function AttendanceLeaveTools({ staffOptions = [] }: { staffOptions?: { id: number; label: string }[] }) {
  const [categories, setCategories] = useState<LeaveCategory[]>([]); const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [form, setForm] = useState({ name: "", annual_days: "0", effective_year: new Date().getFullYear(), accrual_mode: "upfront", carry_forward_limit: "0", leave_type: "paid", is_active: true });
  const [staff, setStaff] = useState(""); const [year, setYear] = useState(String(new Date().getFullYear())); const [category, setCategory] = useState("");
  const [days, setDays] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setCategories(await attendanceApi.leaveCategories()); } catch (e) { setError(operationError(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(kind: "category" | "balance" | "adjust", value?: LeaveCategory) {
    if (value?.is_active && !window.confirm(`Deactivate ${value.name}? Existing leave history remains; new requests cannot use it.`)) return;
    setBusy(true); setError("");
    try {
      if (kind === "category") { await attendanceApi.saveLeaveCategory(value ? { ...value, is_active: !value.is_active } : form, value?.id); await load(); }
      else {
        if (!Number.isInteger(Number(staff)) || Number(staff) <= 0) throw new Error("Enter the staff profile ID, not the device PIN or user ID.");
        if (kind === "adjust") { await attendanceApi.adjustLeaveBalance({ staff_id: Number(staff), category_id: Number(category), year: Number(year), days, reason }); }
        setBalances(await attendanceApi.leaveBalances(Number(staff), Number(year)));
      }
    } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <WorkforceSection title="Leave categories and balances" description="Category requests reserve scheduled working days. Legacy requests without a category remain manual-review leave and do not debit these balances."><div className="space-y-4 text-sm">{error && <p role="alert" className="text-destructive">{error}</p>}<details><summary className="min-h-11 cursor-pointer font-medium">Manage entitlement categories</summary><form className="space-y-3" onSubmit={e => { e.preventDefault(); void act("category"); }}><div className="grid gap-3 sm:grid-cols-2"><label>Name<Input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Annual days<Input required type="number" min={0} max={366} step="0.01" value={form.annual_days} onChange={e => setForm({ ...form, annual_days: e.target.value })} /></label><label>Effective year<Input required type="number" min={2000} max={2100} value={form.effective_year} onChange={e => setForm({ ...form, effective_year: Number(e.target.value) })} /></label><label>Carry-forward limit<Input type="number" min={0} max={366} step="0.01" value={form.carry_forward_limit} onChange={e => setForm({ ...form, carry_forward_limit: e.target.value })} /></label><label>Accrual<select className={selectClass} value={form.accrual_mode} onChange={e => setForm({ ...form, accrual_mode: e.target.value })}><option value="upfront">Annual upfront, employment-prorated</option><option value="monthly_completed">Completed months</option></select></label><label>Leave type<select className={selectClass} value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label></div><Button disabled={busy}>Create category</Button></form><p className="my-3 text-xs text-muted-foreground">Used financial rules cannot be edited. Create a new category for changed entitlements. Carry-forward includes at most one prior year.</p><div className="divide-y">{categories.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><p>{c.name} · {c.annual_days} days · {c.effective_year} · {c.is_active ? "Active" : "Inactive"}</p><Button variant="outline" disabled={busy} onClick={() => void act("category", c)}>{c.is_active ? "Deactivate" : "Activate"}</Button></div>)}</div></details>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void act("balance"); }}><label>{staffOptions.length ? "Staff member" : "Staff profile ID"}{staffOptions.length ? <select required className={selectClass} value={staff} onChange={e => { setStaff(e.target.value); setBalances(null); }}><option value="">Choose staff</option>{staffOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select> : <Input required type="number" min={1} value={staff} onChange={e => { setStaff(e.target.value); setBalances(null); }} />}</label><label>Year<Input required type="number" min={2000} max={2100} value={year} onChange={e => { setYear(e.target.value); setBalances(null); }} /></label><Button variant="outline" disabled={busy}>View balances</Button></form>
    {balances && <div className="divide-y rounded-lg border">{!balances.length && <p className="p-3">No categories configured.</p>}{balances.map(b => <div key={b.category_id} className="space-y-2 p-3"><p className="font-medium">{b.category_name}: {b.available} days available</p><p className="text-xs text-muted-foreground">Earned {b.earned} · Carry {b.carry_forward} · Adjustments {b.adjustments} · Approved {b.approved_days} · Reserved {b.reserved_days}</p>{b.adjustment_history.map(a => <p key={a.id} className="break-words text-xs">#{a.id}: {a.days} days · {a.reason}</p>)}</div>)}</div>}
    <details><summary className="min-h-11 cursor-pointer font-medium">Record opening balance or correction</summary><form className="space-y-3" onSubmit={e => { e.preventDefault(); void act("adjust"); }}><p className="text-xs text-muted-foreground">Uses the staff and year above. Enter a signed change, not a replacement balance. Reverse mistakes with an opposite adjustment and a reason.</p><label className="block">Category<select required className={selectClass} value={category} onChange={e => setCategory(e.target.value)}><option value="">Choose category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block">Change in days<Input required type="number" min={-366} max={366} step="0.01" value={days} onChange={e => setDays(e.target.value)} /></label><label className="block">Reason<Input required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label><Button disabled={busy}>Record balance adjustment</Button></form></details>
  </div></WorkforceSection>;
}
