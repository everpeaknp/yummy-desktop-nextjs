"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Copy, CreditCard, Download, Loader2, QrCode, RefreshCw, ShieldAlert, Sprout, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { growthApi } from "@/lib/api/growth";
import type { GrowthSettings, GrowthSmsCreditPackage, GrowthSmsCreditPurchase, GrowthSmsWallet } from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/role-permissions";

function findQrPayload(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["qr_payload", "payload", "qr_string", "deeplink", "content", "qr", "qrurl", "qr_url"]) {
    const result = findQrPayload(record[key]);
    if (result) return result;
  }
  for (const child of Object.values(record)) {
    if (typeof child === "object") {
      const result = findQrPayload(child);
      if (result) return result;
    }
  }
  return null;
}

export function GrowthSettingsClient({ focusSection }: { focusSection?: "credits" }) {
  const { user } = useAuth();
  const canManageSettings = hasPermission(user, "grow.settings.manage");
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creditLoadError, setCreditLoadError] = useState("");
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [savingQuietHours, setSavingQuietHours] = useState(false);
  const [savingFrequencyCap, setSavingFrequencyCap] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("21:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [frequencyCapDays, setFrequencyCapDays] = useState(7);
  const [smsWallet, setSmsWallet] = useState<GrowthSmsWallet | null>(null);
  const [smsPackages, setSmsPackages] = useState<GrowthSmsCreditPackage[]>([]);
  const [smsPurchase, setSmsPurchase] = useState<GrowthSmsCreditPurchase | null>(null);
  const [purchaseQr, setPurchaseQr] = useState("");
  const [buyingPackage, setBuyingPackage] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [signupQr, setSignupQr] = useState("");

  const restaurantId = user?.restaurant_id;
  const configuredCustomerBase = process.env.NEXT_PUBLIC_CUSTOMER_MENU_BASE_URL
    || process.env.NEXT_PUBLIC_MENU_QR_BASE_URL?.replace(/\/qr\/?$/, "");
  const customerBase = configuredCustomerBase
    || (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:3002"
      : "");
  const signupUrl = restaurantId && customerBase
    ? `${customerBase.replace(/\/+$/, "")}/${restaurantId}?view=rewards&join=offers`
    : "";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setCreditLoadError("");
    try {
      const [settingsResult, walletResult, packagesResult] = await Promise.allSettled([
        growthApi.getSettings(), growthApi.getSmsWallet(), growthApi.getSmsPackages(),
      ]);
      if (settingsResult.status === "rejected") throw settingsResult.reason;
      const data = settingsResult.value;
      setSettings(data);
      setQuietHoursStart(data.quiet_hours_start.slice(0, 5));
      setQuietHoursEnd(data.quiet_hours_end.slice(0, 5));
      setFrequencyCapDays(data.promotion_frequency_cap_days);
      setSmsWallet(walletResult.status === "fulfilled" ? walletResult.value : null);
      setSmsPackages(packagesResult.status === "fulfilled" ? packagesResult.value : []);
      if (walletResult.status === "rejected" || packagesResult.status === "rejected") {
        setCreditLoadError("SMS balance and purchase options could not be loaded.");
      }
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Campaign settings could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || (focusSection !== "credits" && window.location.hash !== "#grow-sms-credits")) return;
    document.getElementById("grow-sms-credits")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, [focusSection, loading]);

  useEffect(() => {
    const payload = findQrPayload(smsPurchase?.qr_payload);
    if (!payload) { setPurchaseQr(""); return; }
    if (payload.startsWith("data:image") || payload.startsWith("http")) {
      setPurchaseQr(payload);
      return;
    }
    QRCode.toDataURL(payload, { width: 420, margin: 2, errorCorrectionLevel: "M" })
      .then(setPurchaseQr)
      .catch(() => setPurchaseQr(""));
  }, [smsPurchase]);

  useEffect(() => {
    if (!signupUrl) { setSignupQr(""); return; }
    QRCode.toDataURL(signupUrl, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#10131a", light: "#ffffff" },
    }).then(setSignupQr).catch(() => setSignupQr(""));
  }, [signupUrl]);

  const copySignupUrl = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast.success("Customer sign-up link copied");
    } catch {
      toast.error("Unable to copy the sign-up link");
    }
  };

  const downloadSignupQr = () => {
    if (!signupQr) return;
    const link = document.createElement("a");
    link.href = signupQr;
    link.download = `yummy-customer-sign-up-${restaurantId}.png`;
    link.click();
  };

  const toggleCustomerSignup = async (enabled: boolean) => {
    if (!settings) return;
    setSavingEnrollment(true);
    try {
      const updated = await growthApi.updateSettings({ public_enrollment_enabled: enabled });
      setSettings(updated);
      toast.success(enabled ? "Customer sign-up enabled" : "Customer sign-up disabled");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update customer sign-up"));
    } finally {
      setSavingEnrollment(false);
    }
  };

  const buySmsCredits = async (packageCode: string) => {
    setBuyingPackage(packageCode);
    try {
      setSmsPurchase(await growthApi.createSmsPurchase(packageCode));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to start Fonepay checkout"));
    } finally {
      setBuyingPackage(null);
    }
  };

  const checkSmsPayment = async () => {
    if (!smsPurchase) return;
    setCheckingPayment(true);
    try {
      const purchase = await growthApi.verifySmsPurchase(smsPurchase.id);
      setSmsPurchase(purchase);
      if (purchase.status === "paid") {
        setSmsWallet(await growthApi.getSmsWallet());
        toast.success(`${purchase.credits.toLocaleString("en-NP")} SMS credits added.`);
      } else if (purchase.status === "review_required") {
        toast.error("Payment requires manual review because the verified amount did not match.");
      } else {
        toast.info("Payment has not completed yet.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to verify Fonepay payment"));
    } finally {
      setCheckingPayment(false);
    }
  };

  const [savingEmail, setSavingEmail] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [savingAiCopy, setSavingAiCopy] = useState(false);

  const toggleEmail = async (enabled: boolean) => {
    if (!settings) return;
    setSavingEmail(true);
    try {
      const updated = await growthApi.updateSettings({ email_enabled: enabled });
      setSettings(updated);
      toast.success(enabled ? "Email delivery enabled" : "Email delivery disabled");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update email delivery"));
    } finally {
      setSavingEmail(false);
    }
  };

  const saveQuietHours = async () => {
    if (quietHoursStart === quietHoursEnd) {
      toast.error("Quiet hours must have different start and end times.");
      return;
    }
    setSavingQuietHours(true);
    try {
      const updated = await growthApi.updateSettings({
        quiet_hours_start: `${quietHoursStart}:00`,
        quiet_hours_end: `${quietHoursEnd}:00`,
      });
      setSettings(updated);
      setQuietHoursStart(updated.quiet_hours_start.slice(0, 5));
      setQuietHoursEnd(updated.quiet_hours_end.slice(0, 5));
      toast.success("Campaign quiet hours updated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update quiet hours"));
    } finally {
      setSavingQuietHours(false);
    }
  };

  const saveFrequencyCap = async () => {
    if (!Number.isInteger(frequencyCapDays) || frequencyCapDays < 1 || frequencyCapDays > 90) {
      toast.error("Choose between 1 and 90 days between promotions.");
      return;
    }
    setSavingFrequencyCap(true);
    try {
      const updated = await growthApi.updateSettings({
        promotion_frequency_cap_days: frequencyCapDays,
      });
      setSettings(updated);
      setFrequencyCapDays(updated.promotion_frequency_cap_days);
      toast.success("Campaign frequency cap updated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update the frequency cap"));
    } finally {
      setSavingFrequencyCap(false);
    }
  };

  const toggleSms = async (enabled: boolean) => {
    if (!settings) return;
    setSavingSms(true);
    try {
      const updated = await growthApi.updateSettings({ sms_enabled: enabled });
      setSettings(updated);
      toast.success(enabled ? "SMS campaigns enabled" : "SMS campaigns disabled");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update SMS setting"));
    } finally {
      setSavingSms(false);
    }
  };

  const toggleAiCopy = async (enabled: boolean) => {
    if (!settings) return;
    setSavingAiCopy(true);
    try {
      const updated = await growthApi.updateSettings({ ai_copy_enabled: enabled });
      setSettings(updated);
      toast.success(enabled ? "AI copy generation enabled" : "AI copy generation disabled. System templates will be used.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update AI copy setting"));
    } finally {
      setSavingAiCopy(false);
    }
  };

  if (!canManageSettings) {
    return (
      <Alert className="mx-auto max-w-2xl">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>You don&apos;t have access to Growth settings</AlertTitle>
        <AlertDescription>
          Ask a manager to update campaign delivery and customer sign-up settings.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading Growth settings…
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <Alert className="mx-auto max-w-2xl">
        <TriangleAlert aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Campaign settings are unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{loadError || "Campaign settings could not be loaded."}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16">
      <header className="border-b border-border pb-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Sprout aria-hidden="true" className="h-4 w-4" />
          Yummy Grow
        </div>
        <h1 className="text-pretty text-3xl font-black tracking-tight">Campaign Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage your message balance, delivery channels, customer limits, and sign-up tools.
        </p>
      </header>

      <Card id="grow-sms-credits" className="scroll-mt-6 overflow-hidden border-primary/20">
        <CardHeader>
          <CardTitle>SMS Balance</CardTitle>
          <CardDescription>See what is available now and add credits before scheduling a text campaign.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {creditLoadError ? (
            <Alert>
              <TriangleAlert aria-hidden="true" className="h-4 w-4" />
              <AlertTitle>SMS balance unavailable</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{creditLoadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Try Again</Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 rounded-xl bg-primary/[0.045] p-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available to send</p>
              <p className="mt-1 text-4xl font-black tabular-nums">{smsWallet?.available_credits.toLocaleString("en-NP") ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Each text uses at least 1 credit; longer messages may use more.</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-muted-foreground">Set aside for scheduled campaigns</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{smsWallet?.reserved_credits.toLocaleString("en-NP") ?? "—"}</p>
            </div>
          </div>
          {smsPackages.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {smsPackages.map((item) => (
                <div key={item.code} className="rounded-xl border p-4">
                  <p className="text-2xl font-black tabular-nums">{item.credits.toLocaleString("en-NP")}</p>
                  <p className="text-sm text-muted-foreground">SMS credits</p>
                  <p className="mt-3 font-semibold">NPR {Number(item.price_npr).toLocaleString("en-NP")}</p>
                  <Button className="mt-4 w-full" onClick={() => void buySmsCredits(item.code)} disabled={buyingPackage !== null}>
                    {buyingPackage === item.code ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <CreditCard aria-hidden="true" className="mr-2 h-4 w-4" />}Buy Credits
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            !creditLoadError && <Alert><TriangleAlert aria-hidden="true" className="h-4 w-4" /><AlertTitle>SMS credit purchases are unavailable</AlertTitle><AlertDescription>Contact Yummy support to enable credit purchases for this restaurant.</AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-muted/40 text-emerald-700 dark:text-emerald-300">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Customer sign-up QR</CardTitle>
              <CardDescription className="mt-1">
                Guests scan this code to create their Yummy account and join this restaurant. They
                can choose during sign-up whether to receive your email offers.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Accept customer sign-ups</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Required before a customer can subscribe to restaurant offers.
              </p>
            </div>
            <Switch
              aria-label="Accept customer sign-ups"
              checked={Boolean(settings?.public_enrollment_enabled)}
              onCheckedChange={(checked) => void toggleCustomerSignup(checked)}
              disabled={savingEnrollment || (!settings?.public_enrollment_enabled && !settings?.consent_text_hash)}
            />
          </div>
          {signupQr ? (
            <div className="grid gap-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
              <div className="rounded-xl border bg-white p-3">
                <Image
                  src={signupQr}
                  width={420}
                  height={420}
                  alt="QR code for this restaurant's Yummy customer sign-up"
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
              <div className="min-w-0 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Ready to display</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Print it for the counter, receipts, or table displays. The restaurant is attached
                    automatically after the customer verifies their email.
                  </p>
                </div>
                <p className="truncate rounded-lg border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground" title={signupUrl}>
                  {signupUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void copySignupUrl()} disabled={!settings?.public_enrollment_enabled}>
                    <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                    Copy link
                  </Button>
                  <Button type="button" onClick={downloadSignupQr} disabled={!settings?.public_enrollment_enabled}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Download QR
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Customer menu address is not configured</AlertTitle>
              <AlertDescription>
                Customer sign-up is not available yet. Contact Yummy support to connect your public menu address.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Rules</CardTitle>
          <CardDescription>
            Choose how campaigns are delivered and how often customers can hear from you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Campaign quiet hours</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Scheduled marketing messages cannot be sent during this period. Times use the
                restaurant&apos;s local timezone.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Starts at</span>
                <Input
                  name="campaign_quiet_hours_start"
                  autoComplete="off"
                  type="time"
                  value={quietHoursStart}
                  onChange={(event) => setQuietHoursStart(event.target.value)}
                  disabled={savingQuietHours}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Ends at</span>
                <Input
                  name="campaign_quiet_hours_end"
                  autoComplete="off"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(event) => setQuietHoursEnd(event.target.value)}
                  disabled={savingQuietHours}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveQuietHours()}
                disabled={savingQuietHours || quietHoursStart === quietHoursEnd}
              >
                {savingQuietHours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save quiet hours
              </Button>
              <span className="text-xs text-muted-foreground">
                Current blocked period: {quietHoursStart}–{quietHoursEnd}
              </span>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Days between promotions</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A customer cannot receive another campaign until this many full days have passed.
                This applies across campaign channels for this restaurant.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="space-y-2 text-sm font-medium" htmlFor="promotion-frequency-cap">
                <span className="block">Wait at least</span>
                <span className="flex items-center gap-2">
                  <Input
                    id="promotion-frequency-cap"
                    name="promotion_frequency_cap_days"
                    type="number"
                    inputMode="numeric"
                    autoComplete="off"
                    min={1}
                    max={90}
                    step={1}
                    value={frequencyCapDays}
                    onChange={(event) => setFrequencyCapDays(Number(event.target.value))}
                    disabled={savingFrequencyCap}
                    className="w-24 tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </span>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveFrequencyCap()}
                disabled={
                  savingFrequencyCap ||
                  frequencyCapDays === settings?.promotion_frequency_cap_days ||
                  !Number.isInteger(frequencyCapDays) ||
                  frequencyCapDays < 1 ||
                  frequencyCapDays > 90
                }
              >
                {savingFrequencyCap ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                Save customer limit
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Send SMS offers</p>
              <p className="text-xs text-muted-foreground">
                Turn this off to prevent new text campaigns from being prepared or sent.
              </p>
            </div>
            <Switch
              aria-label="Enable SMS campaigns"
              checked={Boolean(settings?.sms_enabled)}
              onCheckedChange={(checked) => void toggleSms(checked)}
              disabled={savingSms}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Send email offers</p>
              <p className="text-xs text-muted-foreground">
                Turn this off to prevent new email campaigns from being scheduled or sent.
              </p>
            </div>
            <Switch
              aria-label="Enable email delivery"
              checked={Boolean(settings?.email_enabled)}
              onCheckedChange={(checked) => void toggleEmail(checked)}
              disabled={savingEmail}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Campaign writing suggestions</p>
              <p className="text-xs text-muted-foreground">
                Suggest message ideas while you create a campaign. Turn this off to use Yummy templates only.
              </p>
            </div>
            <Switch
              aria-label="Enable campaign writing suggestions"
              checked={Boolean(settings?.ai_copy_enabled)}
              onCheckedChange={(checked) => void toggleAiCopy(checked)}
              disabled={savingAiCopy}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(smsPurchase)} onOpenChange={(open) => { if (!open) setSmsPurchase(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Buy SMS Credits</DialogTitle><DialogDescription>Scan with Fonepay to pay NPR {Number(smsPurchase?.amount_npr || 0).toLocaleString("en-NP")} for {smsPurchase?.credits.toLocaleString("en-NP")} credits.</DialogDescription></DialogHeader>
          <div className="space-y-4 text-center">
            {purchaseQr ? <Image src={purchaseQr} width={300} height={300} alt="Fonepay payment QR" unoptimized className="mx-auto rounded-xl bg-white p-3" /> : <Alert><TriangleAlert className="h-4 w-4" /><AlertDescription>Fonepay did not return a displayable QR payload.</AlertDescription></Alert>}
            <Button className="w-full" onClick={() => void checkSmsPayment()} disabled={checkingPayment || smsPurchase?.status === "paid"}>
              {checkingPayment ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />}{smsPurchase?.status === "paid" ? "Payment Verified" : "Check My Payment"}
            </Button>
            <p className="text-xs text-muted-foreground">Credits are added only after Yummy verifies the exact amount with Fonepay.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Customer marketing consent</CardTitle>
          <CardDescription>
            Yummy applies one reviewed consent policy across every restaurant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Yummy marketing consent policy</p>
                <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Version {settings?.consent_policy_version || "—"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Managed by Yummy and recorded whenever a customer chooses to receive your promotions.
              </p>
            </div>
            <blockquote className="border-l-2 border-primary pl-4 text-sm leading-6 text-foreground">
              {settings?.consent_text || "Consent policy unavailable."}
            </blockquote>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
