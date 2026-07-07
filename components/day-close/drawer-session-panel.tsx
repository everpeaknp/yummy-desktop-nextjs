"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import { hasPermission } from "@/lib/role-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DrawerCountDialog } from "./drawer-count-dialog";
import type {
  BusinessLine,
  DrawerConfiguration,
  DrawerOpeningSuggestion,
  DrawerSession,
  DrawerExpectedBreakdown,
  DrawerSessionOpenInput,
} from "@/types/day-close";

type BaseResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type DrawerSessionPanelProps = {
  restaurantId: number;
  businessLine: BusinessLine | string;
  businessDate?: string | null;
  title?: string;
  description?: string;
  footerNote?: string;
  onCashSummaryChange?: (summary: {
    activeDrawerCash: number;
    activeSessionCount: number;
    unopenedRetainedCash: number;
  }) => void;
};

type OpeningForm = {
  cash: string;
  reason: string;
  overrideRetained?: boolean;
  differenceSource?: string;
  differenceReference?: string;
};

const COUNTABLE_STATUSES = new Set(["opened", "closing_count_required", "variance_review_required", "reopened"]);
const SETTLEMENT_PENDING_STATUSES = new Set(["closed"]);
const READY_STATUSES = new Set(["approved"]);

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function drawerScopeKey(station: string, drawerKey: string) {
  return `${station}::${drawerKey}`;
}

function sourceLabel(value?: string | null) {
  if (!value) return "Not loaded";
  return value.replace(/_/g, " ");
}

function readyLabel(session: DrawerSession | null) {
  if (!session) return "Not opened";
  if (SETTLEMENT_PENDING_STATUSES.has(String(session.status))) return "Settlement pending";
  if (READY_STATUSES.has(String(session.status))) return "Settled";
  if (session.status === "variance_review_required") return "Variance approval required";
  if (COUNTABLE_STATUSES.has(String(session.status))) return "Count required";
  return String(session.status).replace(/_/g, " ");
}

function sessionForConfig(sessions: DrawerSession[], config: DrawerConfiguration) {
  return (
    sessions.find(
      (session) =>
        session.station === config.station &&
        session.drawer_key === config.drawer_key &&
        !READY_STATUSES.has(String(session.status)),
    ) ?? null
  );
}

function isCountable(session: DrawerSession | null) {
  return Boolean(session && COUNTABLE_STATUSES.has(String(session.status)));
}

function isSettlementPending(session: DrawerSession | null) {
  return Boolean(session && SETTLEMENT_PENDING_STATUSES.has(String(session.status)));
}

function numberAmount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function expectedCashForSession(session: DrawerSession, breakdown?: DrawerExpectedBreakdown | null) {
  if (breakdown?.expected_cash != null) return numberAmount(breakdown.expected_cash);
  if (session.expected_closing_cash != null) return numberAmount(session.expected_closing_cash);
  const movementTotal = (session.movements ?? []).reduce(
    (total, movement) => total + numberAmount(movement.signed_amount),
    0,
  );
  return numberAmount(session.counted_opening_cash) + movementTotal;
}

function countedCashLabel(session: DrawerSession | null, breakdown?: DrawerExpectedBreakdown | null) {
  const counted = breakdown?.counted_cash ?? session?.counted_closing_cash;
  return counted == null ? "Not counted" : formatDayCloseCurrency(counted);
}

