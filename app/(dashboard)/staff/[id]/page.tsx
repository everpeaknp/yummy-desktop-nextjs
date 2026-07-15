"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  FileClock,
  History,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import {
  AuthApis,
  RoleApis,
  StaffApis,
  StaffProfileApis,
  UserAccessScopeApis,
} from "@/lib/api/endpoints";
import { attendanceApi } from "@/lib/attendance/api";
import type {
  AttendanceEntry,
  AttendanceLeave,
  AttendanceSchedule,
  AttendanceShiftTemplate,
} from "@/lib/attendance/types";
import {
  staffWorkforceApi,
  type PayrollHistoryRecord,
  type SalaryHistoryRecord,
  type StaffProfile,
} from "@/lib/staff/workforce";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StaffPayrollBalanceCard } from "@/components/payroll/staff-payroll-balance-card";

type ScopeKey = "analytics" | "orders" | "receipts";
type AccessScopeRow = {
  scope_key: ScopeKey;
  max_lookback_days?: number | null;
  window_start?: string | null;
  window_end?: string | null;
};

type StaffUser = {
  id: number;
  name: string;
  email?: string | null;
  role?: string;
  primary_role?: string;
  roles?: string[];
  permissions?: string[];
  created_at?: string;
  status?: string;
  is_active?: boolean;
};

type ProfileForm = {
  account_number: string;
  salary_type: string;
  salary_amount: string;
  phone: string;
  address: string;
  age: string;
  weekly_hours: string;
  daily_hours: string;
  salary_effective_from: string;
  salary_change_reason: string;
};

