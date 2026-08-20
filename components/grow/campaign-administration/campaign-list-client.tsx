"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Grid3x3,
  List,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  TrendingUp,
  Activity,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { growthApi } from "@/lib/api/growth";
import type { GrowthCampaign, GrowthCampaignStatus } from "@/lib/api/growth-types";
import { campaignStatusLabels } from "@/lib/growth/campaign-administration";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";

type Filter = "all" | "needs_action" | "active" | "finished";
type ChannelFilter = "all" | "whatsapp" | "email";
type ViewMode = "grid" | "list";

const statusStyles: Record<GrowthCampaignStatus, string> = {
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

function formatDate(value?: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function filterCampaigns(campaigns: GrowthCampaign[], filter: Filter, channelFilter: ChannelFilter, searchQuery: string): GrowthCampaign[] {
  let filtered = campaigns;
  
  // Apply status filter
  if (filter === "needs_action") {
    filtered = filtered.filter((campaign) => ["draft", "review", "approved", "paused"].includes(campaign.status));
  } else if (filter === "active") {
    filtered = filtered.filter((campaign) => ["scheduled", "sending"].includes(campaign.status));
  } else if (filter === "finished") {
    filtered = filtered.filter((campaign) => ["completed", "canceled", "failed"].includes(campaign.status));
  }
  
  // Apply channel filter
  if (channelFilter === "whatsapp") {
    filtered = filtered.filter((campaign) => campaign.channel === "whatsapp");
  } else if (channelFilter === "email") {
    filtered = filtered.filter((campaign) => campaign.channel === "email");
  }
  
  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((campaign) => 
      campaign.name.toLowerCase().includes(query) ||
      campaign.playbook_code.toLowerCase().includes(query) ||
      campaign.segment_code.toLowerCase().includes(query)
    );
  }
  
  return filtered;
}

export function CampaignListClient() {
  const user = useAuth((state) => state.user);
  const [campaigns, setCampaigns] = useState<GrowthCampaign[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const itemsPerPage = 10;

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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setCampaigns(await growthApi.listCampaigns());
    } catch {
      setError("Campaigns could not be loaded. No campaign state was changed.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const filtered = filterCampaigns(campaigns, filter, channelFilter, searchQuery);
    // Sort by most recent first (scheduled_at or created_at)
    return filtered.sort((a, b) => {
      const dateA = a.scheduled_at || a.created_at;
      const dateB = b.scheduled_at || b.created_at;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [campaigns, filter, channelFilter, searchQuery]);
  
  // Pagination calculations
  const totalPages = Math.ceil(visible.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCampaigns = visible.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, channelFilter, searchQuery]);
  const counts = useMemo(
    () => ({
      review: campaigns.filter((campaign) => campaign.status === "review").length,
      approved: campaigns.filter((campaign) => campaign.status === "approved").length,
      scheduled: campaigns.filter((campaign) => ["scheduled", "sending"].includes(campaign.status)).length,
      completed: campaigns.filter((campaign) => campaign.status === "completed").length,
      whatsapp: campaigns.filter((campaign) => campaign.channel === "whatsapp").length,
      email: campaigns.filter((campaign) => campaign.channel === "email").length,
    }),
    [campaigns],
  );

  if (loading) {
    return (
      <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" aria-label="Loading campaigns">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" data-tour="grow-campaigns">
      {refreshing ? (
        <div className="pointer-events-none absolute right-4 top-0 z-10 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Refreshing…
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/grow" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              ← Back to Overview
            </Link>
          </div>
          <h1 className="dc-page-title">Campaign Management</h1>
          <p className="dc-page-subtitle">
            Create, review, and manage your marketing campaigns in one place
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
          {hasPermission(user, "grow.campaigns.manage") && (
            <Button 
              asChild 
              className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium"
            >
              <Link href="/grow/campaigns/new">
                <Plus className="h-4 w-4" />
                New Campaign
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert className="dc-card border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="font-semibold text-destructive">Unable to load campaigns</AlertTitle>
          <AlertDescription className="text-sm text-destructive/80">{error}</AlertDescription>
        </Alert>
      )}

      {/* Campaign summary cards */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4" aria-label="Campaign counts">
        {[
          { label: "Awaiting Review", value: counts.review, icon: ShieldCheck, color: "text-blue-500", bgColor: "bg-blue-500/5" },
          { label: "Approved", value: counts.approved, icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/5" },
          { label: "Scheduled", value: counts.scheduled, icon: Send, color: "text-purple-500", bgColor: "bg-purple-500/5" },
          { label: "Completed", value: counts.completed, icon: CheckCircle2, color: "text-emerald-500", bgColor: "bg-emerald-500/5" },
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
                <p className="text-2xl font-black tracking-tight tabular-nums">{item.value.toLocaleString("en-NP")}</p>
              </div>
            </div>
            <TrendingUp className="h-6 w-6 text-muted-foreground opacity-10 group-hover:opacity-20 transition-opacity" />
          </div>
        ))}
      </section>

      {/* Campaigns list */}
      <section>
        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <CardTitle className="dc-card-title flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" />
                    All Campaigns
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Review and manage campaign details and schedules
                  </CardDescription>
                </div>
              </div>
              
              {/* Filters, Search, and View Toggle Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search campaigns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 rounded-2xl border-black/[0.08] dark:border-white/10 pl-9 text-xs"
                  />
                </div>

                {/* Status Filter Dropdown */}
                <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-2xl border-black/[0.08] dark:border-white/10 text-xs font-medium">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="needs_action">Action Needed</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                  </SelectContent>
                </Select>

                {/* Channel Filter Dropdown */}
                <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as ChannelFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-2xl border-black/[0.08] dark:border-white/10 text-xs font-medium">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="whatsapp">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp ({counts.whatsapp})
                      </span>
                    </SelectItem>
                    <SelectItem value="email">
                      <span className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        Email ({counts.email})
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl border border-black/[0.08] dark:border-white/10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "h-7 w-7 p-0 rounded-xl transition-all",
                      viewMode === "grid" 
                        ? "bg-background shadow-sm" 
                        : "hover:bg-background/50"
                    )}
                    title="Grid view"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "h-7 w-7 p-0 rounded-xl transition-all",
                      viewMode === "list" 
                        ? "bg-background shadow-sm" 
                        : "hover:bg-background/50"
                    )}
                    title="List view"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {visible.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
                <CircleDashed className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 font-semibold text-sm">No campaigns found</h2>
                <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                  {campaigns.length === 0
                    ? "Create your first campaign to start engaging with customers"
                    : searchQuery 
                      ? `No campaigns match "${searchQuery}"`
                      : "Try a different filter to see other campaigns"}
                </p>
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  <div className="grid gap-5 lg:grid-cols-2">
                    {paginatedCampaigns.map((campaign) => (
                      <Link
                        key={campaign.id}
                        href={`/grow/campaigns/${campaign.id}`}
                        className="group relative overflow-hidden dc-card p-5 transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate font-bold text-base mb-1 group-hover:text-primary transition-colors">
                                {campaign.name}
                              </h2>
                              <p className="text-xs capitalize text-muted-foreground">
                                {campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} segment
                              </p>
                            </div>
                            <Badge variant="outline" className={cn("shrink-0 text-xs font-semibold", statusStyles[campaign.status])}>
                              {campaignStatusLabels[campaign.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/[0.08] dark:border-white/10">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span className="font-medium">{campaign.audience_count.toLocaleString("en-NP")}</span>
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" />
                                <span className="font-medium">{formatDate(campaign.scheduled_at)}</span>
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 font-semibold text-primary text-xs">
                              View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {paginatedCampaigns.map((campaign) => (
                      <Link
                        key={campaign.id}
                        href={`/grow/campaigns/${campaign.id}`}
                        className="group relative overflow-hidden dc-card p-4 transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-4">
                          {/* Channel Icon */}
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center border shrink-0",
                            campaign.channel === "whatsapp" 
                              ? "bg-green-500/10 border-green-500/20 text-green-600"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-600"
                          )}>
                            {campaign.channel === "whatsapp" ? (
                              <MessageCircle className="h-4 w-4" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </div>

                          {/* Campaign Info */}
                          <div className="min-w-0 flex-1">
                            <h2 className="truncate font-bold text-sm mb-0.5 group-hover:text-primary transition-colors">
                              {campaign.name}
                            </h2>
                            <p className="text-[10px] capitalize text-muted-foreground">
                              {campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} segment
                            </p>
                          </div>

                          {/* Metrics */}
                          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              <span className="font-medium tabular-nums">{campaign.audience_count.toLocaleString("en-NP")}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              <span className="font-medium">{formatDate(campaign.scheduled_at)}</span>
                            </span>
                          </div>

                          {/* Status Badge */}
                          <Badge variant="outline" className={cn("shrink-0 text-[10px] font-semibold", statusStyles[campaign.status])}>
                            {campaignStatusLabels[campaign.status]}
                          </Badge>

                          {/* Arrow */}
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-6 mt-6 border-t border-black/[0.08] dark:border-white/10">
                    <p className="text-xs text-muted-foreground">
                      Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, visible.length)}</span> of <span className="font-medium">{visible.length}</span> campaigns
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0 rounded-xl"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            size="sm"
                            variant={currentPage === page ? "default" : "ghost"}
                            onClick={() => setCurrentPage(page)}
                            className={cn(
                              "h-8 w-8 p-0 rounded-xl text-xs font-medium",
                              currentPage === page && "bg-primary text-primary-foreground"
                            )}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0 rounded-xl"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

