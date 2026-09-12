"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { useRestaurant } from "@/hooks/use-restaurant";
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
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { ReportFilters } from "@/components/reports/report-filters";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { toast } from "sonner";

type InventoryItemDetail = {
  id: number;
  name: string;
  category: string | null;
  supplier_name: string;
  total_quantity: number;
  total_cost: number;
  purchase_count: number;
};

type InventoryDetailsResponse = {
  items: InventoryItemDetail[];
  purchase_to_sales_pct: number;
  wastage_pct: number;
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
};

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AnalyticsInventoryPage() {
  const user = useAuth((s) => s.user);
  const { ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<InventoryDetailsResponse | null>(null);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return yyyyMmDd(d);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(today));

  const [view, setView] = useState<"item" | "category">("item");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const money = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);

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
      const url = AnalyticsApis.inventoryDetails({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        page,
        pageSize,
        view,
        businessLine: "all",
      });

      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        const message = res.data?.message || "Failed to load inventory analytics details";
        setFetchError(message);
        toast.error(message);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load inventory analytics details";
      setFetchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canViewAnalytics || !restaurantId) return;
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canViewAnalytics, restaurantId, dateFrom, dateTo, view, pageSize, page]);

  if (!ready) return <AnalyticsAccessLoading />;
  if (!canViewAnalytics) return <AnalyticsAccessDenied />;

  return (
    <AppPage width="wide" className="pb-20">
      {fetchError ? (
        <AnalyticsFetchError message={fetchError} onRetry={fetchDetails} />
      ) : null}
      <PageHeader title="Inventory analytics" description="Track purchase cost by vendor or category." />

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Card className="border-border">
          <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
            <CardTitle className="text-sm text-muted-foreground">Expense To Sales</CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-lg font-semibold tabular-nums sm:p-4">
            {data ? `${Number(data.purchase_to_sales_pct || 0).toFixed(2)}%` : "—"}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
            <CardTitle className="text-sm text-muted-foreground">Groups</CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-lg font-semibold tabular-nums sm:p-4">
            {data ? Number(data.total_items || 0).toLocaleString() : "—"}
          </CardContent>
        </Card>
      </div>

      <ReportFilters title="Inventory filters" activeCount={Number(view !== "item")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-2 md:col-span-1">
            <Label>From</Label>
            <Input
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
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Group By</Label>
            <Select
              value={view}
              onValueChange={(v) => {
                setPage(1);
                setView(v as any);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item">Vendor</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Page Size</Label>
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(1); setPageSize(Number(v)); }}>
              <SelectTrigger>
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
        </div>
      </ReportFilters>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          {data ? <Badge variant="outline">{data.total_items.toLocaleString()} groups</Badge> : null}
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

      <Card className="overflow-hidden border-border shadow-sm">
        <DataList className="rounded-none border-x-0 border-y-0 md:hidden">
          {(data?.items || []).map((it) => (
            <ListRow key={it.id} title={it.name || "Unnamed"} description={it.category || "Uncategorized"} meta={`${Number(it.purchase_count || 0).toLocaleString()} purchases`} trailing={<span className="font-semibold tabular-nums">Rs. {money.format(Number(it.total_cost || 0))}</span>} />
          ))}
        </DataList>
        <div className="hidden md:block"><Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>{view === "category" ? "Category" : "Vendor"}</TableHead>
              <TableHead>Expense Category</TableHead>
              <TableHead className="text-right">Purchases</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
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
                <TableRow key={it.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{it.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{it.category || "—"}</TableCell>
                  <TableCell className="text-right">{Number(it.purchase_count || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    Rs. {money.format(Number(it.total_cost || 0))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </Card>
    </AppPage>
  );
}
