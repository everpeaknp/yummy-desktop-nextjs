"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import QRCode from "qrcode";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Crown,
  Download,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UsageIndicator } from "@/components/subscription/usage-indicator";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { subscriptionApi } from "@/lib/subscription/api";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  billingIntervals,
  currentPlanDisplayName,
  formatPrice,
  planBillingSavings,
  planFeatures,
  planMarketingBadge,
  priceTypeLabel,
  pricesForInterval,
  subscriptionPeriodEnd,
} from "@/lib/subscription/entitlements";
import type { SubscriptionFonepayCheckout, SubscriptionPlan } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "yummyever.np@gmail.com";
const supportWhatsapp = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const visibleFeatureLimit = 5;

type ContactDraft = {
  subject: string;
  message: string;
};

function gmailComposeHref(draft: ContactDraft): string {
  const parameters = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: supportEmail,
    su: draft.subject,
    body: draft.message,
  });
  return `https://mail.google.com/mail/?${parameters.toString()}`;
}

function contactClipboardText(draft: ContactDraft): string {
  return `To: ${supportEmail}\nSubject: ${draft.subject}\n\n${draft.message}`;
}

type ContactFormState = {
  fullName: string;
  emailAddress: string;
  message: string;
};

function intervalLabel(months: number | null): string {
  if (months == null) return "No fixed term";
  if (months === 12) return "Annual";
  if (months === 6) return "6 months";
  if (months === 1) return "Monthly";
  return `${months} months`;
}

function statusLabel(status: string | null | undefined): string {
  const value = (status || "unknown").replace(/_/g, " ");
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, "PPP");
}

function formatCatalogVersion(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy · HH:mm");
}

function statusBadgeVariant(status: string | null | undefined): "default" | "secondary" | "outline" {
  const normalized = (status || "").toLowerCase();
  if (normalized === "active" || normalized === "trialing") return "default";
  if (normalized === "past_due" || normalized === "canceled" || normalized === "cancelled") {
    return "secondary";
  }
  return "outline";
}

function formatMoney(value: number, currency = "NPR") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type PlanFeatureItem = {
  label: string;
  included: boolean;
};

