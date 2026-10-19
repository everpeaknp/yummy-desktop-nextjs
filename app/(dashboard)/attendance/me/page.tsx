"use client";
import { AttendanceRegister } from "@/components/attendance/attendance-register";
import { PayrollPeriodReview } from "@/components/attendance/payroll-period-review";

import { CalendarDays, Clock3, Landmark, MapPin } from "lucide-react";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceHoliday, AttendanceLeave, AttendanceScheduleWeek, MyAttendanceStatus } from "@/lib/attendance/types";
import { localDate, shiftDate } from "@/lib/attendance/register";

function money(value: unknown) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function dateText(value: string) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }

export default function MyAttendancePage() {
  const today = localDate();
  const [status, setStatus] = useState<MyAttendanceStatus | null>(null);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [payroll, setPayroll] = useState<Record<string, unknown> | null>(null);
  const [schedule, setSchedule] = useState<AttendanceScheduleWeek | null>(null);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reportVersion, setReportVersion] = useState(0);
  const requestVersion = useRef(0);
  const [mobileSection, setMobileSection] = useState("records");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadError(false);
    if (!scheduleDate) { setLoading(false); setLoadError(true); return; }
    const weekday = new Date(`${scheduleDate}T12:00:00Z`).getUTCDay();
    const monday = shiftDate(scheduleDate, -((weekday + 6) % 7));
    const [s, l, h, p, w] = await Promise.allSettled([
      attendanceApi.myStatus(), attendanceApi.myLeaves(),
      attendanceApi.myHolidays({ dateFrom: monday, dateTo: shiftDate(monday, 6) }),
      attendanceApi.myPayroll(), attendanceApi.mySchedule(monday),
    ]);
    if (version !== requestVersion.current) return;
    setStatus(s.status === "fulfilled" ? s.value : null);
    setLeaves(l.status === "fulfilled" ? l.value : []);
    setHolidays(h.status === "fulfilled" ? h.value : []);
    setPayroll(p.status === "fulfilled" ? p.value : null);
    setSchedule(w.status === "fulfilled" ? w.value[0] || null : null);
    setLoadError([s, l, h, p, w].some(result => result.status === "rejected"));
    setLoading(false);
  }, [scheduleDate]);
  useEffect(() => { void load(); return () => { requestVersion.current += 1; }; }, [load]);
  function stopScanner() { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  async function submitToken(raw: string) {
    const token = (() => { try { return new URL(raw).searchParams.get("token") || raw; } catch { return raw; } })();
    if (!token) return toast.error("This is not an attendance QR code");
    if (!navigator.geolocation) return toast.error("Location is required for QR attendance");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try { await attendanceApi.submitMobilePunch({ qr_token: token, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_meters: position.coords.accuracy, device_label: navigator.platform }); toast.success(active ? "Clocked out" : "Clocked in"); setScanning(false); stopScanner(); setReportVersion(value => value + 1); await load(); }
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
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">My attendance</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Time, leave and pay</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Scan the rotating restaurant QR with your phone, or use the biometric device.</p></div><Button className="min-h-11" disabled={loading || !status} onClick={() => void startScanner()}>{active ? "Scan QR to clock out" : "Scan QR to clock in"}</Button></header>

    {loadError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">Some personal attendance details could not be loaded. Unavailable amounts are not zero.<Button variant="outline" className="ml-3" onClick={() => void load()}>Retry</Button></div>}
    <section className="grid gap-2 md:grid-cols-3 max-md:[&_article:not(:first-child)]:hidden [&_article]:max-md:p-3 [&_article>svg]:max-md:hidden [&_article>p]:max-md:mt-1"><article className="rounded-xl border bg-card p-4"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Current clock status</p><p className="mt-1 text-lg font-semibold">{loading ? "Loading…" : !status ? "Unavailable" : active ? "Clocked in" : "Clocked out"}</p><p className="mt-1 text-xs text-muted-foreground">{active ? "Use the same QR or biometric station to clock out." : "Clock in from the restaurant QR or biometric device."}</p></article><article className="rounded-xl border bg-card p-4"><Landmark className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Lifetime earnings estimate</p><p className="mt-1 text-lg font-semibold">{!loading && payroll ? money(payroll.accrued) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">Outstanding salary: {!loading && payroll ? money(payroll.balance) : "—"}</p></article><article className="rounded-xl border bg-card p-4"><CalendarDays className="h-4 w-4 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Approved leave requests</p><p className="mt-1 text-lg font-semibold">{loading || loadError ? "—" : leaves.filter((item) => item.status === "approved").length}</p><p className="mt-1 text-xs text-muted-foreground">Requests remain visible here after a decision.</p></article></section>
    <nav className="grid grid-cols-4 rounded-lg border md:hidden" aria-label="My attendance sections">{["records", "schedule", "pay", "leave"].map(section => <button key={section} aria-current={mobileSection === section ? "page" : undefined} className="min-h-11 text-sm capitalize focus-visible:outline focus-visible:outline-2 aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary" onClick={() => setMobileSection(section)}>{section}</button>)}</nav>
    <div className={mobileSection === "schedule" ? "" : "hidden md:block"}><section className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">My schedule</h2><p className="mt-1 text-sm text-muted-foreground">Select any date to view the week containing it. Leave and holidays replace your normal shift.</p></div><label className="text-sm font-medium">Week containing<Input aria-label="Schedule week" type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-7">{!loading && schedule?.days.map((day) => <div key={day.date} className="rounded-lg border p-2"><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(new Date(`${day.date}T00:00:00`))}</p><p className="mt-1 text-sm font-medium">{day.label}</p>{day.detail ? <p className="text-xs text-muted-foreground">{day.detail}</p> : null}</div>) || <p className="text-sm text-muted-foreground">{loading ? "Loading schedule…" : "Your weekly schedule is unavailable."}</p>}</div></section>

    </div>
    <div className={mobileSection === "records" ? "" : "hidden md:block"}><AttendanceRegister key={reportVersion} own /></div>
    <div className={mobileSection === "pay" ? "" : "hidden md:block"}><div className="mb-4 rounded-lg border p-3 md:hidden"><p className="text-xs text-muted-foreground">Outstanding salary · all dates</p><p className="mt-1 text-lg font-semibold tabular-nums">{!loading && payroll ? money(payroll.balance) : "—"}</p></div><PayrollPeriodReview key={`earnings-${reportVersion}`} own /></div>

    <section className={`${mobileSection === "leave" ? "grid" : "hidden md:grid"} gap-5 lg:grid-cols-2`}><Panel title="Leave requests" empty={loading ? "Loading leave requests…" : loadError ? "Leave requests may be unavailable. Retry above." : "No leave requests yet."}>{leaves.map((leave) => <div key={leave.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{dateText(leave.date_from)}{leave.date_to !== leave.date_from ? ` – ${dateText(leave.date_to)}` : ""}</p><p className="text-sm text-muted-foreground">{leave.leave_type === "paid" ? "Paid" : "Unpaid"} · {leave.day_fraction === 0.5 ? "Half day" : "Full day"}</p></div><Badge variant="outline" className="capitalize">{leave.status}</Badge></div>)}</Panel><Panel title="Holidays and days off · selected week" empty="No restaurant holidays in the selected week.">{!loading && !holidays.length && <p className="py-3 text-sm text-muted-foreground">{loadError ? "Holiday details may be unavailable. Retry above." : "No restaurant holidays in the selected week."}</p>}{holidays.map((holiday) => <div key={holiday.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-medium">{holiday.name}</p><p className="text-sm text-muted-foreground">{dateText(holiday.holiday_date)} · {holiday.is_paid ? "Paid holiday" : "Unpaid holiday"}</p></div></div>)}<p className="border-t pt-3 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />Your weekly day off follows the schedule set by your manager.</p></Panel></section>
  <Dialog open={scanning} onOpenChange={(open) => { setScanning(open); if (!open) stopScanner(); }}><DialogContent><DialogHeader><DialogTitle>Scan attendance QR</DialogTitle><DialogDescription>Point your camera at the restaurant&apos;s current QR code.</DialogDescription></DialogHeader><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-lg bg-black object-cover" /></DialogContent></Dialog></main>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const items = Array.isArray(children) ? children.filter(Boolean) : [children]; return <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold">{title}</h2><div className="mt-2 divide-y">{items.length ? children : <p className="py-4 text-sm text-muted-foreground">{empty}</p>}</div></section>; }
