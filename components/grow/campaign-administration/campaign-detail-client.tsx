"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
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
  Send,
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
        warnings.push("Approved WhatsApp template readiness could not be confirmed.");
      }
      if (audienceResponse.status === "fulfilled") setAudience(audienceResponse.value);
      else {
        setAudience(null);
        warnings.push("The current audience preview and exclusion breakdown are unavailable.");
      }
      if (settingsResponse.status === "fulfilled") setSettings(settingsResponse.value);
      else {
        setSettings(null);
        warnings.push("WhatsApp delivery settings and quiet hours could not be confirmed.");
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
      : settings?.whatsapp_enabled === false;
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
  const approvalChecks = campaignApprovalChecks(campaign, templates);
  const approvalReady = isCampaignApprovalReady(approvalChecks);
  const selectedTemplate = templates.find(
    (template) => String(template.id) === String(campaign.message_template_id),
  );
  const frozen = Boolean(campaign.audience_frozen_at);
  const reasonValid = reason.trim().length >= 8;
  const limitations = Array.from(
    new Set([...(campaign.offer?.limitations ?? []), ...(results?.limitations ?? [])]),
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
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4" data-tour="grow-campaign-detail">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/grow/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="dc-page-title">{campaign.name}</h1>
            <Badge variant="outline" className={cn("text-xs font-semibold", statusStyles[campaign.status])}>{campaignStatusLabels[campaign.status]}</Badge>
          </div>
          <p className="dc-page-subtitle">
            {campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} segment · Campaign #{campaign.id}
            {campaign.scheduled_at && ` · Scheduled ${formatDate(campaign.scheduled_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => void load()} 
            disabled={Boolean(busyAction)} 
            className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {actions.submitReview && (
            <Button size="sm" onClick={() => void submitReview()} disabled={Boolean(busyAction)} className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium">
              {busyAction === "review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Submit for review
            </Button>
          )}
          {actions.returnToDraft && (
            <Button size="sm" variant="ghost" onClick={() => { setReason(""); setReasonAction("return"); }} className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4">
              <RotateCcw className="h-4 w-4" />Return to draft
            </Button>
          )}
          {actions.approve && (
            <Button size="sm" onClick={() => setApprovalOpen(true)} disabled={!approvalReady} className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium">
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
      </div>

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
      <section className="grid gap-6 xl:grid-cols-3">
        {/* Offer Details */}
        <Card className="dc-card">
          <CardHeader className="pb-3 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <Tag className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Offer Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {!campaign.offer ? (
              <p className="text-xs text-muted-foreground text-center py-6">No offer available</p>
            ) : (
              <>
                <div className="rounded-lg bg-muted/50 p-3 border border-black/[0.08] dark:border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer Gets</p>
                  <p className="mt-1.5 text-base font-bold">{formatOffer(campaign.offer)}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Min order {formatMoney(Number(campaign.offer.minimum_order_value ?? 0))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Cost</p>
                    <p className="mt-1 font-bold text-xs">{campaign.offer.maximum_exposure == null ? "Not set" : formatMoney(Number(campaign.offer.maximum_exposure))}</p>
                  </div>
                  <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                    <p className="mt-1 font-bold text-xs">{campaign.offer.profitability_status === "verified" ? "Verified" : "Pending"}</p>
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
              <CardTitle className="text-sm font-semibold">Audience</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{frozen ? "Locked" : "Saved"}</p>
                <p className="mt-1 font-bold text-xs">{formatCount(campaign.audience_count)}</p>
              </div>
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live</p>
                <p className="mt-1 font-bold text-xs">{audience ? formatCount(audience.included_count) : "—"}</p>
              </div>
              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-card p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Blocked</p>
                <p className="mt-1 font-bold text-xs">{audience ? formatCount(audience.excluded_count) : "—"}</p>
              </div>
            </div>
            {audience && Object.keys(audience.exclusions).length > 0 && (
              <div className="rounded-lg bg-muted/30 p-2 border border-black/[0.08] dark:border-white/10">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why Excluded</p>
                <div className="space-y-1">
                  {Object.entries(audience.exclusions).slice(0, 3).map(([reasonKey, count]) => {
                    // Channel-specific labels: WhatsApp needs phone, Email needs email
                    const isEmail = campaign.channel === "email";
                    const friendlyLabels: Record<string, string> = {
                      // Phone-related (WhatsApp) - but show as "No contact" for email
                      "missing valid e164": isEmail ? "No email" : "No phone number",
                      "missing_valid_e164": isEmail ? "No email" : "No phone number",
                      "no phone": isEmail ? "No email" : "No phone number",
                      "no_phone": isEmail ? "No email" : "No phone number",
                      "invalid phone": isEmail ? "Invalid email" : "Invalid phone number",
                      "invalid_phone": isEmail ? "Invalid email" : "Invalid phone number",
                      
                      // Email-related (Email) - but show as "No contact" for WhatsApp
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
              <CardTitle className="text-sm font-semibold">Ready to Send?</CardTitle>
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
      {results ? (
        <CampaignAnalyticsDashboard 
          campaign={campaign} 
          results={results} 
          onDownloadCSV={downloadCSV}
          isDownloading={busyAction === "csv"}
        />
      ) : (
        <Card className="dc-card">
          <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted border border-black/[0.08] dark:border-white/15">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <span className="dc-eyebrow">Performance</span>
            </div>
            <CardTitle className="dc-card-title">Campaign Performance</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Analytics will appear after campaign is sent
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
              <div className="text-center">
                <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">No analytics data yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Send this campaign to see performance metrics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Attribution Notes */}
      {limitations.length > 0 && (
        <Card className="dc-card border-dashed">
          <CardHeader className="pb-4">
            <CardTitle className="dc-card-title flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Important Notes
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
            <AlertDialogTitle>Approve and freeze this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Approval freezes the currently eligible, consented, language-matched audience and approves the offer, poster, template, and message snapshot together. It does not schedule or send anything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm"><span className="font-semibold">Current preview:</span> {audience ? `${formatCount(audience.included_count)} segment-eligible before selected-language filtering` : "backend will determine the authoritative audience"}</div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep under review</AlertDialogCancel>
            <AlertDialogAction
              disabled={!approvalReady || Boolean(busyAction)}
              onClick={() => void transition("approve", "Campaign approved and audience frozen. It has not been scheduled or sent.", () => growthApi.approveCampaign(campaign.id))}
            >
              {busyAction === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Approve snapshot
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Schedule approved delivery</DialogTitle>
            <DialogDescription>This creates future delivery jobs for the frozen audience. There is deliberately no send-now action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {!timeZone ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>The restaurant timezone is unavailable. Scheduling is blocked until it is configured.</AlertDescription></Alert>
            ) : channelDisabled ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{campaign.channel === "email" ? "Email" : "WhatsApp"} delivery is disabled in this restaurant&apos;s Grow settings. Enable and verify the channel before scheduling.</AlertDescription></Alert>
            ) : (
              <>
                <div className="space-y-2"><Label htmlFor="growth-schedule-time">Restaurant-local date and time</Label><Input id="growth-schedule-time" type="datetime-local" value={scheduleLocal} onChange={(event) => { setScheduleLocal(event.target.value); setScheduleConfirmed(false); }} /><p className="text-xs text-muted-foreground">Authoritative timezone: <span className="font-semibold text-foreground">{timeZone}</span>{settings ? ` · Quiet hours ${settings.quiet_hours_start}–${settings.quiet_hours_end}` : " · Quiet hours will be checked by the backend"}</p></div>
                {schedulePayload.error ? <p className="text-sm text-destructive">{schedulePayload.error}</p> : schedulePayload.value ? <div className="rounded-xl border bg-muted/30 p-3 text-xs"><p className="font-semibold">Explicit offset sent to backend</p><code className="mt-1 block break-all text-muted-foreground">{schedulePayload.value.scheduled_at}</code></div> : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={scheduleConfirmed} onChange={(event) => setScheduleConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-border accent-primary" /><span><span className="font-semibold">I confirm this future schedule.</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">The backend will recheck entitlement, quota, quiet hours, consent, and delivery safety. This action queues work; it does not send synchronously.</span></span></label>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2"><Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={Boolean(busyAction)}>Cancel</Button><Button onClick={() => void confirmSchedule()} disabled={!schedulePayload.value || !scheduleConfirmed || channelDisabled || Boolean(busyAction)}>{busyAction === "schedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}Schedule delivery</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
