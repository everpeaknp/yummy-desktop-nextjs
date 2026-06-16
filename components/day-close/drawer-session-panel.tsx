"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { DrawerSessionApis } from "@/lib/api/endpoints";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
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

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function sourceLabel(value?: string | null) {
  if (!value) return "Not loaded";
  return value.replace(/_/g, " ");
}

function readyLabel(session: DrawerSession | null) {
  if (!session) return "No active drawer";
  if (session.status === "closed" || session.status === "approved") return "Drawer readiness: ready";
  if (session.status === "variance_review_required") return "Drawer readiness: variance approval required";
  if (session.status === "opened" || session.status === "closing_count_required") return "Drawer readiness: count required";
  return "Drawer readiness: " + session.status;
}

export function DrawerSessionPanel({
  restaurantId,
  businessLine,
  businessDate,
}: DrawerSessionPanelProps) {
  const effectiveBusinessDate = businessDate || todayIso();
  const [station, setStation] = useState("general");
  const [drawerKey, setDrawerKey] = useState("main");
  const [countedOpeningCash, setCountedOpeningCash] = useState("");
  const [openingReason, setOpeningReason] = useState("");
  const [configs, setConfigs] = useState<DrawerConfiguration[]>([]);
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [suggestion, setSuggestion] = useState<DrawerOpeningSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [countDialogOpen, setCountDialogOpen] = useState(false);

  const activeSession = useMemo(() => sessions[0] ?? null, [sessions]);
  const openingPolicyLoaded = Boolean(suggestion);
  const openingVarianceEnforced = Boolean(suggestion?.opening_variance_enforced);
  const openingSuggestionAmount = Number(suggestion?.amount ?? 0);
  const countedOpeningAmount = Number(countedOpeningCash);
  const openingNeedsApproval =
    openingVarianceEnforced &&
    Number.isFinite(countedOpeningAmount) &&
    Math.abs(countedOpeningAmount - openingSuggestionAmount) > Number(suggestion?.opening_variance_tolerance ?? 0);

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
      setSessions(activeRes.data?.data ?? []);
      setConfigs(configRes.data?.data ?? []);
    } catch (error) {
      console.error("Failed to load drawer sessions", error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, businessLine]);

  const loadSuggestion = useCallback(async () => {
    try {
      const res = await apiClient.get<BaseResponse<DrawerOpeningSuggestion>>(
        DrawerSessionApis.suggestion({
          restaurantId,
          businessLine: String(businessLine),
          businessDate: effectiveBusinessDate,
          station,
          drawerKey,
        }),
      );
      const next = res.data?.data ?? null;
      setSuggestion(next);
      if (next && !countedOpeningCash) {
        setCountedOpeningCash(String(next.amount ?? 0));
      }
    } catch (error) {
      setSuggestion(null);
      console.info("Opening float suggestion is unavailable until drawer controls are configured.", error);
    }
  }, [restaurantId, businessLine, effectiveBusinessDate, station, drawerKey, countedOpeningCash]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSuggestion();
  }, [loadSuggestion]);

  const openDrawer = async () => {
    const amount = Number(countedOpeningCash);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid opening cash count.");
      return;
    }
    setOpening(true);
    try {
      const payload: DrawerSessionOpenInput = {
        restaurant_id: restaurantId,
        business_line: businessLine,
        station,
        drawer_key: drawerKey,
        business_date: effectiveBusinessDate,
        counted_opening_cash: amount,
        denominations_json: null,
        reason: openingReason.trim() || null,
      };
      const res = await apiClient.post<BaseResponse<DrawerSession>>(DrawerSessionApis.open, payload);
      const session = res.data?.data;
      if (session) setSessions([session]);
      toast.success("Drawer opened.");
    } catch (error) {
      console.error("Failed to open drawer", error);
      toast.error("Failed to open drawer");
    } finally {
      setOpening(false);
    }
  };

  const updateSession = (session: DrawerSession) => {
    setSessions((current) => {
      const others = current.filter((row) => row.id !== session.id);
      return [session, ...others];
    });
  };

  const canOpen = !activeSession;
  const canCount = Boolean(
    activeSession &&
      ["opened", "closing_count_required", "variance_review_required", "reopened"].includes(String(activeSession.status)),
  );
  const ready = activeSession && ["closed", "approved"].includes(String(activeSession.status));

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
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">
            Station
            <Input value={station} onChange={(event) => setStation(event.target.value || "general")} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Drawer key
            <Input value={drawerKey} onChange={(event) => setDrawerKey(event.target.value || "main")} />
          </label>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opening float source
            </div>
            <div className="mt-1 text-sm font-semibold capitalize">
              {sourceLabel(suggestion?.source)}
            </div>
          </div>
        </div>

        {configs.length === 0 ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Drawer controls may be disabled or not configured for this restaurant.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested opening
            </div>
            <div className="mt-1 text-lg font-semibold">
              {formatDayCloseCurrency(suggestion?.amount ?? activeSession?.suggested_opening_cash ?? 0)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Counted opening cash
            </div>
            <div className="mt-1 text-lg font-semibold">
              {activeSession?.counted_opening_cash != null
                ? formatDayCloseCurrency(activeSession.counted_opening_cash)
                : "Not opened"}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold capitalize">
              {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {readyLabel(activeSession)}
            </div>
          </div>
        </div>

        {canOpen ? (
          <div className="space-y-3">
            {!openingPolicyLoaded ? (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                Opening policy is loading or unavailable. Refresh drawer readiness if this remains blank.
              </div>
            ) : openingVarianceEnforced ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Fixed opening float is active. A manager approval is required if the count is outside tolerance.
              </div>
            ) : (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                Flexible opening mode is active. Today&apos;s counted amount becomes the drawer opening baseline.
              </div>
            )}
            {openingNeedsApproval ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                This opening count differs from the fixed float beyond tolerance. Use a manager-approved opening flow.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm font-medium">
                Counted opening cash
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedOpeningCash}
                  onChange={(event) => setCountedOpeningCash(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                {openingVarianceEnforced ? "Reason for variance" : "Opening note"}
                <Input
                  value={openingReason}
                  onChange={(event) => setOpeningReason(event.target.value)}
                  placeholder={openingVarianceEnforced ? "Required if outside tolerance" : "Optional"}
                />
              </label>
              <div className="flex items-end">
                <Button onClick={openDrawer} disabled={opening || openingNeedsApproval} className="w-full">
                  {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                  Open drawer
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
            <div className="text-sm">
              <div className="font-semibold">
                {activeSession?.station} / {activeSession?.drawer_key}
              </div>
              <div className="text-muted-foreground">
                Expected: {formatDayCloseCurrency(activeSession?.expected_closing_cash ?? 0)} · Counted: {formatDayCloseCurrency(activeSession?.counted_closing_cash ?? 0)}
              </div>
            </div>
            <Button variant={canCount ? "default" : "outline"} onClick={() => setCountDialogOpen(true)} disabled={!canCount}>
              {activeSession?.status === "variance_review_required" ? "Request variance approval" : "Count drawer"}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          This operational panel checks drawer readiness only. Accounting review status is handled after the day is closed.
        </p>

        <DrawerCountDialog
          session={activeSession}
          open={countDialogOpen}
          onOpenChange={setCountDialogOpen}
          onUpdated={updateSession}
        />
      </CardContent>
    </Card>
  );
}
