"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Crown,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatMoney(value: number, currency = "NPR") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
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

  const contactHref = (plan: SubscriptionPlan) => {
    const pricing = pricesForInterval(plan, selectedInterval);
    const billingIntervalMonths =
      currentCode === plan.code && selectedAddonCodes.length > 0
        ? current?.subscription?.billing_interval_months ?? pricing.billingIntervalMonths
        : pricing.billingIntervalMonths;
    const addonText = selectedAddonCodes.length
      ? ` with add-ons: ${selectedAddonCodes.join(", ")}`
      : "";
    const message = `Hello Yummy Team, I saved a plan request for ${restaurant?.name || "my restaurant"} to the ${plan.name} plan (${intervalLabel(billingIntervalMonths)})${addonText}.`;
    if (supportWhatsapp) {
      return `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(message)}`;
    }
    return `mailto:${supportEmail}?subject=${encodeURIComponent(`${plan.name} plan request`)}&body=${encodeURIComponent(message)}`;
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

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.25fr_2fr]">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current account</p>
                <h2 className="mt-1 text-2xl font-black">
                  {currentLoading && !current
                    ? "Loading plan..."
                    : currentPlanDisplayName(current, restaurant)}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentStatus && <Badge variant="outline">{statusLabel(currentStatus)}</Badge>}
              {current?.subscription?.plan_version != null && (
                <Badge variant="outline">Version {current.subscription.plan_version}</Badge>
              )}
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {periodEnd ? `Current period ends ${periodEnd}` : "No fixed period end is recorded."}
              </p>
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Catalog version {catalog?.catalog_version || "not loaded"}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Active add-ons</p>
              <div className="flex flex-wrap gap-2">
                {current?.addons.length ? (
                  current.addons.map((addon) => (
                    <Badge key={`${addon.code}-${String(addon.id)}`} variant="secondary">
                      {addon.name}{addon.status ? ` - ${statusLabel(addon.status)}` : ""}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No add-ons assigned.</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">Current usage</p>
              {usageLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {Object.keys(mergedUsage).length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(mergedUsage).map(([key, value]) => (
                  <UsageIndicator key={key} entitlementKey={key} usage={value} compact />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Usage counters are not available for this account yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Billing history</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Invoices and payment status for this billing account.</p>
          </div>
          {invoicesLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardHeader>
        <CardContent>
          {invoicesError ? <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Billing history unavailable</AlertTitle><AlertDescription>{invoicesError}</AlertDescription></Alert> : invoices.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3 pr-4">Invoice</th><th className="pb-3 pr-4">Period</th><th className="pb-3 pr-4">Total</th><th className="pb-3 pr-4">Paid</th><th className="pb-3 pr-4">Due</th><th className="pb-3">Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={String(invoice.id)} className="border-b last:border-0"><td className="py-4 pr-4"><p className="font-semibold">{invoice.invoice_number}</p><p className="text-xs text-muted-foreground">{formatDate(invoice.created_at) || "Date unavailable"} · {invoice.source}</p></td><td className="py-4 pr-4">{formatDate(invoice.period_start) || "—"}<span className="block text-xs text-muted-foreground">to {formatDate(invoice.period_end) || "—"}</span></td><td className="py-4 pr-4 font-semibold">{formatMoney(invoice.total_amount, invoice.currency)}</td><td className="py-4 pr-4 text-emerald-700">{formatMoney(invoice.amount_paid, invoice.currency)}</td><td className="py-4 pr-4">{formatMoney(invoice.amount_due, invoice.currency)}{invoice.due_at ? <span className="block text-xs text-muted-foreground">Due {formatDate(invoice.due_at)}</span> : null}</td><td className="py-4"><Badge variant={invoice.status === "paid" ? "secondary" : "outline"}>{statusLabel(invoice.status)}</Badge></td></tr>)}</tbody></table></div> : invoicesLoading ? <div className="h-24 animate-pulse rounded-2xl bg-muted/40" /> : <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">No subscription invoices have been issued yet.</p>}
          <p className="mt-4 text-xs text-muted-foreground">Online payment is not enabled yet. Use the payment instructions provided by Yummy; the ledger updates when payment is recorded.</p>
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
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-[460px] animate-pulse rounded-2xl border bg-muted/30" />
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
              const canRequest =
                (isCurrent && selectedAddonCodes.length > 0) ||
                prices.quoteOnly ||
                Boolean(primaryPrice);
              const isRequesting = requestingPlan === plan.code && requestLoading;

              return (
                <Card
                  key={String(plan.id)}
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg",
                    isCurrent && "border-2 border-primary shadow-md shadow-primary/5",
                  )}
                >
                  {isCurrent && (
                    <div className="bg-primary px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                      Current plan
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between gap-3 text-xl">
                      {plan.name}
                      {prices.quoteOnly && <Badge variant="outline">Custom</Badge>}
                    </CardTitle>
                    <p className="min-h-10 text-sm text-muted-foreground">
                      {plan.current_version?.subtitle || plan.description || "Plan details configured by Yummy billing."}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-5">
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      {prices.quoteOnly ? (
                        <>
                          <p className="text-2xl font-black">Let&apos;s chat</p>
                          <p className="mt-1 text-xs text-muted-foreground">Pricing is prepared for your contract.</p>
                        </>
                      ) : primaryPrice ? (
                        <>
                          <p className="text-2xl font-black">{formatPrice(primaryPrice.amount, primaryPrice.currency)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {priceTypeLabel(primaryPrice)} - {intervalLabel(prices.billingIntervalMonths)}
                          </p>
                          {renewal && (
                            <div className="mt-3 border-t pt-3 text-sm">
                              <span className="font-semibold">Renewal: {formatPrice(renewal.amount, renewal.currency)}</span>
                              <span className="ml-1 text-muted-foreground">per {intervalLabel(prices.billingIntervalMonths).toLowerCase()}</span>
                            </div>
                          )}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Tax {primaryPrice.tax_inclusive ? "included" : "not included"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-base font-bold">Not offered for this cycle</p>
                          <p className="mt-1 text-xs text-muted-foreground">Choose another billing period.</p>
                        </>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      {features.length ? (
                        features.slice(0, 14).map((feature, index) => (
                          <div key={`${feature.label}-${index}`} className="flex items-start gap-2.5 text-sm">
                            {feature.included ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className={cn(!feature.included && "text-muted-foreground")}>{feature.label}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Detailed entitlements are being prepared.</p>
                      )}
                      {features.length > 14 && (
                        <p className="text-xs font-semibold text-primary">+ {features.length - 14} more included capabilities</p>
                      )}
                    </div>

                    <div className="space-y-2">
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
                      {savedRequestPlan === plan.code && (
                        <Button className="w-full" variant="outline" asChild>
                          <a
                            href={contactHref(plan)}
                            target={supportWhatsapp ? "_blank" : undefined}
                            rel={supportWhatsapp ? "noopener noreferrer" : undefined}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Contact Yummy (optional)
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {catalog?.addons.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-black">Available add-ons</h2>
            <p className="text-sm text-muted-foreground">Add-ons are assigned and enforced separately from the base plan.</p>
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
                  className={cn(selected && "border-primary ring-1 ring-primary/20")}
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                      <div>
                        <h3 className="font-bold">{addon.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{addon.description || "Contact Yummy for availability."}</p>
                        {(primaryPrice || quoteOnly) && (
                          <p className="mt-3 text-sm font-bold">
                            {quoteOnly
                              ? "Custom quote"
                              : `${formatPrice(primaryPrice?.amount ?? null, primaryPrice?.currency || catalog.currency)} - ${intervalLabel(addonPricing.billingIntervalMonths)}`}
                          </p>
                        )}
                        {addon.compatible_plan_codes.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Available with {addon.compatible_plan_codes.join(", ")}.
                          </p>
                        )}
                      </div>
                    </div>
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
                      {selected ? "Included in request" : "Add to request"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

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
        <Button variant="outline" asChild>
          <a href={`mailto:${supportEmail}`}>
            <Mail className="mr-2 h-4 w-4" />
            {supportEmail}
          </a>
        </Button>
      </div>
    </div>
  );
}
