"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  Download,
  Fingerprint,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import { attendanceApi } from "@/lib/attendance/api";
import type {
  AttendanceDevice,
  AttendanceEntry,
  AttendanceMobileDevice,
  AttendanceOverview,
  AttendanceQrSession,
  AttendanceSchedule,
  AttendanceSettings,
  AttendanceShiftTemplate,
  StaffDeviceMapping,
} from "@/lib/attendance/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttendancePolicyMap } from "./attendance-policy-map";
import { attendanceRadiusLabel } from "./attendance-policy";

type StaffProfile = { id: number; user_id: number; account_number?: string };
type StaffUser = { id: number; name?: string; full_name?: string; email?: string };
type AttendanceSettingsForm = {
  timezone: string;
  geofence_radius_meters: string;
  required_location_accuracy_meters: string;
  mobile_clocking_enabled: boolean;
  device_clocking_enabled: boolean;
};

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function isOpenEntry(entry: AttendanceEntry) {
  return entry.status === "open" || !entry.clock_out_at;
}

function mergeEntriesWithOpenCarryover(selectedEntries: AttendanceEntry[], recentEntries: AttendanceEntry[]) {
  const merged = new Map<number, AttendanceEntry>();
  for (const entry of selectedEntries) merged.set(entry.id, entry);
  for (const entry of recentEntries) {
    if (isOpenEntry(entry)) merged.set(entry.id, entry);
  }
  return Array.from(merged.values()).sort((a, b) => {
    const left = new Date(a.clock_in_at).getTime();
    const right = new Date(b.clock_in_at).getTime();
    return right - left;
  });
}

function settingsToForm(settings: AttendanceSettings): AttendanceSettingsForm {
  return {
    timezone: settings.timezone || "Asia/Kathmandu",
    geofence_radius_meters: String(settings.geofence_radius_meters || 150),
    required_location_accuracy_meters: String(settings.required_location_accuracy_meters || 100),
    mobile_clocking_enabled: settings.mobile_clocking_enabled,
    device_clocking_enabled: settings.device_clocking_enabled,
  };
}

const deviceTypeLabels: Record<AttendanceDevice["device_type"], string> = {
  zkteco_lan: "ZKTeco LAN",
  zkteco_cloud: "ZKTeco cloud",
  generic_import: "Generic import",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function minutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return String(hours) + "h " + String(rest).padStart(2, "0") + "m";
}

function errorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { message?: string; detail?: string | { message?: string } } }; message?: string };
  const detail = candidate.response?.data?.detail;
  return (
    candidate.response?.data?.message ||
    (typeof detail === "string" ? detail : detail?.message) ||
    candidate.message ||
    fallback
  );
}

function isBiometricAddonError(error: unknown) {
  const candidate = error as { response?: { data?: { message?: string; errors?: Array<{ code?: string; message?: string }> } } };
  const data = candidate.response?.data;
  return Boolean(
    data?.errors?.some((item) => item.code === "ATTENDANCE_BIOMETRIC_REQUIRED") ||
      data?.message?.includes("Biometric-device attendance is not enabled"),
  );
}

function staffLabel(profile: StaffProfile | undefined, usersById: Map<number, StaffUser>) {
  if (!profile) return "Unknown staff";
  const user = usersById.get(profile.user_id);
  return user?.name || user?.full_name || user?.email || profile.account_number || "Staff #" + profile.id;
}

