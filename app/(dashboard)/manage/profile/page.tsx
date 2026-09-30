"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Save,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { StaffPerformanceCard } from "@/components/staff/staff-performance-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { AuthApis } from "@/lib/api/endpoints";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceEntry, MyAttendanceStatus } from "@/lib/attendance/types";
import { attendanceApprovalLabel, attendanceStatusLabel } from "@/lib/presentation/workforce";

const roleBadgeColors: Record<string, string> = {
  admin: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  administrator: "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  manager: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
  waiter: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400",
  chef: "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400",
  cashier: "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function workedHours(entry?: AttendanceEntry | null) {
  if (!entry) return "0.0h";
  return `${((entry.regular_minutes + entry.overtime_minutes) / 60).toFixed(1)}h`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function MyProfilePage() {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const [name, setName] = useState(user?.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<MyAttendanceStatus | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceUnavailable, setAttendanceUnavailable] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(user?.full_name || ""); }, [user?.full_name]);
  useEffect(() => {
    if (!user) { setAttendanceLoading(false); return; }
    let cancelled = false;
    void (async () => {
      setAttendanceLoading(true);
      const [statusResult, entriesResult] = await Promise.allSettled([attendanceApi.myStatus(), attendanceApi.myEntries({ limit: 5 })]);
      if (cancelled) return;
      if (statusResult.status === "fulfilled") setAttendanceStatus(statusResult.value);
      if (entriesResult.status === "fulfilled") setAttendanceEntries(entriesResult.value);
      setAttendanceUnavailable(statusResult.status === "rejected" && entriesResult.status === "rejected");
      setAttendanceLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) return toast.error("Enter your name");
    if (normalizedName === user?.full_name) return setEditingProfile(false);
    try {
      setSavingName(true);
      await apiClient.patch(AuthApis.meProfile, { name: normalizedName });
      await useAuth.getState().syncUserProfile();
      setEditingProfile(false);
      toast.success("Profile updated");
    } catch (error: any) { toast.error(error?.response?.data?.detail || "Could not update your profile"); }
    finally { setSavingName(false); }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(["image/jpeg", "image/png"].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name))) { toast.error("Choose a JPG or PNG image"); event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be smaller than 5 MB"); event.target.value = ""; return; }
    try {
      setUploadingPhoto(true);
      const form = new FormData(); form.append("file", file);
      await apiClient.post(AuthApis.uploadProfilePicture, form, { headers: { "Content-Type": "multipart/form-data" } });
      await useAuth.getState().syncUserProfile();
      toast.success("Profile photo updated");
    } catch (error: any) { toast.error(error?.response?.data?.detail || "Could not update your photo"); }
    finally { setUploadingPhoto(false); event.target.value = ""; }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.next || password.next !== password.confirm) return toast.error("Enter matching new passwords");
    if (password.next.length < 8) return toast.error("Use at least 8 characters for your new password");
    try {
      setSavingPassword(true);
      await apiClient.post(AuthApis.changePassword, { old_password: password.current || undefined, new_password: password.next, confirm_password: password.confirm });
      setPassword({ current: "", next: "", confirm: "" }); setEditingPassword(false); toast.success("Password updated");
    } catch (error: any) { toast.error(error?.response?.data?.detail || "Could not update your password"); }
    finally { setSavingPassword(false); }
  };

  const initials = (user?.full_name || user?.email || "U").trim().slice(0, 2).toUpperCase();
  const roles = user?.roles?.length ? user.roles : [user?.role || "Staff"];
  const recentEntries = useMemo(() => attendanceEntries.filter((entry) => entry.clock_in_at.slice(0, 10) !== todayKey()).slice(0, 3), [attendanceEntries]);
  const todayEntry = attendanceStatus?.active_entry || attendanceEntries.find((entry) => entry.clock_in_at.slice(0, 10) === todayKey()) || attendanceStatus?.latest_entry;
  const isClockedIn = Boolean(attendanceStatus?.is_clocked_in);

  return <main className="mx-auto w-full max-w-5xl space-y-5 pb-10 sm:space-y-6 lg:pb-8">
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Your information">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar userName={user?.full_name} photoUrl={user?.photo_url} initials={initials} size="large" />
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{user?.full_name || "Your profile"}</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email || "No email address"}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">{roles.map((role) => <Badge key={role} variant="outline" className={`capitalize ${roleBadgeColors[role.toLowerCase().replaceAll(" ", "_")] || ""}`}>{role.replaceAll("_", " ")}</Badge>)}</div>
          </div>
          <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-full" onClick={() => setEditingProfile(true)} aria-label="Edit profile" title="Edit profile"><Pencil className="h-4 w-4" /></Button>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/45 px-3.5 py-3 sm:px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Working at</p><p className="mt-0.5 truncate text-sm font-semibold">{restaurant?.name || "No restaurant selected"}</p><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{restaurant?.address || "Your current workplace"}</p></div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border bg-card" aria-label="Attendance">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h2 className="font-semibold tracking-tight">Attendance</h2></div><p className="mt-1 text-sm text-muted-foreground">Your current shift and recent time records.</p></div><Button asChild variant={isClockedIn ? "default" : "outline"} className="w-full sm:w-auto"><Link href="/attendance" data-tour="mobile-profile-attendance">{isClockedIn ? "Clock out" : "Take attendance"}<ChevronRight className="ml-1 h-4 w-4" /></Link></Button></div>
      <div className="grid divide-y md:grid-cols-[0.85fr_1.15fr] md:divide-x md:divide-y-0">
        <div className="p-4 sm:p-5">{attendanceLoading ? <div className="flex min-h-24 items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking today&apos;s attendance</div> : attendanceUnavailable ? <EmptyAttendance /> : <><p className="text-sm text-muted-foreground">Today</p><p className="mt-2 text-2xl font-semibold tracking-tight">{isClockedIn ? "You are clocked in" : todayEntry ? attendanceStatusLabel(todayEntry.status) : "No attendance yet"}</p><p className="mt-2 text-sm leading-5 text-muted-foreground">{isClockedIn ? `Started at ${formatDateTime(attendanceStatus?.active_entry?.clock_in_at)}` : todayEntry ? `${workedHours(todayEntry)} recorded on ${formatDateTime(todayEntry.clock_in_at)}` : "Use an approved attendance station to record your shift."}</p></>}</div>
        <div className="p-4 sm:p-5"><p className="text-sm font-medium">Recent records</p>{!attendanceLoading && !attendanceUnavailable && recentEntries.length ? <div className="mt-2 divide-y">{recentEntries.map((entry) => <div key={entry.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{formatDateTime(entry.clock_in_at)}</p><p className="mt-0.5 text-xs text-muted-foreground">{attendanceStatusLabel(entry.status)} - {attendanceApprovalLabel(entry.approval_status)}</p></div><p className="text-sm font-semibold tabular-nums">{workedHours(entry)}</p></div>)}</div> : <p className="mt-2 text-sm leading-5 text-muted-foreground">Your latest attendance records will appear here.</p>}</div>
      </div>
      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">Attendance uses your restaurant&apos;s approved QR, mobile, or device process so each record can be verified.</p>
    </section>

    {user ? <StaffPerformanceCard userId={user.id} /> : null}

    <section className="rounded-2xl border bg-card" aria-label="Account settings" data-tour="mobile-profile-account-settings">
      <div className="border-b p-4 sm:p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-semibold tracking-tight">Account settings</h2></div><p className="mt-1 text-sm text-muted-foreground">Update your profile, sign-in, and restaurant access.</p></div>
      <div className="divide-y"><ActionRow icon={Pencil} title="Personal details" description="Name and profile photo" onClick={() => setEditingProfile(true)} /><ActionRow icon={KeyRound} title="Change password" description="Use a strong password you do not use elsewhere" onClick={() => setEditingPassword(true)} /><ActionRow icon={LogOut} title="Leave this restaurant" description="Review any open responsibilities before leaving" href="/leave-restaurant" tone="danger" /></div>
    </section>
    <Dialog open={editingProfile} onOpenChange={setEditingProfile}><DialogContent className="sm:max-w-[460px]"><DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update how your name and photo appear in Yummy.</DialogDescription></DialogHeader><form onSubmit={saveName} className="space-y-5"><div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3"><Avatar userName={user?.full_name} photoUrl={user?.photo_url} initials={initials} /><div><p className="text-sm font-medium">Profile photo</p><p className="mt-0.5 text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p><input ref={photoInput} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={uploadPhoto} /><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => photoInput.current?.click()} disabled={uploadingPhoto}>{uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{uploadingPhoto ? "Uploading" : "Change photo"}</Button></div></div><Field label="Full name" htmlFor="profile-name"><Input id="profile-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></Field><Field label="Email address" htmlFor="profile-email" hint="Changing your sign-in email requires a verified email-change flow."><Input id="profile-email" type="email" value={user?.email || ""} readOnly className="bg-muted/30" /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingProfile(false)}>Cancel</Button><Button type="submit" disabled={savingName || !name.trim()}>{savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save changes</Button></div></form></DialogContent></Dialog>
    <Dialog open={editingPassword} onOpenChange={setEditingPassword}><DialogContent className="sm:max-w-[460px]"><DialogHeader><DialogTitle>Change password</DialogTitle><DialogDescription>Choose a password you do not use for any other account.</DialogDescription></DialogHeader><form onSubmit={savePassword} className="space-y-4"><Field label="Current password" htmlFor="current-password" hint="Leave this blank only if you have not set a password yet."><Input id="current-password" type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))} /></Field><Field label="New password" htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))} /></Field><Field label="Confirm new password" htmlFor="confirm-password"><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={password.confirm} onChange={(event) => setPassword((current) => ({ ...current, confirm: event.target.value }))} /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingPassword(false)}>Cancel</Button><Button type="submit" disabled={savingPassword || !password.next || !password.confirm}>{savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Update password</Button></div></form></DialogContent></Dialog>
  </main>;
}

