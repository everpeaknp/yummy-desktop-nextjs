"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Check,
  Clock3,
  Edit3,
  FileClock,
  History,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Shield,
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
  type SalaryHistoryRecord,
  type StaffProfile,
} from "@/lib/staff/workforce";
import { staffCreditApi } from "@/lib/staff/credit";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlement } from "@/hooks/use-subscription";
import { useMobileAppBarTitle } from "@/components/layout/mobile-app-bar-title";
import { AppPage } from "@/components/patterns/page/app-page";
import {
  EmptyState as SharedEmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StaffSalaryCard } from "@/components/staff/staff-salary-card";
import { StaffCreditCard } from "@/components/staff/staff-credit-card";
import { StaffPerformanceCard } from "@/components/staff/staff-performance-card";
import { EntitlementGate } from "@/components/subscription/entitlement-gate";
import {
  StaffEditDialog,
  type StaffEditRole,
  type StaffEditSection,
  type StaffEditValues,
} from "@/components/staff/staff-edit-dialog";
import {
  normalizeStaffDetailSection,
  StaffDesktopSectionNav,
  StaffDetailContent,
  StaffIdentityHeader,
  StaffMobileSectionNav,
  StaffSectionHeading,
  type StaffDetailSection,
} from "@/components/staff/staff-detail-shell";
import { StaffOverviewSection } from "@/components/staff/staff-overview-section";
import { WorkforceSection } from "@/components/workforce/workforce-presentation";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  attendanceApprovalLabel,
  attendanceExceptionLabel,
  attendanceStatusLabel,
} from "@/lib/presentation/workforce";

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
  custom_role_id?: number | null;
};

type RoleOption = {
  id: number | string;
  name: string;
  description?: string | null;
  is_system_role?: boolean;
  permissions?: string[];
};

type EmploymentPeriod = {
  id: number;
  staff_id: number;
  restaurant_id: number;
  started_on: string;
  ended_on?: string | null;
  is_current: boolean;
  end_reason?: string | null;
  created_at: string;
};

type EmploymentHistory = {
  staff_id: number;
  restaurant_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  currently_in_restaurant: boolean;
  can_rehire: boolean;
  rehire_requires_invitation: boolean;
  rehire_blocked_reason?: string | null;
  periods: EmploymentPeriod[];
};

const scopeKeys: ScopeKey[] = ["analytics", "orders", "receipts"];
const scopeLabels: Record<ScopeKey, string> = {
  analytics: "Analytics history",
  orders: "Order history",
  receipts: "Receipt history",
};
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const ROLE_COPY: Record<string, { label: string; description: string }> = {
  admin: {
    label: "Administrator",
    description: "Full business administration and team management.",
  },
  manager: {
    label: "Operations manager",
    description: "Runs day-to-day operations and supervises the team.",
  },
  cashier: {
    label: "Cashier",
    description: "Takes payments and manages the assigned checkout flow.",
  },
  waiter: {
    label: "Service staff",
    description: "Creates and manages guest orders during service.",
  },
  kitchen: {
    label: "Kitchen staff",
    description: "Views and updates kitchen tickets and preparation work.",
  },
  bar: {
    label: "Bar staff",
    description: "Manages bar orders and drink preparation.",
  },
  cafe: {
    label: "Cafe staff",
    description: "Manages cafe service and preparation work.",
  },
  barista: {
    label: "Barista",
    description: "Prepares and manages coffee and cafe orders.",
  },
  accountant: {
    label: "Accountant",
    description: "Reviews finance, records, and accounting reports.",
  },
  accounting_approver: {
    label: "Finance approver",
    description: "Reviews and approves controlled finance actions.",
  },
  staff: {
    label: "Team member",
    description: "Standard staff access based on assigned responsibilities.",
  },
};

