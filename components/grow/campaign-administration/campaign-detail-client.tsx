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

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-16" aria-label="Loading campaign detail">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-8 xl:grid-cols-2">
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
    <div className="mx-auto max-w-[1400px] space-y-8 pb-16" data-tour="grow-campaign-detail">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
        <div className="relative space-y-4">
          {/* Row 1: Back link, Campaign Detail label, status, and action buttons */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/grow/campaigns" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Campaigns
              </Link>
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Campaign Detail</span>
              </div>
              <Badge variant="outline" className={cn("text-xs", statusStyles[campaign.status])}>{campaignStatusLabels[campaign.status]}</Badge>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busyAction)} className="rounded-xl border border-border">
                <RefreshCw className="mr-2 h-4 w-4" />Refresh
              </Button>
              {actions.submitReview && (
                <Button size="sm" onClick={() => void submitReview()} disabled={Boolean(busyAction)} className="rounded-xl border border-border">
                  {busyAction === "review" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Submit for review
                </Button>
              )}
              {actions.returnToDraft && (
                <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonAction("return"); }} className="rounded-xl border border-border">
                  <RotateCcw className="mr-2 h-4 w-4" />Return to draft
                </Button>
              )}
              {actions.approve && (
                <Button size="sm" onClick={() => setApprovalOpen(true)} disabled={!approvalReady} className="rounded-xl border border-border">
                  <LockKeyhole className="mr-2 h-4 w-4" />Approve
                </Button>
              )}
              {actions.schedule && (
                <Button size="sm" onClick={openSchedule} className="rounded-xl border border-border">
                  <CalendarClock className="mr-2 h-4 w-4" />Schedule
                </Button>
              )}
              {actions.pause && (
                <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonAction("pause"); }} className="rounded-xl border border-border">
                  <Pause className="mr-2 h-4 w-4" />Pause
                </Button>
              )}
              {actions.cancel && (
                <Button size="sm" variant="destructive" onClick={() => { setReason(""); setReasonAction("cancel"); }} className="rounded-xl border border-border">
                  <XCircle className="mr-2 h-4 w-4" />Cancel
                </Button>
              )}
            </div>
          </div>
          
          {/* Row 2: Campaign title */}
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{campaign.name}</h1>
            
            {/* Row 3: Campaign metadata */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="capitalize">{campaign.playbook_code.replaceAll("_", " ")}</span>
              <span>•</span>
              <span>{campaign.segment_code} segment</span>
              <span>•</span>
              <span>Campaign #{campaign.id}</span>
              {campaign.scheduled_at && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(campaign.scheduled_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {secondaryWarnings.length > 0 && (
        <Alert className="rounded-xl border border-border bg-card">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Partial data</AlertTitle>
          <AlertDescription>{secondaryWarnings.join(" ")}</AlertDescription>
        </Alert>
      )}

      {campaign.failure_reason ? (
        <Alert variant="destructive" className="rounded-xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Campaign failed</AlertTitle>
          <AlertDescription>{campaign.failure_reason}</AlertDescription>
        </Alert>
      ) : campaign.pause_reason ? (
        <Alert className="rounded-xl border border-border bg-card">
          <Pause className="h-4 w-4" />
          <AlertTitle>Campaign paused</AlertTitle>
          <AlertDescription>{campaign.pause_reason}</AlertDescription>
        </Alert>
      ) : null}

      {/* Offer & Approval Section */}
      <section className="grid gap-8 xl:grid-cols-2">
        <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="rounded-lg border border-border bg-muted p-2">
                <Tag className="h-5 w-5" />
              </div>
              Offer Details
            </CardTitle>
            <CardDescription className="text-sm">What customers get and your cost limit</CardDescription>
          </CardHeader>
          <CardContent>
            {!campaign.offer ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
                <p className="text-sm text-muted-foreground">No offer available</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Offer</p>
                  <p className="mt-2 text-2xl font-bold">{formatOffer(campaign.offer)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Min order {formatMoney(Number(campaign.offer.minimum_order_value ?? 0))} · Valid until {formatDate(campaign.offer.valid_until)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Maximum Cost"
                    value={campaign.offer.maximum_exposure == null ? "Not set" : formatMoney(Number(campaign.offer.maximum_exposure))}
                    detail={campaign.offer.redemption_limit ? `${campaign.offer.redemption_limit.toLocaleString("en-NP")} uses max` : "No limit"}
                  />
                  <Metric
                    label="Cost Verified"
                    value={campaign.offer.profitability_status === "verified" ? "Yes" : "No"}
                    detail={campaign.offer.profitability_status === "verified" ? "Checked against menu prices" : "Not checked yet"}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="rounded-lg border border-border bg-muted p-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              Ready to Send?
            </CardTitle>
            <CardDescription className="text-sm">Check these before sending campaign</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalChecks.map((check) => (
              <div key={check.key} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
                <div className={cn("mt-0.5 rounded-full border border-border p-1.5 transition-transform hover:scale-110", check.ready ? "bg-muted" : "bg-muted")}>
                  {check.ready ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{check.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Audience & Message Section */}
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="rounded-lg border border-border bg-muted p-2">
                <Users className="h-5 w-5" />
              </div>
              Who Gets This
            </CardTitle>
            <CardDescription className="text-sm">Customer list (locked after approval)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric 
                label={frozen ? "Locked" : "Saved"} 
                value={formatCount(campaign.audience_count)} 
                detail={frozen ? formatDate(campaign.audience_frozen_at) : "Not locked yet"} 
              />
              <Metric 
                label="Live" 
                value={audience ? formatCount(audience.included_count) : "—"} 
                detail="Can receive now" 
              />
              <Metric 
                label="Can't Receive" 
                value={audience ? formatCount(audience.excluded_count) : "—"} 
                detail="Blocked by rules" 
              />
            </div>
            {audience && Object.keys(audience.exclusions).length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Why some customers can't receive this</p>
                <p className="mt-1 text-sm text-muted-foreground">These customers are excluded for legal or technical reasons:</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(audience.exclusions).map(([reasonKey, count]) => {
                    // Staff-friendly labels
                    const staffLabels: Record<string, string> = {
                      "missing valid e164": "No phone number",
                      "marketing opted out": "Unsubscribed",
                      "marketing consent missing": "No permission",
                      "no completed orders": "Never ordered",
                      "different segment": "Wrong group",
                      "missing email": "No email",
                      "invalid email": "Bad email",
                      "duplicate email": "Duplicate email",
                      "duplicate phone": "Duplicate phone",
                      "test customer": "Test account",
                      "bounced": "Email bounced",
                      "complained": "Marked as spam"
                    };
                    const label = staffLabels[reasonKey] ?? reasonKey.replaceAll("_", " ");
                    
                    return (
                      <div key={reasonKey} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm transition-all hover:shadow-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-bold">{formatCount(count)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="rounded-lg border border-border bg-muted p-2">
                <MessageCircleMore className="h-5 w-5" />
              </div>
              Message & Images
            </CardTitle>
            <CardDescription className="text-sm">What customers will see</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{campaign.approved_message_snapshot || "No message"}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-sm">
                <MessageCircleMore className="mt-0.5 h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{campaign.channel === "email" ? "Email template" : "WhatsApp template"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedTemplate
                      ? `${selectedTemplate.provider_template_name} · ${selectedTemplate.language}`
                      : campaign.message_template_id
                        ? `Template #${campaign.message_template_id}`
                        : "No template"}
                  </p>
                </div>
              </div>
              {campaign.channel !== "email" && (
                <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-sm">
                  <FileImage className="mt-0.5 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">Poster asset</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.creative_asset_id
                        ? `Asset #${campaign.creative_asset_id}`
                        : "No asset"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Delivery Results Section */}
      <Card className="rounded-xl border border-border bg-card transition-all hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="rounded-lg border border-border bg-muted p-2">
                  <Send className="h-5 w-5" />
                </div>
                Sending Results
              </CardTitle>
              <CardDescription className="text-sm">How many sent and who used the offer</CardDescription>
            </div>
            {results && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadCSV()}
                disabled={busyAction === "csv"}
                className="rounded-xl border border-border"
              >
                {busyAction === "csv" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!results ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
              <div className="text-center">
                <CircleDashed className="mx-auto h-10 w-10 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">No results yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sending Status</p>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
                  <Metric label="Queued" value={formatCount(results.queued_count)} />
                  <Metric label="Sending" value={formatCount(results.sending_count)} />
                  <Metric label="Sent" value={formatCount(results.sent_count)} />
                  <Metric label="Delivered" value={formatCount(results.delivered_count)} />
                  <Metric label="Read" value={campaign.channel === "email" ? "Not tracked" : formatCount(results.read_count)} />
                  <Metric label="Failed" value={formatCount(results.failed_count)} />
                  <Metric label="Unknown" value={formatCount(results.unknown_count)} />
                  <Metric label="Suppressed" value={formatCount(results.suppressed_count)} />
                </div>
              </div>
              
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer Used</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Metric label="Redeemed" value={formatCount(results.redeemed_count)} />
                  <Metric label="Reversed" value={formatCount(results.reversed_count)} />
                  <Metric label="Opt-outs" value={formatCount(results.opt_out_count)} />
                  <Metric label="Orders" value={formatCount(results.attributed_order_count)} />
                  <Metric label="Revenue" value={formatMoney(results.attributed_revenue)} />
                </div>
              </div>
              
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Discount Given</p>
                    <p className="mt-1 text-2xl font-bold">{formatMoney(results.discount_cost)}</p>
                  </div>
                  <div className={cn(
                    "rounded-lg border border-border px-3 py-1.5 text-xs font-medium",
                    results.profitability_status === "verified" 
                      ? "bg-muted text-foreground" 
                      : "bg-muted text-foreground"
                  )}>
                    {results.profitability_status === "verified" ? "Verified" : "Not Verified"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-dashed border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-4 w-4" />Important Notes</CardTitle>
          <CardDescription>What these numbers mean</CardDescription>
        </CardHeader>
        <CardContent>
          {limitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">These numbers show what happened, but don't prove the campaign caused all the sales.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {limitations.map((limitation) => <li key={limitation} className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{limitation}</span></li>)}
            </ul>
          )}
        </CardContent>
      </Card>

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
