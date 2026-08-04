"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import type { GrowthCampaign, GrowthCampaignStatus } from "@/lib/api/growth-types";
import { campaignStatusLabels } from "@/lib/growth/campaign-administration";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_action" | "active" | "finished";

const statusStyles: Record<GrowthCampaignStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  scheduled: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  sending: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  canceled: "border-border bg-muted text-muted-foreground",
  failed: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function filterCampaigns(campaigns: GrowthCampaign[], filter: Filter): GrowthCampaign[] {
  if (filter === "needs_action") {
    return campaigns.filter((campaign) => ["draft", "review", "approved", "paused"].includes(campaign.status));
  }
  if (filter === "active") {
    return campaigns.filter((campaign) => ["scheduled", "sending"].includes(campaign.status));
  }
  if (filter === "finished") {
    return campaigns.filter((campaign) => ["completed", "canceled", "failed"].includes(campaign.status));
  }
  return campaigns;
}

export function CampaignListClient() {
  const user = useAuth((state) => state.user);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await growthApi.listCampaigns());
    } catch {
      setCampaigns([]);
      setError("Campaigns could not be loaded. No campaign state was changed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => filterCampaigns(campaigns, filter), [campaigns, filter]);
  const counts = useMemo(
    () => ({
      review: campaigns.filter((campaign) => campaign.status === "review").length,
      approved: campaigns.filter((campaign) => campaign.status === "approved").length,
      scheduled: campaigns.filter((campaign) => ["scheduled", "sending"].includes(campaign.status)).length,
      completed: campaigns.filter((campaign) => campaign.status === "completed").length,
    }),
    [campaigns],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-5 pb-10" aria-label="Loading campaigns">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-10" data-tour="grow-campaigns">
      <section className="rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-card to-primary/5 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/grow" className="text-xs font-semibold text-primary hover:underline">
              Yummy Grow overview
            </Link>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
              <Megaphone className="h-4 w-4" />
              Controlled campaigns
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Campaign administration</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review each offer, audience, poster, template, schedule, and result from one place. Approval freezes facts; scheduling remains a separate permissioned step.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            {hasPermission(user, "grow.campaigns.manage") && (
              <Button asChild>
                <Link href="/grow/campaigns/new"><Plus className="mr-2 h-4 w-4" />New campaign</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Campaign list unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Campaign counts">
        {[
          { label: "Awaiting review", value: counts.review, icon: ShieldCheck },
          { label: "Approved, unscheduled", value: counts.approved, icon: CheckCircle2 },
          { label: "Scheduled or sending", value: counts.scheduled, icon: Send },
          { label: "Completed", value: counts.completed, icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-black">{item.value.toLocaleString("en-NP")}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary"><item.icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>All campaign snapshots</CardTitle>
            <CardDescription>Open a campaign to inspect its controls and evidence. This list never sends a message.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter campaigns">
            {([
              ["all", "All"],
              ["needs_action", "Needs action"],
              ["active", "Active delivery"],
              ["finished", "Finished"],
            ] as Array<[Filter, string]>).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
              <CircleDashed className="h-9 w-9 text-muted-foreground/60" />
              <h2 className="mt-3 font-semibold">No campaigns in this view</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {campaigns.length === 0
                  ? "Create a controlled draft when a safe opportunity is available. Nothing is approved or sent automatically."
                  : "Choose another filter to see the remaining campaign snapshots."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/grow/campaigns/${campaign.id}`}
                  className="group rounded-2xl border bg-muted/10 p-5 transition hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold group-hover:text-primary">{campaign.name}</h2>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} customers
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", statusStyles[campaign.status])}>
                      {campaignStatusLabels[campaign.status]}
                    </Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                    <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{campaign.audience_count.toLocaleString("en-NP")} audience</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatDate(campaign.scheduled_at)}</span>
                    <span className="inline-flex items-center justify-end gap-1 font-semibold text-primary sm:ml-auto">Inspect <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Clock3 className="h-4 w-4" />
        Delivery begins only through the background worker after a separately approved campaign reaches its scheduled time.
      </div>
    </div>
  );
}

