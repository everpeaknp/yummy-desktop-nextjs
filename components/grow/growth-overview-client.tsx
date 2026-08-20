"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Mail,
  Megaphone,
  MessageCircleMore,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  Users,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

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
  GrowthCampaign,
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
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" aria-label="Loading Yummy Grow overview">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
  const [allCampaigns, setAllCampaigns] = useState<GrowthCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, campaignsData] = await Promise.all([
        growthApi.getOverview(),
        growthApi.listCampaigns()
      ]);
      setOverview(overviewData);
      setAllCampaigns(campaignsData);
    } catch {
      setOverview(null);
      setAllCampaigns([]);
      setError("Unable to load growth data. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [overviewData, campaignsData] = await Promise.all([
        growthApi.getOverview(),
        growthApi.listCampaigns()
      ]);
      setOverview(overviewData);
      setAllCampaigns(campaignsData);
    } catch {
      setError("Unable to load growth data. Please check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  if (loading) return <OverviewSkeleton />;

  const summary = overview?.summary ?? {};
  const readinessDomains = overview?.readiness.domains ?? [];
  const opportunities = overview?.opportunities ?? [];
  const recentResults = overview?.recent_results ?? [];
  
  // Show latest 10 campaigns (all channels, all statuses, sorted by date)
  const latestCampaigns = allCampaigns
    .sort((a, b) => {
      const dateA = a.scheduled_at || a.created_at;
      const dateB = b.scheduled_at || b.created_at;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 10);

  return (
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" data-tour="grow-overview">
      {refreshing ? (
        <div className="pointer-events-none absolute right-4 top-0 z-10 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Refreshing…
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="dc-page-title">Grow Your Customer Base</h1>
          <p className="dc-page-subtitle">
            Create targeted campaigns to engage customers and drive repeat visits
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => void refresh()} 
            className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4"
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
          {hasPermission(user, "grow.settings.manage") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          )}
          {hasPermission(user, "grow.campaigns.manage") && (
            <Button 
              asChild 
              className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium"
            >
              <Link href="/grow/campaigns/new">
                <Megaphone className="h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert className="dc-card border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="font-semibold text-destructive">Unable to load data</AlertTitle>
          <AlertDescription className="text-sm text-destructive/80">
            There was an error loading the overview. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4" aria-label="Growth summary">
        {[
          {
            label: "Total Customers",
            value: summary.identified_customer_count,
            detail: "From completed orders",
            icon: Users,
            color: "text-blue-500",
            bgColor: "bg-blue-500/5",
          },
          {
            label: "Opted-In Contacts",
            value: summary.consented_customer_count,
            detail: "Ready for campaigns",
            icon: MessageCircleMore,
            color: "text-green-500",
            bgColor: "bg-green-500/5",
          },
          {
            label: "Opportunities",
            value: summary.open_opportunity_count ?? (overview ? opportunities.length : undefined),
            detail: "Growth opportunities",
            icon: Sprout,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/5",
          },
          {
            label: "Active Campaigns",
            value: summary.active_campaign_count ?? (overview ? overview.active_campaigns?.length : allCampaigns.length),
            detail: `${allCampaigns.length} total campaigns`,
            icon: Megaphone,
            color: "text-purple-500",
            bgColor: "bg-purple-500/5",
          },
        ].map((item) => (
          <div key={item.label} className="group relative overflow-hidden dc-card min-h-[108px] p-5 flex items-center justify-between transition-all duration-300 hover:-translate-y-1">
            <div className={cn("absolute top-0 right-0 w-28 h-28 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110", item.bgColor)} />
            <div className="flex items-center gap-4 relative z-10">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm transition-colors", 
                item.color.replace("text-", "bg-") + "/10",
                item.color.replace("text-", "border-") + "/20",
                "group-hover:" + item.color.replace("text-", "bg-") + "/15"
              )}>
                <item.icon className={cn("h-6 w-6", item.color)} />
              </div>
              <div>
                <p className="dc-metric-label mb-1">{item.label}</p>
                <p className="text-2xl font-black tracking-tight tabular-nums">{formatCount(item.value)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <span className="dc-eyebrow">Readiness</span>
            </div>
            <CardTitle className="dc-card-title">System Setup</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Check which features are ready to use
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
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

        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <Sprout className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="dc-eyebrow">Opportunities</span>
            </div>
            <CardTitle className="dc-card-title">Your Opportunities</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Ways to bring back customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
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
                  <article key={opportunity.id} className="group dc-card p-4 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-sm leading-snug">{opportunity.title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{simplifyOpportunityText(opportunity.explanation || opportunity.suggested_action || "Check eligible customers")}</p>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 text-xs font-semibold", status.className)}>{status.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-black/[0.08] dark:border-white/10">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium">{formatCount(opportunity.eligible_customer_count)} eligible</span>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                    <Megaphone className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="dc-eyebrow">Campaigns</span>
                </div>
                <CardTitle className="dc-card-title">Your Campaigns</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Manage your marketing messages
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost" className="dc-filter-refresh shrink-0 rounded-xl h-8 px-3 text-xs">
                <Link href="/grow/campaigns">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {latestCampaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">No campaigns yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Create your first campaign to reach customers</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {latestCampaigns.map((campaign) => {
                  const statusColors: Record<string, string> = {
                    draft: "border-amber-500/20 bg-amber-500/10 text-amber-600",
                    review: "border-blue-500/20 bg-blue-500/10 text-blue-600",
                    approved: "border-green-500/20 bg-green-500/10 text-green-600",
                    scheduled: "border-purple-500/20 bg-purple-500/10 text-purple-600",
                    sending: "border-primary/20 bg-primary/10 text-primary",
                    completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
                    paused: "border-orange-500/20 bg-orange-500/10 text-orange-600",
                    canceled: "border-border bg-muted text-muted-foreground",
                    failed: "border-destructive/20 bg-destructive/10 text-destructive",
                  };
                  
                  return (
                    <Link 
                      key={campaign.id} 
                      href={`/grow/campaigns/${campaign.id}`} 
                      className="group block rounded-lg border border-border bg-card p-3 transition-all hover:border-border/80 hover:shadow-sm hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-3">
                        {/* Channel Icon */}
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                          campaign.channel === "whatsapp" 
                            ? "bg-green-500/10 border-green-500/20 text-green-600"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-600"
                        )}>
                          {campaign.channel === "whatsapp" ? (
                            <FaWhatsapp className="h-4 w-4" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </div>
                        
                        {/* Campaign Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1">
                              {campaign.name}
                            </h3>
                            <Badge 
                              variant="outline" 
                              className={cn("shrink-0 text-[10px] font-semibold px-1.5 py-0 h-5", statusColors[campaign.status])}
                            >
                              {campaignStatusLabels[campaign.status]}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3 w-3" />
                              <span className="font-medium tabular-nums">{formatCount(campaign.audience_count)}</span>
                            </span>
                            {campaign.scheduled_at && (
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 className="h-3 w-3" />
                                <span className="font-medium">{formatDate(campaign.scheduled_at)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <span className="dc-eyebrow">Results</span>
            </div>
            <CardTitle className="dc-card-title">Results</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              How your campaigns performed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {recentResults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-semibold text-sm">No results yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">Results show after campaigns finish</p>
              </div>
            ) : (
              recentResults.slice(0, 4).map((result) => (
                <div key={result.campaign_id} className="dc-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{result.campaign_name}</p>
                      <p className="text-xs text-muted-foreground">{formatCount(result.redeemed_count)} redeemed · {formatCount(result.opt_out_count)} opt-outs</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-lg font-bold">{formatMoney(result.attributed_revenue)}</p>
                      <p className="dc-eyebrow">Revenue</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-black/[0.08] dark:border-white/10">
                    <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.sent_count)}</span>
                      <span className="dc-eyebrow">Sent</span>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.delivered_count)}</span>
                      <span className="dc-eyebrow">Delivered</span>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2.5 space-y-0.5">
                      <span className="block text-sm font-bold">{formatCount(result.failed_count)}</span>
                      <span className="dc-eyebrow">Failed</span>
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
