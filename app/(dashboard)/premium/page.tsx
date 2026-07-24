"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Crown,
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
import FUIPricingSectionWithOnePlan from "@/components/ui/colorful-pricing";
import { UsageIndicator } from "@/components/subscription/usage-indicator";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { getApiErrorMessage } from "@/lib/api-error-message";
import {
  billingIntervals,
  currentPlanDisplayName,
  formatPrice,
  planFeatures,
  priceTypeLabel,
  pricesForInterval,
  subscriptionPeriodEnd,
} from "@/lib/subscription/entitlements";
import type { SubscriptionPlan } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "yummyever.np@gmail.com";
const supportWhatsapp = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "").replace(/\D/g, "");
const visibleFeatureLimit = 10;
const featureRowHeight = 32;

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

type PlanFeatureItem = {
  label: string;
  included: boolean;
};

function PlanFeatureList({ features }: { features: PlanFeatureItem[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const extraFeatures = Math.max(features.length - visibleFeatureLimit, 0);
  const isScrollable = extraFeatures > 0;
  const [remainingCount, setRemainingCount] = useState(extraFeatures);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !isScrollable) {
      setRemainingCount(0);
      return;
    }

    const hiddenPixels = Math.max(
      container.scrollHeight - container.clientHeight - container.scrollTop,
      0,
    );
    const rowsRemaining = Math.ceil(hiddenPixels / featureRowHeight);
    setRemainingCount(Math.min(extraFeatures, rowsRemaining));
  }, [extraFeatures, isScrollable]);

  useEffect(() => {
    setRemainingCount(extraFeatures);
    if (isScrollable) {
      requestAnimationFrame(handleScroll);
    }
  }, [extraFeatures, handleScroll, isScrollable]);

  if (!features.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Detailed entitlements are being prepared.
      </p>
    );
  }

  return (
    <div className="shrink-0 space-y-3">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "space-y-3 overscroll-contain [&::-webkit-scrollbar]:w-[1px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/5 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/15",
          isScrollable && "overflow-y-auto",
        )}
        style={
          isScrollable
            ? {
                maxHeight: `calc(1.25rem * ${visibleFeatureLimit} + 0.75rem * ${visibleFeatureLimit - 1})`,
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(var(--muted-foreground) / 0.05) transparent'
              }
            : undefined
        }
      >
        {features.map((feature, index) => (
          <div
            key={`${feature.label}-${index}`}
            className="flex h-5 items-center gap-2.5 text-sm leading-5"
          >
            {feature.included ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
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

      {isScrollable ? (
        <div className="flex h-5 items-center gap-2.5 text-sm leading-5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">
            {remainingCount > 0
              ? `+${remainingCount} more included capabilities`
              : "All features shown"}
          </span>
        </div>
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
  const [previewPlanCode, setPreviewPlanCode] = useState<string | null>(null);

  useEffect(() => {
    void refreshAll({ restaurantId: restaurant?.id ?? null });
  }, [refreshAll, restaurant?.id]);

  useEffect(() => {
    if (!intervals.length) return;
    if (!intervals.includes(selectedInterval)) {
      setSelectedInterval(intervals.includes(12) ? 12 : intervals[0]);
    }
  }, [intervals, selectedInterval]);

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
  const previewPlan = useMemo(
    () => catalog?.plans.find((plan) => plan.code === previewPlanCode) ?? null,
    [catalog?.plans, previewPlanCode],
  );
  const previewPrices = useMemo(
    () => (previewPlan ? pricesForInterval(previewPlan, selectedInterval) : null),
    [previewPlan, selectedInterval],
  );
  const previewPrimaryPrice = previewPrices ? previewPrices.initial ?? previewPrices.renewal : null;
  const previewRenewal = previewPrices?.initial ? previewPrices.renewal : null;
  const previewFeatureLabels = useMemo(
    () => (previewPlan ? planFeatures(previewPlan).map((feature) => feature.label) : []),
    [previewPlan],
  );

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
    <div className="mx-auto w-full max-w-[1500px] space-y-8 px-4 py-8 md:px-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Crown className="h-4 w-4" />
            Billing & subscription
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Choose the right Yummy plan</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Plans, prices, limits, and add-ons come directly from Yummy billing. Backend checks remain authoritative for every protected action.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={catalogLoading || currentLoading || usageLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", (catalogLoading || currentLoading || usageLoading) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Current account
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black tracking-tight md:text-2xl">
                  {currentLoading && !current
                    ? "Loading plan..."
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
                Catalog {catalogUpdated}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Usage</p>
              {usageLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            {Object.keys(mergedUsage).length ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Object.entries(mergedUsage).map(([key, value]) => (
                  <UsageIndicator key={key} entitlementKey={key} usage={value} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Usage counters are not available for this account yet.
              </div>
            )}
          </div>
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
            <h2 className="text-2xl font-black">Published plans</h2>
            <p className="text-sm text-muted-foreground">Flat, initial, and renewal pricing are shown exactly as published.</p>
          </div>
          {intervals.length > 0 && (
            <div className="inline-flex w-fit rounded-xl border bg-muted/40 p-1">
              {intervals.map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setSelectedInterval(months)}
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
              <div key={index} className="h-[640px] animate-pulse rounded-2xl border bg-muted/30" />
            ))}
          </div>
        ) : (
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog?.plans.map((plan) => {
              const prices = pricesForInterval(plan, selectedInterval);
              const primaryPrice = prices.initial ?? prices.renewal;
              const renewal = prices.initial ? prices.renewal : null;
              const features = planFeatures(plan);
              const isCurrent = currentCode === plan.code;
              const isFreePlan = plan.code.toLowerCase() === "free";
              const canRequest =
                (isCurrent && selectedAddonCodes.length > 0) ||
                prices.quoteOnly ||
                Boolean(primaryPrice);
              const isRequesting = requestingPlan === plan.code && requestLoading;
              const showContact = savedRequestPlan === plan.code;

              return (
                <Card
                  key={String(plan.id)}
                  className={cn(
                    "relative flex h-full min-h-[640px] flex-col overflow-hidden border-border/50 transition-all duration-200 hover:border-border",
                    !isFreePlan && "cursor-pointer focus-within:ring-2 focus-within:ring-primary/30",
                    isCurrent && "border-2 border-primary",
                  )}
                  role={isFreePlan ? undefined : "button"}
                  tabIndex={isFreePlan ? -1 : 0}
                  onClick={() => {
                    if (!isFreePlan) {
                      setPreviewPlanCode(plan.code);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isFreePlan && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setPreviewPlanCode(plan.code);
                    }
                  }}
                >
                  <div
                    className={cn(
                      "shrink-0 px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest",
                      isCurrent ? "bg-primary text-primary-foreground" : "invisible",
                    )}
                    aria-hidden={!isCurrent}
                  >
                    Current plan
                  </div>
                  <CardHeader className="shrink-0 space-y-1.5 pb-3 pt-5">
                    <CardTitle className="flex items-center justify-between gap-3 text-xl">
                      <span className="truncate">{plan.name}</span>
                      {prices.quoteOnly ? <Badge variant="outline">Custom</Badge> : null}
                    </CardTitle>
                    {(plan.current_version?.subtitle || plan.description) ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {plan.current_version?.subtitle || plan.description}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-5 pt-0">
                    <div
                      className="flex min-h-[148px] shrink-0 flex-col justify-between rounded-2xl border bg-muted/20 p-4"
                    >
                      {prices.quoteOnly ? (
                        <>
                          <div>
                            <p className="text-2xl font-black">Let&apos;s chat</p>
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
                            <p className="text-2xl font-black">
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
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-2xl font-black">N/A</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Not offered for this billing cycle.
                            </p>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">Choose another period</p>
                        </>
                      )}
                    </div>

                    <PlanFeatureList features={features} />

                    <div
                      className="mt-auto flex shrink-0 flex-col gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={
                          (isCurrent && selectedAddonCodes.length === 0) ||
                          !canRequest ||
                          requestLoading ||
                          savedRequestPlan === plan.code
                        }
                        onClick={() => handlePlanRequest(plan)}
                      >
                        {isRequesting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : prices.quoteOnly ? (
                          <MessageSquare className="mr-2 h-4 w-4" />
                        ) : (
                          <Crown className="mr-2 h-4 w-4" />
                        )}
                        {savedRequestPlan === plan.code
                          ? "Request saved"
                          : isCurrent && selectedAddonCodes.length > 0
                            ? "Request selected add-ons"
                            : isCurrent
                              ? "Current plan"
                              : prices.quoteOnly
                                ? "Request quote"
                                : `Request ${plan.name}`}
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
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Yummy (optional)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {catalog?.addons.filter((addon) => addon.is_public).map((addon) => {
              const addonPricing = pricesForInterval(addon, selectedInterval);
              const primaryPrice = addonPricing.initial;
              const quoteOnly = addonPricing.quoteOnly;
              const selected = selectedAddonCodes.includes(addon.code);
              return (
                <Card
                  key={String(addon.id)}
                  className={cn(
                    "relative flex h-full min-h-[640px] flex-col overflow-hidden border-border/50 transition-all duration-200 hover:border-border",
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
                      className="flex min-h-[148px] shrink-0 flex-col justify-between rounded-2xl border bg-muted/20 p-4"
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
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate">Add-ons are enforced separately</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate">Can be combined with any plan</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
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
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {selected ? "Included in request" : "Add to request"}
                      </Button>
                      <Button
                        type="button"
                        className={cn("w-full", !selected && "invisible pointer-events-none")}
                        variant="outline"
                        aria-hidden={!selected}
                        tabIndex={selected ? 0 : -1}
                        disabled={!selected}
                        onClick={() => {
                          const draft = {
                            subject: `${addon.name} add-on request`,
                            message: `Hello Yummy Team, I would like to add ${addon.name} to ${restaurant?.name || "my restaurant"}'s subscription.`,
                          };
                          openContact(draft);
                        }}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Yummy (optional)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Billing history
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Invoices and payment status for this billing account.
            </p>
          </div>
          {invoicesLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
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
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Invoice</th>
                    <th className="pb-3 pr-4">Period</th>
                    <th className="pb-3 pr-4">Total</th>
                    <th className="pb-3 pr-4">Paid</th>
                    <th className="pb-3 pr-4">Due</th>
                    <th className="pb-3">Status</th>
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
                      <td className="py-4 pr-4 font-semibold">
                        {formatMoney(invoice.total_amount, invoice.currency)}
                      </td>
                      <td className="py-4 pr-4 text-emerald-700">
                        {formatMoney(invoice.amount_paid, invoice.currency)}
                      </td>
                      <td className="py-4 pr-4">
                        {formatMoney(invoice.amount_due, invoice.currency)}
                        {invoice.due_at ? (
                          <span className="block text-xs text-muted-foreground">
                            Due {formatDate(invoice.due_at)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-4">
                        <Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>
                          {statusLabel(invoice.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : invoicesLoading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted/40" />
          ) : (
            <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              No subscription invoices have been issued yet.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Online payment is not enabled yet. Use the payment instructions provided by Yummy; the
            ledger updates when payment is recorded.
          </p>
        </CardContent>
      </Card>

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
            <DialogTitle className="text-3xl font-black tracking-tight">Let&apos;s Get In Touch.</DialogTitle>
            <DialogDescription>
              <span className="block text-foreground/90">
                Your plan request is already saved. Use the prepared email below if you would also like to contact the Yummy team directly.
              </span>
              <span className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${supportEmail}`} className="font-semibold text-primary hover:underline">
                  {supportEmail}
                </a>
              </span>
            </DialogDescription>
          </DialogHeader>

          {contactDraft && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Full Name</p>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={contactForm.fullName}
                    onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Enter your full name"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Email Address</p>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={contactForm.emailAddress}
                    onChange={(event) => setContactForm((current) => ({ ...current, emailAddress: event.target.value }))}
                    placeholder="Enter your email address"
                    className="h-12 rounded-full pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Message</p>
                <Textarea
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Enter your message"
                  className="min-h-36 rounded-2xl"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copyContactDetails}>
                  Copy details
                </Button>
                <Button type="button" className="w-full rounded-full sm:flex-1" onClick={submitContactForm}>
                  Submit Form
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewPlanCode !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPlanCode(null);
        }}
      >
        <DialogContent className="w-[78vw] max-w-2xl h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] overflow-hidden p-2 sm:w-[76vw] sm:h-[calc(100vh-48px)] sm:max-h-[calc(100vh-48px)] sm:p-3">
          {previewPlan && previewPrices ? (
            <FUIPricingSectionWithOnePlan
              className="h-full"
              plan={{
                name: previewPlan.name,
                desc: previewPlan.current_version?.subtitle || previewPlan.description || "Plan details",
                priceLabel: previewPrices.quoteOnly
                  ? "Let's chat"
                  : previewPrimaryPrice
                    ? formatPrice(previewPrimaryPrice.amount, previewPrimaryPrice.currency)
                    : "N/A",
                periodLabel: previewPrices.quoteOnly
                  ? `Custom - ${intervalLabel(previewPrices.billingIntervalMonths)}`
                  : previewPrimaryPrice
                    ? `${priceTypeLabel(previewPrimaryPrice)} - ${intervalLabel(previewPrices.billingIntervalMonths)}`
                    : "Not offered for this billing cycle",
                renewalLabel: previewPrices.quoteOnly
                  ? `Renewal: On request per ${intervalLabel(previewPrices.billingIntervalMonths).toLowerCase()}`
                  : previewRenewal
                    ? `Renewal: ${formatPrice(previewRenewal.amount, previewRenewal.currency)} per ${intervalLabel(previewPrices.billingIntervalMonths).toLowerCase()}`
                    : "No separate renewal price",
                noteLabel: previewPrices.quoteOnly
                  ? "Tax and terms defined in contract"
                  : previewPrimaryPrice
                    ? `Tax ${previewPrimaryPrice.tax_inclusive ? "included" : "not included"}`
                    : "Choose another period",
                ctaLabel: previewPrices.quoteOnly ? "Request quote" : `Request ${previewPlan.name}`,
                onCtaClick: () => {
                  setPreviewPlanCode(null);
                  void handlePlanRequest(previewPlan);
                },
                features: previewFeatureLabels,
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
