"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>Performance</CardTitle>
          <CardDescription>Completed-order performance for this staff member.</CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{error}</div>
        ) : !row ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No completed orders attributed to this staff member in this period.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={ReceiptText} label="Orders created" value={String(row.orders_count)} />
              <Metric icon={Wallet} label="Revenue (created)" value={money(row.revenue)} />
              <Metric icon={TrendingUp} label="Avg order" value={money(row.avg_order_value)} />
            </div>
            {row.orders_completed > 0 || row.items_added > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {row.orders_completed > 0 ? (
                  <Metric
                    icon={Wallet}
                    label="Orders completed"
                    value={`${row.orders_completed} · ${money(row.revenue_as_completer)}`}
                  />
                ) : null}
                {row.items_added > 0 ? (
                  <Metric icon={ReceiptText} label="Items added to orders" value={String(row.items_added)} />
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          {dateFrom} to {dateTo}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
