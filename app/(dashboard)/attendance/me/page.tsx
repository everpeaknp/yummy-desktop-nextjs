"use client";

import { CalendarDays, Clock3, Landmark, MapPin } from "lucide-react";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceEntry, AttendanceHoliday, AttendanceLeave, AttendanceScheduleWeek, MyAttendanceStatus } from "@/lib/attendance/types";
import { attendanceApprovalLabel, attendanceStatusLabel } from "@/lib/presentation/workforce";

function iso(value: Date) { return value.toISOString().slice(0, 10); }
function money(value: unknown) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function hours(entry: AttendanceEntry) { return `${((entry.regular_minutes + entry.overtime_minutes) / 60).toFixed(1)}h`; }
function dateText(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }

export default function MyAttendancePage() {
  const today = iso(new Date());
  const [from, setFrom] = useState(() => iso(new Date(new Date().setDate(new Date().getDate() - 30))));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<MyAttendanceStatus | null>(null);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [payroll, setPayroll] = useState<Record<string, unknown> | null>(null);
  const [schedule, setSchedule] = useState<AttendanceScheduleWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { void load(); }, [from, to]);
  async function load() {
    setLoading(true);
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const [s, e, l, h, p, w] = await Promise.allSettled([
      attendanceApi.myStatus(), attendanceApi.myEntries({ dateFrom: from, dateTo: to, limit: 100 }), attendanceApi.myLeaves(), attendanceApi.myHolidays({ dateFrom: from, dateTo: to }), attendanceApi.myPayroll(), attendanceApi.mySchedule(iso(monday)),
    ]);
    if (s.status === "fulfilled") setStatus(s.value);
    if (e.status === "fulfilled") setEntries(e.value);
    if (l.status === "fulfilled") setLeaves(l.value);
    if (h.status === "fulfilled") setHolidays(h.value);
    if (p.status === "fulfilled") setPayroll(p.value);
    if (w.status === "fulfilled") setSchedule(w.value[0] || null);
    setLoading(false);
  }
  function stopScanner() { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  async function submitToken(raw: string) {
    const token = (() => { try { return new URL(raw).searchParams.get("token") || raw; } catch { return raw; } })();
    if (!token) return toast.error("This is not an attendance QR code");
    if (!navigator.geolocation) return toast.error("Location is required for QR attendance");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try { await attendanceApi.submitMobilePunch({ qr_token: token, latitude: position.coords.latitude, longitude: position.coords.longitude, device_label: navigator.platform }); toast.success(active ? "Clocked out" : "Clocked in"); setScanning(false); stopScanner(); await load(); }
      catch (error: any) { toast.error(error?.response?.data?.detail || "Attendance could not be recorded"); }
    }, () => toast.error("Allow location access to clock in"), { enableHighAccuracy: true, timeout: 10000 });
  }
  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("Camera scanning is unavailable in this browser");
    setScanning(true);
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); streamRef.current = stream; await new Promise((resolve) => window.setTimeout(resolve, 50)); const video = videoRef.current; if (!video) throw new Error(); video.srcObject = stream; await video.play(); const canvas = document.createElement("canvas"); const context = canvas.getContext("2d", { willReadFrequently: true }); timerRef.current = window.setInterval(() => { if (!context || video.readyState < 2) return; canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height); if (result?.data) { stopScanner(); void submitToken(result.data); } }, 250); }
    catch { stopScanner(); setScanning(false); toast.error("Allow camera access to scan the attendance QR"); }
  }
  useEffect(() => () => stopScanner(), []);

  const active = status?.is_clocked_in;
  return <main className="mx-auto w-full max-w-6xl space-y-5 pb-10">
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">My attendance</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Time, leave and pay</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Scan the rotating restaurant QR with your phone, or use the biometric device.</p></div><Button onClick={() => void startScanner()}>{active ? "Scan QR to clock out" : "Scan QR to clock in"}</Button></header>

    <section className="grid gap-4 md:grid-cols-3"><article className="rounded-xl border bg-card p-4"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Today</p><p className="mt-1 text-lg font-semibold">{active ? "Clocked in" : status?.latest_entry ? "Clocked out" : "No attendance"}</p><p className="mt-1 text-xs text-muted-foreground">{active ? "Use the same QR or biometric station to clock out." : "Clock in from the restaurant QR or biometric device."}</p></article><article className="rounded-xl border bg-card p-4"><Landmark className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Salary accrued</p><p className="mt-1 text-lg font-semibold">{payroll ? money(payroll.accrued) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Outstanding: {payroll ? money(payroll.balance) : "—"}</p></article><article className="rounded-xl border bg-card p-4"><CalendarDays className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Approved leave</p><p className="mt-1 text-lg font-semibold">{leaves.filter((item) => item.status === "approved").length}</p><p className="mt-1 text-xs text-muted-foreground">Requests remain visible here after a decision.</p></article></section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">My schedule this week</h2><p className="mt-1 text-sm text-muted-foreground">Leave and holidays replace your normal shift for the affected date.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-7">{schedule?.days.map((day) => <div key={day.date} className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(new Date(`${day.date}T00:00:00`))}</p><p className="mt-1 text-sm font-medium">{day.label}</p>{day.detail ? <p className="text-xs text-muted-foreground">{day.detail}</p> : null}</div>) || <p className="text-sm text-muted-foreground">Your weekly schedule is unavailable.</p>}</div></section>

    <section className="rounded-xl border bg-card"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Attendance record</h2><p className="mt-1 text-sm text-muted-foreground">Only your own verified entries are shown.</p></div><div className="flex gap-2"><Input aria-label="From date" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /><Input aria-label="To date" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div></div><div className="divide-y">{loading ? <p className="p-4 text-sm text-muted-foreground">Loading your attendance…</p> : entries.length ? entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4"><div className="min-w-44"><p className="font-medium">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.clock_in_at))}</p><p className="text-xs text-muted-foreground">{entry.clock_out_at ? `Out ${new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(entry.clock_out_at))}` : "Open shift"}</p></div><span className="font-semibold tabular-nums">{hours(entry)}</span><Badge variant="outline">{attendanceStatusLabel(entry.status)}</Badge><span className="text-sm text-muted-foreground">{attendanceApprovalLabel(entry.approval_status)}</span></div>) : <p className="p-6 text-sm text-muted-foreground">No attendance records in this period.</p>}</div></section>

    <section className="grid gap-5 lg:grid-cols-2"><Panel title="Leave requests" empty="No leave requests yet.">{leaves.map((leave) => <div key={leave.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{dateText(leave.date_from)}{leave.date_to !== leave.date_from ? ` – ${dateText(leave.date_to)}` : ""}</p><p className="text-sm text-muted-foreground">{leave.leave_type === "paid" ? "Paid" : "Unpaid"} · {leave.day_fraction === 0.5 ? "Half day" : "Full day"}</p></div><Badge variant="outline" className="capitalize">{leave.status}</Badge></div>)}</Panel><Panel title="Holidays and days off" empty="No restaurant holidays in this period.">{holidays.map((holiday) => <div key={holiday.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{holiday.name}</p><p className="text-sm text-muted-foreground">{dateText(holiday.holiday_date)} · {holiday.is_paid ? "Paid holiday" : "Unpaid holiday"}</p></div></div>)}<p className="border-t pt-3 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />Your weekly day off follows the schedule set by your manager.</p></Panel></section>
  <Dialog open={scanning} onOpenChange={(open) => { setScanning(open); if (!open) stopScanner(); }}><DialogContent><DialogHeader><DialogTitle>Scan attendance QR</DialogTitle><DialogDescription>Point your camera at the restaurant&apos;s current QR code.</DialogDescription></DialogHeader><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-lg bg-black object-cover" /></DialogContent></Dialog></main>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const items = Array.isArray(children) ? children.filter(Boolean) : [children]; return <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{title}</h2><div className="mt-2 divide-y">{items.length ? children : <p className="py-4 text-sm text-muted-foreground">{empty}</p>}</div></section>; }
