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
import { Textarea } from "@/components/ui/textarea";
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

export function GrowthSettingsClient() {
  const { user } = useAuth();
  const canManageSettings = hasPermission(user, "grow.settings.manage");
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [savingConsentPolicy, setSavingConsentPolicy] = useState(false);
  const [savingQuietHours, setSavingQuietHours] = useState(false);
  const [savingFrequencyCap, setSavingFrequencyCap] = useState(false);
  const [consentPolicyVersion, setConsentPolicyVersion] = useState("");
  const [consentText, setConsentText] = useState("");
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
    try {
      const [data, wallet, packages] = await Promise.all([
        growthApi.getSettings(), growthApi.getSmsWallet(), growthApi.getSmsPackages(),
      ]);
      setSettings(data);
      setConsentPolicyVersion(data.consent_policy_version || "");
      setConsentText(data.consent_text || "");
      setQuietHoursStart(data.quiet_hours_start.slice(0, 5));
      setQuietHoursEnd(data.quiet_hours_end.slice(0, 5));
      setFrequencyCapDays(data.promotion_frequency_cap_days);
      setSmsWallet(wallet);
      setSmsPackages(packages);
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
    if (enabled && (!settings.consent_policy_version || !settings.consent_text_hash)) {
      toast.error("Save the customer consent policy before enabling sign-up.");
      return;
    }
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

  const saveConsentPolicy = async () => {
    const version = consentPolicyVersion.trim();
    const text = consentText.trim();
    if (!version || !text) {
      toast.error("Consent policy version and consent text are both required.");
      return;
    }
    setSavingConsentPolicy(true);
    try {
      const updated = await growthApi.updateSettings({
        consent_policy_version: version,
        consent_text: text,
      });
      setSettings(updated);
      setConsentPolicyVersion(updated.consent_policy_version || "");
      setConsentText(updated.consent_text || "");
      toast.success("Consent policy saved. Public sign-up can now be enabled.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save consent policy"));
    } finally {
      setSavingConsentPolicy(false);
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
          Managing campaign delivery and consent settings requires the grow.settings.manage permission.
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
        Manage campaign delivery, consent wording, quiet hours, and frequency limits.
      </p>

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
                Set NEXT_PUBLIC_CUSTOMER_MENU_BASE_URL to the public address of the Yummy customer menu.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery channels</CardTitle>
          <CardDescription>
            Turn a channel off to stop new sends immediately without affecting the other channel or
            any campaign already in flight elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  type="time"
                  value={quietHoursStart}
                  onChange={(event) => setQuietHoursStart(event.target.value)}
                  disabled={savingQuietHours}
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Ends at</span>
                <Input
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
                <span className="block">Frequency cap</span>
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
                Save frequency cap
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">SMS campaigns enabled</p>
              <p className="text-xs text-muted-foreground">
                Enables SMS consent and campaign preparation. Live sending still requires a configured provider and credits.
              </p>
            </div>
            <Switch
              checked={Boolean(settings?.sms_enabled)}
              onCheckedChange={(checked) => void toggleSms(checked)}
              disabled={savingSms}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Email delivery enabled</p>
              <p className="text-xs text-muted-foreground">
                Required before any email campaign can be scheduled or sent.
              </p>
            </div>
            <Switch
              checked={Boolean(settings?.email_enabled)}
              onCheckedChange={(checked) => void toggleEmail(checked)}
              disabled={savingEmail}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">AI copy generation enabled</p>
              <p className="text-xs text-muted-foreground">
                When enabled, uses AI to suggest campaign copy. When disabled, uses system templates.
              </p>
            </div>
            <Switch
              checked={Boolean(settings?.ai_copy_enabled)}
              onCheckedChange={(checked) => void toggleAiCopy(checked)}
              disabled={savingAiCopy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMS credits</CardTitle>
          <CardDescription>Prepaid credits are consumed by SMS segments, not simply by customer count.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div><p className="text-sm text-muted-foreground">Available balance</p><p className="text-3xl font-black tabular-nums">{smsWallet?.available_credits.toLocaleString("en-NP") ?? "—"}</p></div>
            <div className="text-right"><p className="text-sm text-muted-foreground">Reserved</p><p className="text-lg font-bold tabular-nums">{smsWallet?.reserved_credits.toLocaleString("en-NP") ?? "—"}</p></div>
          </div>
          {smsPackages.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {smsPackages.map((item) => (
                <div key={item.code} className="rounded-xl border p-4">
                  <p className="font-bold">{item.label}</p>
                  <p className="mt-1 text-2xl font-black">{item.credits.toLocaleString("en-NP")}</p>
                  <p className="text-xs text-muted-foreground">credits · NPR {Number(item.price_npr).toLocaleString("en-NP")}</p>
                  <Button className="mt-4 w-full" onClick={() => void buySmsCredits(item.code)} disabled={buyingPackage !== null}>
                    {buyingPackage === item.code ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Buy with Fonepay
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert><TriangleAlert className="h-4 w-4" /><AlertTitle>Credit sales are not configured</AlertTitle><AlertDescription>Yummy must configure its Fonepay merchant and approved SMS package prices before purchases can be accepted.</AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(smsPurchase)} onOpenChange={(open) => { if (!open) setSmsPurchase(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pay with Fonepay</DialogTitle><DialogDescription>Scan and pay NPR {Number(smsPurchase?.amount_npr || 0).toLocaleString("en-NP")} for {smsPurchase?.credits.toLocaleString("en-NP")} SMS credits.</DialogDescription></DialogHeader>
          <div className="space-y-4 text-center">
            {purchaseQr ? <Image src={purchaseQr} width={300} height={300} alt="Fonepay payment QR" unoptimized className="mx-auto rounded-xl bg-white p-3" /> : <Alert><TriangleAlert className="h-4 w-4" /><AlertDescription>Fonepay did not return a displayable QR payload.</AlertDescription></Alert>}
            <p className="font-mono text-xs text-muted-foreground">{smsPurchase?.provider_reference}</p>
            <Button className="w-full" onClick={() => void checkSmsPayment()} disabled={checkingPayment || smsPurchase?.status === "paid"}>
              {checkingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{smsPurchase?.status === "paid" ? "Payment verified" : "I paid — check status"}
            </Button>
            <p className="text-xs text-muted-foreground">Credits are added only after Yummy verifies the exact amount with Fonepay.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Customer marketing consent</CardTitle>
          <CardDescription>
            This wording records the policy customers accept from their Yummy account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-semibold">Customer consent policy</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This text is recorded with each customer opt-in. Review it for your business before
                enabling marketing campaigns.
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Policy version</span>
              <Input
                value={consentPolicyVersion}
                onChange={(event) => setConsentPolicyVersion(event.target.value)}
                placeholder="For example: 2026-10"
                maxLength={80}
                disabled={savingConsentPolicy}
              />
              <span className="block text-xs text-muted-foreground">
                Change this version whenever the consent wording changes.
              </span>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Consent text shown to customers</span>
              <Textarea
                value={consentText}
                onChange={(event) => setConsentText(event.target.value)}
                placeholder="I agree to receive marketing messages from this restaurant through the channels I select. I can unsubscribe at any time."
                rows={5}
                maxLength={4000}
                disabled={savingConsentPolicy}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveConsentPolicy()}
                disabled={
                  savingConsentPolicy ||
                  !consentPolicyVersion.trim() ||
                  !consentText.trim()
                }
              >
                {savingConsentPolicy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save reviewed policy
              </Button>
              {settings?.consent_text_hash ? (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Saved policy: {settings.consent_policy_version}
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Required before customer marketing opt-in can be recorded
                </span>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