function readableRole(role?: string | null) {
  const key = String(role || "staff")
    .trim()
    .toLowerCase();
  return (
    ROLE_COPY[key]?.label ||
    key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function roleDescription(role?: string | null, fallback?: string | null) {
  const key = String(role || "staff")
    .trim()
    .toLowerCase();
  return (
    fallback?.trim() ||
    ROLE_COPY[key]?.description ||
    "Access tailored to this team member's responsibilities."
  );
}

function permissionTitle(permission: any) {
  return (
    permission?.title ||
    String(permission?.key || "Permission")
      .replaceAll(".", " ")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function permissionMode(permissionKey: string) {
  const action = permissionKey.split(".").at(-1)?.toLowerCase() || "";
  return ["view", "read", "list", "history", "export"].includes(action)
    ? "Read"
    : "Manage";
}

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
  return formatCurrency(value);
}

function salaryFrequency(value: string) {
  return value.trim().replaceAll("_", " ").toLowerCase();
}

function minutes(value: number) {
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function dateTime(value?: string | null) {
  return formatDateTime(value);
}

function toDateTimeLocal(value?: string | null) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function dateOnly(value?: string | null) {
  return formatDate(value);
}

export default function StaffWorkspacePage() {
  const params = useParams() as { id?: string | string[] } | null;
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const userId = Number(rawId);
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [employmentHistory, setEmploymentHistory] =
    useState<EmploymentHistory | null>(null);
  const [rehiring, setRehiring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceAvailable, setAttendanceAvailable] = useState(true);
  const [scheduleAvailable, setScheduleAvailable] = useState(true);
  const [leaveAvailable, setLeaveAvailable] = useState(true);

  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([]);
  const [staffEditOpen, setStaffEditOpen] = useState(false);
  const [staffEditSection, setStaffEditSection] =
    useState<StaffEditSection>("profile");
  const [staffEditSaving, setStaffEditSaving] = useState(false);
  const [correctionEntry, setCorrectionEntry] =
    useState<AttendanceEntry | null>(null);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    clockIn: "",
    clockOut: "",
    reason: "",
  });

  const [scopesByKey, setScopesByKey] = useState<
    Partial<Record<ScopeKey, AccessScopeRow>>
  >({});
  const [scopeDrafts, setScopeDrafts] = useState<
    Record<
      ScopeKey,
      { max_lookback_days: string; window_start: string; window_end: string }
    >
  >({
    analytics: { max_lookback_days: "", window_start: "", window_end: "" },
    orders: { max_lookback_days: "", window_start: "", window_end: "" },
    receipts: { max_lookback_days: "", window_start: "", window_end: "" },
  });
  const [scopeBusy, setScopeBusy] = useState<ScopeKey | null>(null);
  const [scopeEditor, setScopeEditor] = useState<ScopeKey | null>(null);

  const currentRole = String(
    currentUser?.primary_role || currentUser?.role || "",
  ).toLowerCase();
  const currentPermissions = useMemo(
    () =>
      new Set<string>(
        (currentUser?.permissions || []).map((item: unknown) =>
          String(item).toLowerCase(),
        ),
      ),
    [currentUser?.permissions],
  );
  const can = useCallback(
    (permission: string) =>
      currentRole === "admin" ||
      currentRole === "superadmin" ||
      currentPermissions.has(permission),
    [currentPermissions, currentRole],
  );
  const attendanceAccess = useEntitlement("attendance.enabled", true);
  const canViewAttendance =
    attendanceAccess.allowed &&
    (can("attendance.view") || can("attendance.manage"));
  const canManageAttendance = attendanceAccess.allowed && can("attendance.manage");
  const canManagePayroll = can("admin.staff.credit.manage");
  const canViewPayroll =
    can("admin.staff.view") || can("admin.staff.credit.manage");
  const canManageStaff = can("admin.staff.manage");
  const allowedSections = useMemo<StaffDetailSection[]>(
    () => [
      "overview",
      ...(canViewAttendance ? (["attendance"] as const) : []),
      ...(canViewPayroll ? (["financials"] as const) : []),
      "performance",
      "employment",
      "access",
      "activity",
    ],
    [canViewAttendance, canViewPayroll],
  );
  const activeSection = normalizeStaffDetailSection(
    searchParams.get("tab"),
    allowedSections,
  );
  const selectSection = useCallback(
    (section: StaffDetailSection) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", section);
      router.replace(`?${nextParams.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const hydrateScopes = useCallback((rows: AccessScopeRow[]) => {
    const next: Record<
      ScopeKey,
      { max_lookback_days: string; window_start: string; window_end: string }
    > = {
      analytics: { max_lookback_days: "", window_start: "", window_end: "" },
      orders: { max_lookback_days: "", window_start: "", window_end: "" },
      receipts: { max_lookback_days: "", window_start: "", window_end: "" },
    };
    const map: Partial<Record<ScopeKey, AccessScopeRow>> = {};
    rows.forEach((row) => {
      map[row.scope_key] = row;
      next[row.scope_key] = {
        max_lookback_days:
          row.max_lookback_days == null ? "" : String(row.max_lookback_days),
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

  const loadWorkspace = useCallback(
    async (quiet = false) => {
      if (!Number.isFinite(userId) || userId <= 0) {
        setLoading(false);
        return;
      }
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const [
          userResponse,
          permissionResponse,
          employmentResponse,
          customRolesResponse,
          builtInRolesResponse,
        ] = await Promise.all([
          apiClient.get(StaffApis.getStaff(userId)),
          apiClient.get(RoleApis.listPermissions).catch(() => null),
          apiClient
            .get(StaffProfileApis.employmentHistory(userId))
            .catch(() => null),
          apiClient.get(RoleApis.listRoles).catch(() => null),
          apiClient.get(RoleApis.listBuiltInRoles).catch(() => null),
        ]);
        const loadedStaff = userResponse.data?.data as StaffUser;
        setStaff(loadedStaff);
        setSelectedPermissions(loadedStaff.permissions || []);
        setAvailablePermissions(permissionResponse?.data?.data || []);
        const rolePayload = (response: any) => {
          const body = response?.data;
          if (Array.isArray(body?.data)) return body.data;
          if (Array.isArray(body?.data?.roles)) return body.data.roles;
          if (Array.isArray(body)) return body;
          if (Array.isArray(body?.roles)) return body.roles;
          if (
            body?.status === "success" &&
            body?.data &&
            typeof body.data === "object"
          ) {
            return Object.entries(body.data).map(([name, permissions]) => ({
              id: `system-${name}`,
              name,
              is_system_role: true,
              permissions: Array.isArray(permissions) ? permissions : [],
            }));
          }
          return [];
        };
        const byName = new Map<string, RoleOption>();
        [
          ...rolePayload(builtInRolesResponse),
          ...rolePayload(customRolesResponse),
        ].forEach((role: RoleOption) => {
          const name = String(role?.name || "").trim();
          if (
            !name ||
            ["superadmin", "super_admin", "platform_staff"].includes(
              name.toLowerCase(),
            )
          )
            return;
          const existing = byName.get(name.toLowerCase());
          if (
            !existing ||
            (String(existing.id).startsWith("system-") &&
              !String(role.id).startsWith("system-"))
          ) {
            byName.set(name.toLowerCase(), { ...role, name });
          }
        });
        Object.keys(ROLE_COPY).forEach((name) => {
          if (!byName.has(name)) {
            byName.set(name, {
              id: `built-in-${name}`,
              name,
              is_system_role: true,
              permissions: [],
            });
          }
        });
        const currentRoleName =
          loadedStaff.primary_role || loadedStaff.role || "staff";
        if (!byName.has(currentRoleName.toLowerCase())) {
          byName.set(currentRoleName.toLowerCase(), {
            id: `legacy-${currentRoleName}`,
            name: currentRoleName,
            is_system_role: true,
            permissions: loadedStaff.permissions || [],
          });
        }
        setAvailableRoles(
          Array.from(byName.values()).sort((left, right) =>
            readableRole(left.name).localeCompare(readableRole(right.name)),
          ),
        );
        setEmploymentHistory(
          (employmentResponse?.data?.data || null) as EmploymentHistory | null,
        );

        const loadedProfile = await staffWorkforceApi.profileByUserId(userId);
        setProfile(loadedProfile);
        if (!loadedProfile) {
          setEntries([]);
          setSchedules([]);
          setLeaves([]);
          setSalaryHistory([]);
          setAttendanceAvailable(false);
          setScheduleAvailable(false);
          setLeaveAvailable(false);
        } else {
          const results = await Promise.allSettled([
            canViewAttendance
              ? attendanceApi.listEntries({
                  dateFrom,
                  dateTo,
                  staffId: loadedProfile.id,
                  limit: 500,
                })
              : Promise.resolve([] as AttendanceEntry[]),
            canViewAttendance
              ? attendanceApi.listSchedules(loadedProfile.id)
              : Promise.resolve([] as AttendanceSchedule[]),
            canViewAttendance
              ? attendanceApi.listShiftTemplates()
              : Promise.resolve([] as AttendanceShiftTemplate[]),
            canViewAttendance
              ? attendanceApi.listLeaves({
                  staffId: loadedProfile.id,
                  dateFrom,
                  dateTo,
                })
              : Promise.resolve([] as AttendanceLeave[]),
            staffWorkforceApi.salaryHistory(loadedProfile.id),
          ]);
          const [
            entryResult,
            scheduleResult,
            templateResult,
            leaveResult,
            salaryResult,
          ] = results;
          setEntries(
            entryResult.status === "fulfilled" ? entryResult.value : [],
          );
          setSchedules(
            scheduleResult.status === "fulfilled" ? scheduleResult.value : [],
          );
          setTemplates(
            templateResult.status === "fulfilled" ? templateResult.value : [],
          );
          setLeaves(
            leaveResult.status === "fulfilled" ? leaveResult.value : [],
          );
          setAttendanceAvailable(
            canViewAttendance && entryResult.status === "fulfilled",
          );
          setScheduleAvailable(
            canViewAttendance && scheduleResult.status === "fulfilled",
          );
          setLeaveAvailable(
            canViewAttendance && leaveResult.status === "fulfilled",
          );
          setSalaryHistory(
            salaryResult.status === "fulfilled" ? salaryResult.value : [],
          );
        }
        await loadScopes();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.detail || "Failed to load staff workspace",
        );
        setStaff(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewAttendance, dateFrom, dateTo, loadScopes, userId],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const totals = useMemo(() => {
    const regular = entries.reduce(
      (sum, item) => sum + Number(item.regular_minutes || 0),
      0,
    );
    const overtime = entries.reduce(
      (sum, item) => sum + Number(item.overtime_minutes || 0),
      0,
    );
    const pending = entries.filter((item) =>
      ["draft", "pending", "needs_correction"].includes(item.approval_status),
    ).length;
    const exceptions = entries.filter((item) =>
      Boolean(item.exception_code),
    ).length;
    return { regular, overtime, pending, exceptions };
  }, [entries]);

  const todayEntry = useMemo(() => {
    const today = isoDate(new Date());
    return (
      entries.find(
        (entry) =>
          entry.clock_in_at.slice(0, 10) === today && entry.status === "open",
      ) ||
      entries.find((entry) => entry.clock_in_at.slice(0, 10) === today) ||
      null
    );
  }, [entries]);
  const pendingLeaveCount = leaves.filter(
    (leave) => leave.status === "pending",
  ).length;

  const canChangeGlobalStatus =
    currentRole === "superadmin" ||
    currentRole === "platform_staff" ||
    currentPermissions.has("platform.staff.manage");

  const staffEditRoles = useMemo<StaffEditRole[]>(
    () =>
      availableRoles.map((role) => ({
        id: role.id,
        name: role.name,
        label: readableRole(role.name),
        description: roleDescription(role.name, role.description),
        permissions: role.permissions || [],
        protected: [
          "admin",
          "administrator",
          "superadmin",
          "super_admin",
          "platform_staff",
        ].includes(role.name.toLowerCase()),
      })),
    [availableRoles],
  );

  const staffEditInitialValues = useMemo<StaffEditValues>(
    () => ({
      name: staff?.name || "",
      email: staff?.email || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
      accountNumber: profile?.account_number || "",
      salaryType: profile?.salary_type || "monthly",
      salaryAmount:
        profile?.salary_amount == null ? "" : String(profile.salary_amount),
      weeklyHours:
        profile?.weekly_hours == null ? "" : String(profile.weekly_hours),
      dailyHours:
        profile?.daily_hours == null ? "" : String(profile.daily_hours),
      effectiveFrom:
        salaryHistory.find((record) => !record.effective_to)?.effective_from ||
        isoDate(new Date()),
      salaryChangeReason: "",
      roleName: staff?.primary_role || staff?.role || "staff",
      isActive: staff?.is_active !== false,
    }),
    [profile, salaryHistory, staff],
  );

  const openStaffEditor = (section: StaffEditSection) => {
    setStaffEditSection(section);
    setStaffEditOpen(true);
  };

  useEffect(() => {
    const requestedSection = searchParams.get("edit");
    if (
      !staff ||
      !canManageStaff ||
      !["profile", "employment", "access"].includes(requestedSection || "")
    ) {
      return;
    }
    setStaffEditSection(requestedSection as StaffEditSection);
    setStaffEditOpen(true);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("edit");
    const query = nextParams.toString();
    router.replace(query ? `?${query}` : `/staff/${userId}`, {
      scroll: false,
    });
  }, [canManageStaff, router, searchParams, staff, userId]);

  const saveStaffEditor = async (values: StaffEditValues) => {
    const name = values.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }

    const selectedRole = availableRoles.find(
      (role) => role.name === values.roleName,
    );
    if (!selectedRole) {
      toast.error("Choose a role for this staff member");
      return;
    }

    const profileWasEdited = Boolean(
      profile ||
      values.accountNumber.trim() ||
      values.salaryAmount ||
      values.phone.trim() ||
      values.address.trim() ||
      values.weeklyHours ||
      values.dailyHours,
    );
    const amount = Number(values.salaryAmount);
    if (
      profileWasEdited &&
      (!values.accountNumber.trim() ||
        !values.salaryAmount ||
        !Number.isFinite(amount) ||
        amount < 0)
    ) {
      toast.error("Payroll account and a valid salary amount are required");
      return;
    }

    const salaryChanged =
      profileWasEdited &&
      (!profile ||
        profile.salary_type !== values.salaryType ||
        Number(profile.salary_amount) !== amount ||
        Number(profile.weekly_hours || 0) !== Number(values.weeklyHours || 0) ||
        Number(profile.daily_hours || 0) !== Number(values.dailyHours || 0));
    if (
      profile &&
      salaryChanged &&
      values.salaryChangeReason.trim().length < 3
    ) {
      toast.error(
        "Explain the salary change so it keeps a useful audit history",
      );
      return;
    }

    setStaffEditSaving(true);
    try {
      const accountPayload: Record<string, unknown> = {};
      if (name !== staff?.name) accountPayload.name = name;

      const currentRoleName = staff?.primary_role || staff?.role || "staff";
      if (values.roleName !== currentRoleName) {
        const customRoleId = Number(selectedRole.id);
        const isCustomRole =
          selectedRole.is_system_role === false &&
          Number.isInteger(customRoleId);
        Object.assign(accountPayload, {
          role: selectedRole.name,
          roles: [selectedRole.name],
          primary_role: selectedRole.name,
          custom_role_id: isCustomRole ? customRoleId : null,
        });
      }
      if (
        canChangeGlobalStatus &&
        values.isActive !== (staff?.is_active !== false)
      ) {
        accountPayload.is_active = values.isActive;
      }
      if (Object.keys(accountPayload).length) {
        await apiClient.patch(StaffApis.update(userId), accountPayload);
      }

      if (profileWasEdited) {
        const profilePayload: Record<string, unknown> = {
          account_number: values.accountNumber.trim(),
          phone: values.phone.trim() || undefined,
          address: values.address.trim() || undefined,
        };
        if (!profile || salaryChanged) {
          Object.assign(profilePayload, {
            salary_type: values.salaryType,
            salary_amount: amount,
            weekly_hours: values.weeklyHours
              ? Number(values.weeklyHours)
              : undefined,
            daily_hours: values.dailyHours
              ? Number(values.dailyHours)
              : undefined,
            salary_effective_from: values.effectiveFrom,
            salary_change_reason:
              values.salaryChangeReason.trim() || "Initial salary",
          });
        }
        if (profile) {
          await apiClient.patch(
            StaffProfileApis.update(profile.id),
            profilePayload,
          );
        } else {
          profilePayload.user_id = userId;
          await apiClient.post(StaffProfileApis.create, profilePayload);
        }
      }

      toast.success("Staff details updated");
      setStaffEditOpen(false);
      await loadWorkspace(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "Failed to update staff details",
      );
    } finally {
      setStaffEditSaving(false);
    }
  };

  const updateDiscountLimit = async (value: number | null) => {
    if (!profile) return;
    await staffCreditApi.updateDiscountLimit(profile.id, value);
    toast.success("Discount limit updated");
    await loadWorkspace(true);
  };

  const updateAttendance = async (
    entry: AttendanceEntry,
    action: "submit" | "approve" | "reject" | "reopen",
  ) => {
    try {
      if (action === "submit")
        await attendanceApi.submitEntry(
          entry.id,
          "Submitted from staff workspace",
        );
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
      toast.error(
        error?.response?.data?.detail || "Failed to update attendance",
      );
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
    if (Number.isNaN(clockIn.getTime()) || Number.isNaN(clockOut.getTime()))
      return toast.error("Enter valid times");
    if (clockOut <= clockIn)
      return toast.error("Clock out must be after clock in");
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
      toast.error(
        typeof detail === "string"
          ? detail
          : detail?.message || "Failed to correct attendance",
      );
    } finally {
      setCorrectionSaving(false);
    }
  };

  const assignedRolePermissions = useMemo(() => {
    const assignedRoleName = String(
      staff?.primary_role || staff?.role || "staff",
    ).toLowerCase();
    return new Set(
      availableRoles.find(
        (role) => role.name.toLowerCase() === assignedRoleName,
      )?.permissions || [],
    );
  }, [availableRoles, staff?.primary_role, staff?.role]);

  const groupedPermissions = useMemo(() => {
    const query = permissionQuery.trim().toLowerCase();
    return availablePermissions
      .filter((permission) => {
        if (!query) return true;
        return [
          permissionTitle(permission),
          permission?.description,
          permission?.module,
          permission?.key,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      })
      .reduce((grouped: Record<string, any[]>, permission: any) => {
        const groupName = String(permission.module || "Other").replaceAll(
          "_",
          " ",
        );
        (grouped[groupName] ||= []).push(permission);
        return grouped;
      }, {});
  }, [availablePermissions, permissionQuery]);

  const savePermissions = async () => {
    setPermissionsSaving(true);
    try {
      await apiClient.post(AuthApis.updateUserPermissions(userId), {
        permission_keys: Array.from(
          new Set([
            ...Array.from(assignedRolePermissions),
            ...selectedPermissions,
          ]),
        ),
      });
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
    const maxDays = draft.max_lookback_days
      ? Number(draft.max_lookback_days)
      : null;
    if (
      maxDays != null &&
      (!Number.isFinite(maxDays) || maxDays < 1 || maxDays > 3650)
    ) {
      toast.error("Lookback must be between 1 and 3650 days");
      return;
    }
    if (
      draft.window_start &&
      draft.window_end &&
      draft.window_start > draft.window_end
    ) {
      toast.error("Scope start cannot be after its end");
      return;
    }
    if (!maxDays && !draft.window_start && !draft.window_end) {
      if (scopesByKey[key]) {
        await removeScope(key);
      } else {
        setScopeEditor(null);
      }
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
      setScopeEditor(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || "Failed to save access scope",
      );
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
      setScopeEditor(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || "Failed to remove access scope",
      );
    } finally {
      setScopeBusy(null);
    }
  };

  const removeStaffMembership = async () => {
    if (
      !window.confirm(
        `Remove ${staff?.name || "this employee"} from this restaurant? Their account stays active, while attendance and payroll history remain here.`,
      )
    )
      return;
    try {
      await apiClient.delete(StaffApis.delete(userId));
      toast.success(
        "Staff membership removed; account and history were preserved",
      );
      router.replace("/staff");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || "Failed to remove staff member",
      );
    }
  };

  const rehireStaff = async () => {
    if (!employmentHistory?.can_rehire) return;
    const startDate = window
      .prompt("Employment start date (YYYY-MM-DD)", isoDate(new Date()))
      ?.trim();
    if (!startDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      toast.error("Use a valid YYYY-MM-DD start date");
      return;
    }
    setRehiring(true);
    try {
      const response = await apiClient.post(
        StaffProfileApis.rehire(employmentHistory.staff_id),
        {
          start_date: startDate,
        },
      );
      setEmploymentHistory(response.data?.data as EmploymentHistory);
      toast.success(
        "Employment period reactivated; previous history remains unchanged",
      );
      await loadWorkspace(true);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || "Unable to rehire this staff member",
      );
    } finally {
      setRehiring(false);
    }
  };

  useMobileAppBarTitle(staff?.name || "Staff");

  if (loading) {
    return (
      <AppPage width="workspace">
        <LoadingState label="Loading staff details" className="min-h-[60vh]" />
      </AppPage>
    );
  }
  if (!staff) {
    return (
      <AppPage width="detail">
        <ErrorState
          title="Staff member unavailable"
          description="This record was not found, is outside your restaurant, or you do not have access to it."
          actionLabel="Back to staff"
          onAction={() => router.push("/staff")}
        />
      </AppPage>
    );
  }

  const configuredRoles =
    staff.roles?.filter((role) => !role.startsWith("__user_")) || [];
  const activeRoles = configuredRoles.length
    ? configuredRoles
    : [staff.primary_role || staff.role || "staff"];
  const primaryRole = readableRole(staff.primary_role || staff.role);
  const overviewNeedsAttention =
    !profile ||
    totals.pending > 0 ||
    (schedules.length === 0 && profile.salary_type !== "hourly");
  const overviewAttention = !profile
    ? {
        title: "Compensation profile required",
        description: "Create a compensation profile for this employee.",
      }
    : totals.pending > 0
      ? {
          title: "Attendance review required",
          description:
            "Resolve draft, pending, or correction-required attendance.",
        }
      : schedules.length === 0 && profile.salary_type !== "hourly"
        ? {
            title: "Work schedule required",
            description: "Assign an effective work schedule.",
          }
        : {
            title: "",
            description: "",
          };
  const activeScopeDraft = scopeEditor ? scopeDrafts[scopeEditor] : null;
  return (
    <AppPage
      width="workspace"
      className="flex flex-col gap-3 pb-20 lg:gap-6 lg:pb-4"
    >
      <StaffIdentityHeader
        name={staff.name}
        active={staff.is_active !== false}
        role={primaryRole}
        reference={staff.email || null}
        canEdit={canManageStaff}
        refreshing={refreshing}
        onEdit={() => openStaffEditor("profile")}
        onRefresh={() => void loadWorkspace(true)}
      />

      <StaffMobileSectionNav
        activeSection={activeSection}
        allowedSections={allowedSections}
        onSectionChange={selectSection}
      />

      <div className="grid min-w-0 gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <StaffDesktopSectionNav
          activeSection={activeSection}
          allowedSections={allowedSections}
          onSectionChange={selectSection}
        />
        <StaffDetailContent>
          {activeSection !== "overview" ? (
            <StaffSectionHeading section={activeSection} />
          ) : null}

          {activeSection === "overview" ? (
            <StaffOverviewSection
              today={[
                ...(attendanceAvailable
                  ? [
                      {
                        icon: Clock3,
                        label: "Attendance",
                        value: todayEntry
                          ? todayEntry.status === "open"
                            ? "Clocked in"
                            : "Attendance completed"
                          : "No attendance record available",
                      },
                      {
                        icon: FileClock,
                        label: "Issues",
                        value: totals.pending
                          ? `${totals.pending} unresolved`
                          : "No issues",
                        attention: totals.pending > 0,
                      },
                    ]
                  : []),
                ...(scheduleAvailable
                  ? [
                      {
                        icon: CalendarClock,
                        label: "Schedule",
                        value: schedules.length
                          ? `${schedules.length} assigned day${schedules.length === 1 ? "" : "s"}`
                          : "No schedule assigned",
                        attention: schedules.length === 0,
                      },
                    ]
                  : []),
                ...(leaveAvailable
                  ? [
                      {
                        icon: CalendarDays,
                        label: "Leave",
                        value: pendingLeaveCount
                          ? `${pendingLeaveCount} pending`
                          : "No leave requests",
                        attention: pendingLeaveCount > 0,
                      },
                    ]
                  : []),
              ]}
              periodLabel={`${dateOnly(dateFrom)} – ${dateOnly(dateTo)}`}
              metrics={
                attendanceAvailable
                  ? [
                      {
                        icon: Clock3,
                        label: "Regular time",
                        value: minutes(totals.regular),
                      },
                      {
                        icon: History,
                        label: "Overtime",
                        value: minutes(totals.overtime),
                      },
                      {
                        icon: AlertTriangle,
                        label: "Exceptions",
                        value: String(totals.exceptions),
                      },
                    ]
                  : []
              }
              employment={[
                { label: "Role", value: primaryRole },
                {
                  label: "Compensation",
                  value: profile
                    ? `${money(profile.salary_amount)} / ${salaryFrequency(profile.salary_type)}`
                    : "Not configured",
                },
              ]}
              needsAttention={overviewNeedsAttention}
              attentionTitle={overviewAttention.title}
              attentionDescription={overviewAttention.description}
              todayUnavailable={!attendanceAvailable}
            />
          ) : null}

          {activeSection === "attendance" && canViewAttendance ? (
            <section className="space-y-5" aria-label="Attendance">
              <WorkforceSection
                title="Period"
                description={`${dateOnly(dateFrom)} – ${dateOnly(dateTo)}`}
                contentClassName="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </div>
                </div>
              </WorkforceSection>
              <WorkforceSection title="Summary">
                {attendanceAvailable ? (
                  <DataList className="rounded-none border-x-0 bg-transparent">
                    <ListRow
                      title="Regular time"
                      trailing={
                        <span className="font-semibold tabular-nums">
                          {minutes(totals.regular)}
                        </span>
                      }
                    />
                    <ListRow
                      title="Overtime"
                      trailing={
                        <span className="font-semibold tabular-nums">
                          {minutes(totals.overtime)}
                        </span>
                      }
                    />
                    <ListRow
                      title="Exceptions"
                      description={
                        totals.pending
                          ? `${totals.pending} record${totals.pending === 1 ? "" : "s"} need review`
                          : undefined
                      }
                      trailing={
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            totals.exceptions > 0 &&
                              "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {totals.exceptions}
                        </span>
                      }
                    />
                  </DataList>
                ) : (
                  <p className="border-y py-3 text-sm text-muted-foreground">
                    Attendance information is unavailable for your access level.
                  </p>
                )}
              </WorkforceSection>
              <div className="space-y-6">
                {attendanceAvailable ? (
                  <WorkforceSection
                    title="Timesheet"
                    description="Attendance records for the selected period."
                  >
                    <AttendanceList
                      entries={entries}
                      canManage={canManageAttendance}
                      onAction={updateAttendance}
                      onCorrect={openAttendanceCorrection}
                    />
                  </WorkforceSection>
                ) : null}
                <div className="space-y-5">
                  <ScheduleCard
                    schedules={schedules}
                    templates={templates}
                    available={scheduleAvailable}
                  />
                  <LeaveCard leaves={leaves} available={leaveAvailable} />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "financials" && canViewPayroll ? (
            <section aria-label="Financials">
              <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] lg:items-start">
                <div className="min-w-0 space-y-7">
                  <WorkforceSection
                    title="Compensation"
                    className="[&>div:first-child]:flex-row [&>div:first-child]:items-center [&>div:first-child]:justify-between"
                    actions={
                      canManageStaff ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openStaffEditor("employment")}
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      ) : null
                    }
                  >
                    {profile ? (
                      <div className="border-y py-4">
                        <p className="text-2xl font-semibold tabular-nums">
                          {money(profile.salary_amount)}
                          <span className="ml-1 text-sm font-normal text-muted-foreground">
                            / {salaryFrequency(profile.salary_type)}
                          </span>
                        </p>
                        <div className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                          <InfoRow
                            label="Weekly hours"
                            value={
                              profile.weekly_hours == null
                                ? "Not set"
                                : String(profile.weekly_hours)
                            }
                          />
                          <InfoRow
                            label="Daily hours"
                            value={
                              profile.daily_hours == null
                                ? "Not set"
                                : String(profile.daily_hours)
                            }
                          />
                          <InfoRow
                            label="Effective from"
                            value={
                              salaryHistory.find(
                                (record) => !record.effective_to,
                              )
                                ? dateOnly(
                                    salaryHistory.find(
                                      (record) => !record.effective_to,
                                    )!.effective_from,
                                  )
                                : "Not recorded"
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <SharedEmptyState
                        title="No compensation profile"
                        description="Create an employment profile before this employee can be paid."
                        actionLabel={
                          canManageStaff ? "Create profile" : undefined
                        }
                        onAction={
                          canManageStaff
                            ? () => openStaffEditor("employment")
                            : undefined
                        }
                        className="min-h-40"
                      />
                    )}
                  </WorkforceSection>
                  {profile ? (
                    <StaffSalaryCard
                      staffId={profile.id}
                      canManage={canManagePayroll}
                      attendanceBasedSalary={
                        profile.attendance_based_salary ?? false
                      }
                      selfDiscountPercent={profile.self_discount_percent}
                      compensationHistory={salaryHistory}
                      onSettingsChanged={() => loadWorkspace(true)}
                    />
                  ) : null}
                </div>
                {profile ? (
                  <div className="min-w-0 lg:sticky lg:top-24">
                    <StaffCreditCard
                      staffId={profile.id}
                      canManage={canManagePayroll}
                      discountLimitAmount={profile.discount_limit_amount}
                      onDiscountLimitChanged={updateDiscountLimit}
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === "performance" ? (
            <section className="space-y-5" aria-label="Performance">
              <EntitlementGate entitlement="staff.performance.enabled" legacyFallback>
                <StaffPerformanceCard userId={userId} />
              </EntitlementGate>
            </section>
          ) : null}

          {activeSection === "employment" ? (
            <section className="space-y-5" aria-label="Employment">
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="border-0 shadow-none">
                  <CardHeader className="flex flex-row items-start justify-between border-b px-0 pb-3 pt-0">
                    <div>
                      <CardTitle>Profile</CardTitle>
                    </div>
                    {canManageStaff ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openStaffEditor("profile")}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="grid gap-4 px-0 pb-0 pt-4 sm:grid-cols-2">
                    <InfoLine
                      icon={UserRound}
                      label="Status"
                      value={staff.is_active === false ? "Inactive" : "Active"}
                    />
                    <InfoLine
                      icon={Mail}
                      label="Email"
                      value={staff.email || "Not set"}
                    />
                    <InfoLine
                      icon={Phone}
                      label="Phone"
                      value={profile?.phone || "Not set"}
                    />
                    <InfoLine
                      icon={MapPin}
                      label="Address"
                      value={profile?.address || "Not set"}
                    />
                    <InfoLine
                      icon={BriefcaseBusiness}
                      label="Primary role"
                      value={staff.primary_role || staff.role || "Staff"}
                    />
                    <InfoLine
                      icon={CalendarDays}
                      label="Joined"
                      value={
                        staff.created_at ? dateOnly(staff.created_at) : "—"
                      }
                    />
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-none">
                  <CardHeader className="flex flex-row items-start justify-between border-b px-0 pb-3 pt-0">
                    <div>
                      <CardTitle>Pay</CardTitle>
                    </div>
                    {canManageStaff ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openStaffEditor("employment")}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        {profile ? "Edit" : "Create"}
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="px-0 pb-0 pt-4">
                    {profile ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoLine
                          icon={Banknote}
                          label="Salary"
                          value={`${money(profile.salary_amount)} / ${profile.salary_type}`}
                        />
                        <InfoLine
                          icon={Clock3}
                          label="Weekly hours"
                          value={
                            profile.weekly_hours == null
                              ? "Not set"
                              : String(profile.weekly_hours)
                          }
                        />
                        <InfoLine
                          icon={Clock3}
                          label="Daily hours"
                          value={
                            profile.daily_hours == null
                              ? "Not set"
                              : String(profile.daily_hours)
                          }
                        />
                      </div>
                    ) : (
                      <SharedEmptyState
                        title="No employment profile"
                        description="Attendance and payroll need a linked staff profile."
                        actionLabel={
                          canManageStaff ? "Create profile" : undefined
                        }
                        onAction={
                          canManageStaff
                            ? () => openStaffEditor("employment")
                            : undefined
                        }
                        className="min-h-40"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
              <Card className="border-0 shadow-none">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b px-0 pb-3 pt-0">
                  <div>
                    <CardTitle className="text-base">Lifecycle</CardTitle>
                    <CardDescription>Employment periods.</CardDescription>
                  </div>
                  {canManageStaff && employmentHistory?.can_rehire ? (
                    <Button
                      size="sm"
                      disabled={rehiring}
                      onClick={() => void rehireStaff()}
                    >
                      {rehiring ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <BriefcaseBusiness className="mr-2 h-4 w-4" />
                      )}
                      Rehire
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3 px-0 pb-0 pt-2">
                  {employmentHistory?.rehire_requires_invitation ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      <p className="font-semibold">
                        Verified invitation required
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        This person is no longer a member. Invite their verified
                        email; approval or acceptance automatically starts a new
                        employment period while keeping every previous period
                        historical.
                      </p>
                    </div>
                  ) : null}
                  {employmentHistory?.rehire_blocked_reason &&
                  !employmentHistory.can_rehire ? (
                    <p className="text-sm text-muted-foreground">
                      {employmentHistory.rehire_blocked_reason}
                    </p>
                  ) : null}
                  {employmentHistory?.periods?.length ? (
                    employmentHistory.periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold">
                            {dateOnly(period.started_on)} to{" "}
                            {period.ended_on
                              ? dateOnly(period.ended_on)
                              : "Present"}
                          </p>
                          {period.end_reason ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {period.end_reason}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant={period.is_current ? "secondary" : "outline"}
                          className="self-start whitespace-nowrap"
                        >
                          {period.is_current ? "Current" : "Historical"}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <SharedEmptyState
                      title="No employment periods"
                      description="A period will be recorded when employment begins."
                      className="min-h-40"
                    />
                  )}
                </CardContent>
              </Card>
              {canManageStaff &&
              !activeRoles.some((role) => role.toLowerCase() === "admin") ? (
                <details className="group border-t pt-1">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold">
                    Restaurant membership
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="border-l-2 border-destructive/60 py-2 pl-4">
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Remove restaurant access without disabling the account or
                      deleting attendance, payroll, or audit history.
                    </p>
                    <Button
                      className="mt-3"
                      variant="destructive"
                      onClick={removeStaffMembership}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Remove from restaurant
                    </Button>
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}

          {activeSection === "access" ? (
            <section className="space-y-5" aria-label="Access">
              <WorkforceSection
                title="Assigned role"
                actions={
                  canManageStaff ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openStaffEditor("access")}
                    >
                      Edit
                    </Button>
                  ) : null
                }
              >
                <DataList className="rounded-none border-x-0 bg-transparent">
                  <ListRow
                    leading={<ShieldCheck className="h-4 w-4" />}
                    title={readableRole(staff.primary_role || staff.role)}
                    description={roleDescription(
                      staff.primary_role || staff.role,
                    )}
                  />
                  <ListRow
                    leading={<Shield className="h-4 w-4" />}
                    title="Permissions"
                    description="Effective access from this role and approved exceptions"
                    trailing={
                      <span className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {staff.permissions?.length || 0}
                        </span>
                        {canManageStaff ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </span>
                    }
                    interactive={canManageStaff}
                    role={canManageStaff ? "button" : undefined}
                    tabIndex={canManageStaff ? 0 : undefined}
                    onClick={() => canManageStaff && setPermissionsOpen(true)}
                    onKeyDown={(event) => {
                      if (
                        canManageStaff &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        setPermissionsOpen(true);
                      }
                    }}
                  />
                </DataList>
              </WorkforceSection>
              <WorkforceSection title="Restrictions">
                <DataList className="rounded-none border-x-0 bg-transparent">
                  {scopeKeys.map((key) => {
                    const scope = scopesByKey[key];
                    const active = Boolean(scopesByKey[key]);
                    return (
                      <ListRow
                        key={key}
                        title={scopeLabels[key]}
                        description={
                          active
                            ? scope?.max_lookback_days
                              ? `Limited to ${scope.max_lookback_days} days`
                              : [scope?.window_start, scope?.window_end]
                                  .filter(Boolean)
                                  .join(" to ")
                            : "No historical limit"
                        }
                        trailing={
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {active
                                ? scope?.max_lookback_days
                                  ? `${scope.max_lookback_days} days`
                                  : "Custom dates"
                                : "Full history"}
                            </span>
                            {canManageStaff ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : null}
                          </span>
                        }
                        interactive={canManageStaff}
                        role={canManageStaff ? "button" : undefined}
                        tabIndex={canManageStaff ? 0 : undefined}
                        onClick={() => canManageStaff && setScopeEditor(key)}
                        onKeyDown={(event) => {
                          if (
                            canManageStaff &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setScopeEditor(key);
                          }
                        }}
                      />
                    );
                  })}
                </DataList>
              </WorkforceSection>
            </section>
          ) : null}

          {activeSection === "activity" ? (
            <section aria-label="Activity">
              <WorkforceSection
                title="Recent activity"
                description="Attendance and compensation changes."
              >
                <ActivityTimeline
                  entries={entries}
                  salaryHistory={salaryHistory}
                />
              </WorkforceSection>
            </section>
          ) : null}
        </StaffDetailContent>
      </div>

      <Dialog
        open={Boolean(scopeEditor)}
        onOpenChange={(open) => !open && setScopeEditor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {scopeEditor ? scopeLabels[scopeEditor] : "Module restriction"}
            </DialogTitle>
            <DialogDescription>
              Limit historical visibility. Leave the restriction removed to
              allow the complete available history.
            </DialogDescription>
          </DialogHeader>
          {scopeEditor && activeScopeDraft ? (
            <div className="space-y-4 py-2">
              <FormField label="History available">
                <Select
                  value={
                    activeScopeDraft.window_start || activeScopeDraft.window_end
                      ? "custom"
                      : ["7", "30", "40", "90", "365"].includes(
                            activeScopeDraft.max_lookback_days,
                          )
                        ? activeScopeDraft.max_lookback_days
                        : activeScopeDraft.max_lookback_days
                          ? "custom"
                          : "full"
                  }
                  onValueChange={(value) =>
                    setScopeDrafts((current) => ({
                      ...current,
                      [scopeEditor]: {
                        max_lookback_days:
                          value === "full"
                            ? ""
                            : value === "custom"
                              ? "custom"
                              : value,
                        window_start: "",
                        window_end: "",
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full history</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="40">40 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="custom">Custom limit</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {activeScopeDraft.window_start ||
              activeScopeDraft.window_end ||
              (activeScopeDraft.max_lookback_days &&
                !["7", "30", "40", "90", "365"].includes(
                  activeScopeDraft.max_lookback_days,
                )) ? (
                <>
                  <FormField label="Custom lookback days">
                    <Input
                      inputMode="numeric"
                      placeholder="For example: 120"
                      value={
                        activeScopeDraft.max_lookback_days === "custom"
                          ? ""
                          : activeScopeDraft.max_lookback_days
                      }
                      onChange={(event) =>
                        setScopeDrafts((current) => ({
                          ...current,
                          [scopeEditor]: {
                            ...current[scopeEditor],
                            max_lookback_days: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Start date">
                      <Input
                        type="date"
                        value={activeScopeDraft.window_start}
                        onChange={(event) =>
                          setScopeDrafts((current) => ({
                            ...current,
                            [scopeEditor]: {
                              ...current[scopeEditor],
                              window_start: event.target.value,
                            },
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="End date">
                      <Input
                        type="date"
                        value={activeScopeDraft.window_end}
                        onChange={(event) =>
                          setScopeDrafts((current) => ({
                            ...current,
                            [scopeEditor]: {
                              ...current[scopeEditor],
                              window_end: event.target.value,
                            },
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            {scopeEditor && scopesByKey[scopeEditor] ? (
              <Button
                type="button"
                variant="outline"
                disabled={scopeBusy === scopeEditor}
                onClick={() => void removeScope(scopeEditor)}
              >
                Remove restriction
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!scopeEditor || scopeBusy === scopeEditor}
              onClick={() => scopeEditor && void saveScope(scopeEditor)}
            >
              {scopeEditor && scopeBusy === scopeEditor ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save restriction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(correctionEntry)}
        onOpenChange={(open) => {
          if (!open && !correctionSaving) setCorrectionEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct attendance time</DialogTitle>
            <DialogDescription>
              The record will return to draft and must be reviewed again before
              payroll.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <FormField label="Clock in">
              <Input
                type="datetime-local"
                value={correctionForm.clockIn}
                onChange={(event) =>
                  setCorrectionForm((current) => ({
                    ...current,
                    clockIn: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Clock out">
              <Input
                type="datetime-local"
                value={correctionForm.clockOut}
                onChange={(event) =>
                  setCorrectionForm((current) => ({
                    ...current,
                    clockOut: event.target.value,
                  }))
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Correction reason">
                <Textarea
                  value={correctionForm.reason}
                  onChange={(event) =>
                    setCorrectionForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="For example: employee forgot to clock out"
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={correctionSaving}
              onClick={() => setCorrectionEntry(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={correctionSaving}
              onClick={saveAttendanceCorrection}
            >
              {correctionSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffEditDialog
        open={staffEditOpen}
        onOpenChange={setStaffEditOpen}
        initialSection={staffEditSection}
        initialValues={staffEditInitialValues}
        roles={staffEditRoles}
        hasEmploymentProfile={Boolean(profile)}
        canChangeGlobalStatus={canChangeGlobalStatus}
        effectivePermissionCount={staff.permissions?.length || 0}
        saving={staffEditSaving}
        onSave={saveStaffEditor}
        onOpenPermissions={() => {
          setStaffEditOpen(false);
          window.setTimeout(() => setPermissionsOpen(true), 0);
        }}
      />

      <Dialog
        open={permissionsOpen}
        onOpenChange={(open) => {
          if (permissionsSaving) return;
          setPermissionsOpen(open);
          if (!open) setPermissionQuery("");
        }}
      >
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden border-0 p-0 sm:rounded-none lg:h-auto lg:max-h-[min(90vh,820px)] lg:max-w-2xl lg:rounded-xl lg:border">
          <DialogHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
            <DialogTitle>Permissions</DialogTitle>
            <DialogDescription>
              Role permissions are inherited. Add direct access only for work
              outside {staff.name}&apos;s assigned role.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 border-b px-5 py-3 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={permissionQuery}
                onChange={(event) => setPermissionQuery(event.target.value)}
                placeholder="Search permissions"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-5 sm:px-6">
            <div className="space-y-7 py-5">
              {Object.keys(groupedPermissions).length ? (
                Object.entries(groupedPermissions).map(
                  ([groupName, permissions]) => (
                    <section key={groupName}>
                      <h3 className="mb-2 text-sm font-semibold capitalize">
                        {groupName}
                      </h3>
                      <div className="divide-y border-y">
                        {permissions.map((permission: any) => {
                          const inherited = assignedRolePermissions.has(
                            permission.key,
                          );
                          const checked =
                            inherited ||
                            selectedPermissions.includes(permission.key);
                          return (
                            <label
                              key={permission.key}
                              className="flex min-h-14 items-start gap-3 py-3"
                            >
                              <Checkbox
                                className="mt-0.5"
                                checked={checked}
                                disabled={inherited}
                                onCheckedChange={(nextChecked) =>
                                  setSelectedPermissions((current) =>
                                    nextChecked
                                      ? Array.from(
                                          new Set([...current, permission.key]),
                                        )
                                      : current.filter(
                                          (item) => item !== permission.key,
                                        ),
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {permissionTitle(permission)}
                                  </span>
                                  <Badge variant="outline">
                                    {permissionMode(permission.key)}
                                  </Badge>
                                  <Badge
                                    variant={
                                      inherited ? "secondary" : "outline"
                                    }
                                  >
                                    {inherited ? "Inherited" : "Direct"}
                                  </Badge>
                                </span>
                                {permission.description ? (
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {permission.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ),
                )
              ) : (
                <SharedEmptyState
                  title="No permissions found"
                  description="Try a different permission or module name."
                  className="min-h-48"
                />
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              disabled={permissionsSaving}
              onClick={() => setPermissionsOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={savePermissions} disabled={permissionsSaving}>
              {permissionsSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save direct access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AttendanceList({
  entries,
  canManage,
  onAction,
  onCorrect,
  compact = false,
}: {
  entries: AttendanceEntry[];
  canManage: boolean;
  onAction: (
    entry: AttendanceEntry,
    action: "submit" | "approve" | "reject" | "reopen",
  ) => void;
  onCorrect: (entry: AttendanceEntry) => void;
  compact?: boolean;
}) {
  if (!entries.length)
    return (
      <p className="border-y py-4 text-sm text-muted-foreground">
        No attendance records for this period.
      </p>
    );
  return (
    <div className="divide-y border-y">
      {entries.map((entry) => (
        <div key={entry.id} className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{dateTime(entry.clock_in_at)}</p>
                <Badge
                  variant={
                    entry.status === "complete" || entry.status === "adjusted"
                      ? "outline"
                      : "secondary"
                  }
                >
                  {attendanceStatusLabel(entry.status)}
                </Badge>
                <Badge
                  variant={
                    entry.approval_status === "approved" ||
                    entry.approval_status === "payroll_exported"
                      ? "default"
                      : "secondary"
                  }
                >
                  {attendanceApprovalLabel(entry.approval_status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Out {dateTime(entry.clock_out_at)} •{" "}
                {minutes(entry.regular_minutes)} regular •{" "}
                {minutes(entry.overtime_minutes)} overtime
                {entry.exception_code
                  ? ` • ${attendanceExceptionLabel(entry.exception_code)}`
                  : ""}
              </p>
            </div>
            {canManage && !compact ? (
              <div className="flex shrink-0 flex-wrap gap-1">
                {entry.approval_status !== "payroll_exported" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCorrect(entry)}
                  >
                    <Edit3 className="mr-1 h-3.5 w-3.5" />
                    Correct
                  </Button>
                ) : null}
                {entry.approval_status === "draft" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction(entry, "submit")}
                  >
                    <FileClock className="mr-1 h-3.5 w-3.5" />
                    Submit
                  </Button>
                ) : null}
                {entry.approval_status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onAction(entry, "approve")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction(entry, "reject")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </>
                ) : null}
                {["rejected", "needs_correction"].includes(
                  entry.approval_status,
                ) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAction(entry, "reopen")}
                  >
                    Reopen only
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleCard({
  schedules,
  templates,
  available,
}: {
  schedules: AttendanceSchedule[];
  templates: AttendanceShiftTemplate[];
  available: boolean;
}) {
  return (
    <WorkforceSection
      title="Assigned schedule"
      description="Staff overrides and effective dates."
      contentClassName="divide-y border-y"
    >
      {!available ? (
        <p className="py-4 text-sm text-muted-foreground">
          Schedule data is unavailable.
        </p>
      ) : schedules.length ? (
        schedules.map((schedule) => {
          const template = templates.find(
            (item) => item.id === schedule.shift_template_id,
          );
          return (
            <div
              key={schedule.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {weekdays[schedule.weekday] || `Day ${schedule.weekday}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {schedule.is_day_off
                    ? "Day off"
                    : template
                      ? `${template.name} • ${template.start_local_time.slice(0, 5)}–${template.end_local_time.slice(0, 5)}`
                      : `Shift #${schedule.shift_template_id || "—"}`}
                </p>
              </div>
              <Badge variant="outline">
                {dateOnly(schedule.effective_from)}
              </Badge>
            </div>
          );
        })
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          No staff-specific schedule.
        </p>
      )}
    </WorkforceSection>
  );
}

