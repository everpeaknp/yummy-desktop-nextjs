"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Download, Loader2, QrCode, ShieldAlert, Sprout, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { growthApi } from "@/lib/api/growth";
import type { GrowthSettings } from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasPermission } from "@/lib/role-permissions";

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
}

/**
 * Falls back to this browser's own origin when unset -- fine for local
 * development, but a QR code printed with that fallback baked in would
 * point at whatever happened to be open in someone's browser, not a
 * stable public address. The UI surfaces this distinction explicitly
 * rather than silently using a fallback that looks identical to a real
 * configured value.
 */
function resolveGrowPublicBaseUrl(): { baseUrl: string; isConfigured: boolean } {
  const configured = process.env.NEXT_PUBLIC_GROW_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return { baseUrl: configured.replace(/\/+$/, ""), isConfigured: true };
  }
  return { baseUrl: window.location.origin, isConfigured: false };
}

export function GrowthSettingsClient() {
  const { user } = useAuth();
  const { restaurant } = useRestaurant();
  const canManageSettings = hasPermission(user, "grow.settings.manage");
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [baseUrlInfo, setBaseUrlInfo] = useState<{ baseUrl: string; isConfigured: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await growthApi.getSettings();
      setSettings(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to load Growth settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setBaseUrlInfo(resolveGrowPublicBaseUrl());
  }, []);

  const joinUrl =
    settings?.public_enrollment_slug && baseUrlInfo
      ? `${baseUrlInfo.baseUrl}/grow/join?restaurant=${encodeURIComponent(settings.public_enrollment_slug)}`
      : "";

  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(joinUrl, {
      width: 520,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(() => toast.error("Failed to render the sign-up QR code"));
  }, [joinUrl]);

  const toggleEnrollment = async (enabled: boolean) => {
    if (!settings) return;
    setSavingEnrollment(true);
    try {
      const updated = await growthApi.updateSettings({ public_enrollment_enabled: enabled });
      setSettings(updated);
      toast.success(enabled ? "Public sign-up enabled" : "Public sign-up disabled");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update public sign-up"));
    } finally {
      setSavingEnrollment(false);
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${safeFileName(restaurant?.name || "restaurant")}-grow-signup-qr.png`;
    anchor.click();
  };

  if (!canManageSettings) {
    return (
      <Alert className="mx-auto max-w-2xl">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>You don&apos;t have access to Growth settings</AlertTitle>
        <AlertDescription>
          Managing the customer sign-up QR code requires the grow.settings.manage permission.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading Growth settings...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
        <Sprout className="h-4 w-4" />
        Yummy Grow settings
      </div>
      <h1 className="text-3xl font-black tracking-tight">Customer sign-up</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Let customers join your WhatsApp marketing list by scanning a QR code at your restaurant.
        No internal restaurant details are exposed by this link.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Public sign-up page</CardTitle>
          <CardDescription>
            When enabled, the QR code below opens a page where customers can opt in to WhatsApp
            marketing messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Public sign-up enabled</p>
              <p className="text-xs text-muted-foreground">
                Turning this off does not change the QR image below -- it stops the page it points to
                from accepting new sign-ups.
              </p>
            </div>
            <Switch
              checked={Boolean(settings?.public_enrollment_enabled)}
              onCheckedChange={(checked) => void toggleEnrollment(checked)}
              disabled={savingEnrollment || !settings?.public_enrollment_slug}
            />
          </div>

          {!settings?.public_enrollment_slug ? (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>No sign-up link yet</AlertTitle>
              <AlertDescription>
                A sign-up link hasn&apos;t been generated for this restaurant yet.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {baseUrlInfo && !baseUrlInfo.isConfigured && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <TriangleAlert className="h-4 w-4 text-amber-600" />
                  <AlertTitle>Using this browser&apos;s address as a placeholder</AlertTitle>
                  <AlertDescription>
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      NEXT_PUBLIC_GROW_PUBLIC_BASE_URL
                    </code>{" "}
                    is not configured, so this QR code currently points at{" "}
                    <span className="font-mono">{baseUrlInfo.baseUrl}</span>. Do not print or hand
                    out this QR code until that is set to your real public domain.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/20 p-6">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    width={280}
                    height={280}
                    alt="Growth sign-up QR code"
                    unoptimized
                    className="h-[min(280px,70vw)] w-[min(280px,70vw)] rounded bg-white p-2"
                  />
                ) : (
                  <div className="flex h-[280px] w-[280px] items-center justify-center text-muted-foreground">
                    <QrCode className="h-12 w-12" />
                  </div>
                )}
                <p className="max-w-md break-all text-center font-mono text-xs text-muted-foreground">
                  {joinUrl}
                </p>
                <Button onClick={downloadQr} disabled={!qrDataUrl}>
                  <Download className="mr-2 h-4 w-4" />
                  Download QR code
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
