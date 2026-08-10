"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
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
  draft: "border border-border bg-muted text-foreground",
  review: "border border-border bg-muted text-foreground",
  approved: "border border-border bg-muted text-foreground",
  scheduled: "border border-border bg-muted text-foreground",
  sending: "border border-border bg-muted text-foreground",
  completed: "border border-border bg-muted text-foreground",
  paused: "border border-border bg-muted text-foreground",
  canceled: "border border-border bg-muted text-muted-foreground",
  failed: "border border-border bg-muted text-foreground",
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
      <div className="mx-auto max-w-[1400px] space-y-8 pb-16" aria-label="Loading campaigns">
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-16" data-tour="grow-campaigns">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-12">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/grow" className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors">
              ← Back to Overview
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
              <Megaphone className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tracking-wide">CAMPAIGNS</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Campaign Management</h1>
            <p className="text-base text-muted-foreground">
              Create, review, and manage your marketing campaigns in one place.
            </p>
          </div>
          
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => void load()} className="rounded-xl border border-border">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            {hasPermission(user, "grow.campaigns.manage") && (
              <Button asChild className="rounded-xl border border-border shadow-sm hover:shadow transition-all">
                <Link href="/grow/campaigns/new"><Plus className="mr-2 h-4 w-4" />New Campaign</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <Alert className="rounded-xl border border-border bg-card">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Unable to load campaigns</AlertTitle>
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Campaign counts">
        {[
          { label: "Awaiting Review", value: counts.review, icon: ShieldCheck },
          { label: "Approved", value: counts.approved, icon: CheckCircle2 },
          { label: "Scheduled", value: counts.scheduled, icon: Send },
          { label: "Completed", value: counts.completed, icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label} className="group rounded-xl border border-border bg-card transition-all hover:shadow-md">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</p>
                <p className="text-4xl font-bold tracking-tight">{item.value.toLocaleString("en-NP")}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-border bg-muted p-2.5 transition-transform group-hover:scale-110">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-xl border border-border bg-card">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">All Campaigns</CardTitle>
            <CardDescription className="text-sm">Review and manage campaign details and schedules</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter campaigns">
            {([
              ["all", "All"],
              ["needs_action", "Action Needed"],
              ["active", "Active"],
              ["finished", "Finished"],
            ] as Array<[Filter, string]>).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-xl border border-border transition-all",
                  filter === value ? "" : ""
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {visible.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
              <CircleDashed className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 font-semibold text-sm">No campaigns found</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                {campaigns.length === 0
                  ? "Create your first campaign to start engaging with customers"
                  : "Try a different filter to see other campaigns"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/grow/campaigns/${campaign.id}`}
                  className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate font-bold text-sm group-hover:text-primary transition-colors">{campaign.name}</h2>
                      <p className="text-xs capitalize text-muted-foreground">
                        {campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} segment
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-xs", statusStyles[campaign.status])}>
                      {campaignStatusLabels[campaign.status]}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{campaign.audience_count.toLocaleString("en-NP")}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatDate(campaign.scheduled_at)}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary text-xs">
                      View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

