"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import {
  AnalyticsAccessDenied,
  AnalyticsAccessLoading,
  AnalyticsFetchError,
} from "@/components/analytics/analytics-access-states";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PeriodSummary = { income: number; expense: number; profit: number };
type PeriodDeltas = { income_pct: number; expense_pct: number; profit_pct: number };
type ComparisonResponse = { current: PeriodSummary; previous: PeriodSummary; deltas: PeriodDeltas };

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AnalyticsComparePage() {
  const { user, ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonResponse | null>(null);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return yyyyMmDd(d);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(today));

  const [station, setStation] = useState<string>("all");
  const showBusinessLine = Boolean(restaurant?.hotel_enabled && restaurant?.restaurant_enabled);
  const [businessLine, setBusinessLine] = useState<string>("all");

  const money = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);

  const fetchCompare = async () => {
    if (!canViewAnalytics) {
      setFetchError("You do not have permission to view analytics.");
      return;
    }
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const url = AnalyticsApis.compare({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        station: station !== "all" ? station : undefined,
        businessLine: showBusinessLine && businessLine !== "all" ? businessLine : undefined,
      });
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        const message = res.data?.message || "Failed to load comparison";
        setFetchError(message);
        toast.error(message);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load comparison";
      setFetchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canViewAnalytics || !restaurantId) return;
    fetchCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canViewAnalytics, restaurantId, dateFrom, dateTo, station, businessLine]);

  const Delta = ({ value }: { value: number }) => {
    const positive = value >= 0;
    return (
      <Badge
        variant="outline"
        className={positive ? "text-emerald-700 border-emerald-200" : "text-red-700 border-red-200"}
      >
        {positive ? "+" : ""}
        {value.toFixed(1)}%
      </Badge>
    );
  };

  if (!ready) return <AnalyticsAccessLoading />;
  if (!canViewAnalytics) return <AnalyticsAccessDenied />;

  const current = data?.current;
  const previous = data?.previous;
  const deltas = data?.deltas;

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      {fetchError ? (
        <AnalyticsFetchError message={fetchError} onRetry={fetchCompare} />
      ) : null}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/analytics">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Period Comparison</h1>
            <p className="text-muted-foreground">Compare income, expense, and profit vs the prior period.</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchCompare} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Station</Label>
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="cafe">Cafe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Business Line</Label>
            <Select
              value={businessLine}
              onValueChange={setBusinessLine}
              disabled={!showBusinessLine}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="hotel">Hotel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Income", key: "income" as const, delta: deltas?.income_pct },
          { label: "Expense", key: "expense" as const, delta: deltas?.expense_pct },
          { label: "Profit", key: "profit" as const, delta: deltas?.profit_pct },
        ].map(({ label, key, delta }) => (
          <Card key={key} className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{label}</span>
                {typeof delta === "number" ? <Delta value={delta} /> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current</span>
                <span className="font-semibold tabular-nums">
                  {money.format(current?.[key] ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous</span>
                <span className="font-medium tabular-nums text-muted-foreground">
                  {money.format(previous?.[key] ?? 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && !data && !fetchError ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No comparison data for the selected range.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
