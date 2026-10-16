"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  SlidersHorizontal,
  Clock3,
  Mail,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import type { GrowthCampaign, GrowthCampaignStatus } from "@/lib/api/growth-types";
import { campaignStatusLabels } from "@/lib/growth/campaign-administration";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import { GrowPageHeader } from "@/components/grow/grow-page-header";

type WorkflowTab = "attention" | "scheduled" | "sent" | "drafts" | "all";
type ChannelFilter = "all" | "email" | "sms";
type GoalFilter = "all" | "second_visit" | "win_back" | "slow_day" | "custom";
type SortBy = "updated_desc" | "scheduled_asc";

const tabLabels: Record<WorkflowTab, string> = {
  attention: "Needs Attention",
  scheduled: "Scheduled",
  sent: "Sent",
  drafts: "Drafts",
  all: "All",
};

const goalLabels: Record<string, string> = {
  second_visit: "Bring Back New Customers",
  win_back: "Re-engage Inactive Customers",
  slow_day: "Fill a Quiet Period",
  custom: "Selected Customers",
};

const statusStyles: Record<GrowthCampaignStatus, string> = {
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

const actionLabels: Record<GrowthCampaignStatus, string> = {
  draft: "Continue Editing",
  review: "Review Campaign",
  approved: "Schedule Campaign",
  scheduled: "View Schedule",
  sending: "View Delivery",
  completed: "View Results",
  paused: "Review Campaign",
  canceled: "View Campaign",
  failed: "Fix Delivery Issue",
};

function dateTime(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function matchesTab(campaign: GrowthCampaign, tab: WorkflowTab): boolean {
  if (tab === "attention") return ["review", "approved", "paused", "failed"].includes(campaign.status);
  if (tab === "scheduled") return ["scheduled", "sending"].includes(campaign.status);
  if (tab === "sent") return ["completed", "canceled"].includes(campaign.status);
  if (tab === "drafts") return campaign.status === "draft";
  return true;
}

function CampaignListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pb-20" aria-label="Loading campaigns">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-[32rem] rounded-2xl" />
    </div>
  );
}

