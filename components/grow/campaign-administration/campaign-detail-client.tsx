"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  FileImage,
  Info,
  Loader2,
  LockKeyhole,
  MessageCircleMore,
  Pause,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TriangleAlert,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import apiClient from "@/lib/api-client";
import { GrowthApis } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { growthApi } from "@/lib/api/growth";
import type {
  GrowthCampaign,
  GrowthCampaignResultSummary,
  GrowthCampaignStatus,
  GrowthMessageTemplate,
  GrowthSegmentPreview,
  GrowthSettings,
} from "@/lib/api/growth-types";
import {
  buildGrowthScheduleInput,
  campaignActions,
  campaignApprovalChecks,
  campaignStatusLabels,
  formatOffer,
  isCampaignApprovalReady,
  scheduleOfferWindowConflict,
  segmentLabels,
} from "@/lib/growth/campaign-administration";
import { hasPermission } from "@/lib/role-permissions";
import { cn } from "@/lib/utils";
import { CampaignAnalyticsDashboard } from "@/components/grow/campaign-analytics/campaign-analytics-dashboard";
import { TemplatePreview } from "@/components/grow/campaign-analytics/template-preview";

// Every status previously rendered as the same neutral gray, so the badge
// gave no at-a-glance signal about campaign state. Color now tracks meaning:
// neutral while still editable, blue while in motion toward sending, amber
// for anything needing attention, green for a clean finish, red for failure.
const statusStyles: Record<GrowthCampaignStatus, string> = {
  draft: "border-border bg-muted text-foreground",
  review: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  approved: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  scheduled: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  sending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  canceled: "border-border bg-muted text-muted-foreground",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

type ReasonAction = "return" | "pause" | "cancel";

function formatDate(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return `Rs. ${value.toLocaleString("en-NP", { maximumFractionDigits: 2 })}`;
}

function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-NP")
    : "0";
}

function statusGuidance(status: GrowthCampaignStatus): { title: string; detail: string } {
  const guidance: Record<GrowthCampaignStatus, { title: string; detail: string }> = {
    draft: { title: "Finish this campaign", detail: "Review the customers, offer, and message, then send it for approval." },
    review: { title: "Waiting for approval", detail: "A manager can approve it or return it for changes." },
    approved: { title: "Ready to schedule", detail: "Choose when customers should receive this campaign." },
    scheduled: { title: "Scheduled", detail: "Yummy will send it at the selected time after checking customer permissions again." },
    sending: { title: "Sending now", detail: "Delivery results will update as messages are processed." },
    completed: { title: "Campaign complete", detail: "Review delivery, offer use, and sales linked to this campaign." },
    paused: { title: "Campaign paused", detail: "Review the reason before deciding what to do next." },
    canceled: { title: "Campaign canceled", detail: "This campaign will not send. Its history remains available." },
    failed: { title: "Delivery needs attention", detail: "Review the delivery issue before creating or scheduling another campaign." },
  };
  return guidance[status];
}

function localInputForZone(timeZone: string): string {
  try {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(future)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return "";
  }
}

const metricToneStyles = {
  default: "border-border bg-card",
  success: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
} as const;

