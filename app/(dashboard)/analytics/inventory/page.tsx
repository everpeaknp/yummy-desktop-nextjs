"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
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

  const fetchDetails = async () => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    setLoading(true);
    try {
      const url = AnalyticsApis.inventoryDetails({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        page,
        pageSize,
        view,
      });

      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load inventory analytics details");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load inventory analytics details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && restaurantId) fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, restaurantId, dateFrom, dateTo, view, pageSize, page]);

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
            <h1 className="text-2xl font-bold tracking-tight">Inventory Analytics</h1>
            <p className="text-muted-foreground">Expense spend grouped by vendor or category.</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchDetails} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Purchase To Sales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data ? `${Number(data.purchase_to_sales_pct || 0).toFixed(2)}%` : "—"}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Wastage</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data ? `${Number(data.wastage_pct || 0).toFixed(2)}%` : "—"}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Groups</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {data ? Number(data.total_items || 0).toLocaleString() : "—"}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
        </CardContent>
      </Card>

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

      <Card className="border-border shadow-sm overflow-hidden">
        <Table>
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
        </Table>
      </Card>
    </div>
  );
}
