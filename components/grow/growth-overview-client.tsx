"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Megaphone,
  MessageCircleMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sprout,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import type {
  GrowthCampaignStatus,
  GrowthReadinessDomain,
  GrowthReadinessStatus,
  NormalizedGrowthOverview,
} from "@/lib/api/growth-types";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

const domainLabels: Record<string, string> = {
  sales: "Sales intelligence",
  cash: "Cash-control intelligence",
  expenses: "Expense intelligence",
  inventory: "Food-cost intelligence",
  customers: "Customer growth intelligence",
  campaigns: "Campaign readiness",
};

const campaignStatusLabels: Record<GrowthCampaignStatus, string> = {
  draft: "Draft",
  review: "Awaiting review",
  approved: "Approved",
  scheduled: "Scheduled",
  sending: "Sending",
  completed: "Completed",
  paused: "Paused",
  canceled: "Canceled",
  failed: "Failed",
};

function domainKey(domain: GrowthReadinessDomain): string {
  return domain.key || domain.code || domain.domain || "unknown";
}

function readinessCopy(status: GrowthReadinessStatus) {
  if (status === "ready") {
    return {
      label: "Ready",
      icon: CheckCircle2,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (status === "partial") {
    return {
      label: "Partial",
      icon: TriangleAlert,
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Unavailable",
    icon: CircleDashed,
    className: "border-border bg-muted/60 text-muted-foreground",
  };
}

function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-NP")
    : "—";
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading Yummy Grow overview">
      <Skeleton className="h-32 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function UnavailableSection({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
        <CircleDashed className="h-8 w-8 text-muted-foreground/60" />
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function GrowthOverviewClient() {
  const user = useAuth((state) => state.user);
  const [overview, setOverview] = useState<NormalizedGrowthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await growthApi.getOverview());
    } catch {
      setOverview(null);
      setError(
        "Yummy could not load the Grow overview. Growth services may still be unavailable for this restaurant, or the connection may have been interrupted.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  if (loading) return <OverviewSkeleton />;

  const summary = overview?.summary ?? {};
  const readinessDomains = overview?.readiness.domains ?? [];
  const opportunities = overview?.opportunities ?? [];
  const campaigns = overview?.active_campaigns ?? [];
  const recentResults = overview?.recent_results ?? [];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10" data-tour="grow-overview">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500/12 via-card to-primary/8 p-6 shadow-sm md:p-8">
        <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              <Sprout className="h-4 w-4" />
              Yummy Grow
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Bring customers back, thoughtfully.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Grow turns consented customer history into clear retention opportunities. This overview is advisory: no campaign is sent without a separate review and approval flow.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {hasPermission(user, "grow.campaigns.manage") && (
              <Button asChild>
                <Link href="/grow/campaigns/new">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Create controlled campaign
                </Link>
              </Button>
            )}
            <div className="flex items-center gap-2 rounded-2xl border bg-background/70 px-4 py-3 text-xs text-muted-foreground backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Consent and backend eligibility remain authoritative
            </div>
          </div>
        </div>
      </section>

      {error && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Grow overview is temporarily unavailable</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error} Yummy Operations is unaffected, and nothing has been sent.</span>
            <Button variant="outline" size="sm" onClick={() => void loadOverview()} className="shrink-0">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Growth summary">
        {[
          {
            label: "Identified customers",
            value: summary.identified_customer_count,
            detail: "Customers linked to completed orders",
            icon: Users,
          },
          {
            label: "Consented contacts",
            value: summary.consented_customer_count,
            detail: "Currently eligible for WhatsApp marketing",
            icon: MessageCircleMore,
          },
          {
            label: "Open opportunities",
            value: summary.open_opportunity_count ?? (overview ? opportunities.length : undefined),
            detail: "Deterministic growth rules, not AI guesses",
            icon: Sparkles,
          },
          {
            label: "Active campaigns",
            value: summary.active_campaign_count ?? (overview ? campaigns.length : undefined),
            detail: "Draft through sending states",
            icon: Megaphone,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-black">{formatCount(item.value)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Intelligence readiness</CardTitle>
            <CardDescription>Each area is judged independently. Missing data reduces the claim, not the whole product.</CardDescription>
          </CardHeader>
          <CardContent>
            {readinessDomains.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <CircleDashed className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 font-semibold">Readiness has not been calculated yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Yummy will show exactly which insights are safe as data becomes available.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {readinessDomains.map((domain, index) => {
                  const key = domainKey(domain);
                  const status = readinessCopy(domain.status);
                  const StatusIcon = status.icon;
                  const percent =
                    typeof domain.coverage_percent === "number"
                      ? Math.min(100, Math.max(0, domain.coverage_percent))
                      : null;
                  return (
                    <div key={`${key}-${index}`} className="rounded-2xl border bg-muted/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{domain.label || domainLabels[key] || "Readiness area"}</h3>
                          {percent !== null && <p className="mt-1 text-xs text-muted-foreground">{Math.round(percent)}% coverage</p>}
                        </div>
                        <Badge variant="outline" className={cn("gap-1", status.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      {percent !== null && (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              domain.status === "ready"
                                ? "bg-emerald-500"
                                : domain.status === "partial"
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground/40",
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                      {domain.next_action ? (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          <span className="font-semibold text-foreground">Best next step:</span> {domain.next_action}
                        </p>
                      ) : domain.limitation ? (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">{domain.limitation}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Growth opportunities</CardTitle>
            <CardDescription>Observed customer patterns with transparent data limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunities.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <Sprout className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 font-semibold">No safe opportunity is available yet</p>
                <p className="mt-1 text-sm text-muted-foreground">This can mean there is not enough history, consent, or an eligible audience. Yummy will not invent one.</p>
              </div>
            ) : (
              opportunities.slice(0, 4).map((opportunity) => {
                const status = readinessCopy(opportunity.readiness_status);
                return (
                  <article key={opportunity.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{opportunity.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{opportunity.explanation || opportunity.suggested_action || "Review the observed audience before creating an offer."}</p>
                      </div>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{formatCount(opportunity.eligible_customer_count)} eligible</span>
                      {opportunity.confidence && <span className="capitalize">{opportunity.confidence} confidence</span>}
                      {opportunity.data_status && <span className="capitalize">{opportunity.data_status} data</span>}
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Campaign summary</CardTitle>
              <CardDescription>Status only. Campaign editing and sending are deliberately outside this overview.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/grow/campaigns">View campaigns</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 ? (
              <UnavailableSection
                title="No active campaigns"
                description="A campaign will appear here after an authorized user creates it through the reviewed campaign workflow."
              />
            ) : (
              campaigns.slice(0, 5).map((campaign) => (
                <Link key={campaign.id} href={`/grow/campaigns/${campaign.id}`} className="flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:border-primary/40 hover:bg-primary/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{campaign.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatCount(campaign.audience_count)} recipients</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(campaign.scheduled_at)}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{campaignStatusLabels[campaign.status]}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent attributed results</CardTitle>
            <CardDescription>These are linked order results, not claims that every sale was incremental.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentResults.length === 0 ? (
              <UnavailableSection
                title="No campaign results yet"
                description="Delivered, redeemed, and attributed order totals will appear after a campaign completes."
              />
            ) : (
              recentResults.slice(0, 4).map((result) => (
                <div key={result.campaign_id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{result.campaign_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatCount(result.redeemed_count)} redemptions · {formatCount(result.opt_out_count)} opt-outs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatMoney(result.attributed_revenue)}</p>
                      <p className="text-[11px] text-muted-foreground">attributed revenue</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-muted/60 p-2"><span className="block font-bold">{formatCount(result.sent_count)}</span>Sent</div>
                    <div className="rounded-xl bg-muted/60 p-2"><span className="block font-bold">{formatCount(result.delivered_count)}</span>Delivered</div>
                    <div className="rounded-xl bg-muted/60 p-2"><span className="block font-bold">{formatCount(result.failed_count)}</span>Failed</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />{overview?.generated_at ? `Last calculated ${formatDate(overview.generated_at)}` : "Calculation time unavailable"}</span>
        <span className="inline-flex items-center gap-1 font-medium text-foreground/70">Readiness improves through normal restaurant use <ArrowUpRight className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}