export function AttendanceAdminClient() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [templates, setTemplates] = useState<AttendanceShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [mappings, setMappings] = useState<StaffDeviceMapping[]>([]);
  const [mobileDevices, setMobileDevices] = useState<AttendanceMobileDevice[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [biometricUnavailable, setBiometricUnavailable] = useState(false);
  const [qrSession, setQrSession] = useState<AttendanceQrSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [stationLabel, setStationLabel] = useState("Restaurant attendance");
  const [ttlSeconds, setTtlSeconds] = useState("60");
  const [pairingCode, setPairingCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [deviceForm, setDeviceForm] = useState({ name: "", serial_number: "", ip_address: "", port: "4370", timezone: "Asia/Kathmandu" });
  const [mappingForm, setMappingForm] = useState({ device_id: "", staff_id: "", device_user_id: "" });
  const [templateForm, setTemplateForm] = useState({ name: "", start_local_time: "09:00", end_local_time: "17:00", unpaid_break_minutes: "30" });
  const [scheduleForm, setScheduleForm] = useState({ staff_id: "default", shift_template_id: "", weekday: "1", effective_from: todayIso() });
  const [busy, setBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettingsForm>({
    timezone: "Asia/Kathmandu",
    geofence_radius_meters: "150",
    required_location_accuracy_meters: "100",
    mobile_clocking_enabled: true,
    device_clocking_enabled: true,
  });

  const usersById = useMemo(() => new Map(staffUsers.map((user) => [user.id, user])), [staffUsers]);
  const devicesById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const activeEntries = useMemo(() => entries.filter(isOpenEntry), [entries]);

  const qrPayload = useMemo(() => {
    if (!qrSession?.token) return "";
    return "yummy-attendance://clock?token=" + encodeURIComponent(qrSession.token);
  }, [qrSession?.token]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const biometricData = Promise.all([
        attendanceApi.listDevices(),
        attendanceApi.listDeviceMappings(),
      ])
        .then(([deviceData, mappingData]) => ({ deviceData, mappingData, unavailable: false }))
        .catch((error) => {
          if (isBiometricAddonError(error)) {
            return { deviceData: [] as AttendanceDevice[], mappingData: [] as StaffDeviceMapping[], unavailable: true };
          }
          throw error;
        });

      const [settingsData, overviewData, selectedEntryData, recentEntryData, templateData, scheduleData, biometric, mobileData, profilesRes, usersRes] = await Promise.all([
        attendanceApi.getSettings(),
        attendanceApi.overview(dateFrom, dateTo),
        attendanceApi.listEntries({ dateFrom, dateTo, limit: 300 }),
        attendanceApi.listEntries({ limit: 300 }),
        attendanceApi.listShiftTemplates(),
        attendanceApi.listSchedules(),
        biometricData,
        attendanceApi.listMobileDevices(),
        apiClient.get(StaffProfileApis.list({ limit: 500 })),
        apiClient.get(StaffApis.list()),
      ]);
      setSettings(settingsData);
      setSettingsForm(settingsToForm(settingsData));
      setOverview(overviewData);
      setEntries(mergeEntriesWithOpenCarryover(selectedEntryData, recentEntryData));
      setTemplates(templateData);
      setSchedules(scheduleData);
      setDevices(biometric.deviceData);
      setMappings(biometric.mappingData);
      setBiometricUnavailable(biometric.unavailable);
      setMobileDevices(mobileData);
      setStaffProfiles(profilesRes.data?.data || []);
      setStaffUsers(usersRes.data?.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load attendance"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(qrPayload, { margin: 2, width: 520, color: { dark: "#111827", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => toast.error("Failed to render attendance QR"));
  }, [qrPayload]);

  async function createQrSession() {
    setBusy(true);
    try {
      const ttl = Math.min(300, Math.max(15, Number.parseInt(ttlSeconds, 10) || 60));
      const session = await attendanceApi.createQrSession({ station_label: stationLabel.trim(), ttl_seconds: ttl });
      setQrSession(session);
      toast.success("Attendance QR generated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to generate QR"));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      const updated = await attendanceApi.updateSettings({
        timezone: settingsForm.timezone.trim() || "Asia/Kathmandu",
        geofence_radius_meters: Number.parseInt(settingsForm.geofence_radius_meters, 10) || 150,
        required_location_accuracy_meters: Number.parseInt(settingsForm.required_location_accuracy_meters, 10) || 100,
        mobile_clocking_enabled: settingsForm.mobile_clocking_enabled,
        device_clocking_enabled: settingsForm.device_clocking_enabled,
      });
      setSettings(updated);
      setSettingsForm(settingsToForm(updated));
      toast.success("Attendance settings saved");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save attendance settings"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  }

  async function submitEntry(entry: AttendanceEntry) {
    setBusy(true);
    try {
      await attendanceApi.submitEntry(entry.id, "Submitted from web");
      await loadAll();
      toast.success("Attendance submitted");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to submit attendance"));
    } finally {
      setBusy(false);
    }
  }

  async function approveEntry(entry: AttendanceEntry) {
    const approved = Number.parseInt(window.prompt("Approved overtime minutes", String(entry.overtime_minutes || 0)) || "", 10);
    if (Number.isNaN(approved) || approved < 0 || approved > entry.overtime_minutes) return;
    const rejected = entry.overtime_minutes - approved;
    setBusy(true);
    try {
      await attendanceApi.approveEntry(entry.id, { approved_overtime_minutes: approved, rejected_overtime_minutes: rejected, reason: "Approved from web" });
      await loadAll();
      toast.success("Attendance approved");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to approve attendance"));
    } finally {
      setBusy(false);
    }
  }

  async function rejectEntry(entry: AttendanceEntry) {
    const reason = window.prompt("Rejection reason");
    if (!reason) return;
    setBusy(true);
    try {
      await attendanceApi.rejectEntry(entry.id, reason);
      await loadAll();
      toast.success("Attendance rejected");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to reject attendance"));
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate() {
    if (!templateForm.name.trim()) return toast.error("Shift name is required");
    setBusy(true);
    try {
      await attendanceApi.createShiftTemplate({
        name: templateForm.name.trim(),
        start_local_time: templateForm.start_local_time,
        end_local_time: templateForm.end_local_time,
        unpaid_break_minutes: Number.parseInt(templateForm.unpaid_break_minutes, 10) || 0,
        is_active: true,
      });
      setTemplateForm((current) => ({ ...current, name: "" }));
      await loadAll();
      toast.success("Shift template created");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create shift"));
    } finally {
      setBusy(false);
    }
  }

  async function createSchedule() {
    if (!scheduleForm.shift_template_id) return toast.error("Select a shift template");
    setBusy(true);
    try {
      await attendanceApi.createSchedule({
        staff_id: scheduleForm.staff_id === "default" ? null : Number(scheduleForm.staff_id),
        shift_template_id: Number(scheduleForm.shift_template_id),
        weekday: Number(scheduleForm.weekday),
        effective_from: scheduleForm.effective_from,
        is_day_off: false,
      });
      await loadAll();
      toast.success("Schedule saved");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save schedule"));
    } finally {
      setBusy(false);
    }
  }

  async function createDevice() {
    if (!deviceForm.name.trim() || !deviceForm.serial_number.trim()) return toast.error("Device name and serial are required");
    setBusy(true);
    try {
      await attendanceApi.createDevice({
        name: deviceForm.name.trim(),
        device_type: "zkteco_lan",
        serial_number: deviceForm.serial_number.trim(),
        ip_address: deviceForm.ip_address.trim() || null,
        port: Number.parseInt(deviceForm.port, 10) || 4370,
        timezone: deviceForm.timezone.trim() || "UTC",
        is_active: true,
      });
      setDeviceForm((current) => ({ ...current, name: "", serial_number: "" }));
      await loadAll();
      toast.success("Device registered");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to register device"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDevice(device: AttendanceDevice, checked: boolean) {
    setDevices((current) => current.map((item) => (item.id === device.id ? { ...item, is_active: checked } : item)));
    try {
      await attendanceApi.updateDevice(device.id, { is_active: checked });
      toast.success("Device updated");
    } catch (error) {
      setDevices((current) => current.map((item) => (item.id === device.id ? { ...item, is_active: device.is_active } : item)));
      toast.error(errorMessage(error, "Failed to update device"));
    }
  }

  async function saveMapping() {
    const deviceId = Number(mappingForm.device_id);
    const staffId = Number(mappingForm.staff_id);
    if (!deviceId || !staffId || !mappingForm.device_user_id.trim()) return toast.error("Device, staff, and device user ID are required");
    setBusy(true);
    try {
      await attendanceApi.upsertDeviceMapping({ device_id: deviceId, staff_id: staffId, device_user_id: mappingForm.device_user_id.trim(), is_active: true });
      setMappingForm((current) => ({ ...current, staff_id: "", device_user_id: "" }));
      await loadAll();
      toast.success("Mapping saved");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save mapping"));
    } finally {
      setBusy(false);
    }
  }

  async function createPairingCode(deviceId: number) {
    setBusy(true);
    try {
      const result = await attendanceApi.createConnectorPairingCode({ device_id: deviceId, ttl_seconds: 600 });
      setPairingCode({ code: result.code, expires_at: result.expires_at });
      toast.success("Connector pairing code created");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create pairing code"));
    } finally {
      setBusy(false);
    }
  }

  async function decideMobile(device: AttendanceMobileDevice, action: "approve" | "reject" | "revoke") {
    const reason = action === "approve" ? undefined : window.prompt("Reason") || undefined;
    if (action !== "approve" && !reason) return;
    setBusy(true);
    try {
      await attendanceApi.decideMobileDevice(device.id, action, reason);
      await loadAll();
      toast.success("Mobile device updated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update mobile device"));
    } finally {
      setBusy(false);
    }
  }

  const metricCards = [
    ["Total entries", overview?.total_entries || 0],
    ["Active now", activeEntries.length],
    ["Pending", overview?.pending_entries || 0],
    ["Approved", overview?.approved_entries || 0],
    ["Regular", minutesLabel(overview?.regular_minutes || 0)],
    ["Overtime", minutesLabel(overview?.overtime_minutes || 0)],
    ["Breaks", minutesLabel(overview?.break_minutes || 0)],
  ];
  const radiusMeters = Math.min(
    5000,
    Math.max(10, Number.parseInt(settingsForm.geofence_radius_meters, 10) || 150),
  );
  const showDateFilters = activeTab === "overview" || activeTab === "timesheets";

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-5 overflow-x-hidden p-4 pb-24 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Staff presence, payable time, schedules, kiosk, and attendance devices.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showDateFilters ? <>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 sm:w-[160px]" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 sm:w-[160px]" />
          </> : null}
          <Button variant="outline" onClick={loadAll} disabled={loading || busy}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="overview" className="min-w-max gap-2"><CalendarDays className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="timesheets" className="min-w-max gap-2"><Check className="h-4 w-4" />Timesheets</TabsTrigger>
          <TabsTrigger value="schedules" className="min-w-max gap-2"><CalendarDays className="h-4 w-4" />Schedule</TabsTrigger>
          <TabsTrigger value="qr" className="min-w-max gap-2"><QrCode className="h-4 w-4" />QR Kiosk</TabsTrigger>
          <TabsTrigger value="devices" className="min-w-max gap-2"><Fingerprint className="h-4 w-4" />Devices</TabsTrigger>
          <TabsTrigger value="settings" className="min-w-max gap-2"><MapPin className="h-4 w-4" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
            {metricCards.map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-black">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Active Now</CardTitle>
              <CardDescription>Staff currently clocked in, including entries that started before this date range.</CardDescription>
            </CardHeader>
            <CardContent>
              <TimesheetTable entries={activeEntries} staffProfiles={staffProfiles} usersById={usersById} onSubmit={submitEntry} onApprove={approveEntry} onReject={rejectEntry} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Exceptions</CardTitle>
              <CardDescription>Entries that need manager attention before payroll.</CardDescription>
            </CardHeader>
            <CardContent>
              <TimesheetTable entries={entries.filter((entry) => entry.exception_code || entry.approval_status === "pending" || entry.approval_status === "needs_correction")} staffProfiles={staffProfiles} usersById={usersById} onSubmit={submitEntry} onApprove={approveEntry} onReject={rejectEntry} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets">
          <Card>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Timesheets</CardTitle>
                <CardDescription>Approve payable hours before payroll snapshot. Open entries stay visible even when they started earlier.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => window.open(attendanceApi.exportCsvUrl(dateFrom, dateTo), "_blank")}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <TimesheetTable entries={entries} staffProfiles={staffProfiles} usersById={usersById} onSubmit={submitEntry} onApprove={approveEntry} onReject={rejectEntry} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Restaurant Geofence</CardTitle>
              <CardDescription>The restaurant profile owns the location. Attendance controls only the allowed range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttendancePolicyMap
                latitude={settings?.latitude ?? null}
                longitude={settings?.longitude ?? null}
                radiusMeters={radiusMeters}
                onEditRestaurantLocation={() => window.location.assign("/manage/profile")}
              />
              {settings?.latitude != null && settings?.longitude != null ? (
                <div className="flex justify-end">
                  <Button asChild type="button" variant="ghost" size="sm">
                    <Link href="/manage/profile"><MapPin className="mr-2 h-4 w-4" />Edit restaurant location</Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Attendance Policy</CardTitle>
              <CardDescription>Validation rules for mobile and physical attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Attendance radius</Label>
                  <span className="text-sm font-semibold">{radiusMeters} m</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{attendanceRadiusLabel(radiusMeters)}</p>
                <Slider
                  className="mt-4"
                  min={10}
                  max={5000}
                  step={10}
                  value={[radiusMeters]}
                  onValueChange={([value]) => setSettingsForm((current) => ({ ...current, geofence_radius_meters: String(value) }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Radius meters">
                  <Input type="number" min={10} max={5000} value={settingsForm.geofence_radius_meters} onChange={(event) => setSettingsForm((current) => ({ ...current, geofence_radius_meters: event.target.value }))} />
                </Field>
                <Field label="Required GPS accuracy">
                  <Input type="number" min={1} max={1000} value={settingsForm.required_location_accuracy_meters} onChange={(event) => setSettingsForm((current) => ({ ...current, required_location_accuracy_meters: event.target.value }))} />
                </Field>
              </div>
              <div className="divide-y rounded-lg border">
                <div className="flex items-center justify-between gap-3">
                  <div className="p-3">
                    <Label>Mobile clocking</Label>
                    <p className="text-xs text-muted-foreground">Approved phones inside the attendance radius.</p>
                  </div>
                  <Switch className="mr-3" checked={settingsForm.mobile_clocking_enabled} onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, mobile_clocking_enabled: checked }))} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="p-3">
                    <Label>Biometric devices</Label>
                    <p className="text-xs text-muted-foreground">Registered physical attendance devices.</p>
                  </div>
                  <Switch className="mr-3" checked={settingsForm.device_clocking_enabled} onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, device_clocking_enabled: checked }))} />
                </div>
              </div>
              <Field label="Timezone">
                <Input value={settingsForm.timezone} onChange={(event) => setSettingsForm((current) => ({ ...current, timezone: event.target.value }))} />
              </Field>
              <Button onClick={saveSettings} disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save attendance policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Shift Template</CardTitle>
                <CardDescription>Reusable shift hours for staff schedules.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Name"><Input value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Morning shift" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start"><Input type="time" value={templateForm.start_local_time} onChange={(event) => setTemplateForm((current) => ({ ...current, start_local_time: event.target.value }))} /></Field>
                  <Field label="End"><Input type="time" value={templateForm.end_local_time} onChange={(event) => setTemplateForm((current) => ({ ...current, end_local_time: event.target.value }))} /></Field>
                </div>
                <Field label="Unpaid break minutes"><Input type="number" value={templateForm.unpaid_break_minutes} onChange={(event) => setTemplateForm((current) => ({ ...current, unpaid_break_minutes: event.target.value }))} /></Field>
                <Button onClick={createTemplate} disabled={busy} className="w-full"><Plus className="mr-2 h-4 w-4" />Create template</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Schedule Rule</CardTitle>
                <CardDescription>Assign default weekly shifts or staff overrides.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Staff">
                  <Select value={scheduleForm.staff_id} onValueChange={(value) => setScheduleForm((current) => ({ ...current, staff_id: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Restaurant default</SelectItem>
                      {staffProfiles.map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{staffLabel(profile, usersById)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Template">
                  <Select value={scheduleForm.shift_template_id} onValueChange={(value) => setScheduleForm((current) => ({ ...current, shift_template_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                    <SelectContent>{templates.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Weekday"><Input type="number" min={0} max={6} value={scheduleForm.weekday} onChange={(event) => setScheduleForm((current) => ({ ...current, weekday: event.target.value }))} /></Field>
                  <Field label="Effective from"><Input type="date" value={scheduleForm.effective_from} onChange={(event) => setScheduleForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field>
                </div>
                <Button onClick={createSchedule} disabled={busy || templates.length === 0} className="w-full"><Plus className="mr-2 h-4 w-4" />Save schedule</Button>
              </CardContent>
            </Card>
          </div>
          <ScheduleTable schedules={schedules} templates={templates} staffProfiles={staffProfiles} usersById={usersById} />
        </TabsContent>

        <TabsContent value="qr" className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Generate QR Session</CardTitle>
              <CardDescription>Staff scan this QR from the mobile app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Station label"><Input value={stationLabel} onChange={(event) => setStationLabel(event.target.value)} /></Field>
              <Field label="Expiry seconds"><Input type="number" min={15} max={300} value={ttlSeconds} onChange={(event) => setTtlSeconds(event.target.value)} /></Field>
              <Button onClick={createQrSession} disabled={busy} className="w-full"><RefreshCw className="mr-2 h-4 w-4" />{qrSession ? "Refresh QR" : "Generate QR"}</Button>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Restaurant Attendance QR</CardTitle>
              <CardDescription>Web only displays the QR. Clock-in stays on approved mobile devices.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-3 sm:min-h-[430px]">
                {qrDataUrl ? <Image src={qrDataUrl} width={420} height={420} alt="Attendance QR code" unoptimized className="h-[min(420px,78vw)] w-[min(420px,78vw)] rounded bg-white p-2" /> : <div className="text-center text-muted-foreground"><QrCode className="mx-auto mb-3 h-12 w-12" /><p className="text-sm font-medium">Generate a QR session to display it here.</p></div>}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <InfoLine label="Station" value={qrSession?.station_label || stationLabel} />
                <InfoLine label="Expires" value={formatDateTime(qrSession?.expires_at)} />
                <div className="min-w-0 rounded-md border bg-muted/40 p-3 lg:col-span-2">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-muted-foreground">QR payload</p>
                      <p className="max-h-20 overflow-auto break-all font-mono text-xs text-muted-foreground">{qrPayload || "Not generated"}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(qrPayload, "QR payload copied")} disabled={!qrPayload} className="shrink-0"><Copy className="mr-2 h-4 w-4" />Copy</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-5">
          <MobileDeviceTable devices={mobileDevices} staffProfiles={staffProfiles} usersById={usersById} onDecide={decideMobile} />
          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Register ZKTeco Device</CardTitle><CardDescription>Add the physical device identity.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Device name"><Input value={deviceForm.name} onChange={(event) => setDeviceForm((current) => ({ ...current, name: event.target.value }))} placeholder="Main entrance scanner" /></Field>
                <Field label="Serial number"><Input value={deviceForm.serial_number} onChange={(event) => setDeviceForm((current) => ({ ...current, serial_number: event.target.value }))} /></Field>
                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                  <Field label="IP address"><Input value={deviceForm.ip_address} onChange={(event) => setDeviceForm((current) => ({ ...current, ip_address: event.target.value }))} placeholder="192.168.1.50" /></Field>
                  <Field label="Port"><Input type="number" value={deviceForm.port} onChange={(event) => setDeviceForm((current) => ({ ...current, port: event.target.value }))} /></Field>
                </div>
                <Field label="Timezone"><Input value={deviceForm.timezone} onChange={(event) => setDeviceForm((current) => ({ ...current, timezone: event.target.value }))} /></Field>
                <Button onClick={createDevice} disabled={busy} className="w-full"><Plus className="mr-2 h-4 w-4" />Register device</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Map Staff User</CardTitle><CardDescription>Link biometric device users to staff profiles.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Device">
                  <Select value={mappingForm.device_id} onValueChange={(value) => setMappingForm((current) => ({ ...current, device_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                    <SelectContent>{devices.map((device) => <SelectItem key={device.id} value={String(device.id)}>{device.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Staff">
                  <Select value={mappingForm.staff_id} onValueChange={(value) => setMappingForm((current) => ({ ...current, staff_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staffProfiles.map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{staffLabel(profile, usersById)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Device user ID"><Input value={mappingForm.device_user_id} onChange={(event) => setMappingForm((current) => ({ ...current, device_user_id: event.target.value }))} /></Field>
                <Button variant="outline" onClick={saveMapping} disabled={busy || !devices.length || !staffProfiles.length} className="w-full"><Fingerprint className="mr-2 h-4 w-4" />Save mapping</Button>
              </CardContent>
            </Card>
            {pairingCode ? (
              <Card>
                <CardHeader><CardTitle>Connector Pairing Code</CardTitle><CardDescription>Shown once. Use it on the restaurant LAN connector.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <p className="break-all rounded-md border bg-muted p-3 font-mono text-sm">{pairingCode.code}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Expires {formatDateTime(pairingCode.expires_at)}</span>
                    <Button size="sm" variant="outline" onClick={() => copy(pairingCode.code, "Pairing code copied")}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            </div>
            <div className="space-y-5">
              {biometricUnavailable ? (
                <Card className="border-amber-500/30 bg-amber-500/10">
                  <CardHeader>
                    <CardTitle>Biometric Devices Not Enabled</CardTitle>
                    <CardDescription>
                      QR/mobile attendance is available. Enable the biometric attendance add-on before registering ZKTeco devices.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
              <DeviceTable devices={devices} mappings={mappings} devicesById={devicesById} staffProfiles={staffProfiles} usersById={usersById} onToggle={toggleDevice} onPair={createPairingCode} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function TimesheetTable({ entries, staffProfiles, usersById, onSubmit, onApprove, onReject }: { entries: AttendanceEntry[]; staffProfiles: StaffProfile[]; usersById: Map<number, StaffUser>; onSubmit: (entry: AttendanceEntry) => void; onApprove: (entry: AttendanceEntry) => void; onReject: (entry: AttendanceEntry) => void }) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {entries.length === 0 ? <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">No attendance entries in this range.</div> : entries.map((entry) => {
          const profile = staffProfiles.find((item) => item.id === entry.staff_id);
          return <div key={entry.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-medium">{staffLabel(profile, usersById)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(entry.clock_in_at)} to {formatDateTime(entry.clock_out_at)}</p></div>
              <Badge variant={entry.approval_status === "approved" || entry.approval_status === "payroll_exported" ? "default" : "secondary"}>{entry.approval_status}</Badge>
            </div>
            <p className="mt-3 text-sm">Regular {minutesLabel(entry.regular_minutes)} / OT {minutesLabel(entry.overtime_minutes)}</p>
            {entry.exception_code ? <p className="mt-1 text-xs text-destructive">{entry.exception_code}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.approval_status === "draft" ? <Button size="sm" variant="outline" onClick={() => onSubmit(entry)}>Submit</Button> : null}
              {entry.approval_status === "pending" ? <Button size="sm" onClick={() => onApprove(entry)}><Check className="mr-1 h-3 w-3" />Approve</Button> : null}
              {entry.approval_status === "pending" ? <Button size="sm" variant="outline" onClick={() => onReject(entry)}><X className="mr-1 h-3 w-3" />Reject</Button> : null}
            </div>
          </div>;
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Clock</TableHead><TableHead>Minutes</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {entries.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No attendance entries in this range.</TableCell></TableRow> : entries.map((entry) => {
              const profile = staffProfiles.find((item) => item.id === entry.staff_id);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="min-w-[180px] font-medium">{staffLabel(profile, usersById)}</TableCell>
                  <TableCell className="min-w-[220px] text-sm">{formatDateTime(entry.clock_in_at)} to {formatDateTime(entry.clock_out_at)}</TableCell>
                  <TableCell className="min-w-[180px] text-sm">Regular {minutesLabel(entry.regular_minutes)} / OT {minutesLabel(entry.overtime_minutes)}</TableCell>
                  <TableCell className="min-w-[180px]"><Badge variant={entry.approval_status === "approved" || entry.approval_status === "payroll_exported" ? "default" : "secondary"}>{entry.approval_status}</Badge>{entry.exception_code ? <div className="mt-1 text-xs text-destructive">{entry.exception_code}</div> : null}</TableCell>
                  <TableCell className="min-w-[220px] text-right"><div className="flex justify-end gap-2">{entry.approval_status === "draft" ? <Button size="sm" variant="outline" onClick={() => onSubmit(entry)}>Submit</Button> : null}{entry.approval_status === "pending" ? <Button size="sm" onClick={() => onApprove(entry)}><Check className="mr-1 h-3 w-3" />Approve</Button> : null}{entry.approval_status === "pending" ? <Button size="sm" variant="outline" onClick={() => onReject(entry)}><X className="mr-1 h-3 w-3" />Reject</Button> : null}</div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ScheduleTable({ schedules, templates, staffProfiles, usersById }: { schedules: AttendanceSchedule[]; templates: AttendanceShiftTemplate[]; staffProfiles: StaffProfile[]; usersById: Map<number, StaffUser> }) {
  return <Card><CardHeader><CardTitle>Schedule Rules</CardTitle><CardDescription>Restaurant default rules and staff overrides.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Weekday</TableHead><TableHead>Shift</TableHead><TableHead>Effective</TableHead></TableRow></TableHeader><TableBody>{schedules.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No schedule rules yet.</TableCell></TableRow> : schedules.map((item) => { const template = templates.find((t) => t.id === item.shift_template_id); const profile = staffProfiles.find((staff) => staff.id === item.staff_id); return <TableRow key={item.id}><TableCell>{item.staff_id ? staffLabel(profile, usersById) : "Restaurant default"}</TableCell><TableCell>{item.weekday}</TableCell><TableCell>{item.is_day_off ? "Day off" : template?.name || "Shift #" + item.shift_template_id}</TableCell><TableCell>{item.effective_from} to {item.effective_to || "open"}</TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>;
}

function DeviceTable({ devices, mappings, devicesById, staffProfiles, usersById, onToggle, onPair }: { devices: AttendanceDevice[]; mappings: StaffDeviceMapping[]; devicesById: Map<number, AttendanceDevice>; staffProfiles: StaffProfile[]; usersById: Map<number, StaffUser>; onToggle: (device: AttendanceDevice, checked: boolean) => void; onPair: (deviceId: number) => void }) {
  return <Card><CardHeader><CardTitle>Physical Devices</CardTitle><CardDescription>Registered biometric devices and staff mappings.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Connection</TableHead><TableHead>Last sync</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Connector</TableHead></TableRow></TableHeader><TableBody>{devices.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No attendance devices registered.</TableCell></TableRow> : devices.map((device) => <TableRow key={device.id}><TableCell className="min-w-[180px]"><div className="font-medium">{device.name}</div><div className="text-xs text-muted-foreground">{deviceTypeLabels[device.device_type]} / {device.serial_number}</div></TableCell><TableCell className="min-w-[150px]">{device.ip_address || "No IP"}:{device.port || 4370}</TableCell><TableCell>{formatDateTime(device.last_sync_at)}</TableCell><TableCell><Switch checked={device.is_active} onCheckedChange={(checked) => onToggle(device, checked)} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onPair(device.id)}>Pair</Button></TableCell></TableRow>)}</TableBody></Table></div><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Staff</TableHead><TableHead>Device user</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{mappings.length === 0 ? <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No staff mappings saved.</TableCell></TableRow> : mappings.map((mapping) => { const profile = staffProfiles.find((item) => item.id === mapping.staff_id); return <TableRow key={mapping.id}><TableCell>{devicesById.get(mapping.device_id)?.name || "Device #" + mapping.device_id}</TableCell><TableCell>{staffLabel(profile, usersById)}</TableCell><TableCell>{mapping.device_user_id}</TableCell><TableCell><Badge variant={mapping.is_active ? "default" : "secondary"}>{mapping.is_active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>;
}

function MobileDeviceTable({ devices, staffProfiles, usersById, onDecide }: { devices: AttendanceMobileDevice[]; staffProfiles: StaffProfile[]; usersById: Map<number, StaffUser>; onDecide: (device: AttendanceMobileDevice, action: "approve" | "reject" | "revoke") => void }) {
  return <Card><CardHeader><CardTitle>Mobile Approvals</CardTitle><CardDescription>Approve staff phones for QR attendance scanning.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Device</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{devices.length === 0 ? <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No mobile attendance devices.</TableCell></TableRow> : devices.map((device) => { const profile = staffProfiles.find((item) => item.id === device.staff_id); return <TableRow key={device.id}><TableCell>{staffLabel(profile, usersById)}</TableCell><TableCell>{device.device_label || device.platform || "Mobile device"}<div className="text-xs text-muted-foreground">Last seen {formatDateTime(device.last_seen_at)}</div></TableCell><TableCell><Badge variant={device.status === "approved" ? "default" : "secondary"}>{device.status}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{device.status !== "approved" ? <Button size="sm" onClick={() => onDecide(device, "approve")}><Check className="mr-1 h-3 w-3" />Approve</Button> : null}<Button size="sm" variant="outline" onClick={() => onDecide(device, device.status === "approved" ? "revoke" : "reject")}>{device.status === "approved" ? "Revoke" : "Reject"}</Button></div></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>;
}
