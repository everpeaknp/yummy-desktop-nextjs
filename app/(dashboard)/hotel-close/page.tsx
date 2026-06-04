"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bed,
  Utensils,
  ChevronRight,
  AlertTriangle,
  Coins,
  RefreshCw,
  Clock,
  ReceiptText,
  ShoppingBag,
  Clock3,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { useRestaurant } from "@/hooks/use-restaurant";
import { DayCloseApis } from "@/lib/api/endpoints";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import { toast } from "sonner";
import {
  formatDayCloseCloseName,
  formatDayCloseCoveredRange,
  formatDayCloseCurrency,
  pickBackendAmount,
} from "@/lib/day-close-format";
import {
  snapshotHotelSplitRows,
  snapshotPurchaseRows,
  snapshotReceivableRows,
} from "@/lib/day-close-snapshot-view";
import {
  parseDayCloseCurrent,
  parseDayCloseSnapshotData,
  unwrapApiData,
  type DayCloseCurrent,
  type DayCloseSnapshotData,
} from "@/types/day-close";

function readAmount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export default function HotelClosePage() {
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<DayCloseCurrent | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<DayCloseSnapshotData | null>(null);
  const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useAuth((state) => state.user);
  const { ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);

  const fetchHotelData = useCallback(async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    setError(null);
    try {
      const [sessionRes, snapshotRes] = await Promise.all([
        apiClient.get(
          DayCloseApis.current({
            restaurantId: user.restaurant_id,
            businessLine: "hotel",
          }),
        ),
        apiClient.get(
          DayCloseApis.generateSnapshot({
            restaurantId: user.restaurant_id,
            businessLine: "hotel",
          }),
        ),
      ]);

      if (sessionRes.data?.status === "success") {
        setCurrentSession(unwrapApiData(sessionRes.data, parseDayCloseCurrent));
      } else {
        setCurrentSession(null);
      }

      if (snapshotRes.data?.status === "success") {
        setSnapshotPreview(unwrapApiData(snapshotRes.data, parseDayCloseSnapshotData));
      } else {
        setSnapshotPreview(null);
        setError(snapshotRes.data?.message || "Failed to load hotel close snapshot");
      }
    } catch (err: unknown) {
      console.error("Failed to load hotel close details", err);
      const message =
        (err as { response?: { data?: { message?: string; detail?: string } } })?.response
          ?.data?.message ||
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to sync hotel operational records";
      setError(message);
      setSnapshotPreview(null);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id]);

  useEffect(() => {
    if (ready && canViewAnalytics && user?.restaurant_id) {
      void fetchHotelData();
    }
  }, [ready, canViewAnalytics, user?.restaurant_id, fetchHotelData]);

  const hotelSplit = useMemo(
    () => (snapshotPreview ? snapshotHotelSplitRows(snapshotPreview) : []),
    [snapshotPreview],
  );

  const purchaseRows = useMemo(
    () => (snapshotPreview ? snapshotPurchaseRows(snapshotPreview) : []),
    [snapshotPreview],
  );

  const receivableRows = useMemo(
    () => (snapshotPreview ? snapshotReceivableRows(snapshotPreview) : []),
    [snapshotPreview],
  );

  const roomRevenue = readAmount(
    snapshotPreview?.hotel_revenue_split?.room_revenue ??
      hotelSplit.find((row) => row.label === "Room Revenue")?.amount,
  );
  const foodRevenue = readAmount(
    snapshotPreview?.hotel_revenue_split?.food_revenue ??
      hotelSplit.find((row) => row.label === "Food Revenue")?.amount,
  );
  const splitTotal =
    roomRevenue != null && foodRevenue != null ? roomRevenue + foodRevenue : undefined;

  const periodLabel = useMemo(() => {
    const covered = formatDayCloseCoveredRange(
      currentSession?.period_start_at,
      currentSession?.period_end_at,
    );
    if (covered) return covered;
    if (!currentSession?.period_start_at) return null;
    const start = new Date(currentSession.period_start_at);
    if (Number.isNaN(start.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `Window in progress from ${fmt.format(start)}`;
  }, [currentSession?.period_start_at, currentSession?.period_end_at]);

  const folioRows = useMemo(() => {
    if (!snapshotPreview) return [];
    const outstanding = pickBackendAmount(
      snapshotPreview.receivables?.outstanding_receivables,
      receivableRows.find((row) => row.label === "Outstanding Receivables")?.amount,
    );
    return [
      {
        label: "Gross Sales",
        value: pickBackendAmount(snapshotPreview.gross_sales, snapshotPreview.net_sales),
      },
      {
        label: "Net Sales",
        value: pickBackendAmount(snapshotPreview.net_sales),
      },
      {
        label: "Total Expenses",
        value: pickBackendAmount(snapshotPreview.expense_total),
      },
      {
        label: "Expected Cash",
        value: pickBackendAmount(snapshotPreview.expected_cash),
      },
      {
        label: "Outstanding Receivables",
        value: outstanding,
      },
    ].filter((row) => row.value != null);
  }, [snapshotPreview, receivableRows]);

  if (!ready || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-xs uppercase tracking-widest font-black text-muted-foreground">
          Synchronizing Hotel Ledger…
        </p>
      </div>
    );
  }

  if (error && !snapshotPreview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
        <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold">Failed to load Hotel Close</h3>
        <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
        <Button onClick={() => void fetchHotelData()} variant="outline" className="rounded-xl">
          Retry Sync
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10 px-4 md:px-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Hotel Day Close</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider text-orange-500 font-bold">
            {restaurant?.name || "Hotel Operations"} • Room folio reconciliation
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          {periodLabel ? (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-start gap-2 max-w-md">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-[10px] opacity-80">
                  Active {formatDayCloseCloseName("hotel")} window
                </p>
                <p className="mt-0.5">{periodLabel}</p>
              </div>
            </div>
          ) : null}
          {currentSession?.action_label ? (
            <p className="text-xs font-semibold text-muted-foreground">{currentSession.action_label}</p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => void fetchHotelData()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-500/[0.03] to-blue-500/[0.01] border-blue-500/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 opacity-60" />
          <CardHeader className="pb-2">
            <div className="p-2 bg-blue-500/10 w-fit rounded-xl text-blue-500 mb-2">
              <Bed className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-blue-500 uppercase tracking-widest">
              Room Revenue
            </CardTitle>
            <CardDescription>From backend hotel revenue split (rent category)</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <span className="text-3xl font-black text-foreground">
              {formatDayCloseCurrency(roomRevenue)}
            </span>
            {splitTotal != null && roomRevenue != null && splitTotal > 0 ? (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-semibold border-t border-border/40 pt-3">
                <span>Share of room + food</span>
                <span className="text-blue-500 font-bold">
                  {Math.round((roomRevenue / splitTotal) * 100)}%
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/[0.03] to-orange-500/[0.01] border-orange-500/10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 opacity-60" />
          <CardHeader className="pb-2">
            <div className="p-2 bg-orange-500/10 w-fit rounded-xl text-orange-500 mb-2">
              <Utensils className="w-5 h-5" />
            </div>
            <CardTitle className="text-sm font-bold text-orange-500 uppercase tracking-widest">
              Food & Beverage Revenue
            </CardTitle>
            <CardDescription>From backend hotel revenue split (non-rent items)</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <span className="text-3xl font-black text-foreground">
              {formatDayCloseCurrency(foodRevenue)}
            </span>
            {splitTotal != null && foodRevenue != null && splitTotal > 0 ? (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-semibold border-t border-border/40 pt-3">
                <span>Share of room + food</span>
                <span className="text-orange-500 font-bold">
                  {Math.round((foodRevenue / splitTotal) * 100)}%
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-orange-500" />
              Folio Summary
            </CardTitle>
            <CardDescription>
              Server snapshot for the current hotel close window — not calculated in the browser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {folioRows.length > 0 ? (
              <div className="space-y-3">
                {folioRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2 border-b border-border/40 text-sm last:border-0"
                  >
                    <span className="font-semibold text-muted-foreground">{row.label}</span>
                    <span className="font-bold text-foreground">
                      {formatDayCloseCurrency(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Folio totals are not available yet.</p>
            )}

            {(hotelSplit.length > 0 || purchaseRows.length > 0) && (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Hotel Breakdown
                </h3>
                <div className="rounded-xl border bg-muted/20 divide-y divide-border/40">
                  {hotelSplit.map((row) => (
                    <HotelBreakdownRow
                      key={row.label}
                      icon={<Bed className="w-4 h-4" />}
                      label={row.label}
                      value={formatDayCloseCurrency(row.amount)}
                    />
                  ))}
                  {purchaseRows.map((row) => (
                    <HotelBreakdownRow
                      key={row.label}
                      icon={
                        row.label.includes("Pending") ? (
                          <Clock3 className="w-4 h-4" />
                        ) : (
                          <ShoppingBag className="w-4 h-4" />
                        )
                      }
                      label={row.label}
                      value={formatDayCloseCurrency(row.amount)}
                      secondary={row.secondary}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/[0.01] flex flex-col justify-between shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <ReceiptText className="w-4 h-4 text-orange-500" />
              Perform Hotel Close
            </CardTitle>
            <CardDescription>
              Reconcile room folios, hotel expenses, and purchases for this exact window.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end gap-4 pt-4">
            <div className="text-xs text-muted-foreground bg-muted p-3.5 rounded-xl border border-border/60 font-semibold space-y-2">
              <p>Before closing the hotel day:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Ensure occupied rooms are checked in correctly.</li>
                <li>Verify room service bills are posted or charged to folios.</li>
              </ul>
            </div>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white w-full rounded-xl py-5 font-bold gap-2 flex items-center justify-center shadow-lg shadow-orange-500/10 transition-all active:scale-[0.98]"
              onClick={() => setIsDayCloseOpen(true)}
            >
              Close Hotel Day <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {user?.restaurant_id ? (
        <DayCloseModal
          isOpen={isDayCloseOpen}
          onClose={() => {
            setIsDayCloseOpen(false);
            void fetchHotelData();
          }}
          restaurantId={user.restaurant_id}
          businessLine="hotel"
        />
      ) : null}
    </div>
  );
}

function HotelBreakdownRow({
  icon,
  label,
  value,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-orange-500 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{label}</p>
          {secondary ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{secondary}</p>
          ) : null}
        </div>
      </div>
      <span className="font-bold tabular-nums shrink-0">{value}</span>
    </div>
  );
}