function Avatar({ userName, photoUrl, initials, size = "regular" }: { userName?: string | null; photoUrl?: string | null; initials: string; size?: "regular" | "large" }) {
  const dimension = size === "large" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 w-14";
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-primary/10 font-semibold text-primary ${dimension}`}>{photoUrl ? <Image src={photoUrl} alt={userName || "Profile photo"} width={80} height={80} unoptimized className="h-full w-full object-cover" /> : initials}</div>;
}

function EmptyAttendance() { return <><p className="text-sm text-muted-foreground">Today</p><p className="mt-2 text-xl font-semibold tracking-tight">Attendance is unavailable</p><p className="mt-2 text-sm leading-5 text-muted-foreground">Ask a manager to confirm that attendance access is enabled for your account.</p></>; }

function ActionRow({ icon: Icon, title, description, href, onClick, tone = "default" }: { icon: LucideIcon; title: string; description: string; href?: string; onClick?: () => void; tone?: "default" | "danger" }) {
  const body = <><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className={`block text-sm font-medium ${tone === "danger" ? "text-destructive" : ""}`}>{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span><ChevronRight className={`h-4 w-4 shrink-0 ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`} /></>;
  const className = "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5";
  return href ? <Link href={href} className={className}>{body}</Link> : <button type="button" className={className} onClick={onClick}>{body}</button>;
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}{hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}</div>;
}
