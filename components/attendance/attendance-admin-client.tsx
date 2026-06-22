"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Copy,
  Fingerprint,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { AttendanceApis, StaffApis, StaffProfileApis } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BaseResponse<T> = {
  status: string;
  message?: string;
  data: T;
};

type AttendanceQrSession = {
  id: number;
  token: string;
  station_label?: string | null;
  expires_at: string;
  is_active: boolean;
};

type AttendanceDevice = {
  id: number;
  name: string;
  device_type: "zkteco_lan" | "zkteco_cloud" | "generic_import";
  serial_number: string;
  ip_address?: string | null;
  port?: number | null;
  timezone: string;
  is_active: boolean;
  last_sync_at?: string | null;
};

type StaffDeviceMapping = {
  id: number;
  device_id: number;
  staff_id: number;
  device_user_id: string;
  is_active: boolean;
};

type StaffProfile = {
  id: number;
  user_id: number;
  account_number?: string;
};

type StaffUser = {
  id: number;
  name?: string;
  full_name?: string;
  email?: string;
};

const deviceTypeLabels: Record<AttendanceDevice["device_type"], string> = {
  zkteco_lan: "ZKTeco LAN",
  zkteco_cloud: "ZKTeco cloud",
  generic_import: "Generic import",
};

function errorMessage(error: unknown, fallback: string) {
  const candidate = error as {
    response?: { data?: { message?: string; detail?: string } };
    message?: string;
  };
  return (
    candidate.response?.data?.message ||
    candidate.response?.data?.detail ||
    candidate.message ||
    fallback
  );
}

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

function staffLabel(profile: StaffProfile, usersById: Map<number, StaffUser>) {
  const user = usersById.get(profile.user_id);
  return user?.name || user?.full_name || user?.email || `Staff #${profile.id}`;
}

