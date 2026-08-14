"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Megaphone,
  MessageCircleMore,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { GrowthSettingsClient } from "@/components/grow/growth-settings-client";
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
  sales: "Sales",
  cash: "Cash and day-close",
  expenses: "Expenses",
  inventory: "Inventory and menu costing",
  customers: "Customer identity",
  campaigns: "Campaign delivery",
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

function simplifyOpportunityText(text: string): string {
  // Simplify technical opportunity descriptions for restaurant staff
  const simplifications: Array<[RegExp, string]> = [
    [/(\d+) consented customer\(s\) have exactly one completed visit within the configured lookback/i, "$1 customers visited once and haven't come back"],
    [/(\d+) consented repeat customer\(s\) have no completed visit inside the configured active period/i, "$1 regular customers stopped visiting"],
    [/On average they visited ([\d.]+) time\(s\) before going quiet/i, "They used to visit $1 times on average"],
    [/Average time since last visit: (\d+) day\(s\)/i, "Last visit: $1 days ago"],
    [/Average past spend per visit: ([\d,]+)/i, "Average spent: Rs. $1 per visit"],
    [/Observed ([\d.]+) completed orders on average across (\d+) sales-active (\w+)s in the last (\d+) weeks/i, "Only $1 orders on average each $3 (checked $2 $3s)"],
    [/within the configured lookback/gi, "recently"],
    [/inside the configured active period/gi, "lately"],
  ];

  let simplified = text;
  for (const [pattern, replacement] of simplifications) {
    simplified = simplified.replace(pattern, replacement);
  }
  return simplified;
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
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-16" aria-label="Loading Yummy Grow overview">
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function GrowthOverviewClient() {
  const user = useAuth((state) => state.user);
  const [overview, setOverview] = useState<NormalizedGrowthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await growthApi.getOverview());
    } catch {
      setOverview(null);
      setError("Unable to load growth data. Please check your connection and try again.");
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
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-16" data-tour="grow-overview">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-12">
        {hasPermission(user, "grow.settings.manage") && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Grow settings"
            onClick={() => setSettingsOpen(true)}
            className="absolute right-6 top-6 z-10 h-10 w-10 rounded-xl border border-border bg-background hover:bg-accent transition-all"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
              <Sprout className="h-3.5 w-3.5 text-foreground" />
              <span className="text-xs font-semibold tracking-wide text-foreground">YUMMY GROW</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Grow Your Customer Base</h1>
            <p className="text-base text-muted-foreground">
              Create targeted campaigns to engage customers and drive repeat visits.
            </p>
          </div>
          
          {hasPermission(user, "grow.campaigns.manage") && (
            <Button asChild size="lg" className="h-12 rounded-xl border border-border px-6 shadow-sm hover:shadow transition-all">
              <Link href="/grow/campaigns/new">
                <Megaphone className="mr-2 h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          )}
        </div>
      </section>

      {error && (
        <Alert className="rounded-xl border border-border bg-card">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Unable to load data</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm">There was an error loading the overview. Please try again.</span>
            <Button variant="outline" size="sm" onClick={() => void loadOverview()} className="shrink-0 rounded-xl border border-border">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Growth summary">
        {[
          {
            label: "Total Customers",
            value: summary.identified_customer_count,
            detail: "From completed orders",
            icon: Users,
          },
          {
            label: "Opted-In Contacts",
            value: summary.consented_customer_count,
            detail: "Ready for campaigns",
            icon: MessageCircleMore,
          },
          {
            label: "Opportunities",
            value: summary.open_opportunity_count ?? (overview ? opportunities.length : undefined),
            detail: "Growth opportunities",
            icon: Sprout,
          },
          {
            label: "Active Campaigns",
            value: summary.active_campaign_count ?? (overview ? campaigns.length : undefined),
            detail: "Currently running",
            icon: Megaphone,
          },
        ].map((item) => (
          <Card key={item.label} className="group rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</p>
                <p className="text-4xl font-bold tracking-tight">{formatCount(item.value)}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-border bg-muted p-2.5 transition-transform group-hover:scale-110">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-border bg-muted p-1.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Readiness</span>
            </div>
            <CardTitle className="text-xl">System Setup</CardTitle>
            <CardDescription className="text-sm">Check which features are ready to use</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {readinessDomains.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">Checking system setup...</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Setup status will show here</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {[...readinessDomains]
                  .sort((a, b) => {
                    const percentA = typeof a.coverage_percent === "number" ? a.coverage_percent : 0;
                    const percentB = typeof b.coverage_percent === "number" ? b.coverage_percent : 0;
                    return percentB - percentA; // Sort descending: 100 -> 0
                  })
                  .map((domain, index) => {
                  const key = domainKey(domain);
                  const status = readinessCopy(domain.status);
                  const StatusIcon = status.icon;
                  const percent =
                    typeof domain.coverage_percent === "number"
                      ? Math.min(100, Math.max(0, domain.coverage_percent))
                      : null;
                  const chartPercent = percent ?? 0;
                  
                  return (
                    <div
                      key={`${key}-${index}`}
                      className="group rounded-lg border border-border bg-card p-3.5 transition-all hover:border-border/80 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            domain.status === "ready"
                              ? "bg-emerald-500/10"
                              : domain.status === "partial"
                                ? "bg-amber-500/10"
                                : "bg-muted"
                          )}>
                            <StatusIcon className={cn(
                              "h-4 w-4",
                              domain.status === "ready"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : domain.status === "partial"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-xs truncate">
                              {domain.label || domainLabels[key] || "Setup area"}
                            </h3>
                            <p className="text-[10px] text-muted-foreground">
                              {domain.status === "ready" 
                                ? "Ready to use"
                                : domain.status === "partial"
                                  ? "Needs setup"
                                  : "Not set up yet"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xl font-bold tabular-nums">
                            {Math.round(chartPercent)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Compact horizontal bar chart */}
                      <div className="relative">
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted/30">
                          <div
                            className={cn(
                              "relative overflow-hidden rounded-full transition-all duration-1000 ease-out",
                              domain.status === "ready"
                                ? "bg-emerald-500"
                                : domain.status === "partial"
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                            )}
                            style={{ width: `${chartPercent}%` }}
                          >
                            {/* Animated shine effect */}
                            <div 
                              className="absolute inset-0 w-full h-full"
                              style={{
                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                                animation: "shine 2s ease-in-out infinite"
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-border bg-muted p-1.5">
                <Sprout className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Opportunities</span>
            </div>
            <CardTitle className="text-xl">Your Opportunities</CardTitle>
            <CardDescription className="text-sm">Ways to bring back customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {opportunities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <Sprout className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">No opportunities yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Check back as more customers visit</p>
              </div>
            ) : (
              opportunities.slice(0, 4).map((opportunity) => {
                const status = readinessCopy(opportunity.readiness_status);
                return (
                  <article key={opportunity.id} className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-sm leading-snug">{opportunity.title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{simplifyOpportunityText(opportunity.explanation || opportunity.suggested_action || "Check eligible customers")}</p>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0", status.className)}>{status.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{formatCount(opportunity.eligible_customer_count)} eligible</span>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg border border-border bg-muted p-1.5">
                  <Megaphone className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Campaigns</span>
              </div>
              <CardTitle className="text-xl">Your Campaigns</CardTitle>
              <CardDescription className="text-sm">Manage your marketing messages</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 rounded-xl border border-border">
              <Link href="/grow/campaigns">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">No campaigns yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Create your first campaign to reach customers</p>
              </div>
            ) : (
              campaigns.slice(0, 5).map((campaign) => (
                <Link key={campaign.id} href={`/grow/campaigns/${campaign.id}`} className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate font-semibold text-sm">{campaign.name}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatCount(campaign.audience_count)} recipients</span>
                      {campaign.scheduled_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(campaign.scheduled_at)}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 border border-border text-xs">{campaignStatusLabels[campaign.status]}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-border bg-muted p-1.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Results</span>
            </div>
            <CardTitle className="text-xl">Results</CardTitle>
            <CardDescription className="text-sm">How your campaigns performed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {recentResults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">No results yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Results show after campaigns finish</p>
              </div>
            ) : (
              recentResults.slice(0, 4).map((result) => (
                <div key={result.campaign_id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{result.campaign_name}</p>
                      <p className="text-xs text-muted-foreground">{formatCount(result.redeemed_count)} redeemed · {formatCount(result.opt_out_count)} opt-outs</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-lg font-bold">{formatMoney(result.attributed_revenue)}</p>
                      <p className="text-[10px] tracking-wide uppercase text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border bg-muted p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.sent_count)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent</span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.delivered_count)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivered</span>
                    </div>
                    <div className="rounded-lg border border-border bg-muted p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.failed_count)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Failed</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="sr-only">Yummy Grow settings</DialogTitle>
          <GrowthSettingsClient />
        </DialogContent>
      </Dialog>
    </div>
  );
}
