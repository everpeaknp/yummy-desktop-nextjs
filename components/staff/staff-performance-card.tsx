"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkforceMetricStrip } from "@/components/workforce/workforce-presentation";

type StaffDetailRow = {
  id: number;
  name: string;
  email: string;
  /** Orders this staff member created, and their revenue. */
  revenue: number;
  orders_count: number;
  avg_order_value: number;
  /** Orders this staff member *completed* (collected final payment on) --
   * can be a different person than whoever created the order. */
  orders_completed: number;
  revenue_as_completer: number;
  /** Order lines added to an already-created order. An activity count. */
  items_added: number;
};

function money(value: number) {
  return formatCurrency(value);
}

function yyyyMmDd(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Scopes the restaurant-wide staff leaderboard (analytics/staff page) down to
 * one person, fetched at a large page size and filtered client-side -- the
 * backend endpoint has no per-staff filter, and this profile card doesn't
 * need one built for a single, infrequent lookup.
 */
export function StaffPerformanceCard({ userId }: { userId: number }) {
  const restaurantId = useRestaurant((state) => state.restaurant?.id);
  const authRestaurantId = useAuth((state) => state.user?.restaurant_id);
  const effectiveRestaurantId = restaurantId ?? authRestaurantId;
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const [dateFrom, setDateFrom] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 29);
    return yyyyMmDd(value);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<StaffDetailRow | null>(null);

  const load = useCallback(async () => {
    if (!effectiveRestaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        AnalyticsApis.staffDetails({
          restaurantId: effectiveRestaurantId,
          dateFrom,
          dateTo,
          timezone,
          page: 1,
          pageSize: 100,
        }),
      );
      const rows = (response.data?.data?.staff || []) as StaffDetailRow[];
      setRow(rows.find((item) => Number(item.id) === Number(userId)) ?? null);
    } catch (error: any) {
      setError(
        error?.response?.data?.detail ||
          error?.response?.data?.message ||
          "Performance data is unavailable for this plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, effectiveRestaurantId, timezone, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Period</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed-order performance for this staff member.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div>
        {loading ? (
          <LoadingState label="Loading performance" className="min-h-40" />
        ) : error ? (
          <ErrorState
            title="Performance unavailable"
            description={error}
            actionLabel="Retry"
            onAction={() => void load()}
            className="min-h-40"
          />
        ) : !row ? (
          <EmptyState
            title="No performance activity"
            description="No completed orders were attributed to this staff member in the selected period."
            className="min-h-40"
          />
        ) : (
          <WorkforceMetricStrip
            className="lg:grid-cols-5"
            items={[
              {
                icon: ReceiptText,
                label: "Orders created",
                value: String(row.orders_count),
              },
              {
                icon: Wallet,
                label: "Created-order revenue",
                value: money(row.revenue),
                valueClassName: "whitespace-nowrap",
              },
              {
                icon: TrendingUp,
                label: "Average order",
                value: money(row.avg_order_value),
                valueClassName: "whitespace-nowrap",
              },
              {
                icon: Wallet,
                label: "Orders completed",
                value: String(row.orders_completed),
                helper: `${money(row.revenue_as_completer)} collected`,
              },
              {
                icon: ReceiptText,
                label: "Items added",
                value: String(row.items_added),
              },
            ]}
          />
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          {formatDate(dateFrom)} – {formatDate(dateTo)}
        </div>
      </div>
    </section>
  );
}