function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: keyof typeof metricToneStyles;
}) {
  return (
    <div className={cn("rounded-xl border p-4", metricToneStyles[tone])}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" aria-label="Loading campaign detail">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((state) => state.restaurant);
  const fetchRestaurant = useRestaurant((state) => state.fetchRestaurant);
  const [campaign, setCampaign] = useState<GrowthCampaign | null>(null);
  const [audience, setAudience] = useState<GrowthSegmentPreview | null>(null);
  const [results, setResults] = useState<GrowthCampaignResultSummary | null>(null);
  const [templates, setTemplates] = useState<GrowthMessageTemplate[]>([]);
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondaryWarnings, setSecondaryWarnings] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);

  const permissions = useMemo(
    () => ({
      manage: hasPermission(user, "grow.campaigns.manage"),
      approve: hasPermission(user, "grow.campaigns.approve"),
      send: hasPermission(user, "grow.campaigns.send"),
    }),
    [user],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSecondaryWarnings([]);
    try {
      const nextCampaign = await growthApi.getCampaign(campaignId);
      setCampaign(nextCampaign);

      const [resultResponse, templateResponse, audienceResponse, settingsResponse] = await Promise.allSettled([
        growthApi.getCampaignResults(campaignId),
        growthApi.listMessageTemplates(),
        permissions.manage
          ? growthApi.previewCampaignAudience(campaignId)
          : growthApi.previewSegment(nextCampaign.segment_code),
        growthApi.getSettings(),
      ]);
      const warnings: string[] = [];
      if (resultResponse.status === "fulfilled") setResults(resultResponse.value);
      else {
        setResults(null);
        warnings.push("Delivery and attribution results are temporarily unavailable.");
      }
      if (templateResponse.status === "fulfilled") setTemplates(templateResponse.value);
      else {
        setTemplates([]);
        warnings.push("Approved message template readiness could not be confirmed.");
      }
      if (audienceResponse.status === "fulfilled") setAudience(audienceResponse.value);
      else {
        setAudience(null);
        warnings.push("The current audience preview and exclusion breakdown are unavailable.");
      }
      if (settingsResponse.status === "fulfilled") setSettings(settingsResponse.value);
      else {
        setSettings(null);
        warnings.push("Delivery settings and quiet hours could not be confirmed.");
      }
      setSecondaryWarnings(warnings);
    } catch (loadError) {
      setCampaign(null);
      setError(getApiErrorMessage(loadError, "Campaign detail could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [campaignId, permissions.manage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!restaurant) void fetchRestaurant();
  }, [fetchRestaurant, restaurant]);

  const timeZone = restaurant?.timezone?.trim() || "";
  const channelDisabled =
    campaign?.channel === "email"
      ? settings?.email_enabled === false
      : campaign?.channel === "sms"
        ? settings?.sms_enabled === false
        : true;
  const schedulePayload = useMemo(() => {
    if (!scheduleLocal || !timeZone) return { value: null, error: null };
    try {
      return { value: buildGrowthScheduleInput(scheduleLocal, timeZone), error: null };
    } catch (scheduleError) {
      return {
        value: null,
        error: scheduleError instanceof Error ? scheduleError.message : "Schedule is invalid.",
      };
    }
  }, [scheduleLocal, timeZone]);
  const scheduleWindowError = useMemo(() => {
    if (!schedulePayload.value || !campaign?.offer) return null;
    const conflict = scheduleOfferWindowConflict(
      schedulePayload.value.scheduled_at,
      campaign.offer.valid_from,
      campaign.offer.valid_until,
    );
    if (conflict === "before") {
      return `Choose a send time on or after the offer starts: ${formatDate(campaign.offer.valid_from)}.`;
    }
    if (conflict === "after") {
      return `Choose a send time before the offer expires: ${formatDate(campaign.offer.valid_until)}.`;
    }
    return null;
  }, [campaign?.offer, schedulePayload.value]);

  if (loading) return <DetailSkeleton />;

  if (!campaign) {
    return (
      <div className="mx-auto max-w-3xl pb-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Campaign unavailable</AlertTitle>
          <AlertDescription>{error || "This campaign is unavailable or outside your restaurant."}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4"><Link href="/grow/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Back to campaigns</Link></Button>
      </div>
    );
  }

  const actions = campaignActions(campaign.status, permissions);
  const currentCampaignId = campaign.id;
  const approvalChecks = campaignApprovalChecks(campaign, templates, audience);
  const approvalReady = isCampaignApprovalReady(approvalChecks);
  const selectedTemplate = templates.find(
    (template) => String(template.id) === String(campaign.message_template_id),
  );
  const frozen = Boolean(campaign.audience_frozen_at);
  const reasonValid = reason.trim().length >= 8;
  const limitations = Array.from(
    new Set([...(campaign.offer?.limitations ?? []), ...(results?.limitations ?? [])]),
  );
  const guidance = statusGuidance(campaign.status);
  const hasPerformance = Boolean(
    results &&
      (["sending", "completed", "failed"].includes(campaign.status) ||
        results.sent_count > 0 ||
        results.delivered_count > 0 ||
        results.failed_count > 0),
  );

  async function transition(
    key: string,
    successMessage: string,
    request: () => Promise<GrowthCampaign>,
  ): Promise<boolean> {
    setBusyAction(key);
    try {
      const updated = await request();
      setCampaign(updated);
      toast.success(successMessage);
      await load();
      return true;
    } catch (transitionError) {
      toast.error(getApiErrorMessage(transitionError, "Campaign state could not be changed."));
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function submitReview() {
    await transition(
      "review",
      "Campaign submitted for review. It is not approved, scheduled, or sent.",
      () => growthApi.submitCampaignForReview(currentCampaignId),
    );
  }

  async function confirmReasonAction() {
    if (!reasonAction || !reasonValid) return;
    const normalizedReason = reason.trim();
    let completed = false;
    if (reasonAction === "return") {
      completed = await transition(
        "return",
        "Campaign returned to draft with the review reason recorded.",
        () => growthApi.returnCampaignToDraft(currentCampaignId, normalizedReason),
      );
    } else if (reasonAction === "pause") {
      completed = await transition(
        "pause",
        "Campaign paused. The delivery worker will respect the backend state.",
        () => growthApi.pauseCampaign(currentCampaignId, normalizedReason),
      );
    } else {
      completed = await transition(
        "cancel",
        "Campaign canceled with the reason recorded.",
        () => growthApi.cancelCampaign(currentCampaignId, normalizedReason),
      );
    }
    if (completed) {
      setReasonAction(null);
      setReason("");
    }
  }

  function openSchedule() {
    setScheduleLocal(timeZone ? localInputForZone(timeZone) : "");
    setScheduleConfirmed(false);
    setScheduleOpen(true);
  }

  async function confirmSchedule() {
    if (!schedulePayload.value || !scheduleConfirmed) return;
    const completed = await transition(
      "schedule",
      "Campaign scheduled. It was queued for the selected future time, not sent now.",
      () => growthApi.scheduleCampaign(currentCampaignId, schedulePayload.value!),
    );
    if (completed) setScheduleOpen(false);
  }

  async function downloadCSV() {
    if (!restaurant?.id) {
      toast.error("Restaurant context is required for CSV export.");
      return;
    }
    setBusyAction("csv");
    try {
      const response = await apiClient.get(GrowthApis.campaignResultsCsv(currentCampaignId), {
        responseType: 'blob',
        timeout: 60000, // 60 seconds for CSV generation
      });
      
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers["content-disposition"];
      let filename = `campaign_${currentCampaignId}_results.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("Campaign results exported to CSV.");
    } catch (csvError) {
      toast.error(getApiErrorMessage(csvError, "CSV export failed."));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pb-20" data-tour="grow-campaign-detail">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/grow/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Campaigns
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-pretty text-3xl font-black tracking-tight">{campaign.name}</h1>
            <Badge variant="outline" className={cn("text-xs font-semibold", statusStyles[campaign.status])}>{campaignStatusLabels[campaign.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.channel === "email" ? "Email" : "SMS"} · {segmentLabels[campaign.segment_code] || "Selected customers"}
            {campaign.scheduled_at && ` · ${formatDate(campaign.scheduled_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={Boolean(busyAction)}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
          {actions.submitReview && (
            <Button size="sm" onClick={() => void submitReview()} disabled={Boolean(busyAction)} className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium">
              {busyAction === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Send for approval
            </Button>
          )}
          {actions.returnToDraft && (
            <Button size="sm" variant="ghost" onClick={() => { setReason(""); setReasonAction("return"); }} className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4">
              <RotateCcw className="h-4 w-4" />Return to draft
            </Button>
          )}
          {actions.approve && (
            <Button size="sm" onClick={() => setApprovalOpen(true)} disabled={!approvalReady || Boolean(busyAction)} title={!approvalReady ? "A verified eligible audience and complete campaign bundle are required" : undefined} className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium">
              <LockKeyhole className="h-4 w-4" />Approve
            </Button>
          )}
          {actions.schedule && (
            <Button size="sm" onClick={openSchedule} className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium">
              <CalendarClock className="h-4 w-4" />Schedule
            </Button>
          )}
          {actions.pause && (
            <Button size="sm" variant="ghost" onClick={() => { setReason(""); setReasonAction("pause"); }} className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4">
              <Pause className="h-4 w-4" />Pause
            </Button>
          )}
          {actions.cancel && (
            <Button size="sm" variant="destructive" onClick={() => { setReason(""); setReasonAction("cancel"); }} className="h-9 gap-2 rounded-2xl px-4">
              <XCircle className="h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      </header>

      <section className={cn("flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between", campaign.status === "failed" ? "border-destructive/30 bg-destructive/5" : campaign.status === "paused" ? "border-amber-500/30 bg-amber-500/5" : "border-primary/20 bg-primary/[0.035]")} aria-labelledby="campaign-next-step">
        <div>
          <h2 id="campaign-next-step" className="text-lg font-bold">{guidance.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{guidance.detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <Users aria-hidden="true" className="h-4 w-4" />
          {formatCount(campaign.audience_count)} customers
        </div>
      </section>

      {secondaryWarnings.length > 0 && (
        <Alert className="dc-card border-amber-500/30 bg-amber-500/5">
          <TriangleAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-semibold text-amber-700 dark:text-amber-400">Partial data</AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-300 text-xs">{secondaryWarnings.join(" ")}</AlertDescription>
        </Alert>
      )}

      {campaign.failure_reason ? (
        <Alert className="dc-card border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertTitle className="font-semibold text-destructive">Campaign failed</AlertTitle>
          <AlertDescription className="text-destructive/80 text-xs">{campaign.failure_reason}</AlertDescription>
        </Alert>
      ) : campaign.pause_reason ? (
        <Alert className="dc-card border-amber-500/30 bg-amber-500/5">
          <Pause className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-semibold text-amber-700 dark:text-amber-400">Campaign paused</AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-300 text-xs">{campaign.pause_reason}</AlertDescription>
        </Alert>
      ) : null}

      {/* Compact 3-column grid */}
      <section className="grid gap-5 xl:grid-cols-3">
        {/* Offer Details */}
        <Card className="dc-card">
          <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <Tag className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">What Customers Get</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {!campaign.offer ? (
              <p className="text-xs text-muted-foreground text-center py-6">No offer available</p>
            ) : (
              <>
                <div className="rounded-lg bg-muted/50 p-3 border border-black/[0.08] dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Offer</p>
                  <p className="mt-1.5 text-base font-bold">{formatOffer(campaign.offer)}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Min order {formatMoney(Number(campaign.offer.minimum_order_value ?? 0))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Maximum Discount Cost</p>
                    <p className="mt-1 font-bold text-xs">{campaign.offer.maximum_exposure == null ? "Not set" : formatMoney(Number(campaign.offer.maximum_exposure))}</p>
                  </div>
                  <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost Check</p>
                    <p className="mt-1 font-bold text-xs">{campaign.offer.profitability_status === "verified" ? "Ready" : "Needs review"}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Audience */}
        <Card className="dc-card">
          <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <CardTitle className="text-sm font-semibold">Who Will Receive It</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{frozen ? "Approved List" : "Saved List"}</p>
                <p className="mt-1 font-bold text-xs">{formatCount(campaign.audience_count)}</p>
              </div>
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Can Receive Now</p>
                <p className="mt-1 font-bold text-xs">{audience ? formatCount(audience.included_count) : "—"}</p>
              </div>
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cannot Receive</p>
                <p className="mt-1 font-bold text-xs">{audience ? formatCount(audience.excluded_count) : "—"}</p>
              </div>
            </div>
            {audience && Object.keys(audience.exclusions).length > 0 && (
              <div className="rounded-lg bg-muted/30 p-2 border border-black/[0.08] dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why Some Customers Are Left Out</p>
                <div className="space-y-1">
                  {Object.entries(audience.exclusions).slice(0, 3).map(([reasonKey, count]) => {
                    // Channel-specific labels: SMS needs phone, Email needs email
                    const isEmail = campaign.channel === "email";
                    const friendlyLabels: Record<string, string> = {
                      // Phone-related (SMS) - but show as "No contact" for email
                      "missing valid e164": isEmail ? "No email" : "No phone number",
                      "missing_valid_e164": isEmail ? "No email" : "No phone number",
                      "no phone": isEmail ? "No email" : "No phone number",
                      "no_phone": isEmail ? "No email" : "No phone number",
                      "invalid phone": isEmail ? "Invalid email" : "Invalid phone number",
                      "invalid_phone": isEmail ? "Invalid email" : "Invalid phone number",
                      
                      // Email-related (Email) - but show as "No contact" for SMS
                      "missing email": isEmail ? "No email address" : "No phone",
                      "missing_email": isEmail ? "No email address" : "No phone",
                      "no email": isEmail ? "No email address" : "No phone",
                      "no_email": isEmail ? "No email address" : "No phone",
                      "invalid email": isEmail ? "Invalid email address" : "Bad phone",
                      "invalid_email": isEmail ? "Invalid email address" : "Bad phone",
                      "bounced": "Email bounced",
                      "complained": "Marked as spam",
                      
                      // Common to both
                      "marketing opted out": "Unsubscribed",
                      "marketing_opted_out": "Unsubscribed",
                      "marketing consent missing": "No permission",
                      "marketing_consent_missing": "No permission",
                      "no completed orders": "Never ordered",
                      "no_completed_orders": "Never ordered",
                      "different segment": "Wrong group",
                      "different_segment": "Wrong group",
                      "blocked": "Blocked",
                      "inactive": "Inactive",
                      "test customer": "Test account",
                      "test_customer": "Test account",
                      "duplicate phone": "Duplicate",
                      "duplicate_phone": "Duplicate",
                      "duplicate email": "Duplicate",
                      "duplicate_email": "Duplicate",
                    };
                    const label = friendlyLabels[reasonKey.toLowerCase()] ?? reasonKey.replaceAll("_", " ");
                    return (
                      <div key={reasonKey} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate">{label}</span>
                        <span className="font-semibold ml-2">{formatCount(count)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready to Send Checklist - Vertical */}
        <Card className="dc-card">
          <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              </div>
              <CardTitle className="text-sm font-semibold">Before Sending</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {approvalChecks.map((check) => (
                <div
                  key={check.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    check.ready ? "border-border bg-card" : "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 rounded-full border p-1 shrink-0",
                      check.ready
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {check.ready ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs">{check.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

{/* Template Preview - Show what customers will see */}
      {selectedTemplate && (
        <TemplatePreview campaign={campaign} template={selectedTemplate} />
      )}

      {/* Campaign Performance Analytics */}
      {hasPerformance && results && (
        <CampaignAnalyticsDashboard 
          campaign={campaign} 
          results={results} 
          onDownloadCSV={downloadCSV}
          isDownloading={busyAction === "csv"}
        />
      )}

      {/* Important Attribution Notes */}
      {hasPerformance && limitations.length > 0 && (
        <Card className="dc-card border-dashed">
          <CardHeader className="pb-4">
            <CardTitle className="dc-card-title flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              About These Results
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              What these numbers mean
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {limitations.map((limitation) => (
                <li key={limitation} className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}


      <AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {approvalReady
                ? `This will lock the campaign details and ${formatCount(audience!.included_count)} customers. You can schedule it after approval. No messages will be sent yet.`
                : "Approval is blocked because there is no verified eligible audience or the campaign bundle is incomplete."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!approvalReady || Boolean(busyAction)}
              onClick={() => void transition("approve", "Campaign approved and audience frozen. It has not been scheduled or sent.", () => growthApi.approveCampaign(campaign.id))}
            >
              {busyAction === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reasonAction !== null} onOpenChange={(open) => { if (!open && !busyAction) { setReasonAction(null); setReason(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reasonAction === "return" ? "Return campaign to draft" : reasonAction === "pause" ? "Pause campaign delivery" : "Cancel campaign"}</DialogTitle>
            <DialogDescription>{reasonAction === "return" ? "Record what must change. The reviewed facts become editable only after the backend returns the campaign to draft." : reasonAction === "pause" ? "Record why delivery must pause. Already processed provider outcomes are not erased." : "Cancellation is terminal. Record a clear operational reason for the audit trail."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label htmlFor="campaign-transition-reason">Reason</Label><Textarea id="campaign-transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="At least 8 characters" maxLength={2000} className="min-h-28" /><p className="text-xs text-muted-foreground">{reason.trim().length}/8 minimum characters</p></div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setReasonAction(null)} disabled={Boolean(busyAction)}>Keep current state</Button>
            <Button variant={reasonAction === "cancel" ? "destructive" : "default"} onClick={() => void confirmReasonAction()} disabled={!reasonValid || Boolean(busyAction)}>{busyAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : reasonAction === "return" ? <RotateCcw className="mr-2 h-4 w-4" /> : reasonAction === "pause" ? <Pause className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}{reasonAction === "return" ? "Return to draft" : reasonAction === "pause" ? "Pause campaign" : "Cancel campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={(open) => { if (!busyAction) setScheduleOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule campaign</DialogTitle>
            <DialogDescription>Choose when to send this campaign to customers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!timeZone ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Restaurant timezone is not configured. Please set it up first.</AlertDescription></Alert>
            ) : channelDisabled ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{campaign.channel === "email" ? "Email" : campaign.channel === "sms" ? "SMS" : "This legacy channel"} is disabled. Please enable an active Grow channel first.</AlertDescription></Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="growth-schedule-time">Send date and time</Label>
                  <Input 
                    id="growth-schedule-time" 
                    type="datetime-local" 
                    value={scheduleLocal} 
                    onChange={(event) => { 
                      setScheduleLocal(event.target.value); 
                      setScheduleConfirmed(false); 
                    }} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Timezone: {timeZone}
                    {settings ? ` • Quiet hours: ${settings.quiet_hours_start}–${settings.quiet_hours_end}` : ""}
                  </p>
                </div>
                {campaign.offer ? (
                  <p className="text-xs text-muted-foreground">
                    Offer window: {formatDate(campaign.offer.valid_from)} to {formatDate(campaign.offer.valid_until)}
                  </p>
                ) : null}
                {schedulePayload.error && <p className="text-sm text-destructive">{schedulePayload.error}</p>}
                {scheduleWindowError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Send time is outside the offer window</AlertTitle>
                    <AlertDescription>{scheduleWindowError}</AlertDescription>
                  </Alert>
                )}
                <label className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50">
                  <input 
                    type="checkbox" 
                    checked={scheduleConfirmed} 
                    onChange={(event) => setScheduleConfirmed(event.target.checked)} 
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary" 
                  />
                  <span className="text-muted-foreground">I confirm the schedule above is correct</span>
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={Boolean(busyAction)}>
              Cancel
            </Button>
            <Button 
              onClick={() => void confirmSchedule()} 
              disabled={!schedulePayload.value || Boolean(scheduleWindowError) || !scheduleConfirmed || channelDisabled || Boolean(busyAction)}
            >
              {busyAction === "schedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
