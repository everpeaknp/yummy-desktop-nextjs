"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { DayCloseHistory } from "@/components/analytics/day-close-history";
import { DayCloseFinancialOverview } from "@/components/analytics/day-close-financial-overview";
import { cn } from "@/lib/utils";
import { Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { DayCloseApis } from "@/lib/api/endpoints";
import { formatDayCloseListHeading } from "@/lib/day-close-format";
import {
  parseDayCloseCurrent,
  parseDayCloseSnapshotData,
  unwrapApiData,
  type DayCloseCurrent,
  type DayCloseSnapshotData,
  type BusinessLine,
} from "@/types/day-close";

export default function DayClosePage() {
  const user = useAuth((s) => s.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const restaurantId = user?.restaurant_id ?? undefined;
  const [closeOpen, setCloseOpen] = useState(false);
  const [businessLine, setBusinessLine] = useState<BusinessLine>("restaurant");
  const [currentLoading, setCurrentLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentClose, setCurrentClose] = useState<DayCloseCurrent | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<DayCloseSnapshotData | null>(null);

  const showBusinessLinePicker = Boolean(
    restaurant?.hotel_enabled && restaurant?.restaurant_enabled,
  );

  const loadCurrent = useCallback(async () => {
    if (!restaurantId) return;
    setCurrentLoading(true);
    setLoadError(null);
    try {
      const [sessionRes, snapshotRes] = await Promise.all([
        apiClient.get(DayCloseApis.current({ restaurantId, businessLine })),
        apiClient.get(DayCloseApis.generateSnapshot({ restaurantId, businessLine })),
      ]);

      if (sessionRes.data?.status === "success") {
        setCurrentClose(unwrapApiData(sessionRes.data, parseDayCloseCurrent));
      } else {
        setCurrentClose(null);
        setLoadError("Could not load the current day-close session.");
      }

      if (snapshotRes.data?.status === "success") {
        setSnapshotPreview(unwrapApiData(snapshotRes.data, parseDayCloseSnapshotData));
      } else {
        setSnapshotPreview(null);
        setLoadError((prev) => prev ?? "Financial snapshot is unavailable from the server.");
      }
    } catch (error: unknown) {
      setCurrentClose(null);
      setSnapshotPreview(null);
      const message =
        error instanceof Error ? error.message : "Failed to load day close data.";
      setLoadError(message);
      toast.error("Day close data could not be loaded", { description: message });
    } finally {
      setCurrentLoading(false);
    }
  }, [restaurantId, businessLine]);

  useEffect(() => {
    if (restaurantId) loadCurrent();
  }, [restaurantId, loadCurrent]);

  const actionLabel = useMemo(() => {
    const label = currentClose?.action_label?.trim();
    if (label) return label;
    const status = String(currentClose?.status ?? "open").toLowerCase();
    if (status === "pending") return "Continue Close";
    if (status === "confirmed") return "View Current Day";
    return "Close Today";
  }, [currentClose?.action_label, currentClose?.status]);

  const businessLineLabel = businessLine === "hotel" ? "Hotel Close" : "Restaurant Close";
  const statusLabel = String(currentClose?.status ?? "—").replace(/_/g, " ");
  const statusTone = (() => {
    const normalized = statusLabel.toLowerCase();
    if (normalized === "open") return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    if (normalized === "confirmed") return "bg-primary/10 text-primary border-primary/20";
    if (normalized === "pending") return "bg-amber-500/10 text-amber-600 border-amber-200";
    if (normalized === "reopened") return "bg-blue-500/10 text-blue-600 border-blue-200";
    return "bg-muted text-muted-foreground border-border";
  })();

  return (
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">Day Close</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Review financials, receivables, and close history — all totals from the backend
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {showBusinessLinePicker ? (
            <Select
              value={businessLine}
              onValueChange={(value) => setBusinessLine(value as BusinessLine)}
            >
              <SelectTrigger className="h-11 rounded-2xl font-bold min-w-[200px] bg-card/80 border-border/50">
                <SelectValue placeholder="Business line" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restaurant">Restaurant Close</SelectItem>
                <SelectItem value="hotel">Hotel Close</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Button
            onClick={() => setCloseOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-2xl shadow-md gap-2"
            disabled={!restaurantId}
          >
            <CheckCircle2 className="w-4 h-4" />
            {actionLabel}
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-destructive font-medium">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadCurrent} disabled={currentLoading}>
            Retry
          </Button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {businessLineLabel}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                onClick={loadCurrent}
                disabled={!restaurantId || currentLoading}
                aria-label="Refresh current day close"
              >
                <RefreshCw className={currentLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest opacity-80">
              Current close window
            </p>
            <p className="text-lg font-black tracking-tight break-words">
              {currentClose?.id
                ? formatDayCloseListHeading({
                    id: currentClose.id,
                    business_line: currentClose.business_line,
                    period_start_at: currentClose.period_start_at,
                    period_end_at: currentClose.period_end_at,
                  })
                : currentLoading
                  ? "Loading…"
                  : "No active session"}
            </p>
            <Badge
              variant="outline"
              className={cn("capitalize font-semibold border", statusTone)}
            >
              {statusLabel}
            </Badge>
          </CardContent>
        </Card>

        <DayCloseFinancialOverview snapshot={snapshotPreview} loading={currentLoading} />
      </section>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="bg-muted/20 border border-border/60 rounded-2xl p-1 h-11 sm:h-12 w-full grid grid-cols-2">
          <TabsTrigger value="history" className="rounded-xl px-3 sm:px-5 font-bold text-xs sm:text-sm">
            History
          </TabsTrigger>
          <TabsTrigger value="about" className="rounded-xl px-3 sm:px-5 font-bold text-xs sm:text-sm">
            What This Does
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-5">
          <DayCloseHistory restaurantId={restaurantId} businessLine={businessLine} />
        </TabsContent>

        <TabsContent value="about" className="mt-5">
          <Card className="shadow-sm rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                A Day Close locks in your daily totals (sales, payments, expenses, refunds) and
                records a cash reconciliation. Receivables show credit orders in the close window
                plus outstanding customer balances from the backend.
              </p>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Use <span className="font-semibold text-foreground">{actionLabel}</span> to run
                  the close wizard.
                </p>
                <p>
                  Tap any financial card above to open a detailed breakdown. Use{" "}
                  <span className="font-semibold text-foreground">History</span> to export PDF/Excel
                  and review saved snapshots.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {restaurantId ? (
        <DayCloseModal
          isOpen={closeOpen}
          onClose={() => {
            setCloseOpen(false);
            loadCurrent();
          }}
          restaurantId={restaurantId}
          businessLine={businessLine}
        />
      ) : null}
    </div>
  );
}
