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
    <div className="rounded-2xl border bg-muted/20 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10" aria-label="Loading campaign detail">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid gap-5 xl:grid-cols-2">
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

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-10" data-tour="grow-campaign-detail">
      <section className="rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-card to-primary/5 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <Link href="/grow/campaigns" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />Campaign administration
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn(statusStyles[campaign.status])}>{campaignStatusLabels[campaign.status]}</Badge>
              <span className="text-xs capitalize text-muted-foreground">{campaign.playbook_code.replaceAll("_", " ")} · {campaign.segment_code} customers</span>
            </div>
            <h1 className="mt-3 break-words text-3xl font-black tracking-tight md:text-4xl">{campaign.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>Campaign #{campaign.id}</span>
              <span>Updated {formatDate(campaign.updated_at)}</span>
              {campaign.scheduled_at ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Scheduled {formatDate(campaign.scheduled_at)}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(busyAction)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            {actions.submitReview && <Button size="sm" onClick={() => void submitReview()} disabled={Boolean(busyAction)}>{busyAction === "review" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Submit for review</Button>}
            {actions.returnToDraft && <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonAction("return"); }}><RotateCcw className="mr-2 h-4 w-4" />Return to draft</Button>}
            {actions.approve && <Button size="sm" onClick={() => setApprovalOpen(true)} disabled={!approvalReady}><LockKeyhole className="mr-2 h-4 w-4" />Approve snapshot</Button>}
            {actions.schedule && <Button size="sm" onClick={openSchedule}><CalendarClock className="mr-2 h-4 w-4" />Schedule delivery</Button>}
            {actions.pause && <Button size="sm" variant="outline" onClick={() => { setReason(""); setReasonAction("pause"); }}><Pause className="mr-2 h-4 w-4" />Pause</Button>}
            {actions.cancel && <Button size="sm" variant="destructive" onClick={() => { setReason(""); setReasonAction("cancel"); }}><XCircle className="mr-2 h-4 w-4" />Cancel</Button>}
          </div>
        </div>
      </section>

      {secondaryWarnings.length > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <TriangleAlert className="h-4 w-4 text-amber-600" />
          <AlertTitle>Some evidence is unavailable</AlertTitle>
          <AlertDescription>{secondaryWarnings.join(" ")} Campaign state remains backend-authoritative.</AlertDescription>
        </Alert>
      )}

      {campaign.failure_reason ? (
        <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Campaign failure recorded</AlertTitle><AlertDescription>{campaign.failure_reason}</AlertDescription></Alert>
      ) : campaign.pause_reason ? (
        <Alert className="border-orange-500/40 bg-orange-500/5"><Pause className="h-4 w-4 text-orange-600" /><AlertTitle>Campaign paused</AlertTitle><AlertDescription>{campaign.pause_reason}</AlertDescription></Alert>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" />Offer economics</CardTitle>
            <CardDescription>The offer is bounded server-side; profitability is only claimed when cost evidence supports it.</CardDescription>
          </CardHeader>
          <CardContent>
            {!campaign.offer ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Offer details are unavailable.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-primary/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer offer</p>
                  <p className="mt-2 text-2xl font-black">{formatOffer(campaign.offer)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Minimum order {formatMoney(Number(campaign.offer.minimum_order_value ?? 0))} · Valid {formatDate(campaign.offer.valid_from)} to {formatDate(campaign.offer.valid_until)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Maximum exposure"
                    value={campaign.offer.maximum_exposure == null ? "Not provable" : formatMoney(Number(campaign.offer.maximum_exposure))}
                    detail={campaign.offer.redemption_limit ? `${campaign.offer.redemption_limit.toLocaleString("en-NP")} redemption limit` : "No finite redemption limit supplied"}
                  />
                  <Metric
                    label="Profitability"
                    value={campaign.offer.profitability_status === "verified" ? "Verified" : "Unverified"}
                    detail={campaign.offer.profitability_status === "verified" ? "Supported by current cost evidence" : "No precise profit claim is made"}
                  />
                </div>
                {((campaign.offer.item_ids?.length ?? 0) > 0 || (campaign.offer.category_ids?.length ?? 0) > 0) && (
                  <p className="text-xs text-muted-foreground">Scoped to {campaign.offer.item_ids?.length ?? 0} item(s) and {campaign.offer.category_ids?.length ?? 0} categor{campaign.offer.category_ids?.length === 1 ? "y" : "ies"}.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Approval bundle</CardTitle>
            <CardDescription>All material facts are checked independently before the approver can freeze them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalChecks.map((check) => (
              <div key={check.key} className="flex items-start gap-3 rounded-2xl border p-4">
                <div className={cn("mt-0.5 rounded-full p-1", check.ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                  {check.ready ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
                <div><p className="font-semibold">{check.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p></div>
              </div>
            ))}
            {campaign.status === "review" && !approvalReady && permissions.approve && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Approval remains disabled until the complete offer, message, poster, and provider-approved template bundle is present.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Audience evidence</CardTitle>
            <CardDescription>A preview can change. Only approval creates the frozen, consented recipient snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label={frozen ? "Frozen audience" : "Stored audience"} value={formatCount(campaign.audience_count)} detail={frozen ? `Frozen ${formatDate(campaign.audience_frozen_at)}` : "Not frozen before approval"} />
              <Metric label="Current preview" value={audience ? formatCount(audience.included_count) : "Unavailable"} detail="Segment eligible; approval also filters the selected language" />
              <Metric label="Currently excluded" value={audience ? formatCount(audience.excluded_count) : "Unavailable"} detail="Exclusion rules applied by the backend" />
            </div>
            {audience ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current exclusion breakdown</p>
                {Object.keys(audience.exclusions).length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No current exclusion reason was reported.</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(audience.exclusions).map(([reasonKey, count]) => (
                      <div key={reasonKey} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                        <span className="capitalize text-muted-foreground">{reasonKey.replaceAll("_", " ")}</span>
                        <span className="font-bold">{formatCount(count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Alert><Info className="h-4 w-4" /><AlertDescription>Current preview is unavailable. The frozen campaign count remains the stored approval snapshot.</AlertDescription></Alert>
            )}
            {frozen && audience && (
              <Alert className="border-blue-500/30 bg-blue-500/5"><LockKeyhole className="h-4 w-4 text-blue-600" /><AlertDescription>The current preview may differ from the frozen audience because consent, frequency caps, or customer activity can change after approval. Delivery rechecks safety before sending.</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircleMore className="h-5 w-5 text-primary" />Message and creative</CardTitle>
            <CardDescription>Stored campaign copy and provider/asset references—not a delivery preview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Campaign message snapshot</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{campaign.approved_message_snapshot || "Message snapshot unavailable."}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-start gap-3"><MessageCircleMore className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-semibold">WhatsApp template</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedTemplate ? `${selectedTemplate.whatsapp_template_name} · ${selectedTemplate.language} · provider approved` : campaign.message_template_id ? `Template #${campaign.message_template_id} is no longer in the approved template list.` : "No approved template selected."}</p></div></div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-start gap-3"><FileImage className="mt-0.5 h-4 w-4 text-primary" /><div><p className="font-semibold">Poster asset</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{campaign.creative_asset_id ? `Registered asset #${campaign.creative_asset_id}${["approved", "scheduled", "sending", "completed", "paused"].includes(campaign.status) ? " · approved with campaign" : " · pending campaign approval"}` : "No stable poster asset is attached."}</p></div></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />Delivery and attributed results</CardTitle>
          <CardDescription>Provider states remain separate. Unknown outcomes are never counted as failures, and attributed orders are not assumed incremental.</CardDescription>
        </CardHeader>
        <CardContent>
          {!results ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center"><CircleDashed className="h-8 w-8 text-muted-foreground/60" /><p className="mt-2 text-sm text-muted-foreground">Results are unavailable.</p></div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11">
                <Metric label="Queued" value={formatCount(results.queued_count)} />
                <Metric label="Sending" value={formatCount(results.sending_count)} />
                <Metric label="Sent" value={formatCount(results.sent_count)} />
                <Metric label="Delivered" value={formatCount(results.delivered_count)} />
                <Metric label="Read" value={formatCount(results.read_count)} />
                <Metric label="Failed" value={formatCount(results.failed_count)} />
                <Metric label="Unknown" value={formatCount(results.unknown_count)} detail="Reconcile; not failed" />
                <Metric label="Suppressed" value={formatCount(results.suppressed_count)} />
                <Metric label="Redeemed" value={formatCount(results.redeemed_count)} />
                <Metric label="Reversed" value={formatCount(results.reversed_count)} />
                <Metric label="Opt-outs" value={formatCount(results.opt_out_count)} detail="Observed post-send" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Attributed orders" value={formatCount(results.attributed_order_count)} detail="Linked offer-code redemptions" />
                <Metric label="Attributed revenue" value={formatMoney(results.attributed_revenue)} detail="Association, not incremental lift" />
                <Metric label="Discount cost" value={formatMoney(results.discount_cost)} detail={results.profitability_status === "verified" ? "Cost evidence verified" : "Profit remains unverified"} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-4 w-4 text-amber-600" />Interpretation limits</CardTitle>
          <CardDescription>Yummy does not convert incomplete evidence into precise growth claims.</CardDescription>
        </CardHeader>
        <CardContent>
          {limitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No additional limitation was returned. Delivery and attribution still remain observational, not proof of incremental lift.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {limitations.map((limitation) => <li key={limitation} className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{limitation}</span></li>)}
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
            ) : settings?.whatsapp_enabled === false ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>WhatsApp delivery is disabled in this restaurant&apos;s Grow settings. Enable and verify the channel before scheduling.</AlertDescription></Alert>
            ) : (
              <>
                <div className="space-y-2"><Label htmlFor="growth-schedule-time">Restaurant-local date and time</Label><Input id="growth-schedule-time" type="datetime-local" value={scheduleLocal} onChange={(event) => { setScheduleLocal(event.target.value); setScheduleConfirmed(false); }} /><p className="text-xs text-muted-foreground">Authoritative timezone: <span className="font-semibold text-foreground">{timeZone}</span>{settings ? ` · Quiet hours ${settings.quiet_hours_start}–${settings.quiet_hours_end}` : " · Quiet hours will be checked by the backend"}</p></div>
                {schedulePayload.error ? <p className="text-sm text-destructive">{schedulePayload.error}</p> : schedulePayload.value ? <div className="rounded-xl border bg-muted/30 p-3 text-xs"><p className="font-semibold">Explicit offset sent to backend</p><code className="mt-1 block break-all text-muted-foreground">{schedulePayload.value.scheduled_at}</code></div> : null}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={scheduleConfirmed} onChange={(event) => setScheduleConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-border accent-primary" /><span><span className="font-semibold">I confirm this future schedule.</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">The backend will recheck entitlement, quota, quiet hours, consent, and delivery safety. This action queues work; it does not send synchronously.</span></span></label>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2"><Button variant="outline" onClick={() => setScheduleOpen(false)} disabled={Boolean(busyAction)}>Cancel</Button><Button onClick={() => void confirmSchedule()} disabled={!schedulePayload.value || !scheduleConfirmed || settings?.whatsapp_enabled === false || Boolean(busyAction)}>{busyAction === "schedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}Schedule delivery</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
