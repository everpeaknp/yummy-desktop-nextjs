"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
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
};

type OpeningForm = {
  cash: string;
  reason: string;
};

const COUNTABLE_STATUSES = new Set(["opened", "closing_count_required", "variance_review_required", "reopened"]);
const READY_STATUSES = new Set(["closed", "approved"]);

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
  if (READY_STATUSES.has(String(session.status))) return "Ready";
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

export function DrawerSessionPanel({
  restaurantId,
  businessLine,
  businessDate,
}: DrawerSessionPanelProps) {
  const effectiveBusinessDate = businessDate || todayIso();
  const [configs, setConfigs] = useState<DrawerConfiguration[]>([]);
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, DrawerOpeningSuggestion | null>>({});
  const [openingForms, setOpeningForms] = useState<Record<string, OpeningForm>>({});
  const [loading, setLoading] = useState(false);
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
          if (!next[key]) {
            const suggestion = nextSuggestions[key];
            next[key] = {
              cash: suggestion ? String(Number(suggestion.amount ?? 0)) : "",
              reason: "",
            };
          }
        }
        return next;
      });
    },
    [businessLine, effectiveBusinessDate, restaurantId],
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
      const nextSessions = activeRes.data?.data ?? [];
      const nextConfigs = configRes.data?.data ?? [];
      setSessions(nextSessions);
      setConfigs(nextConfigs);
      await loadSuggestions(nextConfigs);
    } catch (error) {
      console.error("Failed to load drawer sessions", error);
      setSessions([]);
      setConfigs([]);
      toast.error("Failed to load drawer readiness");
    } finally {
      setLoading(false);
    }
  }, [businessLine, loadSuggestions, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOpeningForm = (key: string, patch: Partial<OpeningForm>) => {
    setOpeningForms((current) => ({
      ...current,
      [key]: {
        cash: current[key]?.cash ?? "",
        reason: current[key]?.reason ?? "",
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
    const needsApproval = varianceEnforced && Math.abs(amount - suggestedAmount) > tolerance;
    if (needsApproval) {
      toast.error("Opening count is outside tolerance. Use manager approval from checkout/settings flow.");
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
      toast.error("Failed to open drawer");
    } finally {
      setOpeningKey(null);
    }
  };

  const updateSession = (session: DrawerSession) => {
    setSessions((current) => {
      const others = current.filter((row) => row.id !== session.id);
      return [session, ...others];
    });
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
            Drawer readiness
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeConfigs.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Drawer controls may be disabled or no active drawers are configured for this restaurant.
          </div>
        ) : (
          <div className="grid gap-4">
            {activeConfigs.map((config) => {
              const key = drawerScopeKey(config.station, config.drawer_key);
              const session = sessionForConfig(sessions, config);
              const suggestion = suggestions[key];
              const openingForm = openingForms[key] ?? { cash: "", reason: "" };
              const varianceEnforced = Boolean(suggestion?.opening_variance_enforced);
              const suggestedAmount = Number(suggestion?.amount ?? session?.suggested_opening_cash ?? 0);
              const countedOpeningAmount = Number(openingForm.cash);
              const openingNeedsApproval =
                !session &&
                varianceEnforced &&
                Number.isFinite(countedOpeningAmount) &&
                Math.abs(countedOpeningAmount - suggestedAmount) > Number(suggestion?.opening_variance_tolerance ?? 0);
              const countable = isCountable(session);
              const ready = Boolean(session && READY_STATUSES.has(String(session.status)));

              return (
                <div key={config.id} className="rounded-lg border bg-muted/10 p-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{config.name || `${config.station} / ${config.drawer_key}`}</div>
                        <Badge variant={session ? "default" : "secondary"} className="text-[10px]">
                          {readyLabel(session)}
                        </Badge>
                        {varianceEnforced ? (
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
                        Opening source
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
                        {session?.counted_opening_cash != null
                          ? formatDayCloseCurrency(session.counted_opening_cash)
                          : "Not opened"}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Closing cash
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        Expected {formatDayCloseCurrency(session?.expected_closing_cash ?? 0)} · Counted{" "}
                        {formatDayCloseCurrency(session?.counted_closing_cash ?? 0)}
                      </div>
                    </div>
                  </div>

                  {!session ? (
                    <div className="space-y-3">
                      {!suggestion ? (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          Opening policy is loading or unavailable. Refresh drawer readiness if this remains blank.
                        </div>
                      ) : varianceEnforced ? (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                          <AlertTriangle className="mr-2 inline h-4 w-4" />
                          Fixed opening float is active. A manager approval is required if the count is outside tolerance.
                        </div>
                      ) : (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900">
                          <CheckCircle2 className="mr-2 inline h-4 w-4" />
                          Flexible opening mode is active. Today&apos;s counted amount becomes this drawer&apos;s opening baseline.
                        </div>
                      )}
                      {openingNeedsApproval ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          This opening count differs from the fixed float beyond tolerance.
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <label className="grid gap-1 text-sm font-medium">
                          Counted opening cash
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={openingForm.cash}
                            onChange={(event) => updateOpeningForm(key, { cash: event.target.value })}
                            placeholder="0.00"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-medium">
                          {varianceEnforced ? "Reason for variance" : "Opening note"}
                          <Input
                            value={openingForm.reason}
                            onChange={(event) => updateOpeningForm(key, { reason: event.target.value })}
                            placeholder={varianceEnforced ? "Required if outside tolerance" : "Optional"}
                          />
                        </label>
                        <div className="flex items-end">
                          <Button
                            onClick={() => openDrawer(config)}
                            disabled={openingKey === key || openingNeedsApproval}
                            className="w-full"
                          >
                            {openingKey === key ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Banknote className="mr-2 h-4 w-4" />
                            )}
                            Open drawer
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
                          Cashier #{session.cashier_id ?? "unassigned"} · Expected{" "}
                          {formatDayCloseCurrency(session.expected_closing_cash ?? 0)} · Counted{" "}
                          {formatDayCloseCurrency(session.counted_closing_cash ?? 0)}
                        </div>
                      </div>
                      <Button
                        variant={countable ? "default" : "outline"}
                        onClick={() => openCountDialog(session)}
                        disabled={!countable}
                      >
                        {session.status === "variance_review_required" ? "Request variance approval" : "Count drawer"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This operational panel checks drawer readiness only. Accounting review status is handled after the day is closed.
        </p>

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
