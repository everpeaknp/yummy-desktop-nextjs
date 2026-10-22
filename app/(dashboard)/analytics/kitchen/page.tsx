"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis, ItemCategoryApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { ReportFilters } from "@/components/patterns/controls/report-filters";
import { DataList, ListRow } from "@/components/patterns/data/data-list";

type KitchenItemMetric = {
  item_id: number;
  item_name: string;
  category: string | null;
  avg_prep_time_min: number;
  total_orders: number;
};

type KitchenDetailsResponse = {
  items: KitchenItemMetric[];
  overall_avg_prep_time: number;
  delayed_orders_pct: number;
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
};

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AnalyticsKitchenPage() {
  const user = useAuth((s) => s.user);
  const { ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<KitchenDetailsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [category, setCategory] = useState("");

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return yyyyMmDd(d);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(today));

  const showBusinessLine = Boolean(restaurant?.hotel_enabled && restaurant?.restaurant_enabled);
  const [businessLine, setBusinessLine] = useState<string>("all");

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const fetchCategories = async () => {
    if (!restaurantId) return;
    setCategoriesLoading(true);
    try {
      const res = await apiClient.get(ItemCategoryApis.getItemCategories(restaurantId));
      const list: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
      const names: string[] = Array.from(
        new Set(
          list
            .map((item: any) => String(item?.name || "").trim())
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b));
      setCategories(names);
    } catch (e) {
      console.error("Failed to load kitchen/menu categories:", e);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchDetails = async () => {
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
      const url = AnalyticsApis.kitchenDetails({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        page,
        pageSize,
        businessLine: showBusinessLine ? businessLine : "all",
        category: category.trim() || undefined,
      });

      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        const message = res.data?.message || "Failed to load kitchen analytics details";
        setFetchError(message);
        toast.error(message);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load kitchen analytics details";
      setFetchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    fetchCategories();
  }, [restaurantId]);

  useEffect(() => {
    if (!ready || !canViewAnalytics || !restaurantId) return;
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canViewAnalytics, restaurantId, dateFrom, dateTo, businessLine, category, pageSize, page]);

  if (!ready) return <AnalyticsAccessLoading />;
  if (!canViewAnalytics) return <AnalyticsAccessDenied />;

  return (
    <AppPage width="wide" className="pb-24">
      {fetchError ? (
        <AnalyticsFetchError message={fetchError} onRetry={fetchDetails} />
      ) : null}
      <PageHeader title="Kitchen analytics" description="Prep-time proxy metrics by menu item." />

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Card className="rounded-xl border-border">
          <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
            <CardTitle className="text-sm text-muted-foreground">Overall Avg Prep Time</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-lg font-semibold tabular-nums sm:p-4 sm:pt-1">
            {data ? `${Number(data.overall_avg_prep_time || 0).toFixed(2)} min` : "—"}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border">
          <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
            <CardTitle className="text-sm text-muted-foreground">Items Tracked</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 text-lg font-semibold tabular-nums sm:p-4 sm:pt-1">
            {data ? Number(data.total_items || 0).toLocaleString() : "—"}
          </CardContent>
        </Card>
      </div>

      <ReportFilters title="Kitchen filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 md:col-span-1">
            <Label>From</Label>
            <Input className="h-11"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>To</Label>
            <Input className="h-11"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Business Line</Label>
            <Select
              value={businessLine}
              onValueChange={(v) => {
                setPage(1);
                setBusinessLine(v);
              }}
              disabled={!showBusinessLine}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="hotel">Hotel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Page Size</Label>
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(1); setPageSize(Number(v)); }}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </ReportFilters>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => { setCategory(""); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                !category
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-muted text-muted-foreground border-border hover:bg-card"
              )}
            >
              All Categories
            </button>
            {categoriesLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              categories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => { setCategory(cat === category ? "" : cat); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
                    category === cat
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-muted text-muted-foreground border-border hover:bg-card"
                  )}
                >
                  {cat}
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          {data ? <Badge variant="outline">{data.total_items.toLocaleString()} items</Badge> : null}
        </div>
        {data ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Badge variant="outline">
              Page {data.page} / {data.total_pages || 1}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min((data.total_pages || p + 1), p + 1))}
              disabled={loading || page >= (data.total_pages || 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="overflow-hidden rounded-xl border-border shadow-sm">
        <div className="md:hidden">
          <DataList>
            {loading && !data ? <div className="px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading...</div> : null}
            {!loading && (data?.items?.length || 0) === 0 ? <div className="px-4 py-10 text-center text-sm text-muted-foreground">No results found for this range.</div> : null}
            {(data?.items || []).map((item) => <ListRow key={item.item_id} title={item.item_name || "Unnamed item"} description={item.category || "Uncategorised"} value={<div className="text-right"><p className="font-semibold tabular-nums">{Number(item.avg_prep_time_min || 0).toFixed(1)} min</p><p className="text-xs text-muted-foreground">{Number(item.total_orders || 0).toLocaleString()} orders</p></div>} />)}
          </DataList>
        </div>
        <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Avg Prep (min)</TableHead>
              <TableHead className="text-right">Total Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  Loading...
                </TableCell>
              </TableRow>
            ) : (data?.items?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                  No results found for the selected range.
                </TableCell>
              </TableRow>
            ) : (
              (data?.items || []).map((it) => (
                <TableRow key={it.item_id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{it.item_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{it.category || "—"}</TableCell>
                  <TableCell className="text-right">{Number(it.avg_prep_time_min || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(it.total_orders || 0).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>
    </AppPage>
  );
}
