"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

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
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const { restaurant } = useRestaurant();

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
      setAuthLoading(false);
    };
    checkAuth();
  }, [user, me, router]);

  const money = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);

  const fetchCompare = async () => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    setLoading(true);
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
        toast.error(res.data?.message || "Failed to load comparison");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load comparison");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && restaurantId) fetchCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, restaurantId, dateFrom, dateTo, station, businessLine]);

  const Delta = ({ value }: { value: number }) => {
    const v = Number(value || 0);
    const positive = v >= 0;
    return (
      <Badge variant={positive ? "success" : "destructive"}>
        {positive ? "+" : ""}{v.toFixed(2)}%
      </Badge>
    );
  };

  if (authLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/analytics">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Period Comparison</h1>
            <p className="text-muted-foreground">Compare this range to the previous period.</p>
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
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2 md:col-span-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
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
            <Select value={businessLine} onValueChange={setBusinessLine} disabled={!showBusinessLine}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">Rs. {money.format(Number(data?.current?.income || 0))}</div>
            <div className="text-sm text-muted-foreground">Prev: Rs. {money.format(Number(data?.previous?.income || 0))}</div>
            {data ? <Delta value={data.deltas?.income_pct} /> : null}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">Rs. {money.format(Number(data?.current?.expense || 0))}</div>
            <div className="text-sm text-muted-foreground">Prev: Rs. {money.format(Number(data?.previous?.expense || 0))}</div>
            {data ? <Delta value={data.deltas?.expense_pct} /> : null}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">Rs. {money.format(Number(data?.current?.profit || 0))}</div>
            <div className="text-sm text-muted-foreground">Prev: Rs. {money.format(Number(data?.previous?.profit || 0))}</div>
            {data ? <Delta value={data.deltas?.profit_pct} /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

