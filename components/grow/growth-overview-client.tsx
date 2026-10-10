"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Mail,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Settings,
  Sprout,
  TriangleAlert,
  Users,
  WalletCards,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import type {
  GrowthCampaign,
  GrowthCampaignStatus,
  GrowthOpportunitySummary,
  GrowthReadinessDomain,
  GrowthSettings,
  GrowthSmsWallet,
  NormalizedGrowthOverview,
} from "@/lib/api/growth-types";
import { campaignStatusLabels } from "@/lib/growth/campaign-administration";
import { campaignRecommendationHref, recommendedCampaignChannel } from "@/lib/growth/campaign-studio";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

const statusClasses: Record<GrowthCampaignStatus, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  review: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  scheduled: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  sending: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  canceled: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

const nextAction: Partial<Record<GrowthCampaignStatus, string>> = {
  draft: "Finish campaign",
  review: "Review campaign",
  approved: "Schedule campaign",
  paused: "Review paused campaign",
  failed: "Fix delivery issue",
};

function count(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-NP")
    : "—";
}

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-NP", {
        style: "currency",
        currency: "NPR",
        maximumFractionDigits: 0,
      }).format(value)
    : "Not available";
}

function dateTime(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function friendlyOpportunity(text: string): string {
  return text
    .replace(/consented customer\(s\)/gi, "customers")
    .replace(/configured lookback/gi, "recent period")
    .replace(/configured active period/gi, "recent period")
    .replace(/observed rules?/gi, "recent visits");
}

function readinessName(domain: GrowthReadinessDomain): string {
  const key = domain.key || domain.code || domain.domain || "setup";
  const labels: Record<string, string> = {
    campaigns: "Campaign sending",
    customers: "Customer contact details",
    inventory: "Menu costing",
    sales: "Sales history",
    cash: "Day close",
    expenses: "Expense tracking",
  };
  return labels[key] || domain.label || "Grow setup";
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-20" aria-label="Loading Grow home">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function GrowthOverviewClient() {
  const user = useAuth((state) => state.user);
  const [overview, setOverview] = useState<NormalizedGrowthOverview | null>(null);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [wallet, setWallet] = useState<GrowthSmsWallet | null>(null);
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [overviewResult, campaignResult, walletResult, settingsResult] = await Promise.allSettled([
        growthApi.getOverview(),
        growthApi.listCampaigns(),
        growthApi.getSmsWallet(),
        growthApi.getSettings(),
      ]);
      if (overviewResult.status === "rejected" || campaignResult.status === "rejected") {
        throw new Error("Grow home could not be loaded");
      }
      setOverview(overviewResult.value);
      setCampaigns(campaignResult.value);
      setWallet(walletResult.status === "fulfilled" ? walletResult.value : null);
      setSettings(settingsResult.status === "fulfilled" ? settingsResult.value : null);
    } catch {
      setError("Grow could not load. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => {
      const left = new Date(a.updated_at || a.created_at || 0).getTime();
      const right = new Date(b.updated_at || b.created_at || 0).getTime();
      return right - left;
    }),
    [campaigns],
  );
  const attentionCampaigns = sortedCampaigns.filter((campaign) =>
    ["draft", "review", "approved", "paused", "failed"].includes(campaign.status),
  );
  const setupItems = (overview?.readiness.domains ?? []).filter((domain) =>
    domain.status !== "ready" && ["campaigns", "customers"].includes(domain.key || domain.code || domain.domain || ""),
  );
  const opportunities = overview?.opportunities ?? [];
  const opportunity = opportunities[0];
  const featuredChannel = opportunity
    ? recommendedCampaignChannel(opportunity, settings)
    : "email";
  const summary = overview?.summary ?? {};
  const results = overview?.recent_results ?? [];
  const sent = results.reduce((total, item) => total + (item.sent_count || 0), 0);
  const delivered = results.reduce((total, item) => total + (item.delivered_count || 0), 0);
  const redeemed = results.reduce((total, item) => total + (item.redeemed_count || 0), 0);
  const revenue = results.reduce((total, item) => total + (item.attributed_revenue || 0), 0);

  if (loading) return <OverviewSkeleton />;

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-20" data-tour="grow-overview">
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-pretty text-3xl font-black tracking-tight">Grow</h1>
          <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">
            Bring customers back with timely offers and see what works.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={cn("mr-2 h-4 w-4 motion-reduce:animate-none", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          {hasPermission(user, "grow.settings.manage") && (
            <Button asChild variant="outline" size="sm">
              <Link href="/grow/settings"><Settings aria-hidden="true" className="mr-2 h-4 w-4" />Setup</Link>
            </Button>
          )}
          {hasPermission(user, "grow.campaigns.manage") && (
            <Button asChild size="sm"><Link href="/grow/campaigns/new?goal=custom"><Megaphone aria-hidden="true" className="mr-2 h-4 w-4" />Create Campaign</Link></Button>
          )}
        </div>
      </header>

      {error && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertCircle aria-hidden="true" className="h-4 w-4 text-destructive" />
          <AlertTitle>Grow Could Not Load</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span><Button size="sm" variant="outline" onClick={() => void load()}>Try Again</Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Grow at a glance">
        <Card className="border-border/80 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Users aria-hidden="true" className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">Customers You Can Reach</p><p className="mt-1 text-2xl font-black tabular-nums">{count(summary.consented_customer_count)}</p><p className="mt-1 text-xs text-muted-foreground">From {count(summary.identified_customer_count)} known customers</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300"><WalletCards aria-hidden="true" className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-sm text-muted-foreground">SMS Credits</p><p className="mt-1 text-2xl font-black tabular-nums">{count(wallet?.available_credits)}</p><Link href="/grow/settings#grow-sms-credits" className="mt-1 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Add Credits</Link></div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Ways to Reach Customers</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className={settings?.email_enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}><Mail aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />Email {settings?.email_enabled ? "On" : "Off"}</Badge>
              <Badge variant="outline" className={settings?.sms_enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}><MessageSquareText aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />SMS {settings?.sms_enabled ? "On" : "Off"}</Badge>
            </div>
            <Link href="/grow/settings" className="mt-3 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage Sending</Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden border-primary/20 bg-primary/[0.035] shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sprout aria-hidden="true" className="h-4 w-4" />Smart campaign suggestions</div>
            <CardDescription>Suggestions based on completed visits and current marketing permission—not predictions.</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {opportunity ? (
              <div>
                <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div>
                    <Badge variant="outline" className="mb-3 border-primary/25 bg-background text-primary">Best next move</Badge>
                    <CardTitle className="text-pretty text-2xl">{opportunity.title}</CardTitle>
                    <CardDescription className="mt-3 max-w-2xl text-sm leading-6">{friendlyOpportunity(opportunity.explanation || opportunity.suggested_action || "Create a timely offer for these customers.")}</CardDescription>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      <span className="font-semibold tabular-nums"><Mail aria-hidden="true" className="mr-2 inline h-4 w-4 text-primary" />{count(opportunity.email_eligible_customer_count)} by email</span>
                      <span className="font-semibold tabular-nums"><MessageSquareText aria-hidden="true" className="mr-2 inline h-4 w-4 text-primary" />{count(opportunity.sms_eligible_customer_count)} by SMS</span>
                      {(opportunity.sms_eligible_customer_count ?? 0) > 0 && <span className="text-muted-foreground tabular-nums">At least {count(opportunity.estimated_sms_credits)} SMS credits</span>}
                    </div>
                  </div>
                  {hasPermission(user, "grow.campaigns.manage") && (opportunity.eligible_customer_count > 0
                    ? <Button asChild><Link href={campaignRecommendationHref(opportunity, featuredChannel)}>Review Campaign<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
                    : <Button disabled>Not Ready to Send</Button>)}
                </div>
                {opportunities.length > 1 && (
                  <div className="mt-6 divide-y divide-border border-t border-border" aria-label="More campaign opportunities">
                    {opportunities.slice(1).map((item) => {
                      const channel = recommendedCampaignChannel(item, settings);
                      return (
                        <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{friendlyOpportunity(item.explanation || item.suggested_action || "Review this customer opportunity.")}</p>
                            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                              {count(item.email_eligible_customer_count)} email · {count(item.sms_eligible_customer_count)} SMS
                              {(item.sms_eligible_customer_count ?? 0) > 0 ? ` · at least ${count(item.estimated_sms_credits)} SMS credits` : ""}
                            </p>
                          </div>
                          {hasPermission(user, "grow.campaigns.manage") && (item.eligible_customer_count > 0
                            ? <Button asChild variant="outline" size="sm"><Link href={campaignRecommendationHref(item, channel)}>Review<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
                            : <Button variant="outline" size="sm" disabled>Not ready</Button>)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4">
                <CardTitle className="text-xl">No smart suggestion right now</CardTitle>
                <CardDescription className="mt-2 max-w-xl leading-6">Your customers may not match a visit pattern yet, or they may have received an offer recently. You can still create a campaign for everyone who can receive it or select customers yourself.</CardDescription>
                <div className="mt-4 flex flex-wrap gap-3">
                  {hasPermission(user, "grow.campaigns.manage") && <Button asChild><Link href="/grow/campaigns/new?goal=custom">Create Campaign<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>}
                  <Button asChild variant="outline"><Link href="/grow/subscribers">View Customers</Link></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader><CardTitle className="text-lg">Needs Your Attention</CardTitle><CardDescription>Campaigns waiting for the next step</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {attentionCampaigns.length ? attentionCampaigns.slice(0, 4).map((campaign) => (
              <Link key={campaign.id} href={`/grow/campaigns/${campaign.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">{campaign.channel === "email" ? <Mail aria-hidden="true" className="h-4 w-4" /> : <MessageSquareText aria-hidden="true" className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{campaign.name}</span><span className="block text-xs text-muted-foreground">{nextAction[campaign.status] || campaignStatusLabels[campaign.status]}</span></span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
            )) : <div className="py-8 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 text-sm font-semibold">Nothing Needs Attention</p><p className="mt-1 text-xs text-muted-foreground">Your campaigns are up to date.</p></div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-lg">Recent Campaigns</CardTitle><CardDescription className="mt-1">Status, audience, and next action</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/grow/campaigns">View All</Link></Button></CardHeader>
          <CardContent className="divide-y divide-border">
            {sortedCampaigns.length ? sortedCampaigns.slice(0, 5).map((campaign) => (
              <Link key={campaign.id} href={`/grow/campaigns/${campaign.id}`} className="grid gap-2 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{campaign.name}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.channel === "email" ? "Email" : "SMS"} · {count(campaign.audience_count)} customers</p></div>
                <p className="text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="mr-1.5 inline h-3.5 w-3.5" />{dateTime(campaign.scheduled_at || campaign.created_at)}</p>
                <Badge variant="outline" className={cn("w-fit", statusClasses[campaign.status])}>{campaignStatusLabels[campaign.status]}</Badge>
              </Link>
            )) : <div className="py-10 text-center"><Megaphone aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No Campaigns Yet</p><p className="mt-1 text-xs text-muted-foreground">Create your first campaign when you are ready.</p></div>}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader><CardTitle className="text-lg">Recent Results</CardTitle><CardDescription>Combined performance from recent campaigns</CardDescription></CardHeader>
          <CardContent>
            {results.length ? <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div><p className="text-xs text-muted-foreground">Delivered</p><p className="mt-1 text-2xl font-black tabular-nums">{count(delivered)}</p><p className="text-xs text-muted-foreground">of {count(sent)} sent</p></div>
                <div><p className="text-xs text-muted-foreground">Offers Used</p><p className="mt-1 text-2xl font-black tabular-nums">{count(redeemed)}</p><p className="text-xs text-muted-foreground">linked redemptions</p></div>
                <div className="col-span-2 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Sales Linked to Offers</p><p className="mt-1 text-2xl font-black tabular-nums">{money(revenue)}</p></div>
              </div>
              <Button asChild variant="outline" className="mt-5 w-full"><Link href="/grow/campaigns">View Campaign Results</Link></Button>
            </> : <div className="py-10 text-center"><CircleDollarSign aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Results Will Appear Here</p><p className="mt-1 text-xs text-muted-foreground">You will see delivery and offer use after a campaign is sent.</p></div>}
          </CardContent>
        </Card>
      </section>

      {setupItems.length > 0 && (
        <section aria-labelledby="grow-setup-title">
          <Card className="border-amber-500/25 bg-amber-500/[0.035] shadow-none">
            <CardHeader><CardTitle id="grow-setup-title" className="flex items-center gap-2 text-lg"><TriangleAlert aria-hidden="true" className="h-5 w-5 text-amber-600" />Before You Send</CardTitle><CardDescription>Complete these items to reach more customers reliably.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {setupItems.map((item) => (
                <div key={item.key || item.code || item.domain} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/70 p-4">
                  <div><p className="text-sm font-semibold">{readinessName(item)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.next_action || item.missing_requirements?.[0] || "Finish this setup before sending."}</p></div>
                  {item.action_route && <Button asChild size="sm" variant="outline"><Link href={item.action_route}>{item.action_label || "Open"}</Link></Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

    </main>
  );
}