function LeaveCard({
  leaves,
  available,
}: {
  leaves: AttendanceLeave[];
  available: boolean;
}) {
  return (
    <WorkforceSection
      title="Leave"
      description="Paid and unpaid requests in this period."
      contentClassName="divide-y border-y"
    >
      {!available ? (
        <p className="py-4 text-sm text-muted-foreground">
          Leave data is unavailable.
        </p>
      ) : leaves.length ? (
        leaves.map((leave) => (
          <div key={leave.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium capitalize">{leave.leave_type} leave</p>
              <Badge
                variant={leave.status === "approved" ? "default" : "secondary"}
              >
                {leave.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dateOnly(leave.date_from)} to {dateOnly(leave.date_to)} •{" "}
              {leave.day_fraction === 0.5 ? "Half day" : "Full day"}
            </p>
            <p className="mt-1 text-sm">{leave.reason}</p>
          </div>
        ))
      ) : (
        <p className="py-4 text-sm text-muted-foreground">No leave records.</p>
      )}
    </WorkforceSection>
  );
}

function ActivityTimeline({
  entries,
  salaryHistory,
}: {
  entries: AttendanceEntry[];
  salaryHistory: SalaryHistoryRecord[];
}) {
  const events = [
    ...entries.map((entry) => ({
      key: `attendance-${entry.id}`,
      at: entry.updated_at || entry.clock_in_at,
      icon: Clock3,
      title: `Attendance ${attendanceApprovalLabel(entry.approval_status)}`,
      detail: `${dateTime(entry.clock_in_at)} • ${minutes(entry.regular_minutes)} regular`,
    })),
    ...salaryHistory.map((record) => ({
      key: `salary-${record.id}`,
      at: record.created_at || record.effective_from,
      icon: WalletCards,
      title: `Salary ${money(record.salary_amount)} / ${record.salary_type}`,
      detail: `Effective ${dateOnly(record.effective_from)}${record.reason ? ` • ${record.reason}` : ""}`,
    })),
  ]
    .sort(
      (left, right) =>
        new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime(),
    )
    .slice(0, 30);
  if (!events.length)
    return (
      <SharedEmptyState
        title="No activity yet"
        description="Attendance and compensation changes will appear here."
        className="min-h-0 py-6"
      />
    );
  if (events.length < 3) {
    return (
      <DataList className="rounded-none border-x-0 bg-transparent">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <ListRow
              key={event.key}
              leading={<Icon className="h-4 w-4" />}
              title={event.title}
              description={event.detail}
              trailing={
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateOnly(event.at)}
                </span>
              }
            />
          );
        })}
      </DataList>
    );
  }
  return (
    <div className="space-y-1">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={event.key} className="relative flex gap-4 pb-5 last:pb-0">
            {index < events.length - 1 ? (
              <div className="absolute left-5 top-10 h-[calc(100%-1.5rem)] w-px bg-border" />
            ) : null}
            <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="pt-1">
              <p className="font-semibold capitalize">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateTime(event.at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
