"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceQrSession } from "@/lib/attendance/types";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function errorMessage(error: unknown) {
  const detail = (
    error as { response?: { data?: { detail?: string; message?: string } } }
  )?.response?.data;
  return detail?.message || detail?.detail || "Failed to generate attendance QR";
}

export function QrSessionGenerator() {
  const user = useAuth((state) => state.user);
  const canManageExpiry = hasPermission(user, "attendance.qr.expiry.manage");
  const [stationLabel, setStationLabel] = useState("Restaurant attendance");
  const [expirySeconds, setExpirySeconds] = useState("15");
  const [session, setSession] = useState<AttendanceQrSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.token) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(session.token, { margin: 1, width: 420 })
      .then(setQrDataUrl)
      .catch(() => toast.error("Failed to render attendance QR"));
  }, [session]);

  async function generate() {
    setBusy(true);
    try {
      const ttlSeconds = Math.min(
        3600,
        Math.max(1, Number.parseInt(expirySeconds, 10) || 15),
      );
      const created = await attendanceApi.createQrSession({
        station_label: stationLabel.trim(),
        ...(canManageExpiry ? { ttl_seconds: ttlSeconds } : {}),
      });
      setSession(created);
      toast.success("Attendance QR generated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Generate QR Session</CardTitle>
          <CardDescription>Staff scan this QR from the mobile app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="grid gap-2 text-sm font-medium">
            Station label
            <Input
              name="station-label"
              autoComplete="off"
              value={stationLabel}
              onChange={(event) => setStationLabel(event.target.value)}
            />
          </label>
          {canManageExpiry ? (
            <label className="grid gap-2 text-sm font-medium">
              Expiry seconds
              <Input
                name="expiry-seconds"
                type="number"
                min="1"
                max="3600"
                inputMode="numeric"
                autoComplete="off"
                value={expirySeconds}
                onChange={(event) => setExpirySeconds(event.target.value)}
              />
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Each QR expires in 15 seconds.
            </p>
          )}
          <Button onClick={generate} disabled={busy} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            {busy ? "Generating…" : session ? "Refresh QR" : "Generate QR"}
          </Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Restaurant Attendance QR</CardTitle>
          <CardDescription>
            Display this QR where staff clock in or out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-3">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                width={420}
                height={420}
                alt="Attendance QR code"
                unoptimized
                className="h-[min(420px,78vw)] w-[min(420px,78vw)] rounded bg-white p-2"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <QrCode className="mx-auto mb-3 h-12 w-12" />
                <p className="text-sm">Generate a QR session to display it here.</p>
              </div>
            )}
          </div>
          {session ? (
            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                {session.token}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(session.token)
                    .then(() => toast.success("QR payload copied"))
                    .catch(() => toast.error("Unable to copy QR payload"));
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