export function DrawerSessionPanel({
  restaurantId,
  businessLine,
  businessDate,
  title = "Drawer readiness",
  description,
  footerNote = "This operational panel checks drawer readiness only. Accounting review status is handled after the day is closed.",
  onCashSummaryChange,
}: DrawerSessionPanelProps) {
  const user = useAuth((state) => state.user);
  const canApproveOpeningDifference = hasPermission(user, "finance.variance.approve");
  const effectiveBusinessDate = businessDate || todayIso();
  const [configs, setConfigs] = useState<DrawerConfiguration[]>([]);
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, DrawerOpeningSuggestion | null>>({});
  const [openingForms, setOpeningForms] = useState<Record<string, OpeningForm>>({});
  const [loading, setLoading] = useState(false);
  const [controlsDisabled, setControlsDisabled] = useState(false);
  const [breakdowns, setBreakdowns] = useState<Record<number, DrawerExpectedBreakdown | null>>({});
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [countSession, setCountSession] = useState<DrawerSession | null>(null);
  const [countDialogOpen, setCountDialogOpen] = useState(false);

  const activeConfigs = useMemo(
    () => configs.filter((config) => config.is_active !== false),
    [configs],
  );

  const loadSuggestions = useCallback(
    async (nextConfigs: DrawerConfiguration[]) => {
      const entries = await Promise.all(
        nextConfigs
          .filter((config) => config.is_active !== false)
          .map(async (config) => {
            const key = drawerScopeKey(config.station, config.drawer_key);
            try {
              const res = await apiClient.get<BaseResponse<DrawerOpeningSuggestion>>(
                DrawerSessionApis.suggestion({
                  restaurantId,
                  businessLine: String(businessLine),
                  businessDate: effectiveBusinessDate,
                  station: config.station,
                  drawerKey: config.drawer_key,
                }),
              );
              return [key, res.data?.data ?? null] as const;
            } catch (error) {
              const apiError = error as { response?: { data?: { detail?: unknown } } };
              const detail = apiError.response?.data?.detail;
              if (typeof detail === "string" && detail.includes("Drawer controls are not enabled")) {
                setControlsDisabled(true);
              }
              console.info("Opening float suggestion unavailable", { config, error });
              return [key, null] as const;
            }
          }),
      );

      const nextSuggestions = Object.fromEntries(entries);
      setSuggestions(nextSuggestions);
      setOpeningForms((current) => {
        const next = { ...current };
        for (const config of nextConfigs) {
          const key = drawerScopeKey(config.station, config.drawer_key);
          const suggestion = nextSuggestions[key];
          if (
            next[key]?.overrideRetained &&
            suggestion?.source === "previous_retained_float"
          ) {
            continue;
          }
          next[key] = {
            cash: suggestion ? String(Number(suggestion.amount ?? 0)) : "",
            reason: "",
            overrideRetained: false,
            differenceSource: "",
            differenceReference: "",
          };
        }
        return next;
      });
    },
    [businessLine, effectiveBusinessDate, restaurantId],
  );

  const loadBreakdowns = useCallback(
    async (nextSessions: DrawerSession[], options?: { replace?: boolean }) => {
      const visibleSessions = nextSessions.filter((session) => session?.id);
      if (visibleSessions.length === 0) {
        if (options?.replace) setBreakdowns({});
        return;
      }
      const entries = await Promise.all(
        visibleSessions.map(async (session) => {
          try {
            const res = await apiClient.get<BaseResponse<DrawerExpectedBreakdown>>(
              DrawerSessionApis.expectedBreakdown(session.id),
            );
            return [session.id, res.data?.data ?? null] as const;
          } catch (error) {
            console.info("Expected cash breakdown unavailable", { sessionId: session.id, error });
            return [session.id, null] as const;
          }
        }),
      );
      const next = Object.fromEntries(entries);
      setBreakdowns((current) => (options?.replace ? next : { ...current, ...next }));
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, configRes] = await Promise.all([
        apiClient.get<BaseResponse<DrawerSession[]>>(
          DrawerSessionApis.active({ restaurantId, businessLine: String(businessLine) }),
        ),
        apiClient.get<BaseResponse<DrawerConfiguration[]>>(
          DrawerSessionApis.configurations({ restaurantId, businessLine: String(businessLine) }),
        ).catch(() => ({ data: { data: [] as DrawerConfiguration[] } })),
      ]);
      const disabledByMessage = String(activeRes.data?.message ?? "")
        .toLowerCase()
        .includes("drawer controls are disabled");
      const nextSessions = activeRes.data?.data ?? [];
      const nextConfigs = configRes.data?.data ?? [];
      setControlsDisabled(disabledByMessage);
      setSessions(nextSessions);
      setConfigs(nextConfigs);
      if (disabledByMessage) {
        setSuggestions({});
        setOpeningForms({});
        setBreakdowns({});
      } else {
        await Promise.all([
          loadSuggestions(nextConfigs),
          loadBreakdowns(nextSessions, { replace: true }),
        ]);
      }
    } catch (error) {
      console.error("Failed to load drawer sessions", error);
      setSessions([]);
      setConfigs([]);
      setControlsDisabled(false);
      toast.error("Failed to load drawer readiness");
    } finally {
      setLoading(false);
    }
  }, [businessLine, loadBreakdowns, loadSuggestions, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!onCashSummaryChange) return;
    let activeDrawerCash = 0;
    let activeSessionCount = 0;
    let unopenedRetainedCash = 0;

    for (const config of activeConfigs) {
      const session = sessionForConfig(sessions, config);
      if (session) {
        activeSessionCount += 1;
        activeDrawerCash += expectedCashForSession(session, breakdowns[session.id]);
        continue;
      }
      const suggestion = suggestions[drawerScopeKey(config.station, config.drawer_key)];
      if (suggestion?.source === "previous_retained_float") {
        unopenedRetainedCash += numberAmount(suggestion.amount);
      }
    }

    onCashSummaryChange({ activeDrawerCash, activeSessionCount, unopenedRetainedCash });
  }, [activeConfigs, breakdowns, onCashSummaryChange, sessions, suggestions]);

  const updateOpeningForm = (key: string, patch: Partial<OpeningForm>) => {
    setOpeningForms((current) => ({
      ...current,
      [key]: {
        cash: current[key]?.cash ?? "",
        reason: current[key]?.reason ?? "",
        overrideRetained: current[key]?.overrideRetained ?? false,
        differenceSource: current[key]?.differenceSource ?? "",
        differenceReference: current[key]?.differenceReference ?? "",
        ...patch,
      },
    }));
  };

  const openDrawer = async (config: DrawerConfiguration) => {
    const key = drawerScopeKey(config.station, config.drawer_key);
    const form = openingForms[key] ?? { cash: "", reason: "" };
    const amount = Number(form.cash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid opening cash count.");
      return;
    }

    const suggestion = suggestions[key];
    const varianceEnforced = Boolean(suggestion?.opening_variance_enforced);
    const tolerance = Number(suggestion?.opening_variance_tolerance ?? 0);
    const suggestedAmount = Number(suggestion?.amount ?? 0);
    const retainedCarryForward = suggestion?.source === "previous_retained_float";
    const retainedDifference = retainedCarryForward && Math.abs(amount - suggestedAmount) > 0.005;
    const policyDifference = varianceEnforced && Math.abs(amount - suggestedAmount) > tolerance;
    const needsApproval = retainedDifference || policyDifference;
    const differenceSource = (form.differenceSource || "").trim();
    const approverId = Number(user?.id);
    if (
      needsApproval &&
      (!canApproveOpeningDifference || !Number.isFinite(approverId) || form.reason.trim().length < 5)
    ) {
      toast.error("A manager-approved reason is required when opening cash differs from the carried amount.");
      return;
    }
    if (needsApproval && !differenceSource) {
      toast.error("Select where the opening difference came from.");
      return;
    }

    setOpeningKey(key);
    try {
      const payload: DrawerSessionOpenInput = {
        restaurant_id: restaurantId,
        business_line: businessLine,
        station: config.station,
        drawer_key: config.drawer_key,
        business_date: effectiveBusinessDate,
        counted_opening_cash: amount,
        denominations_json: null,
        reason: form.reason.trim() || null,
        approved_by_id: needsApproval ? approverId : null,
        opening_difference_source: needsApproval ? differenceSource : null,
        opening_difference_destination: differenceSource === "safe_transfer" ? "main_cash_safe" : null,
        opening_difference_reference: form.differenceReference?.trim() || null,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(DrawerSessionApis.open, payload);
      const session = res.data?.data;
      if (session) {
        setSessions((current) => [session, ...current.filter((row) => row.id !== session.id)]);
      }
      toast.success("Drawer opened.");
      await load();
    } catch (error) {
      console.error("Failed to open drawer", error);
      const apiError = error as { response?: { data?: { detail?: unknown } } };
      const detail = apiError.response?.data?.detail;
      toast.error(typeof detail === "string" && detail.trim() ? detail : "Failed to open drawer");
    } finally {
      setOpeningKey(null);
    }
  };

  const updateSession = (session: DrawerSession) => {
    setSessions((current) => {
      const others = current.filter((row) => row.id !== session.id);
      return [session, ...others];
    });
    void loadBreakdowns([session]);
    setCountSession(session);
  };

  const openCountDialog = (session: DrawerSession) => {
    setCountSession(session);
    setCountDialogOpen(true);
  };

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            {title}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {controlsDisabled ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-400">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Drawer controls are disabled for this restaurant. Enable them in Cash Drawers settings first, then return here to open drawers, count cash, and submit settlement evidence.
              </div>
              <Button asChild size="sm" variant="outline" className="self-start">
                <Link href="/manage/settings?tab=payments#cash-drawers">Open Cash Drawer Settings</Link>
              </Button>
            </div>
          </div>
        ) : activeConfigs.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-400">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Drawer controls may be disabled or no active drawers are configured for this restaurant.
          </div>
        ) : (
          <div className="grid gap-4">
            {activeConfigs.map((config) => {
              const key = drawerScopeKey(config.station, config.drawer_key);
              const session = sessionForConfig(sessions, config);
              const breakdown = session ? breakdowns[session.id] : null;
              const suggestion = suggestions[key];
              const openingForm = openingForms[key] ?? { cash: "", reason: "", overrideRetained: false };
              const varianceEnforced = Boolean(suggestion?.opening_variance_enforced);
              const retainedCarryForward = suggestion?.source === "previous_retained_float";
              const overrideRetained = Boolean(openingForm.overrideRetained);
              const suggestedAmount = Number(suggestion?.amount ?? session?.suggested_opening_cash ?? 0);
              const countedOpeningAmount = Number(openingForm.cash);
              const openingNeedsApproval =
                !session &&
                Number.isFinite(countedOpeningAmount) &&
                ((retainedCarryForward && Math.abs(countedOpeningAmount - suggestedAmount) > 0.005) ||
                  (varianceEnforced &&
                    Math.abs(countedOpeningAmount - suggestedAmount) >
                      Number(suggestion?.opening_variance_tolerance ?? 0)));
              const openingApprovalReady =
                !openingNeedsApproval ||
                (canApproveOpeningDifference &&
                  openingForm.reason.trim().length >= 5 &&
                  Boolean((openingForm.differenceSource || "").trim()));
              const countable = isCountable(session);
              const settlementPending = isSettlementPending(session);
              const ready = Boolean(session && READY_STATUSES.has(String(session.status)));
              const expectedClosingCash = session ? expectedCashForSession(session, breakdown) : null;
              const countedOpeningCash =
                session ? breakdown?.opening_float ?? session.counted_opening_cash ?? null : null;

              return (
                <div key={config.id} className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{config.name || `${config.station} / ${config.drawer_key}`}</div>
                        <Badge variant={session ? "default" : "secondary"} className="text-[10px]">
                          {readyLabel(session)}
                        </Badge>
                        {retainedCarryForward ? (
                          <Badge variant="outline" className="text-[10px]">Retained carry-forward</Badge>
                        ) : varianceEnforced ? (
                          <Badge variant="outline" className="text-[10px]">Fixed float</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Flexible opening</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {config.station} / {config.drawer_key}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {ready ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      {readyLabel(session)}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Opening float source
                      </div>
                      <div className="mt-1 text-sm font-semibold capitalize">
                        {sourceLabel(suggestion?.source ?? session?.suggested_opening_source)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Suggested opening
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatDayCloseCurrency(suggestedAmount)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Counted opening
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {countedOpeningCash != null
                          ? formatDayCloseCurrency(countedOpeningCash)
                          : "Not opened"}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Closing cash
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {session ? (
                          <>
                            Expected {formatDayCloseCurrency(expectedClosingCash ?? 0)} - Counted{" "}
                            {countedCashLabel(session, breakdown)}
                          </>
                        ) : (
                          "Not opened"
                        )}
                      </div>
                    </div>
                  </div>

                  {session ? (
                    <div className="grid gap-3 md:grid-cols-6">
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Opening float
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(breakdown?.opening_float ?? countedOpeningCash ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Cash sales
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(breakdown?.cash_sales ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Refunds
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(breakdown?.refunds ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Expenses
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(breakdown?.expenses ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Drops/transfers
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(breakdown?.drops_transfers ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Expected cash
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {formatDayCloseCurrency(expectedClosingCash ?? 0)}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!session ? (
                    <div className="space-y-3">
                      {!suggestion ? (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          Opening policy is loading or unavailable. Refresh drawer readiness if this remains blank.
                        </div>
                      ) : retainedCarryForward ? (
                        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${
                          overrideRetained
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-400"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-400"
                        }`}>
                          <div>
                            <CheckCircle2 className="mr-2 inline h-4 w-4" />
                            {overrideRetained
                              ? "Enter the physical amount and an approval reason."
                              : `${formatDayCloseCurrency(suggestedAmount)} was retained and will carry into this opening.`}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateOpeningForm(key, {
                                cash: String(suggestedAmount),
                                reason: "",
                                differenceSource: "",
                                differenceReference: "",
                                overrideRetained: !overrideRetained,
                              })
                            }
                            disabled={!overrideRetained && !canApproveOpeningDifference}
                            title={
                              !overrideRetained && !canApproveOpeningDifference
                                ? "Drawer approval permission is required."
                                : undefined
                            }
                          >
                            {overrideRetained ? "Use retained amount" : "Report different amount"}
                          </Button>
                        </div>
                      ) : varianceEnforced ? (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-400">
                          <AlertTriangle className="mr-2 inline h-4 w-4" />
                          Fixed opening float is active. A manager approval is required if the count is outside tolerance.
                        </div>
                      ) : (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-400">
                          <CheckCircle2 className="mr-2 inline h-4 w-4" />
                          Flexible opening mode is active. Today&apos;s counted amount becomes this drawer&apos;s opening baseline.
                        </div>
                      )}
                      {openingNeedsApproval ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          This opening count differs from the expected amount. Select a source and enter an approved reason.
                        </div>
                      ) : null}
                      {openingNeedsApproval ? (
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                          <div className="grid gap-2 text-sm font-medium">
                            Difference source
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                ["safe_transfer", "From safe"],
                                ["cash_over_short", "Unexplained"],
                              ].map(([value, label]) => (
                                <Button
                                  key={value}
                                  type="button"
                                  variant={openingForm.differenceSource === value ? "default" : "outline"}
                                  onClick={() => updateOpeningForm(key, { differenceSource: value })}
                                  className="justify-center"
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <label className="grid gap-1 text-sm font-medium">
                            Reference
                            <Input
                              value={openingForm.differenceReference ?? ""}
                              onChange={(event) => updateOpeningForm(key, { differenceReference: event.target.value })}
                              placeholder={openingForm.differenceSource === "safe_transfer" ? "Safe transfer reference" : "Optional"}
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <label className="grid gap-1 text-sm font-medium">
                          {retainedCarryForward && !overrideRetained ? "Retained opening cash" : "Counted opening cash"}
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={openingForm.cash}
                            onChange={(event) => updateOpeningForm(key, { cash: event.target.value })}
                            placeholder="0.00"
                            readOnly={retainedCarryForward && !overrideRetained}
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                          {openingNeedsApproval ? "Reason for difference" : "Opening note"}
                          <Input
                            value={openingForm.reason}
                            onChange={(event) => updateOpeningForm(key, { reason: event.target.value })}
                            placeholder={openingNeedsApproval ? "Required manager approval reason" : "Optional"}
                            disabled={retainedCarryForward && !overrideRetained}
                          />
                        </label>
                        <div className="flex items-end">
                          <Button
                            onClick={() => openDrawer(config)}
                            disabled={openingKey === key || !openingApprovalReady}
                            className="w-full"
                          >
                            {openingKey === key ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Banknote className="mr-2 h-4 w-4" />
                            )}
                            {retainedCarryForward && !overrideRetained ? "Confirm and open" : "Open drawer"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                      <div className="text-sm">
                        <div className="font-semibold">
                          {session.station} / {session.drawer_key}
                        </div>
                        <div className="text-muted-foreground">
                          Cashier #{session.cashier_id ?? "unassigned"} - Expected{" "}
                          {formatDayCloseCurrency(expectedClosingCash ?? 0)} - Counted{" "}
                          {countedCashLabel(session, breakdown)}
                        </div>
                      </div>
                      <Button
                        variant={countable || settlementPending ? "default" : "outline"}
                        onClick={() => openCountDialog(session)}
                        disabled={!countable && !settlementPending}
                      >
                        {settlementPending
                          ? "Settle drawer"
                          : session.status === "variance_review_required"
                            ? "Request variance approval"
                            : "Count drawer"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{footerNote}</p>

        <DrawerCountDialog
          session={countSession}
          open={countDialogOpen}
          onOpenChange={setCountDialogOpen}
          onUpdated={updateSession}
        />
      </CardContent>
    </Card>
  );
}
