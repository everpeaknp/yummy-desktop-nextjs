"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Check, Clock3, Copy, CreditCard, Download, Loader2, Mail, MessageSquareText, QrCode, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GrowPageHeader } from "@/components/grow/grow-page-header";
import { RewardsSignupPoster } from "@/components/grow/rewards-signup-poster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { growthApi } from "@/lib/api/growth";
import type { GrowthSettings, GrowthSmsCreditPackage, GrowthSmsCreditPurchase, GrowthSmsWallet } from "@/lib/api/growth-types";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { hasPermission } from "@/lib/role-permissions";

function findQrPayload(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["qrMessage", "qr_message", "qr_payload", "payload", "qr_string", "deeplink", "content", "qr", "qrurl", "qr_url"]) {
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
  const restaurantName = useRestaurant((state) => state.restaurant?.name);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);
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
  const checkingPaymentRef = useRef(false);
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
    if (!restaurantName) void fetchRestaurant();
  }, [fetchRestaurant, restaurantName]);

  useEffect(() => {
    if (loading) return;
    const targetId = focusSection === "credits" || window.location.hash === "#grow-sms-credits"
      ? "grow-sms-credits"
      : window.location.hash === "#grow-customer-signups"
        ? "grow-customer-signups"
        : null;
    if (!targetId) return;
    document.getElementById(targetId)?.scrollIntoView({
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

  const checkSmsPayment = useCallback(async (purchaseId: number, silent = false) => {
    if (checkingPaymentRef.current) return;
    checkingPaymentRef.current = true;
    setCheckingPayment(true);
    try {
      const purchase = await growthApi.verifySmsPurchase(purchaseId);
      setSmsPurchase(purchase);
      if (purchase.status === "paid") {
        setSmsWallet(await growthApi.getSmsWallet());
        setSmsPurchase(null);
        toast.success(`${purchase.credits.toLocaleString("en-NP")} SMS credits added.`);
      } else if (purchase.status === "review_required") {
        toast.error("Payment requires manual review because the verified amount did not match.");
      } else if (!silent) {
        toast.info("Payment has not completed yet.");
      }
    } catch (error) {
      if (!silent) toast.error(getApiErrorMessage(error, "Unable to verify Fonepay payment"));
    } finally {
      checkingPaymentRef.current = false;
      setCheckingPayment(false);
    }
  }, []);

  useEffect(() => {
    const purchaseId = smsPurchase?.id;
    if (!purchaseId) return;
    const timer = window.setInterval(() => {
      void checkSmsPayment(purchaseId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [checkSmsPayment, smsPurchase?.id]);

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
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 pb-16 sm:gap-6 sm:px-6 2xl:px-8">
      <GrowPageHeader
        title="Grow settings"
        description="Choose how customers join your restaurant and receive offers."
        actions={
          <div className="flex flex-wrap gap-2" aria-label="Enabled messaging channels">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${settings.email_enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-border bg-background/80 text-muted-foreground"}`}>
              <Mail aria-hidden="true" className="h-4 w-4" /> Email {settings.email_enabled ? "on" : "off"}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${settings.sms_enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-border bg-background/80 text-muted-foreground"}`}>
              <MessageSquareText aria-hidden="true" className="h-4 w-4" /> SMS {settings.sms_enabled ? "on" : "off"}
            </span>
          </div>
        }
      />

      <nav aria-label="Grow settings sections" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["grow-customer-signups", "Sign-ups"],
          ["grow-campaign-delivery", "Campaign delivery"],
          ["grow-customer-reach", "Customer reach"],
          ["grow-sms-credits", "SMS credits"],
          ["grow-consent-policy", "Consent policy"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border bg-card px-3 py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card id="grow-customer-signups" aria-labelledby="grow-customer-signups-title" className="scroll-mt-6 h-full overflow-hidden border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-muted/20 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                <QrCode aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <CardTitle id="grow-customer-signups-title" className="text-lg">Customer sign-ups</CardTitle>
                <CardDescription className="mt-1 leading-5">Let guests join your restaurant on Yummy and choose whether they want offers.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <div role="group" aria-label="Customer sign-up controls" className="mx-auto w-full max-w-5xl space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4">
              <div className="min-w-0">
                <p className="font-semibold">Accept new members</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Sign-ups must be on before guests can join your offers list.</p>
              </div>
              <Switch
                aria-label="Accept customer sign-ups"
                checked={Boolean(settings.public_enrollment_enabled)}
                onCheckedChange={(checked) => void toggleCustomerSignup(checked)}
                disabled={savingEnrollment || (!settings.public_enrollment_enabled && !settings.consent_text_hash)}
              />
            </div>
            {signupQr ? (
              <div className="grid gap-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 dark:border-orange-950 dark:bg-orange-950/20 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-5">
                <div className="mx-auto w-36 rounded-2xl border bg-white p-2 shadow-sm sm:w-full">
                  <Image src={signupQr} width={420} height={420} alt="QR code for this restaurant's Yummy customer sign-up" unoptimized className="h-auto w-full rounded-lg" />
                </div>
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold"><Check aria-hidden="true" className="h-4 w-4 text-emerald-600" /> Sign-up QR ready</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">Display it at the counter or on tables. The restaurant is linked after a guest verifies their email.</p>
                  </div>
                  <div role="group" aria-label="Sign-up link" className="grid min-w-0 gap-2 rounded-lg border bg-background/80 p-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <p className="min-w-0 truncate px-2 font-mono text-xs text-muted-foreground" title={signupUrl}>{signupUrl}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void copySignupUrl()} disabled={!settings.public_enrollment_enabled}>
                      <Copy aria-hidden="true" className="mr-2 h-4 w-4" /> Copy link
                    </Button>
                  </div>
                  <div role="group" aria-label="Sign-up QR actions" className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={downloadSignupQr} disabled={!settings.public_enrollment_enabled}>
                      <Download aria-hidden="true" className="mr-2 h-4 w-4" /> Download QR
                    </Button>
                    <RewardsSignupPoster restaurantName={restaurantName || "Your restaurant"} restaurantId={restaurantId || "restaurant"} signupQr={signupQr} />
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Customer menu address is not configured</AlertTitle>
                <AlertDescription>Customer sign-up is not available yet. Contact Yummy support to connect your public menu address.</AlertDescription>
              </Alert>
            )}
            </div>
          </CardContent>
        </Card>

        <Card id="grow-campaign-delivery" role="region" aria-labelledby="grow-campaign-delivery-title" className="scroll-mt-6 h-full border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-muted/20 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"><MessageSquareText aria-hidden="true" className="h-5 w-5" /></span>
              <div>
                <CardTitle id="grow-campaign-delivery-title" className="text-lg">Campaign delivery</CardTitle>
                <CardDescription className="mt-1 leading-5">Choose which tools your team can use when preparing offers.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
            <div className="flex min-h-28 items-start justify-between gap-3 rounded-2xl border bg-background p-4">
              <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"><Mail aria-hidden="true" className="h-4 w-4" /></span><div><p className="font-semibold">Email offers</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Send campaigns to members who choose email.</p></div></div>
              <Switch aria-label="Enable email delivery" checked={Boolean(settings.email_enabled)} onCheckedChange={(checked) => void toggleEmail(checked)} disabled={savingEmail} />
            </div>
            <div className="flex min-h-28 items-start justify-between gap-3 rounded-2xl border bg-background p-4">
              <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><MessageSquareText aria-hidden="true" className="h-4 w-4" /></span><div><p className="font-semibold">SMS offers</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Send text campaigns to opted-in members.</p></div></div>
              <Switch aria-label="Enable SMS campaigns" checked={Boolean(settings.sms_enabled)} onCheckedChange={(checked) => void toggleSms(checked)} disabled={savingSms} />
            </div>
            <div className="flex min-h-28 items-start justify-between gap-3 rounded-2xl border bg-background p-4 sm:col-span-2 xl:col-span-1">
              <div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Sparkles aria-hidden="true" className="h-4 w-4" /></span><div><p className="font-semibold">Writing suggestions</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Suggest message ideas; switch off to use Yummy templates only.</p></div></div>
              <Switch aria-label="Enable campaign writing suggestions" checked={Boolean(settings.ai_copy_enabled)} onCheckedChange={(checked) => void toggleAiCopy(checked)} disabled={savingAiCopy} />
            </div>
          </CardContent>
        </Card>

        <Card id="grow-customer-reach" aria-labelledby="grow-customer-reach-title" className="scroll-mt-6 h-full border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20 p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><UsersRound aria-hidden="true" className="h-5 w-5" /></span><div><CardTitle id="grow-customer-reach-title" className="text-lg">Customer reach</CardTitle><CardDescription className="mt-1 leading-5">Set a respectful pace and quiet time for restaurant messages.</CardDescription></div></div>
          </CardHeader>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Clock3 aria-hidden="true" className="h-4 w-4" /></span><div><p className="font-semibold">Quiet hours</p><p className="mt-1 text-sm leading-5 text-muted-foreground">No scheduled campaign messages during this window, using your restaurant&apos;s local time.</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium"><span>Starts at</span><Input name="campaign_quiet_hours_start" autoComplete="off" type="time" value={quietHoursStart} onChange={(event) => setQuietHoursStart(event.target.value)} disabled={savingQuietHours} /></label>
                <label className="space-y-2 text-sm font-medium"><span>Ends at</span><Input name="campaign_quiet_hours_end" autoComplete="off" type="time" value={quietHoursEnd} onChange={(event) => setQuietHoursEnd(event.target.value)} disabled={savingQuietHours} /></label>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Blocked from {quietHoursStart} to {quietHoursEnd}</span><Button type="button" size="sm" variant="outline" onClick={() => void saveQuietHours()} disabled={savingQuietHours || quietHoursStart === quietHoursEnd}>{savingQuietHours ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}Save quiet hours</Button></div>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><UsersRound aria-hidden="true" className="h-4 w-4" /></span><div><p className="font-semibold">Time between offers</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Apply this minimum wait across campaign channels for each customer.</p></div></div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <label className="space-y-2 text-sm font-medium" htmlFor="promotion-frequency-cap"><span className="block">Wait at least</span><span className="flex items-center gap-2"><Input id="promotion-frequency-cap" name="promotion_frequency_cap_days" type="number" inputMode="numeric" autoComplete="off" min={1} max={90} step={1} value={frequencyCapDays} onChange={(event) => setFrequencyCapDays(Number(event.target.value))} disabled={savingFrequencyCap} className="w-24 tabular-nums" /><span className="text-sm text-muted-foreground">days</span></span></label>
                <Button type="button" size="sm" variant="outline" onClick={() => void saveFrequencyCap()} disabled={savingFrequencyCap || frequencyCapDays === settings.promotion_frequency_cap_days || !Number.isInteger(frequencyCapDays) || frequencyCapDays < 1 || frequencyCapDays > 90}>{savingFrequencyCap ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}Save limit</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="grow-sms-credits" aria-labelledby="grow-sms-credits-title" className="scroll-mt-6 h-full overflow-hidden border-orange-200 shadow-sm dark:border-orange-950">
          <CardHeader className="border-b border-orange-100 bg-orange-50/70 p-5 dark:border-orange-950 dark:bg-orange-950/20 sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-orange-700 shadow-sm dark:bg-orange-950/70 dark:text-orange-300"><WalletCards aria-hidden="true" className="h-5 w-5" /></span><div><CardTitle id="grow-sms-credits-title" className="text-lg">SMS credits</CardTitle><CardDescription className="mt-1 leading-5">Check your balance and top up before sending text offers.</CardDescription></div></div>
          </CardHeader>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {creditLoadError ? <Alert><TriangleAlert aria-hidden="true" className="h-4 w-4" /><AlertTitle>SMS balance unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{creditLoadError}</span><Button type="button" variant="outline" size="sm" onClick={() => void load()}>Try Again</Button></AlertDescription></Alert> : null}
            <div className="grid gap-4 rounded-2xl bg-slate-950 p-5 text-white dark:bg-slate-900 sm:grid-cols-[1fr_auto] sm:items-end">
              <div><p className="text-sm font-medium text-slate-300">Ready to send</p><p className="mt-1 text-4xl font-bold tabular-nums">{smsWallet?.available_credits.toLocaleString("en-NP") ?? "—"}</p><p className="mt-1 text-xs text-slate-300">credits available</p></div>
              <div className="border-t border-white/15 pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="text-sm text-slate-300">Reserved for scheduled</p><p className="mt-1 text-xl font-bold tabular-nums">{smsWallet?.reserved_credits.toLocaleString("en-NP") ?? "—"}</p></div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Each text uses at least 1 credit. Longer messages may use more.</p>
            {smsPackages.length ? <div className="grid gap-3 sm:grid-cols-2">{smsPackages.map((item) => <div key={item.code} className="rounded-2xl border bg-background p-4"><p className="text-2xl font-bold tabular-nums">{item.credits.toLocaleString("en-NP")}</p><p className="text-sm text-muted-foreground">SMS credits</p><p className="mt-3 font-semibold">NPR {Number(item.price_npr).toLocaleString("en-NP")}</p><Button className="mt-4 w-full" onClick={() => void buySmsCredits(item.code)} disabled={buyingPackage !== null}>{buyingPackage === item.code ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <CreditCard aria-hidden="true" className="mr-2 h-4 w-4" />}Buy credits</Button></div>)}</div> : !creditLoadError ? <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Credit purchases are not enabled for this restaurant. Contact Yummy support to add credits.</div> : null}
          </CardContent>
        </Card>

        <Card id="grow-consent-policy" aria-labelledby="grow-consent-policy-title" className="scroll-mt-6 border-border/80 shadow-sm lg:col-span-2">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:p-6">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><ShieldCheck aria-hidden="true" className="h-5 w-5" /></span><div><CardTitle id="grow-consent-policy-title" className="text-lg">Consent policy</CardTitle><CardDescription className="mt-1 leading-5">Yummy records each member&apos;s choice before offers are sent.</CardDescription><span className="mt-3 inline-flex rounded-full border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">Policy version {settings.consent_policy_version || "—"}</span></div></div>
            <blockquote className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/60 px-5 py-4 text-sm leading-6 text-foreground dark:bg-emerald-950/20">{settings.consent_text || "Consent policy unavailable."}</blockquote>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(smsPurchase)} onOpenChange={(open) => { if (!open) setSmsPurchase(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Buy SMS Credits</DialogTitle><DialogDescription>Scan with Fonepay to pay NPR {Number(smsPurchase?.amount_npr || 0).toLocaleString("en-NP")} for {smsPurchase?.credits.toLocaleString("en-NP")} credits.</DialogDescription></DialogHeader>
          <div className="space-y-4 text-center">
            {purchaseQr ? <Image src={purchaseQr} width={300} height={300} alt="Fonepay payment QR" unoptimized className="mx-auto rounded-xl bg-white p-3" /> : <Alert><TriangleAlert className="h-4 w-4" /><AlertDescription>Fonepay did not return a displayable QR payload.</AlertDescription></Alert>}
            <Button className="w-full" onClick={() => smsPurchase && void checkSmsPayment(smsPurchase.id)} disabled={checkingPayment || smsPurchase?.status === "paid"}>
              {checkingPayment ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />}{smsPurchase?.status === "paid" ? "Payment Verified" : "Check My Payment"}
            </Button>
            <p className="text-xs text-muted-foreground">Credits are added only after Yummy verifies the exact amount with Fonepay.</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