function PlanFeatureList({ features, planCode, onShowMore }: { features: PlanFeatureItem[]; planCode: string; onShowMore: (planCode: string) => void }) {
  const visibleFeatures = features.slice(0, visibleFeatureLimit);
  const hiddenFeatures = features.slice(visibleFeatureLimit);
  const hasMoreFeatures = hiddenFeatures.length > 0;

  if (!features.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Detailed entitlements are being prepared.
      </p>
    );
  }

  return (
    <div className="shrink-0 space-y-3">
      <div className="space-y-3">
        {visibleFeatures.map((feature, index) => (
          <div
            key={`${feature.label}-${index}`}
            className="flex h-5 items-center gap-2.5 text-sm leading-5"
          >
            {feature.included ? (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span
              title={feature.label}
              className={cn("truncate", !feature.included && "text-muted-foreground")}
            >
              {feature.label}
            </span>
          </div>
        ))}
      </div>

      {hasMoreFeatures ? (
        <button
          type="button"
          onClick={() => onShowMore(planCode)}
          className="flex h-5 w-full items-center gap-2.5 text-sm leading-5 text-left transition-colors hover:text-primary"
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate font-medium text-primary">
            +{hiddenFeatures.length} more included capabilities
          </span>
        </button>
      ) : null}
    </div>
  );
}

export default function PremiumPage() {
  const restaurant = useRestaurant((state) => state.restaurant);
  const catalog = useSubscriptionStore((state) => state.catalog);
  const current = useSubscriptionStore((state) => state.current);
  const usage = useSubscriptionStore((state) => state.usage);
  const invoices = useSubscriptionStore((state) => state.invoices);
  const catalogLoading = useSubscriptionStore((state) => state.catalogLoading);
  const currentLoading = useSubscriptionStore((state) => state.currentLoading);
  const usageLoading = useSubscriptionStore((state) => state.usageLoading);
  const invoicesLoading = useSubscriptionStore((state) => state.invoicesLoading);
  const requestLoading = useSubscriptionStore((state) => state.requestLoading);
  const catalogError = useSubscriptionStore((state) => state.catalogError);
  const currentError = useSubscriptionStore((state) => state.currentError);
  const usageError = useSubscriptionStore((state) => state.usageError);
  const invoicesError = useSubscriptionStore((state) => state.invoicesError);
  const requestError = useSubscriptionStore((state) => state.requestError);
  const refreshAll = useSubscriptionStore((state) => state.refreshAll);
  const requestUpgrade = useSubscriptionStore((state) => state.requestUpgrade);

  const intervals = useMemo(() => billingIntervals(catalog), [catalog]);
  const [selectedInterval, setSelectedInterval] = useState(12);
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null);
  const [savedRequestPlan, setSavedRequestPlan] = useState<string | null>(null);
  const [selectedAddonCodes, setSelectedAddonCodes] = useState<string[]>([]);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>({
    fullName: "",
    emailAddress: "",
    message: "",
  });
  const [featureListPlan, setFeatureListPlan] = useState<string | null>(null);
  const [fonepayCheckout, setFonepayCheckout] = useState<SubscriptionFonepayCheckout | null>(null);
  const [purchasePlan, setPurchasePlan] = useState<SubscriptionPlan | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [paymentQr, setPaymentQr] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [cancelCheckoutOpen, setCancelCheckoutOpen] = useState(false);
  const [checkoutClock, setCheckoutClock] = useState(() => Date.now());
  const checkoutInvoiceId = fonepayCheckout?.invoice_id;
  const checkoutPrn = fonepayCheckout?.prn;
  const checkoutStatus = fonepayCheckout?.status;

  useEffect(() => {
    void refreshAll({ restaurantId: restaurant?.id ?? null });
  }, [refreshAll, restaurant?.id]);

  useEffect(() => {
    if (!intervals.length) return;
    if (!intervals.includes(selectedInterval)) {
      setSelectedInterval(intervals.includes(12) ? 12 : intervals[0]);
    }
  }, [intervals, selectedInterval]);

  useEffect(() => {
    const payload = fonepayCheckout?.qr_payload?.qrMessage;
    if (!payload) { setPaymentQr(""); return; }
    QRCode.toDataURL(String(payload), { width: 420, margin: 2, errorCorrectionLevel: "M" })
      .then(setPaymentQr).catch(() => setPaymentQr(""));
  }, [fonepayCheckout]);

  useEffect(() => {
    if (checkoutStatus !== "pending") return;
    setCheckoutClock(Date.now());
    const timer = window.setInterval(() => setCheckoutClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [checkoutStatus, checkoutInvoiceId]);

  useEffect(() => {
    if (!checkoutInvoiceId || !checkoutPrn || checkoutStatus !== "pending") return;
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const checkout = await subscriptionApi.verifyFonepayCheckout(
          checkoutInvoiceId,
          checkoutPrn,
          restaurant?.id ?? null,
        );
        if (!active) return;
        setFonepayCheckout((current) => current ? { ...current, ...checkout } : checkout);
        if (checkout.status === "paid") {
          toast.success("Payment verified. Your plan is active.");
          await refreshAll({ force: true, restaurantId: restaurant?.id ?? null });
        } else if (checkout.status === "review_required") {
          toast.error("Payment needs manual review because the verified amount did not match.");
        }
      } catch {
        // Transient provider/network failures are retried; the protected backend
        // reconciler remains the fallback when this browser is closed.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 4_000);
    void poll();
    return () => { active = false; window.clearInterval(timer); };
  }, [checkoutInvoiceId, checkoutPrn, checkoutStatus, refreshAll, restaurant?.id]);

  useEffect(() => {
    if (checkoutStatus !== "expired") return;
    toast.info("Checkout expired. No invoice was added to your billing history.");
    setPurchasePlan(null);
    setFonepayCheckout(null);
    void refreshAll({ force: true, restaurantId: restaurant?.id ?? null });
  }, [checkoutStatus, refreshAll, restaurant?.id]);

  const startPlanPurchase = async () => {
    if (!purchasePlan) return;
    const pricing = pricesForInterval(purchasePlan, selectedInterval);
    if (!pricing.billingIntervalMonths) return;
    setPaymentBusy(true);
    try {
      setFonepayCheckout(await subscriptionApi.createCheckout({
        plan_code: purchasePlan.code,
        billing_interval_months: pricing.billingIntervalMonths,
        promo_code: promoCode.trim() || null,
      }, restaurant?.id ?? null));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create subscription checkout."));
    } finally {
      setPaymentBusy(false);
    }
  };

  const openPlanPurchase = (plan: SubscriptionPlan) => {
    setPurchasePlan(plan);
    setPromoCode("");
    setFonepayCheckout(null);
  };

  const downloadPaymentQr = () => {
    if (!paymentQr || !fonepayCheckout) return;
    const link = document.createElement("a");
    link.href = paymentQr;
    link.download = `yummy-${fonepayCheckout.prn}-fonepay.png`;
    link.click();
  };

  const verifyFonepayPayment = async () => {
    if (!fonepayCheckout) return;
    setPaymentBusy(true);
    try {
      const checkout = await subscriptionApi.verifyFonepayCheckout(
        fonepayCheckout.invoice_id, fonepayCheckout.prn, restaurant?.id ?? null,
      );
      setFonepayCheckout(checkout);
      if (checkout.status === "paid") {
        toast.success("Subscription payment verified.");
        await refreshAll({ force: true, restaurantId: restaurant?.id ?? null });
      } else if (checkout.status === "review_required") {
        toast.error("Payment needs manual review because the verified amount did not match.");
      } else {
        toast.info("Payment has not completed yet.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to verify Fonepay payment."));
    } finally { setPaymentBusy(false); }
  };

  const cancelFonepayPayment = async () => {
    if (!fonepayCheckout || fonepayCheckout.status !== "pending") return;
    setPaymentBusy(true);
    try {
      const checkout = await subscriptionApi.supersedeFonepayCheckout(
        fonepayCheckout.invoice_id, fonepayCheckout.prn, restaurant?.id ?? null,
      );
      if (checkout.status === "paid") {
        setFonepayCheckout((current) => current ? { ...current, ...checkout } : checkout);
        toast.success("Payment was already completed. Your subscription is active.");
        await refreshAll({ force: true, restaurantId: restaurant?.id ?? null });
        return;
      }
      if (checkout.status === "review_required") {
        setFonepayCheckout((current) => current ? { ...current, ...checkout } : checkout);
        toast.error("This payment needs manual review and cannot be replaced yet.");
        return;
      }
      setPurchasePlan(null);
      setFonepayCheckout(null);
      toast.info("Checkout closed. You can choose another plan.");
      await refreshAll({ force: true, restaurantId: restaurant?.id ?? null });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to close this subscription checkout."));
    } finally {
      setPaymentBusy(false);
    }
  };

  const closePurchaseDialog = () => {
    if (fonepayCheckout?.status === "pending") {
      setCancelCheckoutOpen(true);
      return;
    }
    setPurchasePlan(null);
    setFonepayCheckout(null);
  };

  const checkoutExpiresAt = fonepayCheckout?.summary?.expires_at
    ? new Date(fonepayCheckout.summary.expires_at).getTime()
    : Number.NaN;
  const checkoutSecondsRemaining = Number.isNaN(checkoutExpiresAt)
    ? null
    : Math.max(0, Math.ceil((checkoutExpiresAt - checkoutClock) / 1_000));

  const mergedUsage = Object.keys(usage).length ? usage : current?.usage ?? {};
  const currentCode = (
    current?.subscription?.plan_code ||
    current?.effective_plan ||
    restaurant?.subscription?.plan_code ||
    restaurant?.effective_plan ||
    "free"
  ).toLowerCase();
  const currentStatus = current?.subscription?.status || current?.plan_state || restaurant?.plan_state;
  const periodEnd = formatDate(subscriptionPeriodEnd(current) || restaurant?.subscription?.current_period_end);
  const catalogUpdated = formatCatalogVersion(catalog?.catalog_version);
  const planVersion = current?.subscription?.plan_version;
  const activeAddons = current?.addons ?? [];
  const purchasePricing = purchasePlan ? pricesForInterval(purchasePlan, selectedInterval) : null;
  const purchasePrice = purchasePricing?.initial ?? purchasePricing?.renewal ?? null;

  const planContactDraft = (plan: SubscriptionPlan): ContactDraft => {
    const pricing = pricesForInterval(plan, selectedInterval);
    const billingIntervalMonths =
      currentCode === plan.code && selectedAddonCodes.length > 0
        ? current?.subscription?.billing_interval_months ?? pricing.billingIntervalMonths
        : pricing.billingIntervalMonths;
    const addonText = selectedAddonCodes.length
      ? ` with add-ons: ${selectedAddonCodes.join(", ")}`
      : "";
    const message = `Hello Yummy Team, I saved a plan request for ${restaurant?.name || "my restaurant"} to the ${plan.name} plan (${intervalLabel(billingIntervalMonths)})${addonText}.`;
    return {
      subject: `${plan.name} plan request`,
      message,
    };
  };

  const openContact = (draft: ContactDraft) => {
    if (supportWhatsapp) {
      window.open(
        `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(draft.message)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    setContactDraft(draft);
    setContactForm({
      fullName: restaurant?.name || "",
      emailAddress: "",
      message: draft.message,
    });
  };

  const copyContactDetails = async () => {
    if (!contactDraft) return;
    const subject = contactDraft.subject || "Yummy plan support";
    const message = [
      `Name: ${contactForm.fullName || "Not provided"}`,
      `Email: ${contactForm.emailAddress || "Not provided"}`,
      "",
      contactForm.message || contactDraft.message,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(contactClipboardText({ subject, message }));
      toast.success("Contact details copied.");
    } catch {
      toast.error(`Unable to copy automatically. Email us at ${supportEmail}.`);
    }
  };

  const submitContactForm = () => {
    if (!contactDraft) return;
    const subject = contactDraft.subject || "Yummy plan support";
    const message = [
      `Name: ${contactForm.fullName || "Not provided"}`,
      `Email: ${contactForm.emailAddress || "Not provided"}`,
      "",
      contactForm.message || contactDraft.message,
    ].join("\n");

    window.open(
      gmailComposeHref({ subject, message }),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handlePlanRequest = async (plan: SubscriptionPlan) => {
    if (plan.code.toLowerCase() === "free") {
      return;
    }
    const selectedAddons = (catalog?.addons ?? []).filter((addon) =>
      selectedAddonCodes.includes(addon.code),
    );
    const incompatibleAddons = selectedAddons.filter(
      (addon) =>
        addon.compatible_plan_codes.length > 0 &&
        !addon.compatible_plan_codes
          .map((code) => code.toLowerCase())
          .includes(plan.code),
    );
    if (incompatibleAddons.length) {
      toast.error(
        `${incompatibleAddons.map((addon) => addon.name).join(", ")} cannot be requested with ${plan.name}.`,
      );
      return;
    }

    setRequestingPlan(plan.code);
    try {
      const pricing = pricesForInterval(plan, selectedInterval);
      const billingIntervalMonths =
        currentCode === plan.code && selectedAddons.length > 0
          ? current?.subscription?.billing_interval_months ?? pricing.billingIntervalMonths
          : pricing.billingIntervalMonths;
      const requestMessage = `Requested from the web pricing page for restaurant ${restaurant?.name || restaurant?.id || "current"}${selectedAddons.length ? ` with add-ons ${selectedAddons.map((addon) => addon.name).join(", ")}` : ""}.`;
      await requestUpgrade({
        requested_plan_code: plan.code,
        billing_interval_months: billingIntervalMonths,
        requested_addon_codes: selectedAddons.map((addon) => addon.code),
        message: requestMessage.slice(0, 2000),
      });
      setSavedRequestPlan(plan.code);
      toast.success(`${plan.name} request saved. The Yummy team can now follow it up.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save the plan request. Please try again."));
    } finally {
      setRequestingPlan(null);
    }
  };

  const refresh = () => void refreshAll({ restaurantId: restaurant?.id ?? null, force: true });

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-10 px-4 py-8 md:px-6 lg:py-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Crown aria-hidden="true" className="h-4 w-4" />
            Billing & subscription
          </div>
          <h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight md:text-4xl">A plan that fits your restaurant</h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground md:text-base">
            Compare what matters, choose your billing period, and activate securely with Fonepay.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={catalogLoading || currentLoading || usageLoading}>
          <RefreshCw aria-hidden="true" className={cn("mr-2 h-4 w-4", (catalogLoading || currentLoading || usageLoading) && "animate-spin motion-reduce:animate-none")} />
          Refresh
        </Button>
      </div>

      <Card className="border-primary/15 bg-primary/[0.025] shadow-none">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Your current plan
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                  {currentLoading && !current
                    ? "Loading plan…"
                    : currentPlanDisplayName(current, restaurant)}
                </h2>
                {currentStatus ? (
                  <Badge variant={statusBadgeVariant(currentStatus)}>
                    {statusLabel(currentStatus)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {[
                  periodEnd ? `Period ends ${periodEnd}` : null,
                  planVersion != null ? `Version ${planVersion}` : null,
                  activeAddons.length
                    ? `${activeAddons.length} add-on${activeAddons.length === 1 ? "" : "s"}`
                    : "No add-ons",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {catalogUpdated ? (
              <p className="shrink-0 text-xs text-muted-foreground sm:pt-1">
                Updated {catalogUpdated}
              </p>
            ) : null}
          </div>

          <details>
            <summary className="w-fit cursor-pointer list-none rounded-lg border bg-background px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              View current usage
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {usageLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" /> : null}
              {Object.keys(mergedUsage).length ? Object.entries(mergedUsage).map(([key, value]) => (
                <UsageIndicator key={key} entitlementKey={key} usage={value} compact />
              )) : <p className="col-span-full rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Usage counters are not available yet.</p>}
            </div>
          </details>
        </CardContent>
      </Card>

      {(currentError || usageError) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Some account details could not be refreshed</AlertTitle>
          <AlertDescription>{currentError || usageError}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Choose your plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">See the essential differences first. Review every included feature before buying.</p>
          </div>
          {intervals.length > 0 && (
            <div className="inline-flex w-fit rounded-xl border bg-muted/40 p-1">
              {intervals.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setSelectedInterval(months)}
                  aria-pressed={selectedInterval === months}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-semibold transition",
                    selectedInterval === months ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {intervalLabel(months)}
                </button>
              ))}
            </div>
          )}
        </div>

        {catalogError && !catalog ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Plans are unavailable</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{catalogError}</p>
              <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
            </AlertDescription>
          </Alert>
        ) : catalogLoading && !catalog ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[480px] animate-pulse rounded-2xl border bg-muted/30 motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <>
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog?.plans.map((plan) => {
              const prices = pricesForInterval(plan, selectedInterval);
              const primaryPrice = prices.initial ?? prices.renewal;
              const renewal = prices.initial ? prices.renewal : null;
              const features = planFeatures(plan);
              const isCurrent = currentCode === plan.code;
              const isFreePlan = plan.code.toLowerCase() === "free";
              const canRequest =
                !isFreePlan && (
                  (isCurrent && selectedAddonCodes.length > 0) ||
                  prices.quoteOnly ||
                  Boolean(primaryPrice)
                );
              const isRequesting = requestingPlan === plan.code && requestLoading;
              const showContact = savedRequestPlan === plan.code;
              const badge = planMarketingBadge(plan);
              const savings = selectedInterval === 12 ? planBillingSavings(plan) : null;

              return (
                <Card
                  key={String(plan.id)}
                  className={cn(
                    "relative flex h-full min-h-[470px] flex-col overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none",
                    isCurrent && "border-2 border-primary/80 shadow-md shadow-primary/5",
                    badge && !isCurrent && "border-primary/35",
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest",
                      isCurrent || badge ? "bg-primary text-primary-foreground" : "invisible",
                    )}
                    aria-hidden={!isCurrent && !badge}
                  >
                    {isCurrent ? "Current plan" : badge || "Plan"}
                  </div>
                  <CardHeader className="shrink-0 space-y-2 pb-4 pt-5">
                    <CardTitle className="flex items-center justify-between gap-3 text-2xl font-semibold tracking-tight">
                      <span className="truncate">{plan.name}</span>
                      {prices.quoteOnly ? <Badge variant="outline">Custom</Badge> : null}
                    </CardTitle>
                    {(plan.current_version?.subtitle || plan.description) ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {plan.current_version?.subtitle || plan.description}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-5 pt-0">
                    <div
                      className="flex min-h-[148px] shrink-0 flex-col justify-between rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-background p-5"
                    >
                      {prices.quoteOnly ? (
                        <>
                          <div>
                            <p className="text-2xl font-semibold tracking-tight">Let&apos;s chat</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Custom - {intervalLabel(prices.billingIntervalMonths)}
                            </p>
                          </div>
                          <div className="mt-3 min-h-[52px] border-t pt-3 text-sm">
                            <span className="font-semibold">Renewal: On request</span>
                            <span className="ml-1 text-muted-foreground">
                              per {intervalLabel(prices.billingIntervalMonths).toLowerCase()}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">Tax and terms defined in contract</p>
                        </>
                      ) : primaryPrice ? (
                        <>
                          <div>
                            <p className="text-3xl font-semibold tracking-tight tabular-nums">
                              {formatPrice(primaryPrice.amount, primaryPrice.currency)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {priceTypeLabel(primaryPrice)} - {intervalLabel(prices.billingIntervalMonths)}
                            </p>
                          </div>
                          <div className="mt-3 min-h-[52px] border-t pt-3 text-sm">
                            {renewal ? (
                              <>
                                <span className="font-semibold">
                                  Renewal: {formatPrice(renewal.amount, renewal.currency)}
                                </span>
                                <span className="ml-1 text-muted-foreground">
                                  per {intervalLabel(prices.billingIntervalMonths).toLowerCase()}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">No separate renewal price</span>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Tax {primaryPrice.tax_inclusive ? "included" : "not included"}
                          </p>
                          {savings ? <p className="mt-2 w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Save {formatPrice(savings.amount, savings.currency)} annually</p> : null}
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-2xl font-semibold tracking-tight">N/A</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Not offered for this billing cycle.
                            </p>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Choose another period</p>
                        </>
                      )}
                    </div>

                    <PlanFeatureList features={features} planCode={plan.code} onShowMore={setFeatureListPlan} />

                    <div
                      className="mt-auto flex shrink-0 flex-col gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {isFreePlan ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                          Included automatically when your trial or paid access ends.
                        </div>
                      ) : <>
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={
                          (isCurrent && selectedAddonCodes.length === 0) ||
                          !canRequest ||
                          requestLoading ||
                          savedRequestPlan === plan.code
                        }
                        onClick={() => {
                          if (!prices.quoteOnly && !isCurrent && selectedAddonCodes.length === 0) {
                            openPlanPurchase(plan);
                            return;
                          }
                          void handlePlanRequest(plan);
                        }}
                      >
                        {isRequesting ? (
                          <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                        ) : prices.quoteOnly ? (
                          <MessageSquare aria-hidden="true" className="mr-2 h-4 w-4" />
                        ) : (
                          <Crown aria-hidden="true" className="mr-2 h-4 w-4" />
                        )}
                        {savedRequestPlan === plan.code
                          ? "Request saved"
                          : isCurrent && selectedAddonCodes.length > 0
                            ? "Request selected add-ons"
                            : isCurrent
                              ? "Current plan"
                              : prices.quoteOnly
                                ? "Request quote"
                                : selectedAddonCodes.length > 0
                                  ? `Request ${plan.name} + add-ons`
                                  : `Choose ${plan.name}`}
                      </Button>
                      <Button
                        type="button"
                        className={cn("w-full", !showContact && "invisible pointer-events-none")}
                        variant="outline"
                        aria-hidden={!showContact}
                        tabIndex={showContact ? 0 : -1}
                        disabled={!showContact}
                        onClick={() => openContact(planContactDraft(plan))}
                      >
                        <MessageSquare aria-hidden="true" className="mr-2 h-4 w-4" />
                        Contact Yummy (optional)
                      </Button>
                      </>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground sm:grid-cols-3">
            <span className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />Secure Fonepay checkout</span>
            <span className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />Exact amount verification</span>
            <span className="flex items-center gap-2"><FileText aria-hidden="true" className="h-4 w-4 text-primary" />Receipt after payment</span>
          </div>

          {catalog?.addons.some((addon) => addon.is_public) ? <section className="mt-10 space-y-4" aria-labelledby="subscription-addons-title">
            <div>
              <h2 id="subscription-addons-title" className="text-xl font-semibold tracking-tight">Optional add-ons</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add extra capabilities after choosing the plan that fits your restaurant.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.addons.filter((addon) => addon.is_public).map((addon) => {
              const addonPricing = pricesForInterval(addon, selectedInterval);
              const primaryPrice = addonPricing.initial;
              const quoteOnly = addonPricing.quoteOnly;
              const selected = selectedAddonCodes.includes(addon.code);
              return (
                <Card
                  key={String(addon.id)}
                  className={cn(
                    "relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl border-border/60 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 hover:shadow-sm motion-reduce:transition-none",
                    selected && "border-2 border-primary",
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {selected ? "Added to request" : "Available add-on"}
                  </div>
                  <CardHeader className="shrink-0 space-y-1.5 pb-3 pt-5">
                    <CardTitle className="flex items-center justify-between gap-3 text-xl">
                      <span className="truncate">{addon.name}</span>
                      {quoteOnly ? <Badge variant="outline">Custom</Badge> : null}
                    </CardTitle>
                    {addon.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {addon.description}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-5 pt-0">
                    <div
                      className="flex min-h-[124px] shrink-0 flex-col justify-between rounded-xl border bg-muted/20 p-4"
                    >
                      {quoteOnly ? (
                        <>
                          <div>
                            <p className="text-2xl font-black">Custom quote</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Contact for pricing
                            </p>
                          </div>
                          <div className="mt-3 min-h-[52px] border-t pt-3 text-sm">
                            <span className="text-muted-foreground">Available with published plans</span>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">Price determined on request</p>
                        </>
                      ) : primaryPrice ? (
                        <>
                          <div>
                            <p className="text-2xl font-black">
                              {formatPrice(primaryPrice.amount, primaryPrice.currency || catalog.currency)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {priceTypeLabel(primaryPrice)} - {intervalLabel(addonPricing.billingIntervalMonths)}
                            </p>
                          </div>
                          <div className="mt-3 min-h-[52px] border-t pt-3 text-sm">
                            <span className="text-muted-foreground">
                              {addon.compatible_plan_codes.length > 0
                                ? `Available with ${addon.compatible_plan_codes.join(", ")}`
                                : "Available with all plans"}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Tax {primaryPrice.tax_inclusive ? "included" : "not included"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-2xl font-black">Pricing on request</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Contact Yummy team
                            </p>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Not offered for this billing cycle</p>
                        </>
                      )}
                    </div>

                    <div className="shrink-0 space-y-3">
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate">Add-ons are enforced separately</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate">Compatibility checked before request</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate">Billed with your subscription</span>
                      </div>
                    </div>

                    <div
                      className="mt-auto flex shrink-0 flex-col gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        type="button"
                        className="w-full"
                        variant={selected ? "default" : "outline"}
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedAddonCodes((current) =>
                            current.includes(addon.code)
                              ? current.filter((code) => code !== addon.code)
                              : [...current, addon.code],
                          )
                        }
                      >
                        <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />
                        {selected ? "Included in request" : "Add to request"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </section> : null}
          </>
        )}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-primary" />
              Billing history
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed subscription payments for this billing account.
            </p>
          </div>
          {invoicesLoading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" /> : null}
        </CardHeader>
        <CardContent>
          {invoicesError ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Billing history unavailable</AlertTitle>
              <AlertDescription>{invoicesError}</AlertDescription>
            </Alert>
          ) : invoices.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-3 pr-4">Invoice</th>
                    <th className="pb-3 pr-4">Period</th>
                    <th className="pb-3 pr-4">Plan</th>
                    <th className="pb-3 text-right">Amount paid</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={String(invoice.id)} className="border-b last:border-0">
                      <td className="py-4 pr-4">
                        <p className="font-semibold">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(invoice.created_at) || "Date unavailable"} · {invoice.source}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        {formatDate(invoice.period_start) || "—"}
                        <span className="block text-xs text-muted-foreground">
                          to {formatDate(invoice.period_end) || "—"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 font-medium">
                        {String(invoice.line_items?.[0]?.name || "Subscription")}
                      </td>
                      <td className="py-4 text-right font-semibold text-emerald-700 tabular-nums">
                        {formatMoney(invoice.amount_paid, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : invoicesLoading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted/40 motion-reduce:animate-none" />
          ) : (
            <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              No paid subscription invoices yet.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Only verified, fully paid invoices appear here.</p>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(purchasePlan || fonepayCheckout)}
        onOpenChange={(open) => {
          if (!open) closePurchaseDialog();
        }}
      >
        <DialogContent className={cn("max-h-[92vh] overflow-y-auto overscroll-contain p-0", fonepayCheckout ? "sm:max-w-5xl" : "sm:max-w-4xl")}>
          <div className="border-b bg-primary/[0.035] px-6 py-5">
            <DialogHeader>
              <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Secure Fonepay checkout
              </div>
              <DialogTitle>{fonepayCheckout ? "Scan & pay" : "Review your plan"}</DialogTitle>
              <DialogDescription>
                {fonepayCheckout ? "Pay with Fonepay while Yummy verifies the transaction automatically." : "Confirm the details, add a promo code if you have one, then continue with Fonepay."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className={cn("px-6 pb-6", fonepayCheckout ? "grid gap-6 py-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:px-8" : "grid gap-6 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]")}>
            {fonepayCheckout?.summary ? (
              <div className="order-2 rounded-2xl border bg-muted/20 p-5 text-sm lg:p-6">
                <h3 className="text-base font-semibold">Purchase summary</h3>
                <div className="mt-4 space-y-3 border-b pb-4">
                  <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Restaurant</span><span className="max-w-[65%] break-words text-right font-medium">{restaurant?.name || "Current restaurant"}</span></div>
                  <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Plan</span><span className="text-right font-medium">{fonepayCheckout.summary.plan_name}</span></div>
                  <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Billing period</span><span className="text-right font-medium">{intervalLabel(fonepayCheckout.summary.billing_interval_months)}</span></div>
                </div>
                <div className="mt-4 flex justify-between"><span className="text-muted-foreground">Plan price</span><span className="tabular-nums">{formatMoney(Number(fonepayCheckout.summary.subtotal), fonepayCheckout.summary.currency)}</span></div>
                {Number(fonepayCheckout.summary.discount_amount) > 0 ? <div className="mt-2 flex justify-between text-emerald-700"><span>Promo {fonepayCheckout.summary.promo_code}</span><span>-{formatMoney(Number(fonepayCheckout.summary.discount_amount), fonepayCheckout.summary.currency)}</span></div> : null}
                <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total</span><span className="tabular-nums">{formatMoney(Number(fonepayCheckout.summary.total_amount), fonepayCheckout.summary.currency)}</span></div>
                <p className="mt-2 break-all text-xs text-muted-foreground">Reference: {fonepayCheckout.prn}</p>

                <div className="mt-6 border-t pt-5">
                  <h3 className="text-base font-semibold">How to pay</h3>
                  <ol className="mt-4 space-y-3">
                    {[
                      "Open a Fonepay-supported banking or wallet app on your phone.",
                      "Choose Scan QR and scan the code shown here.",
                      `Confirm the exact amount: ${formatMoney(Number(fonepayCheckout.summary.total_amount), fonepayCheckout.summary.currency)}.`,
                      "Complete payment. This checkout updates automatically.",
                    ].map((instruction, index) => (
                      <li key={instruction} className="flex gap-3 leading-6">
                        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{index + 1}</span>
                        <span className="pt-0.5">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 leading-6 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                    Yummy activates the plan only after Fonepay confirms the exact amount.
                  </div>
                </div>
              </div>
            ) : purchasePlan ? (
              <>
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold">Pay securely with Fonepay</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">The QR expiry will appear as soon as it is created. Yummy activates the plan only after the exact amount is verified.</p>
                  </div>
                  <label className="block text-sm font-semibold">Promo code <span className="font-normal text-muted-foreground">(optional)</span>
                    <Input className="mt-2" name="subscription-promo-code" value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} maxLength={32} autoComplete="off" spellCheck={false} placeholder="Example: WELCOME10…" />
                  </label>
                  <Button className="h-11 w-full" type="button" onClick={() => void startPlanPurchase()} disabled={paymentBusy}>
                    {paymentBusy ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />}Continue with Fonepay
                  </Button>
                  <p className="text-xs leading-5 text-muted-foreground">Promo codes are validated before the QR is created. You will review the final payable amount before scanning.</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-5">
                  <h3 className="text-base font-semibold">Order summary</h3>
                  <div className="mt-5 space-y-4 text-sm">
                    <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Restaurant</span><span className="max-w-[65%] break-words text-right font-medium">{restaurant?.name || "Current restaurant"}</span></div>
                    <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Plan</span><span className="text-right font-medium">{purchasePlan.name}</span></div>
                    <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Billing period</span><span className="text-right font-medium">{intervalLabel(purchasePricing?.billingIntervalMonths ?? null)}</span></div>
                    <div className="flex items-center justify-between gap-4 border-t pt-4 text-lg font-semibold"><span>Total before promo</span><span className="tabular-nums">{formatPrice(purchasePrice?.amount ?? null, purchasePrice?.currency || "NPR")}</span></div>
                  </div>
                  <div className="mt-5 rounded-xl border border-primary/15 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mr-2 inline h-4 w-4 text-primary" />Your payment is verified before your plan changes.</div>
                </div>
              </>
            ) : null}

            {fonepayCheckout ? <div className="order-1 flex flex-col items-center text-center">
              <p className="text-sm font-medium text-muted-foreground">Amount to pay</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{formatMoney(Number(fonepayCheckout.summary?.total_amount || 0), fonepayCheckout.summary?.currency || "NPR")}</p>
              {fonepayCheckout.status === "pending" && checkoutSecondsRemaining !== null ? <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><Clock3 aria-hidden="true" className="h-4 w-4" />Checkout closes in <span className="font-semibold text-primary tabular-nums">{formatCountdown(checkoutSecondsRemaining)}</span></p> : null}
              <div className="mt-5 w-full">
                {paymentQr ? <div className="relative mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm"><Image src={paymentQr} width={280} height={280} alt={`Fonepay QR for ${fonepayCheckout.summary?.plan_name || "subscription payment"}`} priority unoptimized /></div> : <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Fonepay did not return a displayable QR.</AlertDescription></Alert>}
              </div>
              <div aria-live="polite" className="mt-5 w-full">
              {fonepayCheckout.status === "pending" ? <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Waiting for payment confirmation…</p> : null}
              {fonepayCheckout.status === "paid" ? <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><CheckCircle2 className="h-4 w-4" /><AlertDescription>Payment verified. Your subscription is active.</AlertDescription></Alert> : null}
              {fonepayCheckout.status === "review_required" ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Payment requires manual review. Your plan will not change until Yummy resolves it.</AlertDescription></Alert> : null}
              </div>
              <div className="mt-5 grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button variant="outline" type="button" onClick={downloadPaymentQr} disabled={!paymentQr}><Download aria-hidden="true" className="mr-2 h-4 w-4" />Download QR</Button>
                <Button variant="outline" type="button" onClick={() => void verifyFonepayPayment()} disabled={paymentBusy || fonepayCheckout.status === "paid" || fonepayCheckout.status === "review_required"}>
                  {paymentBusy ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />}{fonepayCheckout.status === "paid" ? "Payment verified" : "I’ve paid — check now"}
                </Button>
                {fonepayCheckout.status === "pending" ? <Button className="border-destructive/30 text-destructive hover:bg-destructive/5 sm:col-span-2 lg:col-span-1 xl:col-span-2" variant="outline" type="button" onClick={() => setCancelCheckoutOpen(true)} disabled={paymentBusy}>
                  <XCircle aria-hidden="true" className="mr-2 h-4 w-4" />Cancel checkout & choose another plan
                </Button> : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">To choose another plan, cancel this checkout first. Do not pay an old QR after cancelling it.</p>
            </div> : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelCheckoutOpen} onOpenChange={setCancelCheckoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this checkout?</AlertDialogTitle>
            <AlertDialogDescription>
              Yummy will check Fonepay one final time. If payment is still pending, this checkout will close and you can choose another plan. Do not pay the old QR afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paymentBusy}>Keep checkout</AlertDialogCancel>
            <AlertDialogAction
              disabled={paymentBusy}
              onClick={() => void cancelFonepayPayment()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel checkout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {requestError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Request not saved</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border bg-muted/20 p-6 text-center sm:flex-row sm:text-left">
        <div>
          <p className="font-bold">Need help choosing a plan?</p>
          <p className="text-sm text-muted-foreground">Save a plan request above or contact the Yummy team.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            openContact({
              subject: "Yummy plan support",
              message: `Hello Yummy Team, I need help choosing a plan for ${restaurant?.name || "my restaurant"}.`,
            })
          }
        >
          <Mail className="mr-2 h-4 w-4" />
          {supportEmail}
        </Button>
      </div>

      <Dialog
        open={contactDraft !== null}
        onOpenChange={(open) => {
          if (!open) setContactDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Contact Yummy
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Let&apos;s Get In Touch.</DialogTitle>
            <DialogDescription>
              <span className="block text-foreground/90">
                Your plan request is already saved. Use the prepared email below if you would also like to contact the Yummy team directly.
              </span>
              <span className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Mail aria-hidden="true" className="h-4 w-4" />
                <a href={`mailto:${supportEmail}`} className="font-semibold text-primary hover:underline">
                  {supportEmail}
                </a>
              </span>
            </DialogDescription>
          </DialogHeader>

          {contactDraft && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="contact-full-name" className="text-sm font-semibold">Full name</label>
                <div className="relative">
                  <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contact-full-name"
                    name="full-name"
                    autoComplete="name"
                    value={contactForm.fullName}
                    onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Enter your full name…"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-email" className="text-sm font-semibold">Email address</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={contactForm.emailAddress}
                    onChange={(event) => setContactForm((current) => ({ ...current, emailAddress: event.target.value }))}
                    placeholder="Enter your email address…"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-message" className="text-sm font-semibold">Message</label>
                <Textarea
                  id="contact-message"
                  name="message"
                  autoComplete="off"
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Enter your message…"
                  className="min-h-36 rounded-2xl"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copyContactDetails}>
                  Copy details
                </Button>
                <Button type="button" className="w-full rounded-full sm:flex-1" onClick={submitContactForm}>
                  Submit Form
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={contactDraft !== null}
        onOpenChange={(open) => {
          if (!open) setContactDraft(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Contact Yummy
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">Let&apos;s Get In Touch.</DialogTitle>
            <DialogDescription>
              <span className="block text-foreground/90">
                Your plan request is already saved. Use the prepared email below if you would also like to contact the Yummy team directly.
              </span>
              <span className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Mail aria-hidden="true" className="h-4 w-4" />
                <a href={`mailto:${supportEmail}`} className="font-semibold text-primary hover:underline">
                  {supportEmail}
                </a>
              </span>
            </DialogDescription>
          </DialogHeader>

          {contactDraft && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="request-full-name" className="text-sm font-semibold">Full name</label>
                <div className="relative">
                  <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="request-full-name"
                    name="full-name"
                    autoComplete="name"
                    value={contactForm.fullName}
                    onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Enter your full name…"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="request-email" className="text-sm font-semibold">Email address</label>
                <div className="relative">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="request-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={contactForm.emailAddress}
                    onChange={(event) => setContactForm((current) => ({ ...current, emailAddress: event.target.value }))}
                    placeholder="Enter your email address…"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="request-message" className="text-sm font-semibold">Message</label>
                <Textarea
                  id="request-message"
                  name="message"
                  autoComplete="off"
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Enter your message…"
                  className="min-h-36 rounded-2xl"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copyContactDetails}>
                  Copy details
                </Button>
                <Button type="button" className="w-full rounded-full sm:flex-1" onClick={submitContactForm}>
                  Submit Form
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={featureListPlan !== null}
        onOpenChange={(open) => {
          if (!open) setFeatureListPlan(null);
        }}
      >
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {catalog?.plans.find((p) => p.code === featureListPlan)?.name} Features
                </DialogTitle>
                <DialogDescription>
                  Complete list of included capabilities
                </DialogDescription>
              </div>
              {featureListPlan && (() => {
                const plan = catalog?.plans.find((p) => p.code === featureListPlan);
                if (!plan) return null;
                const prices = pricesForInterval(plan, selectedInterval);
                const primaryPrice = prices.initial ?? prices.renewal;
                return (
                  <div className="shrink-0 text-right">
                    {prices.quoteOnly ? (
                      <p className="text-4xl font-black tracking-tight">Custom quote</p>
                    ) : primaryPrice ? (
                      <p className="text-right leading-tight">
                        <span className="text-4xl font-black tracking-tight">
                          {formatPrice(primaryPrice.amount, primaryPrice.currency)}
                        </span>
                        <span className="ml-2 text-sm font-medium text-muted-foreground">
                          - {priceTypeLabel(primaryPrice)} {intervalLabel(prices.billingIntervalMonths)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-4xl font-black tracking-tight">N/A</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </DialogHeader>
          <div
            className={cn(
              "grid gap-3",
              featureListPlan && planFeatures(catalog?.plans.find((p) => p.code === featureListPlan)!).length > 20
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2"
            )}
          >
            {featureListPlan &&
              planFeatures(catalog?.plans.find((p) => p.code === featureListPlan)!).map((feature, index) => (
                <div
                  key={`${feature.label}-${index}`}
                  className="flex items-center gap-2.5 text-sm"
                >
                  {feature.included ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={cn(!feature.included && "text-muted-foreground")}>
                    {feature.label}
                  </span>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