export function AttendanceAdminClient() {
  const [qrSession, setQrSession] = useState<AttendanceQrSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [stationLabel, setStationLabel] = useState("Restaurant attendance");
  const [ttlSeconds, setTtlSeconds] = useState("60");

  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [mappings, setMappings] = useState<StaffDeviceMapping[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);

  const [deviceForm, setDeviceForm] = useState({
    name: "",
    serial_number: "",
    ip_address: "",
    port: "4370",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const [mappingForm, setMappingForm] = useState({
    device_id: "",
    staff_id: "",
    device_user_id: "",
  });

  const qrPayload = useMemo(() => {
    if (!qrSession?.token) return "";
    return `yummy-attendance://clock?token=${encodeURIComponent(qrSession.token)}`;
  }, [qrSession?.token]);

  async function copyQrPayload() {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      toast.success("QR payload copied");
    } catch {
      toast.error("Could not copy QR payload");
    }
  }

  const usersById = useMemo(() => {
    return new Map(staffUsers.map((user) => [user.id, user]));
  }, [staffUsers]);

  const devicesById = useMemo(() => {
    return new Map(devices.map((device) => [device.id, device]));
  }, [devices]);

  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(qrPayload, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
        toast.error("Failed to render attendance QR");
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const loadDeviceAdminData = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const [devicesRes, mappingsRes, profilesRes, usersRes] = await Promise.all([
        apiClient.get<BaseResponse<AttendanceDevice[]>>(AttendanceApis.listDevices),
        apiClient.get<BaseResponse<StaffDeviceMapping[]>>(AttendanceApis.listDeviceMappings()),
        apiClient.get<BaseResponse<StaffProfile[]>>(StaffProfileApis.list({ skip: 0, limit: 500 })),
        apiClient.get<BaseResponse<StaffUser[]>>(StaffApis.list()),
      ]);
      const nextDevices = devicesRes.data.data || [];
      setDevices(nextDevices);
      setMappings(mappingsRes.data.data || []);
      setStaffProfiles(profilesRes.data.data || []);
      setStaffUsers(usersRes.data.data || []);
      if (nextDevices[0]) {
        setMappingForm((current) =>
          current.device_id ? current : { ...current, device_id: String(nextDevices[0].id) }
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load attendance devices"));
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeviceAdminData();
  }, [loadDeviceAdminData]);

  async function createQrSession() {
    const ttl = Math.max(15, Math.min(300, Number.parseInt(ttlSeconds, 10) || 60));
    setQrLoading(true);
    try {
      const response = await apiClient.post<BaseResponse<AttendanceQrSession>>(
        AttendanceApis.createQrSession,
        {
          station_label: stationLabel.trim() || "Restaurant attendance",
          ttl_seconds: ttl,
        }
      );
      setQrSession(response.data.data);
      toast.success("Attendance QR generated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to generate attendance QR"));
    } finally {
      setQrLoading(false);
    }
  }

  async function createDevice() {
    const name = deviceForm.name.trim();
    const serialNumber = deviceForm.serial_number.trim();
    if (!name || !serialNumber) {
      toast.error("Device name and serial number are required");
      return;
    }

    setDeviceSubmitting(true);
    try {
      await apiClient.post<BaseResponse<AttendanceDevice>>(AttendanceApis.createDevice, {
        name,
        device_type: "zkteco_lan",
        serial_number: serialNumber,
        ip_address: deviceForm.ip_address.trim() || null,
        port: Number.parseInt(deviceForm.port, 10) || 4370,
        timezone: deviceForm.timezone.trim() || "UTC",
        is_active: true,
      });
      setDeviceForm((current) => ({ ...current, name: "", serial_number: "", ip_address: "" }));
      toast.success("Attendance device registered");
      await loadDeviceAdminData();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to register attendance device"));
    } finally {
      setDeviceSubmitting(false);
    }
  }

  async function updateDeviceActive(device: AttendanceDevice, isActive: boolean) {
    setDevices((current) =>
      current.map((item) => (item.id === device.id ? { ...item, is_active: isActive } : item))
    );
    try {
      await apiClient.patch<BaseResponse<AttendanceDevice>>(AttendanceApis.updateDevice(device.id), {
        is_active: isActive,
      });
      toast.success(isActive ? "Device enabled" : "Device disabled");
    } catch (error) {
      setDevices((current) =>
        current.map((item) => (item.id === device.id ? { ...item, is_active: device.is_active } : item))
      );
      toast.error(errorMessage(error, "Failed to update device"));
    }
  }

  async function saveMapping() {
    const deviceId = Number.parseInt(mappingForm.device_id, 10);
    const staffId = Number.parseInt(mappingForm.staff_id, 10);
    const deviceUserId = mappingForm.device_user_id.trim();
    if (!deviceId || !staffId || !deviceUserId) {
      toast.error("Select a device, staff member, and device user ID");
      return;
    }

    setMappingSubmitting(true);
    try {
      await apiClient.post<BaseResponse<StaffDeviceMapping>>(AttendanceApis.upsertDeviceMapping, {
        device_id: deviceId,
        staff_id: staffId,
        device_user_id: deviceUserId,
        is_active: true,
      });
      setMappingForm((current) => ({ ...current, staff_id: "", device_user_id: "" }));
      toast.success("Staff device mapping saved");
      await loadDeviceAdminData();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save staff device mapping"));
    } finally {
      setMappingSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6 overflow-x-hidden p-4 pb-24 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Attendance</h1>
          <p className="text-muted-foreground font-medium">
            Generate restaurant QR sessions and manage biometric attendance devices.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Clock-in stays on mobile
        </Badge>
      </div>

      <Tabs defaultValue="qr" className="min-w-0 space-y-5">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="qr" className="gap-2">
            <QrCode className="h-4 w-4" />
            QR kiosk
          </TabsTrigger>
          <TabsTrigger value="devices" className="gap-2">
            <Fingerprint className="h-4 w-4" />
            Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="space-y-5">
          <div className="grid min-w-0 gap-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-xl">Generate QR session</CardTitle>
                <CardDescription>
                  Staff scan this code from the mobile app, then confirm device biometrics there.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="station-label">Station label</Label>
                  <Input
                    id="station-label"
                    value={stationLabel}
                    onChange={(event) => setStationLabel(event.target.value)}
                    placeholder="Front counter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttl-seconds">Expiry seconds</Label>
                  <Input
                    id="ttl-seconds"
                    type="number"
                    min={15}
                    max={300}
                    value={ttlSeconds}
                    onChange={(event) => setTtlSeconds(event.target.value)}
                  />
                </div>
                <Button onClick={createQrSession} disabled={qrLoading} className="w-full">
                  {qrLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {qrSession ? "Refresh QR" : "Generate QR"}
                </Button>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-xl">Restaurant attendance QR</CardTitle>
                <CardDescription>
                  Keep this screen open at the restaurant. Use short expiry and refresh it as needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 space-y-5">
                <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed bg-muted/20 p-4 sm:min-h-[380px]">
                    {qrDataUrl ? (
                      <Image
                        src={qrDataUrl}
                        width={360}
                        height={360}
                        alt="Attendance QR code"
                        unoptimized
                        className="h-[min(360px,72vw)] w-[min(360px,72vw)] rounded bg-white p-2"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <QrCode className="mx-auto mb-3 h-12 w-12" />
                        <p className="text-sm font-medium">Generate a QR session to display it here.</p>
                      </div>
                    )}
                  </div>
                <div className="grid min-w-0 gap-3 md:grid-cols-2">
                  <InfoLine label="Station" value={qrSession?.station_label || stationLabel} />
                  <InfoLine label="Expires" value={formatDateTime(qrSession?.expires_at)} />
                  <div className="min-w-0 rounded-md border bg-muted/40 p-3 md:col-span-2">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            QR payload
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {qrPayload || "Not generated"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyQrPayload}
                          disabled={!qrPayload}
                          className="shrink-0"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 md:col-span-2">
                    Web does not record attendance. Staff must scan this QR from the mobile app so
                    the backend receives QR plus biometric confirmation.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Register ZKTeco device</CardTitle>
                  <CardDescription>
                    Add the device identity used by the LAN sync worker.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device name</Label>
                    <Input
                      id="device-name"
                      value={deviceForm.name}
                      onChange={(event) =>
                        setDeviceForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Main entrance scanner"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serial-number">Serial number</Label>
                    <Input
                      id="serial-number"
                      value={deviceForm.serial_number}
                      onChange={(event) =>
                        setDeviceForm((current) => ({ ...current, serial_number: event.target.value }))
                      }
                      placeholder="ZK serial number"
                    />
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="ip-address">IP address</Label>
                      <Input
                        id="ip-address"
                        value={deviceForm.ip_address}
                        onChange={(event) =>
                          setDeviceForm((current) => ({ ...current, ip_address: event.target.value }))
                        }
                        placeholder="192.168.1.50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="device-port">Port</Label>
                      <Input
                        id="device-port"
                        type="number"
                        value={deviceForm.port}
                        onChange={(event) =>
                          setDeviceForm((current) => ({ ...current, port: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={deviceForm.timezone}
                      onChange={(event) =>
                        setDeviceForm((current) => ({ ...current, timezone: event.target.value }))
                      }
                    />
                  </div>
                  <Button onClick={createDevice} disabled={deviceSubmitting} className="w-full">
                    {deviceSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Register device
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Map staff to device user</CardTitle>
                  <CardDescription>
                    Match the biometric device user ID to a Yummy staff profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Device</Label>
                    <Select
                      value={mappingForm.device_id}
                      onValueChange={(value) =>
                        setMappingForm((current) => ({ ...current, device_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((device) => (
                          <SelectItem key={device.id} value={String(device.id)}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Staff profile</Label>
                    <Select
                      value={mappingForm.staff_id}
                      onValueChange={(value) =>
                        setMappingForm((current) => ({ ...current, staff_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff profile" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={String(profile.id)}>
                            {staffLabel(profile, usersById)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device-user-id">Device user ID</Label>
                    <Input
                      id="device-user-id"
                      value={mappingForm.device_user_id}
                      onChange={(event) =>
                        setMappingForm((current) => ({ ...current, device_user_id: event.target.value }))
                      }
                      placeholder="Employee number in device"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={saveMapping}
                    disabled={mappingSubmitting || devices.length === 0 || staffProfiles.length === 0}
                    className="w-full"
                  >
                    {mappingSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="mr-2 h-4 w-4" />
                    )}
                    Save mapping
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Registered devices</CardTitle>
                  <CardDescription>
                    Devices are synced by the backend worker; web only manages configuration.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadDeviceAdminData} disabled={devicesLoading}>
                  {devicesLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead>Connection</TableHead>
                        <TableHead>Last sync</TableHead>
                        <TableHead className="text-right">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No attendance devices registered.
                          </TableCell>
                        </TableRow>
                      ) : (
                        devices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell>
                              <div className="font-semibold">{device.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {deviceTypeLabels[device.device_type]} / {device.serial_number}
                              </div>
                            </TableCell>
                            <TableCell>
                              {device.ip_address || "No IP"}:{device.port || 4370}
                            </TableCell>
                            <TableCell>{formatDateTime(device.last_sync_at)}</TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={device.is_active}
                                onCheckedChange={(checked) => updateDeviceActive(device, checked)}
                                aria-label={`Toggle ${device.name}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold">Staff mappings</h2>
                    <Badge variant="outline">{mappings.length} mapped</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>Staff</TableHead>
                          <TableHead>Device user ID</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                              No staff mappings saved yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          mappings.map((mapping) => {
                            const profile = staffProfiles.find((item) => item.id === mapping.staff_id);
                            return (
                              <TableRow key={mapping.id}>
                                <TableCell>{devicesById.get(mapping.device_id)?.name || `Device #${mapping.device_id}`}</TableCell>
                                <TableCell>
                                  {profile ? staffLabel(profile, usersById) : `Staff #${mapping.staff_id}`}
                                </TableCell>
                                <TableCell>{mapping.device_user_id}</TableCell>
                                <TableCell>
                                  <Badge variant={mapping.is_active ? "default" : "secondary"}>
                                    {mapping.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "break-all rounded-md bg-muted p-2 font-mono text-xs" : "text-sm font-semibold"}>
        {value}
      </p>
    </div>
  );
}
