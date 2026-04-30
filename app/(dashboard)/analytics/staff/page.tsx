"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";

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

type StaffDetail = {
  id: number;
  name: string;
  email: string;
  revenue: number;
  orders_count: number;
  avg_order_value: number;
};

type StaffDetailsResponse = {
  staff: StaffDetail[];
  total_staff: number;
  page: number;
  page_size: number;
  total_pages: number;
};

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AnalyticsStaffPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StaffDetailsResponse | null>(null);

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
  const [search, setSearch] = useState("");

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
      const url = AnalyticsApis.staffDetails({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        page,
        pageSize,
        businessLine: showBusinessLine && businessLine !== "all" ? businessLine : undefined,
      });

      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load staff analytics details");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load staff analytics details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && restaurantId) fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, restaurantId, dateFrom, dateTo, businessLine, pageSize, page]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.staff || [];
    return (data?.staff || []).filter((s) => {
      return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
    });
  }, [data, search]);

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
            <h1 className="text-2xl font-bold tracking-tight">Staff Analytics</h1>
            <p className="text-muted-foreground">Revenue and orders by staff.</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchDetails} disabled={loading}>
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
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
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

          <div className="space-y-2 md:col-span-1">
            <Label>Business Line</Label>
            <Select
              value={businessLine}
              onValueChange={(v) => {
                setPage(1);
                setBusinessLine(v);
              }}
              disabled={!showBusinessLine}
            >
              <SelectTrigger>
                <SelectValue placeholder={showBusinessLine ? "All" : "All"} />
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          {data ? (
            <Badge variant="outline">{data.total_staff.toLocaleString()} staff</Badge>
          ) : null}
          {search.trim() && data ? (
            <Badge variant="secondary">{visibleRows.length.toLocaleString()} shown</Badge>
          ) : null}
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
              <TableHead>Staff</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Avg Order</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  Loading...
                </TableCell>
              </TableRow>
            ) : (visibleRows?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                  No results found for the selected range.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{s.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email || "—"}</TableCell>
                  <TableCell className="text-right">{Number(s.orders_count || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">Rs. {money.format(Number(s.avg_order_value || 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    Rs. {money.format(Number(s.revenue || 0))}
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