const scopeKeys: ScopeKey[] = ["analytics", "orders", "receipts"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function money(value: number | string | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function minutes(value: number) {
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function toDateTimeLocal(value?: string | null) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function dateOnly(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function emptyProfileForm(): ProfileForm {
  return {
    account_number: "",
    salary_type: "monthly",
    salary_amount: "",
    phone: "",
    address: "",
    age: "",
    weekly_hours: "",
    daily_hours: "",
    salary_effective_from: isoDate(new Date()),
    salary_change_reason: "",
  };
}

export default function StaffWorkspacePage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const userId = Number(rawId);
  const router = useRouter();
  const currentUser = useAuth((state) => state.user) as any;

  const initialRange = useMemo(currentMonthRange, []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [templates, setTemplates] = useState<AttendanceShiftTemplate[]>([]);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRecord[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workspaceWarnings, setWorkspaceWarnings] = useState<string[]>([]);

  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", email: "" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [correctionEntry, setCorrectionEntry] = useState<AttendanceEntry | null>(null);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({ clockIn: "", clockOut: "", reason: "" });

  const [scopesByKey, setScopesByKey] = useState<Partial<Record<ScopeKey, AccessScopeRow>>>({});
  const [scopeDrafts, setScopeDrafts] = useState<Record<ScopeKey, { max_lookback_days: string; window_start: string; window_end: string }>>({
    analytics: { max_lookback_days: "", window_start: "", window_end: "" },
    orders: { max_lookback_days: "", window_start: "", window_end: "" },
    receipts: { max_lookback_days: "", window_start: "", window_end: "" },
  });
  const [scopeBusy, setScopeBusy] = useState<ScopeKey | null>(null);

  const currentRole = String(currentUser?.primary_role || currentUser?.role || "").toLowerCase();
  const currentPermissions = useMemo(
    () => new Set<string>((currentUser?.permissions || []).map((item: unknown) => String(item).toLowerCase())),
    [currentUser?.permissions],
  );
  const can = useCallback(
    (permission: string) =>
      currentRole === "admin" || currentRole === "superadmin" || currentPermissions.has(permission),
    [currentPermissions, currentRole],
  );
  const canViewAttendance = can("attendance.view") || can("attendance.manage");
  const canManageAttendance = can("attendance.manage");
  const canManagePayroll = can("finance.payroll.manage");
  const canViewPayroll = can("finance.payroll.view") || can("finance.payroll.manage");
  const canManageStaff = can("admin.staff.manage");

  const hydrateScopes = useCallback((rows: AccessScopeRow[]) => {
    const next: Record<ScopeKey, { max_lookback_days: string; window_start: string; window_end: string }> = {
      analytics: { max_lookback_days: "", window_start: "", window_end: "" },
      orders: { max_lookback_days: "", window_start: "", window_end: "" },
      receipts: { max_lookback_days: "", window_start: "", window_end: "" },
    };
    const map: Partial<Record<ScopeKey, AccessScopeRow>> = {};
    rows.forEach((row) => {
      map[row.scope_key] = row;
      next[row.scope_key] = {
        max_lookback_days: row.max_lookback_days == null ? "" : String(row.max_lookback_days),
        window_start: row.window_start?.slice(0, 10) || "",
        window_end: row.window_end?.slice(0, 10) || "",
      };
    });
    setScopesByKey(map);
    setScopeDrafts(next);
  }, []);

  const loadScopes = useCallback(async () => {
    if (!Number.isFinite(userId)) return;
    try {
      const response = await apiClient.get(UserAccessScopeApis.list(userId));
      hydrateScopes((response.data?.data || []) as AccessScopeRow[]);
    } catch {
      hydrateScopes([]);
    }
  }, [hydrateScopes, userId]);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setLoading(false);
      return;
    }
    quiet ? setRefreshing(true) : setLoading(true);
    const warnings: string[] = [];
    try {
      const [userResponse, permissionResponse] = await Promise.all([
        apiClient.get(StaffApis.getStaff(userId)),
        apiClient.get(RoleApis.listPermissions).catch(() => null),
      ]);
      const loadedStaff = userResponse.data?.data as StaffUser;
      setStaff(loadedStaff);
      setSelectedPermissions(loadedStaff.permissions || []);
      setAvailablePermissions(permissionResponse?.data?.data || []);
      setAccountForm({ name: loadedStaff.name || "", email: loadedStaff.email || "" });

      const loadedProfile = await staffWorkforceApi.profileByUserId(userId);
      setProfile(loadedProfile);
      if (!loadedProfile) {
        setEntries([]);
        setSchedules([]);
        setLeaves([]);
        setSalaryHistory([]);
        setPayrollHistory([]);
        warnings.push("Create the payroll profile to connect attendance, schedules, and payroll history for this staff member.");
      } else {
        const results = await Promise.allSettled([
          canViewAttendance
            ? attendanceApi.listEntries({ dateFrom, dateTo, staffId: loadedProfile.id, limit: 500 })
            : Promise.resolve([] as AttendanceEntry[]),
          canViewAttendance
            ? attendanceApi.listSchedules(loadedProfile.id)
            : Promise.resolve([] as AttendanceSchedule[]),
          canViewAttendance
            ? attendanceApi.listShiftTemplates()
            : Promise.resolve([] as AttendanceShiftTemplate[]),
          canViewAttendance
            ? attendanceApi.listLeaves({ staffId: loadedProfile.id, dateFrom, dateTo })
            : Promise.resolve([] as AttendanceLeave[]),
          staffWorkforceApi.salaryHistory(loadedProfile.id),
          canViewPayroll
            ? staffWorkforceApi.payrollHistory(loadedProfile.id)
            : Promise.resolve([] as PayrollHistoryRecord[]),
        ]);
        const [entryResult, scheduleResult, templateResult, leaveResult, salaryResult, payrollResult] = results;
        setEntries(entryResult.status === "fulfilled" ? entryResult.value : []);
        setSchedules(scheduleResult.status === "fulfilled" ? scheduleResult.value : []);
        setTemplates(templateResult.status === "fulfilled" ? templateResult.value : []);
        setLeaves(leaveResult.status === "fulfilled" ? leaveResult.value : []);
        setSalaryHistory(salaryResult.status === "fulfilled" ? salaryResult.value : []);
        setPayrollHistory(payrollResult.status === "fulfilled" ? payrollResult.value : []);
        if (entryResult.status === "rejected" || scheduleResult.status === "rejected") {
          warnings.push("Some attendance details are unavailable for your current permission level.");
        }
        if (payrollResult.status === "rejected") {
          warnings.push("Payroll history is unavailable for your current permission level or plan.");
        }
      }
      await loadScopes();
      setWorkspaceWarnings(warnings);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to load staff workspace");
      setStaff(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewAttendance, canViewPayroll, dateFrom, dateTo, loadScopes, userId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const totals = useMemo(() => {
    const regular = entries.reduce((sum, item) => sum + Number(item.regular_minutes || 0), 0);
    const overtime = entries.reduce((sum, item) => sum + Number(item.overtime_minutes || 0), 0);
    const pending = entries.filter((item) => ["draft", "pending", "needs_correction"].includes(item.approval_status)).length;
    const exceptions = entries.filter((item) => Boolean(item.exception_code)).length;
    return { regular, overtime, pending, exceptions };
  }, [entries]);

  const todayEntry = useMemo(() => {
    const today = isoDate(new Date());
    return entries.find((entry) => entry.clock_in_at.slice(0, 10) === today && entry.status === "open")
      || entries.find((entry) => entry.clock_in_at.slice(0, 10) === today)
      || null;
  }, [entries]);
  const latestPayroll = payrollHistory[0] || null;
  const pendingLeaveCount = leaves.filter((leave) => leave.status === "pending").length;

  const openProfileEditor = () => {
    const next = emptyProfileForm();
    if (profile) {
      next.account_number = profile.account_number || "";
      next.salary_type = profile.salary_type || "monthly";
      next.salary_amount = String(profile.salary_amount ?? "");
      next.phone = profile.phone || "";
      next.address = profile.address || "";
      next.age = profile.age == null ? "" : String(profile.age);
      next.weekly_hours = profile.weekly_hours == null ? "" : String(profile.weekly_hours);
      next.daily_hours = profile.daily_hours == null ? "" : String(profile.daily_hours);
    }
    setProfileForm(next);
    setProfileOpen(true);
  };

  const saveAccount = async () => {
    if (!accountForm.name.trim() || !accountForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setAccountSaving(true);
    try {
      await apiClient.patch(StaffApis.update(userId), {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
      });
      toast.success("Staff account updated");
      setAccountOpen(false);
      await loadWorkspace(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update staff account");
    } finally {
      setAccountSaving(false);
    }
  };

  const saveProfile = async () => {
    const amount = Number(profileForm.salary_amount);
    if (!profileForm.account_number.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.error("Account number and a valid salary amount are required");
      return;
    }
    const salaryChanged = !profile
      || profile.salary_type !== profileForm.salary_type
      || Number(profile.salary_amount) !== amount
      || Number(profile.weekly_hours || 0) !== Number(profileForm.weekly_hours || 0)
      || Number(profile.daily_hours || 0) !== Number(profileForm.daily_hours || 0);
    if (profile && salaryChanged && profileForm.salary_change_reason.trim().length < 3) {
      toast.error("Explain the salary change so payroll keeps a useful audit history");
      return;
    }
    const payload: Record<string, unknown> = {
      account_number: profileForm.account_number.trim(),
      phone: profileForm.phone.trim() || undefined,
      address: profileForm.address.trim() || undefined,
      age: profileForm.age ? Number(profileForm.age) : undefined,
    };
    if (!profile || salaryChanged) {
      Object.assign(payload, {
        salary_type: profileForm.salary_type,
        salary_amount: amount,
        weekly_hours: profileForm.weekly_hours ? Number(profileForm.weekly_hours) : undefined,
        daily_hours: profileForm.daily_hours ? Number(profileForm.daily_hours) : undefined,
        salary_effective_from: profileForm.salary_effective_from,
        salary_change_reason: profileForm.salary_change_reason.trim() || "Initial salary",
      });
    }
    if (!profile) payload.user_id = userId;
    setProfileSaving(true);
    try {
      if (profile) await apiClient.patch(StaffProfileApis.update(profile.id), payload);
      else await apiClient.post(StaffProfileApis.create, payload);
      toast.success(profile ? "Employment and pay profile updated" : "Employment and pay profile created");
      setProfileOpen(false);
      await loadWorkspace(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to save employment profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const updateAttendance = async (entry: AttendanceEntry, action: "submit" | "approve" | "reject" | "reopen") => {
    try {
      if (action === "submit") await attendanceApi.submitEntry(entry.id, "Submitted from staff workspace");
      if (action === "approve") {
        await attendanceApi.approveEntry(entry.id, {
          approved_overtime_minutes: entry.overtime_minutes,
          rejected_overtime_minutes: 0,
          reason: "Approved from staff workspace",
        });
      }
      if (action === "reject") {
        const reason = window.prompt("Reason for rejection?")?.trim();
        if (!reason) return;
        await attendanceApi.rejectEntry(entry.id, reason);
      }
      if (action === "reopen") {
        const reason = window.prompt("Reason for reopening?")?.trim();
        if (!reason) return;
        await attendanceApi.reopenEntry(entry.id, reason);
      }
      toast.success("Attendance updated");
      await loadWorkspace(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update attendance");
    }
  };

  const openAttendanceCorrection = (entry: AttendanceEntry) => {
    setCorrectionEntry(entry);
    setCorrectionForm({
      clockIn: toDateTimeLocal(entry.clock_in_at),
      clockOut: toDateTimeLocal(entry.clock_out_at),
      reason: "",
    });
  };

  const saveAttendanceCorrection = async () => {
    if (!correctionEntry) return;
    const clockIn = new Date(correctionForm.clockIn);
    const clockOut = new Date(correctionForm.clockOut);
    const reason = correctionForm.reason.trim();
    if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime())) return toast.error("Enter valid times");
    if (clockOut <= clockIn) return toast.error("Clock out must be after clock in");
    if (reason.length < 3) return toast.error("Add a short correction reason");

    setCorrectionSaving(true);
    try {
      if (["approved", "rejected"].includes(correctionEntry.approval_status)) {
        await attendanceApi.reopenEntry(correctionEntry.id, reason);
      }
      await attendanceApi.correctEntry(correctionEntry.id, {
        clock_in_at: clockIn.toISOString(),
        clock_out_at: clockOut.toISOString(),
        reason,
      });
      toast.success("Attendance corrected and returned to draft");
      setCorrectionEntry(null);
      await loadWorkspace(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : detail?.message || "Failed to correct attendance");
    } finally {
      setCorrectionSaving(false);
    }
  };

  const savePermissions = async () => {
    setPermissionsSaving(true);
    try {
      await apiClient.post(AuthApis.updateUserPermissions(userId), { permission_keys: selectedPermissions });
      toast.success("Permissions updated");
      setPermissionsOpen(false);
      await loadWorkspace(true);
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setPermissionsSaving(false);
    }
  };

  const saveScope = async (key: ScopeKey) => {
    const draft = scopeDrafts[key];
    const maxDays = draft.max_lookback_days ? Number(draft.max_lookback_days) : null;
    if (maxDays != null && (!Number.isFinite(maxDays) || maxDays < 1 || maxDays > 3650)) {
      toast.error("Lookback must be between 1 and 3650 days");
      return;
    }
    if (draft.window_start && draft.window_end && draft.window_start > draft.window_end) {
      toast.error("Scope start cannot be after its end");
      return;
    }
    if (!maxDays && !draft.window_start && !draft.window_end) {
      toast.error("Set a lookback or date window");
      return;
    }
    setScopeBusy(key);
    try {
      await apiClient.put(UserAccessScopeApis.upsert(userId, key), {
        max_lookback_days: maxDays || undefined,
        window_start: draft.window_start || undefined,
        window_end: draft.window_end || undefined,
      });
      toast.success(`${key} scope saved`);
      await loadScopes();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to save access scope");
    } finally {
      setScopeBusy(null);
    }
  };

  const removeScope = async (key: ScopeKey) => {
    setScopeBusy(key);
    try {
      await apiClient.delete(UserAccessScopeApis.remove(userId, key));
      toast.success(`${key} scope removed`);
      await loadScopes();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to remove access scope");
    } finally {
      setScopeBusy(null);
    }
  };

  const deactivateStaff = async () => {
    if (!window.confirm(`Deactivate ${staff?.name || "this employee"}? Login and attendance access will stop, while payroll history is preserved.`)) return;
    try {
      await apiClient.delete(StaffApis.delete(userId));
      toast.success("Employee deactivated; history was preserved");
      await loadWorkspace(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to deactivate employee");
    }
  };

  const reactivateStaff = async () => {
    try {
      await apiClient.patch(StaffApis.update(userId), { is_active: true });
      toast.success("Employee reactivated");
      await loadWorkspace(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to reactivate employee");
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!staff) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Button asChild variant="ghost"><Link href="/staff"><ArrowLeft className="mr-2 h-4 w-4" />Back to staff</Link></Button>
        <Card className="mt-6"><CardContent className="p-12 text-center"><h1 className="text-xl font-semibold">Staff member not found</h1><p className="mt-2 text-sm text-muted-foreground">The record is unavailable or outside your restaurant.</p></CardContent></Card>
      </div>
    );
  }

  const activeRoles = staff.roles?.filter((role) => !role.startsWith("__user_")) || [staff.primary_role || staff.role || "staff"];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-amber-500/10 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Button asChild size="icon" variant="outline" className="shrink-0 rounded-full bg-background/80"><Link href="/staff"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/20">{staff.name?.charAt(0).toUpperCase() || "?"}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{staff.name}</h1><Badge variant={staff.is_active === false ? "secondary" : "default"}>{staff.is_active === false ? "Inactive" : "Active"}</Badge></div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><BriefcaseBusiness className="h-4 w-4" />{staff.primary_role || staff.role || "Staff"}<span>•</span><span>User #{staff.id}</span>{profile ? <><span>•</span><span>Staff #{profile.id}</span></> : null}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{activeRoles.map((role) => <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" onClick={() => void loadWorkspace(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
            {canManageStaff ? <Button onClick={() => setAccountOpen(true)}><Edit3 className="mr-2 h-4 w-4" />Edit staff</Button> : null}
          </div>
        </div>
        <div className="grid border-t bg-background/70 sm:grid-cols-2 lg:grid-cols-4">
          <HeroMetric icon={Clock3} label="Attendance today" value={todayEntry ? (todayEntry.status === "open" ? "Clocked in" : "Completed") : "No attendance"} tone={todayEntry ? "good" : "neutral"} />
          <HeroMetric icon={FileClock} label="Attendance review" value={totals.pending ? `${totals.pending} unresolved` : "Ready"} tone={totals.pending ? "warn" : "good"} />
          <HeroMetric icon={CalendarDays} label="Pending leave" value={pendingLeaveCount ? String(pendingLeaveCount) : "None"} tone={pendingLeaveCount ? "warn" : "neutral"} />
          <HeroMetric icon={Banknote} label="Latest net pay" value={latestPayroll ? money(latestPayroll.item.net_pay) : "No payroll"} tone="neutral" />
        </div>
      </section>

      {workspaceWarnings.length ? <div className="space-y-2">{workspaceWarnings.map((warning) => <div key={warning} className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{warning}</span></div>)}</div> : null}

      <Tabs defaultValue="overview" className="space-y-5">
        <div className="overflow-x-auto pb-1"><TabsList className="h-auto min-w-max justify-start rounded-xl bg-muted/70 p-1"><TabsTrigger value="overview">Overview</TabsTrigger>{canViewAttendance ? <TabsTrigger value="attendance">Attendance</TabsTrigger> : null}{canViewPayroll ? <TabsTrigger value="payroll">Payroll</TabsTrigger> : null}<TabsTrigger value="employment">Employment</TabsTrigger><TabsTrigger value="access">Access</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList></div>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Clock3} label="Regular time" value={minutes(totals.regular)} helper={`${dateFrom} to ${dateTo}`} />
            <SummaryCard icon={History} label="Overtime" value={minutes(totals.overtime)} helper={`${entries.length} attendance records`} />
            <SummaryCard icon={AlertTriangle} label="Exceptions" value={String(totals.exceptions)} helper={totals.exceptions ? "Needs manager attention" : "No recorded exceptions"} />
            <SummaryCard icon={WalletCards} label="Compensation" value={profile ? money(profile.salary_amount) : "Not configured"} helper={profile ? `${profile.salary_type} • effective salary history enabled` : "Create a payroll profile"} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card><CardHeader><CardTitle className="text-base">Recent attendance</CardTitle><CardDescription>Latest staff-specific records and approval state.</CardDescription></CardHeader><CardContent><AttendanceList entries={entries.slice(0, 5)} canManage={canManageAttendance} onAction={updateAttendance} onCorrect={openAttendanceCorrection} compact /></CardContent></Card>
            <div className="space-y-5">
              <Card><CardHeader><CardTitle className="text-base">Current employment</CardTitle></CardHeader><CardContent className="space-y-3"><InfoLine icon={Mail} label="Email" value={staff.email || "Not set"} /><InfoLine icon={Phone} label="Phone" value={profile?.phone || "Not set"} /><InfoLine icon={MapPin} label="Address" value={profile?.address || "Not set"} /><InfoLine icon={WalletCards} label="Account" value={profile?.account_number || "Not configured"} /></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Payroll readiness</CardTitle><CardDescription>Quick signal; payroll preview remains the authoritative check.</CardDescription></CardHeader><CardContent><div className={`rounded-xl border p-4 ${profile && totals.pending === 0 && schedules.length > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}><div className="flex items-center gap-2 font-semibold">{profile && totals.pending === 0 && schedules.length > 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}{profile && totals.pending === 0 && schedules.length > 0 ? "No obvious staff blockers" : "Setup or review required"}</div><p className="mt-2 text-sm text-muted-foreground">{!profile ? "Create a compensation profile." : totals.pending ? "Resolve draft, pending, or correction-required attendance." : schedules.length === 0 && profile.salary_type !== "hourly" ? "Assign an effective work schedule." : "Run payroll preview to validate salary dates, leave, holidays, and period overlap."}</p></div></CardContent></Card>
            </div>
          </div>
        </TabsContent>

        {canViewAttendance ? <TabsContent value="attendance" className="space-y-5">
          <Card><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Attendance period</h2><p className="text-sm text-muted-foreground">View and manage only {staff.name}&apos;s time records.</p></div><div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div><div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div></div></CardContent></Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard icon={Clock3} label="Regular" value={minutes(totals.regular)} /><SummaryCard icon={History} label="Overtime" value={minutes(totals.overtime)} /><SummaryCard icon={FileClock} label="Needs review" value={String(totals.pending)} /><SummaryCard icon={AlertTriangle} label="Exceptions" value={String(totals.exceptions)} /></div>
          <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <Card><CardHeader><CardTitle>Timesheet</CardTitle><CardDescription>Corrections remain auditable and exported records stay locked to payroll snapshots.</CardDescription></CardHeader><CardContent><AttendanceList entries={entries} canManage={canManageAttendance} onAction={updateAttendance} onCorrect={openAttendanceCorrection} /></CardContent></Card>
            <div className="space-y-5"><ScheduleCard schedules={schedules} templates={templates} /><LeaveCard leaves={leaves} /></div>
          </div>
        </TabsContent> : null}

        {canViewPayroll ? <TabsContent value="payroll" className="space-y-5">
          {profile ? <StaffPayrollBalanceCard staffId={profile.id} canManage={canManagePayroll} /> : null}
          <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
            <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle>Current compensation</CardTitle><CardDescription>Effective salary used for new payroll periods.</CardDescription></div>{canManageStaff ? <Button size="sm" variant="outline" onClick={openProfileEditor}><Edit3 className="mr-2 h-4 w-4" />Edit</Button> : null}</CardHeader><CardContent>{profile ? <div className="space-y-3"><div className="rounded-2xl bg-primary/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{profile.salary_type}</p><p className="mt-1 text-2xl font-bold">{money(profile.salary_amount)}</p></div><InfoRow label="Weekly hours" value={profile.weekly_hours == null ? "—" : String(profile.weekly_hours)} /><InfoRow label="Daily hours" value={profile.daily_hours == null ? "—" : String(profile.daily_hours)} /><InfoRow label="Salary records" value={String(salaryHistory.length)} /></div> : <EmptyState title="No compensation profile" description="Create a payroll profile before this employee can be included in payroll." action={canManageStaff ? <Button onClick={openProfileEditor}>Create profile</Button> : null} />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Salary history</CardTitle><CardDescription>Effective-dated compensation changes; periods crossing a change must be split.</CardDescription></CardHeader><CardContent><div className="space-y-3">{salaryHistory.length ? salaryHistory.map((record) => <div key={record.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold capitalize">{record.salary_type} • {money(record.salary_amount)}</p><p className="text-sm text-muted-foreground">{dateOnly(record.effective_from)} to {record.effective_to ? dateOnly(record.effective_to) : "Current"}</p></div><div className="sm:text-right"><Badge variant={record.effective_to ? "outline" : "default"}>{record.effective_to ? "Historical" : "Current"}</Badge><p className="mt-1 text-xs text-muted-foreground">{record.reason || "No change reason"}</p></div></div>) : <EmptyState title="No salary history" description="A salary record will appear after the profile is created." />}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Payroll history</CardTitle><CardDescription>Run-level status with the staff member&apos;s complete calculation evidence.</CardDescription></CardHeader><CardContent><PayrollHistoryTable records={payrollHistory} /></CardContent></Card>
        </TabsContent> : null}

        <TabsContent value="employment" className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle>Account details</CardTitle><CardDescription>Identity and restaurant login information.</CardDescription></div>{canManageStaff ? <Button size="sm" variant="outline" onClick={() => setAccountOpen(true)}><Edit3 className="mr-2 h-4 w-4" />Edit</Button> : null}</CardHeader><CardContent className="space-y-4"><InfoLine icon={UserRound} label="Full name" value={staff.name} /><InfoLine icon={Mail} label="Email" value={staff.email || "Not set"} /><InfoLine icon={BriefcaseBusiness} label="Primary role" value={staff.primary_role || staff.role || "Staff"} /><InfoLine icon={CalendarDays} label="Joined" value={staff.created_at ? dateOnly(staff.created_at) : "—"} /></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle>Employment and pay profile</CardTitle><CardDescription>Contact, account, salary, and expected hours.</CardDescription></div>{canManageStaff ? <Button size="sm" variant="outline" onClick={openProfileEditor}><Edit3 className="mr-2 h-4 w-4" />{profile ? "Edit" : "Create"}</Button> : null}</CardHeader><CardContent>{profile ? <div className="grid gap-4 sm:grid-cols-2"><InfoLine icon={WalletCards} label="Account number" value={profile.account_number} /><InfoLine icon={Banknote} label="Salary" value={`${money(profile.salary_amount)} / ${profile.salary_type}`} /><InfoLine icon={Phone} label="Phone" value={profile.phone || "Not set"} /><InfoLine icon={MapPin} label="Address" value={profile.address || "Not set"} /><InfoLine icon={Clock3} label="Weekly hours" value={profile.weekly_hours == null ? "Not set" : String(profile.weekly_hours)} /><InfoLine icon={Clock3} label="Daily hours" value={profile.daily_hours == null ? "Not set" : String(profile.daily_hours)} /></div> : <EmptyState title="No employment profile" description="Attendance and payroll need a linked staff profile." action={canManageStaff ? <Button onClick={openProfileEditor}>Create profile</Button> : null} />}</CardContent></Card>
          </div>
          {canManageStaff ? <Card><CardHeader><CardTitle className="text-base">Employment access</CardTitle><CardDescription>Deactivate access without deleting attendance, payroll, or audit history.</CardDescription></CardHeader><CardContent>{staff.is_active === false ? <Button onClick={reactivateStaff}><UserCheck className="mr-2 h-4 w-4" />Reactivate employee</Button> : <Button variant="outline" onClick={deactivateStaff}><UserX className="mr-2 h-4 w-4" />Deactivate employee</Button>}</CardContent></Card> : null}
        </TabsContent>

        <TabsContent value="access" className="space-y-5">
          <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardTitle>Roles and permissions</CardTitle><CardDescription>Role access stays separate from sensitive attendance and payroll data.</CardDescription></div>{canManageStaff ? <Button size="sm" onClick={() => setPermissionsOpen(true)}><ShieldCheck className="mr-2 h-4 w-4" />Manage</Button> : null}</CardHeader><CardContent><div className="flex flex-wrap gap-2">{staff.permissions?.length ? staff.permissions.map((permission) => <Badge key={permission} variant="secondary" className="font-mono text-[11px]">{permission}</Badge>) : <p className="text-sm text-muted-foreground">No direct overrides; role defaults apply.</p>}</div></CardContent></Card>
          <div className="grid gap-5 lg:grid-cols-3">{scopeKeys.map((key) => { const draft = scopeDrafts[key]; const active = Boolean(scopesByKey[key]); return <Card key={key}><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base capitalize">{key}</CardTitle><Badge variant={active ? "default" : "outline"}>{active ? "Scoped" : "Full access"}</Badge></div><CardDescription>Limit historical visibility for this module.</CardDescription></CardHeader><CardContent className="space-y-3"><div><Label>Maximum lookback days</Label><Input inputMode="numeric" placeholder="Example: 30" value={draft.max_lookback_days} onChange={(event) => setScopeDrafts((current) => ({ ...current, [key]: { ...current[key], max_lookback_days: event.target.value } }))} /></div><div className="grid grid-cols-2 gap-2"><div><Label>Start</Label><Input type="date" value={draft.window_start} onChange={(event) => setScopeDrafts((current) => ({ ...current, [key]: { ...current[key], window_start: event.target.value } }))} /></div><div><Label>End</Label><Input type="date" value={draft.window_end} onChange={(event) => setScopeDrafts((current) => ({ ...current, [key]: { ...current[key], window_end: event.target.value } }))} /></div></div>{canManageStaff ? <div className="flex gap-2"><Button className="flex-1" disabled={scopeBusy === key} onClick={() => void saveScope(key)}>{scopeBusy === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button><Button variant="outline" disabled={!active || scopeBusy === key} onClick={() => void removeScope(key)}>Remove</Button></div> : null}</CardContent></Card>; })}</div>
        </TabsContent>

        <TabsContent value="activity"><Card><CardHeader><CardTitle>Workforce activity</CardTitle><CardDescription>Real staff-specific events from attendance, salary history, and payroll.</CardDescription></CardHeader><CardContent><ActivityTimeline entries={entries} salaryHistory={salaryHistory} payrollHistory={payrollHistory} /></CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={Boolean(correctionEntry)} onOpenChange={(open) => { if (!open && !correctionSaving) setCorrectionEntry(null); }}><DialogContent><DialogHeader><DialogTitle>Correct attendance time</DialogTitle><DialogDescription>The record will return to draft and must be reviewed again before payroll.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><FormField label="Clock in"><Input type="datetime-local" value={correctionForm.clockIn} onChange={(event) => setCorrectionForm((current) => ({ ...current, clockIn: event.target.value }))} /></FormField><FormField label="Clock out"><Input type="datetime-local" value={correctionForm.clockOut} onChange={(event) => setCorrectionForm((current) => ({ ...current, clockOut: event.target.value }))} /></FormField><div className="sm:col-span-2"><FormField label="Correction reason"><Textarea value={correctionForm.reason} onChange={(event) => setCorrectionForm((current) => ({ ...current, reason: event.target.value }))} placeholder="For example: employee forgot to clock out" /></FormField></div></div><DialogFooter><Button variant="outline" disabled={correctionSaving} onClick={() => setCorrectionEntry(null)}>Cancel</Button><Button disabled={correctionSaving} onClick={saveAttendanceCorrection}>{correctionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save correction</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent><DialogHeader><DialogTitle>Edit staff account</DialogTitle><DialogDescription>Update the employee&apos;s identity and login email. Roles and permissions are managed from Access.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div><Label>Full name</Label><Input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} /></div><div><Label>Email</Label><Input type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAccountOpen(false)}>Cancel</Button><Button onClick={saveAccount} disabled={accountSaving}>{accountSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save account</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{profile ? "Edit employment and pay profile" : "Create employment and pay profile"}</DialogTitle><DialogDescription>Salary changes create effective-dated history and can require payroll periods to be split.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><FormField label="Account number"><Input value={profileForm.account_number} onChange={(event) => setProfileForm((current) => ({ ...current, account_number: event.target.value }))} /></FormField><FormField label="Salary type"><Select value={profileForm.salary_type} onValueChange={(value) => setProfileForm((current) => ({ ...current, salary_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="hourly">Hourly</SelectItem></SelectContent></Select></FormField><FormField label="Salary amount"><Input type="number" min="0" step="0.01" value={profileForm.salary_amount} onChange={(event) => setProfileForm((current) => ({ ...current, salary_amount: event.target.value }))} /></FormField><FormField label="Effective from"><Input type="date" value={profileForm.salary_effective_from} onChange={(event) => setProfileForm((current) => ({ ...current, salary_effective_from: event.target.value }))} /></FormField><FormField label="Weekly hours"><Input type="number" min="0" step="0.25" value={profileForm.weekly_hours} onChange={(event) => setProfileForm((current) => ({ ...current, weekly_hours: event.target.value }))} /></FormField><FormField label="Daily hours"><Input type="number" min="0" step="0.25" value={profileForm.daily_hours} onChange={(event) => setProfileForm((current) => ({ ...current, daily_hours: event.target.value }))} /></FormField><FormField label="Phone"><Input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></FormField><FormField label="Age"><Input type="number" min="0" value={profileForm.age} onChange={(event) => setProfileForm((current) => ({ ...current, age: event.target.value }))} /></FormField><div className="sm:col-span-2"><FormField label="Address"><Input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} /></FormField></div><div className="sm:col-span-2"><FormField label="Salary change reason"><Input placeholder={profile ? "Promotion, review, correction…" : "Initial salary"} value={profileForm.salary_change_reason} onChange={(event) => setProfileForm((current) => ({ ...current, salary_change_reason: event.target.value }))} /></FormField></div></div><DialogFooter><Button variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button><Button onClick={saveProfile} disabled={profileSaving}>{profileSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save profile</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Manage permissions</DialogTitle><DialogDescription>Direct overrides for {staff.name}. Role defaults still apply.</DialogDescription></DialogHeader><ScrollArea className="h-[420px] pr-4"><div className="space-y-5">{Object.entries(availablePermissions.reduce((grouped: Record<string, any[]>, permission: any) => { const groupName = permission.module || "Other"; (grouped[groupName] ||= []).push(permission); return grouped; }, {})).map(([groupName, permissions]) => <section key={groupName}><h3 className="mb-2 border-b pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{groupName}</h3><div className="space-y-3">{permissions.map((permission: any) => <label key={permission.key} className="flex cursor-pointer items-start gap-3"><Checkbox checked={selectedPermissions.includes(permission.key)} onCheckedChange={(checked) => setSelectedPermissions((current) => checked ? Array.from(new Set([...current, permission.key])) : current.filter((item) => item !== permission.key))} /><span><span className="block text-sm font-medium">{permission.key}</span>{permission.description ? <span className="block text-xs text-muted-foreground">{permission.description}</span> : null}</span></label>)}</div></section>)}</div></ScrollArea><DialogFooter><Button variant="outline" onClick={() => setPermissionsOpen(false)}>Cancel</Button><Button onClick={savePermissions} disabled={permissionsSaving}>{permissionsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save permissions</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-primary";
  return <div className="flex items-center gap-3 border-b p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><div className={`rounded-xl bg-background p-2 shadow-sm ${toneClass}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="truncate font-semibold">{value}</p></div></div>;
}

function SummaryCard({ icon: Icon, label, value, helper }: { icon: any; label: string; value: string; helper?: string }) {
  return <Card><CardContent className="flex items-start gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-bold">{value}</p>{helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}</div></CardContent></Card>;
}

function InfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="flex items-start gap-3"><div className="rounded-lg bg-muted p-2 text-muted-foreground"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm font-semibold">{value}</p></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-7 text-center"><MoreHorizontal className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

function AttendanceList({ entries, canManage, onAction, onCorrect, compact = false }: { entries: AttendanceEntry[]; canManage: boolean; onAction: (entry: AttendanceEntry, action: "submit" | "approve" | "reject" | "reopen") => void; onCorrect: (entry: AttendanceEntry) => void; compact?: boolean }) {
  if (!entries.length) return <EmptyState title="No attendance records" description="No entries were found for the selected period." />;
  return <div className="space-y-3">{entries.map((entry) => <div key={entry.id} className="rounded-xl border p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{dateTime(entry.clock_in_at)}</p><Badge variant={entry.status === "complete" || entry.status === "adjusted" ? "outline" : "secondary"}>{entry.status}</Badge><Badge variant={entry.approval_status === "approved" || entry.approval_status === "payroll_exported" ? "default" : "secondary"}>{entry.approval_status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Out {dateTime(entry.clock_out_at)} • {minutes(entry.regular_minutes)} regular • {minutes(entry.overtime_minutes)} overtime{entry.exception_code ? ` • ${entry.exception_code}` : ""}</p></div>{canManage && !compact ? <div className="flex shrink-0 flex-wrap gap-1">{entry.approval_status !== "payroll_exported" ? <Button size="sm" variant="outline" onClick={() => onCorrect(entry)}><Edit3 className="mr-1 h-3.5 w-3.5" />Correct</Button> : null}{entry.approval_status === "draft" ? <Button size="sm" variant="outline" onClick={() => onAction(entry, "submit")}><FileClock className="mr-1 h-3.5 w-3.5" />Submit</Button> : null}{entry.approval_status === "pending" ? <><Button size="sm" onClick={() => onAction(entry, "approve")}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => onAction(entry, "reject")}><X className="mr-1 h-3.5 w-3.5" />Reject</Button></> : null}{["rejected", "needs_correction"].includes(entry.approval_status) ? <Button size="sm" variant="ghost" onClick={() => onAction(entry, "reopen")}>Reopen only</Button> : null}</div> : null}</div></div>)}</div>;
}

function ScheduleCard({ schedules, templates }: { schedules: AttendanceSchedule[]; templates: AttendanceShiftTemplate[] }) {
  return <Card><CardHeader><CardTitle className="text-base">Assigned schedule</CardTitle><CardDescription>Staff overrides and effective dates.</CardDescription></CardHeader><CardContent className="space-y-2">{schedules.length ? schedules.map((schedule) => { const template = templates.find((item) => item.id === schedule.shift_template_id); return <div key={schedule.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p className="font-medium">{weekdays[schedule.weekday] || `Day ${schedule.weekday}`}</p><p className="text-xs text-muted-foreground">{schedule.is_day_off ? "Day off" : template ? `${template.name} • ${template.start_local_time.slice(0, 5)}–${template.end_local_time.slice(0, 5)}` : `Shift #${schedule.shift_template_id || "—"}`}</p></div><Badge variant="outline">{dateOnly(schedule.effective_from)}</Badge></div>; }) : <EmptyState title="No staff schedule" description="Restaurant defaults may still apply, but staff-specific rules are not configured." />}</CardContent></Card>;
}

function LeaveCard({ leaves }: { leaves: AttendanceLeave[] }) {
  return <Card><CardHeader><CardTitle className="text-base">Leave</CardTitle><CardDescription>Paid and unpaid requests in this period.</CardDescription></CardHeader><CardContent className="space-y-2">{leaves.length ? leaves.map((leave) => <div key={leave.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium capitalize">{leave.leave_type} leave</p><Badge variant={leave.status === "approved" ? "default" : "secondary"}>{leave.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{dateOnly(leave.date_from)} to {dateOnly(leave.date_to)} • {leave.day_fraction === 0.5 ? "Half day" : "Full day"}</p><p className="mt-1 text-sm">{leave.reason}</p></div>) : <EmptyState title="No leave records" description="No leave overlaps the selected period." />}</CardContent></Card>;
}

function PayrollHistoryTable({ records }: { records: PayrollHistoryRecord[] }) {
  if (!records.length) return <EmptyState title="No payroll history" description="This staff member has not been included in a payroll run yet." />;
  return <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>Attendance</TableHead><TableHead>Pay breakdown</TableHead><TableHead className="text-right">Net pay</TableHead></TableRow></TableHeader><TableBody>{records.map(({ run, item }) => <TableRow key={item.id}><TableCell className="min-w-[170px]"><Link href={`/payroll/${run.id}`} className="font-semibold text-primary hover:underline">{dateOnly(run.date_from)} – {dateOnly(run.date_to)}</Link><p className="text-xs text-muted-foreground">Run #{run.id}</p></TableCell><TableCell><Badge variant={run.status === "paid" ? "default" : "secondary"}>{run.status}</Badge>{run.paid_at ? <p className="mt-1 text-xs text-muted-foreground">{dateOnly(run.paid_at)}</p> : null}</TableCell><TableCell className="min-w-[180px]"><p>{item.payable_days} payable / {item.scheduled_days} scheduled</p><p className="text-xs text-muted-foreground">{minutes(item.regular_minutes)} regular • {minutes(item.overtime_minutes)} OT</p></TableCell><TableCell className="min-w-[190px]"><p>{money(item.regular_pay)} regular</p><p className="text-xs text-muted-foreground">+ {money(item.overtime_pay + item.holiday_premium_pay + item.bonus)} extras • − {money(item.deduction + item.tax_amount)} deductions/tax</p></TableCell><TableCell className="text-right text-base font-bold">{money(item.net_pay)}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function ActivityTimeline({ entries, salaryHistory, payrollHistory }: { entries: AttendanceEntry[]; salaryHistory: SalaryHistoryRecord[]; payrollHistory: PayrollHistoryRecord[] }) {
  const events = [
    ...entries.map((entry) => ({ key: `attendance-${entry.id}`, at: entry.updated_at || entry.clock_in_at, icon: Clock3, title: `Attendance ${entry.approval_status.replaceAll("_", " ")}`, detail: `${dateTime(entry.clock_in_at)} • ${minutes(entry.regular_minutes)} regular` })),
    ...salaryHistory.map((record) => ({ key: `salary-${record.id}`, at: record.created_at || record.effective_from, icon: WalletCards, title: `Salary ${money(record.salary_amount)} / ${record.salary_type}`, detail: `Effective ${dateOnly(record.effective_from)}${record.reason ? ` • ${record.reason}` : ""}` })),
    ...payrollHistory.map(({ run, item }) => ({ key: `payroll-${item.id}`, at: run.paid_at || run.created_at || run.date_to, icon: Banknote, title: `Payroll ${run.status}`, detail: `${dateOnly(run.date_from)}–${dateOnly(run.date_to)} • ${money(item.net_pay)} net` })),
  ].sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime()).slice(0, 30);
  if (!events.length) return <EmptyState title="No workforce activity" description="Attendance, salary, and payroll events will appear here." />;
  return <div className="space-y-1">{events.map((event, index) => { const Icon = event.icon; return <div key={event.key} className="relative flex gap-4 pb-5 last:pb-0">{index < events.length - 1 ? <div className="absolute left-5 top-10 h-[calc(100%-1.5rem)] w-px bg-border" /> : null}<div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary"><Icon className="h-4 w-4" /></div><div className="pt-1"><p className="font-semibold capitalize">{event.title}</p><p className="text-sm text-muted-foreground">{event.detail}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime(event.at)}</p></div></div>; })}</div>;
}