export function CampaignListClient() {
  const user = useAuth((state) => state.user);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [tab, setTab] = useState<WorkflowTab>("attention");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [goal, setGoal] = useState<GoalFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated_desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 10;

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setCampaigns(await growthApi.listCampaigns());
    } catch {
      setError("Campaigns could not load. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("view") as WorkflowTab | null;
    const requestedChannel = params.get("channel") as ChannelFilter | null;
    const requestedGoal = params.get("goal") as GoalFilter | null;
    const requestedSort = params.get("sort") as SortBy | null;
    const requestedPage = Number(params.get("page"));
    if (requestedTab && requestedTab in tabLabels) setTab(requestedTab);
    if (requestedChannel && ["all", "email", "sms"].includes(requestedChannel)) setChannel(requestedChannel);
    if (requestedGoal && ["all", "second_visit", "win_back", "slow_day", "custom"].includes(requestedGoal)) setGoal(requestedGoal);
    if (requestedSort && ["updated_desc", "scheduled_asc"].includes(requestedSort)) setSortBy(requestedSort);
    if (Number.isInteger(requestedPage) && requestedPage > 0) setPage(requestedPage);
    setSearch(params.get("q") || "");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (tab !== "attention") params.set("view", tab);
    if (channel !== "all") params.set("channel", channel);
    if (goal !== "all") params.set("goal", goal);
    if (sortBy !== "updated_desc") params.set("sort", sortBy);
    if (search.trim()) params.set("q", search.trim());
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [channel, goal, page, search, sortBy, tab, urlReady]);

  const counts = useMemo(() => ({
    attention: campaigns.filter((campaign) => matchesTab(campaign, "attention")).length,
    scheduled: campaigns.filter((campaign) => matchesTab(campaign, "scheduled")).length,
    sent: campaigns.filter((campaign) => matchesTab(campaign, "sent")).length,
    drafts: campaigns.filter((campaign) => matchesTab(campaign, "drafts")).length,
    all: campaigns.length,
  }), [campaigns]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return campaigns
      .filter((campaign) => matchesTab(campaign, tab))
      .filter((campaign) => channel === "all" || campaign.channel === channel)
      .filter((campaign) => goal === "all" || campaign.playbook_code === goal)
      .filter((campaign) => !query || campaign.name.toLowerCase().includes(query) || (goalLabels[campaign.playbook_code] || "").toLowerCase().includes(query))
      .sort((left, right) => {
        if (sortBy === "scheduled_asc") {
          return new Date(left.scheduled_at || "9999-12-31").getTime() - new Date(right.scheduled_at || "9999-12-31").getTime();
        }
        return new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime();
      });
  }, [campaigns, channel, goal, search, sortBy, tab]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCampaigns = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (loading) return <CampaignListSkeleton />;

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 pb-20 sm:gap-6" data-tour="grow-campaigns">
      <GrowPageHeader title="Campaigns" description="See what needs action, what is scheduled, and how sent campaigns performed." actions={
        <>
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}><RefreshCw aria-hidden="true" className={cn("mr-2 h-4 w-4 motion-reduce:animate-none", refreshing && "animate-spin")} />{refreshing ? "Refreshing…" : "Refresh"}</Button>
          {hasPermission(user, "grow.campaigns.manage") && <Button asChild size="sm"><Link href="/grow/campaigns/new?goal=custom"><Plus aria-hidden="true" className="mr-2 h-4 w-4" />Create Campaign</Link></Button>}
        </>
      } />

      {error && <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle aria-hidden="true" className="h-4 w-4 text-destructive" /><AlertTitle>Campaigns Could Not Load</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void load()}>Try Again</Button></AlertDescription></Alert>}

      <nav aria-label="Campaign views" className="hidden md:flex md:gap-0 md:overflow-x-auto md:border-b md:border-border">
        {(Object.keys(tabLabels) as WorkflowTab[]).map((item) => (
          <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} aria-current={tab === item ? "page" : undefined} className={cn("flex min-h-11 min-w-0 shrink-0 items-center justify-between gap-2 border-b-2 px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <span className="truncate">{tabLabels[item]}</span><span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums sm:text-xs", tab === item ? "bg-primary/10 text-primary" : "bg-muted")}>{counts[item]}</span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:hidden">
        <Select value={tab} onValueChange={(value) => { setTab(value as WorkflowTab); setPage(1); }}>
          <SelectTrigger aria-label="Campaign status" className="min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(tabLabels) as WorkflowTab[]).map((item) => <SelectItem key={item} value={item}>{tabLabels[item]} · {counts[item]}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="outline" className="gap-2" onClick={() => setFiltersOpen(true)}><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />Filters{(channel !== "all" || goal !== "all") && <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{Number(channel !== "all") + Number(goal !== "all")}</span>}</Button>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" aria-label="Campaign filters" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="mb-5 pr-8 text-left"><SheetTitle>Campaign filters</SheetTitle><SheetDescription>Choose which campaigns to show and how to sort them.</SheetDescription></SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2 text-sm font-medium">Channel<Select value={channel} onValueChange={(value) => { setChannel(value as ChannelFilter); setPage(1); }}><SelectTrigger aria-label="Filter by channel" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Channels</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 text-sm font-medium">Campaign goal<Select value={goal} onValueChange={(value) => { setGoal(value as GoalFilter); setPage(1); }}><SelectTrigger aria-label="Filter by campaign goal" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Campaign Goals</SelectItem><SelectItem value="second_visit">Bring Back New Customers</SelectItem><SelectItem value="win_back">Re-engage Inactive Customers</SelectItem><SelectItem value="slow_day">Fill a Quiet Period</SelectItem><SelectItem value="custom">Selected Customers</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 text-sm font-medium">Sort by<Select value={sortBy} onValueChange={(value) => { setSortBy(value as SortBy); setPage(1); }}><SelectTrigger aria-label="Sort campaigns" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated_desc">Recently Updated</SelectItem><SelectItem value="scheduled_asc">Sending Soonest</SelectItem></SelectContent></Select></div>
            <Button type="button" className="w-full" onClick={() => setFiltersOpen(false)}>Show {visible.length} campaigns</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="gap-3 border-b border-border p-4 sm:gap-4 sm:p-6">
          <div><CardTitle className="text-lg">{tabLabels[tab]}</CardTitle><CardDescription className="mt-1">{tab === "attention" ? "Campaigns waiting for your next decision" : tab === "scheduled" ? "Upcoming and currently sending campaigns" : tab === "sent" ? "Completed and canceled campaigns" : tab === "drafts" ? "Campaigns you have started but not sent for approval" : "Every campaign at this restaurant"}</CardDescription></div>
          <div className="grid gap-2 md:grid-cols-[minmax(15rem,1fr)_11rem_14rem_11rem]">
            <div className="relative min-w-0"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search campaigns" name="campaign-search" autoComplete="off" placeholder="Search campaigns…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" /></div>
            <div className="hidden min-w-0 md:block"><Select value={channel} onValueChange={(value) => { setChannel(value as ChannelFilter); setPage(1); }}><SelectTrigger aria-label="Filter by channel" className="min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Channels</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
            <div className="hidden min-w-0 md:block"><Select value={goal} onValueChange={(value) => { setGoal(value as GoalFilter); setPage(1); }}><SelectTrigger aria-label="Filter by campaign goal" className="min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Campaign Goals</SelectItem><SelectItem value="second_visit">Bring Back New Customers</SelectItem><SelectItem value="win_back">Re-engage Inactive Customers</SelectItem><SelectItem value="slow_day">Fill a Quiet Period</SelectItem><SelectItem value="custom">Selected Customers</SelectItem></SelectContent></Select></div>
            <div className="hidden min-w-0 md:block"><Select value={sortBy} onValueChange={(value) => { setSortBy(value as SortBy); setPage(1); }}><SelectTrigger aria-label="Sort campaigns" className="min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated_desc">Recently Updated</SelectItem><SelectItem value="scheduled_asc">Sending Soonest</SelectItem></SelectContent></Select></div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {pageCampaigns.length ? (
            <div className="divide-y divide-border">
              {pageCampaigns.map((campaign) => (
                <article key={campaign.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", campaign.channel === "email" ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300" : "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300")}>{campaign.channel === "email" ? <Mail aria-hidden="true" className="h-4 w-4" /> : <MessageSquareText aria-hidden="true" className="h-4 w-4" />}</span>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-bold">{campaign.name}</h2><Badge variant="outline" className={statusStyles[campaign.status]}>{campaignStatusLabels[campaign.status]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{goalLabels[campaign.playbook_code] || "Campaign"} · {campaign.channel === "email" ? "Email" : "SMS"}</p></div>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Customers</p><p className="mt-1 text-sm font-semibold tabular-nums"><Users aria-hidden="true" className="mr-1.5 inline h-4 w-4" />{campaign.audience_count.toLocaleString("en-NP")}</p></div>
                  <div><p className="text-xs text-muted-foreground">{campaign.scheduled_at ? "Sending" : "Created"}</p><p className="mt-1 text-sm font-semibold"><CalendarClock aria-hidden="true" className="mr-1.5 inline h-4 w-4" />{dateTime(campaign.scheduled_at || campaign.created_at)}</p></div>
                  <Button asChild variant={campaign.status === "approved" || campaign.status === "review" || campaign.status === "failed" ? "default" : "outline"} size="sm" className="justify-between lg:min-w-36"><Link href={`/grow/campaigns/${campaign.id}`}>{actionLabels[campaign.status]}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              {tab === "attention" && !search && channel === "all" && goal === "all" ? <CheckCircle2 aria-hidden="true" className="h-10 w-10 text-emerald-600" /> : <CircleDashed aria-hidden="true" className="h-10 w-10 text-muted-foreground" />}
              <h2 className="mt-4 text-base font-semibold">{tab === "attention" && !search && channel === "all" && goal === "all" ? "Nothing Needs Attention" : "No Campaigns Found"}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{campaigns.length === 0 ? "Create your first campaign to start bringing customers back." : "Try another view or remove a filter."}</p>
              {campaigns.length === 0 && hasPermission(user, "grow.campaigns.manage") && <Button asChild className="mt-5"><Link href="/grow/campaigns/new?goal=custom">Create Campaign</Link></Button>}
            </div>
          )}
        </CardContent>

        {visible.length > pageSize && (
          <footer className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, visible.length)} of {visible.length} campaigns</p>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>Previous</Button><span className="px-2 text-xs font-medium tabular-nums">Page {safePage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>Next</Button></div>
          </footer>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="h-4 w-4" />Campaign actions follow your assigned permissions and the current campaign status.</p>
    </main>
  );
}
