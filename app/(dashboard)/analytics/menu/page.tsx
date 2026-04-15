"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

import apiClient from "@/lib/api-client";
import { AnalyticsApis, ItemCategoryApis } from "@/lib/api/endpoints";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type MenuDetailItem = {
  id: number;
  name: string;
  category: string | null;
  revenue: number;
  quantity_sold: number;
  avg_sale_price: number;
  trend_pct?: number;
  margin_pct?: number | null;
};

type MenuDetailsResponse = {
  items: MenuDetailItem[];
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
};

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AnalyticsMenuPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);
  const { restaurant } = useRestaurant();

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MenuDetailsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return yyyyMmDd(d);
  });
  const [dateTo, setDateTo] = useState(() => yyyyMmDd(today));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "quantity_sold" | "name" | "avg_price">("revenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const skipNextAutoFetchRef = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      if (!user && !token) router.push("/");
      setAuthLoading(false);
    };
    checkAuth();
  }, [user, me, router]);

  const money = useMemo(() => {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  }, []);

  const fetchCategories = async () => {
    if (!restaurantId) return;

    setCategoriesLoading(true);
    try {
      const res = await apiClient.get(ItemCategoryApis.getItemCategories(restaurantId));
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const names = Array.from(
        new Set(
          list
            .map((item: any) => String(item?.name || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));
      setCategories(names);
    } catch (e) {
      console.error("Failed to load menu categories:", e);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchDetails = async (overrides?: { page?: number; category?: string; search?: string }) => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }

    const nextPage = overrides?.page ?? page;
    const nextCategory = overrides?.category ?? category;
    const nextSearch = overrides?.search ?? search;

    setLoading(true);
    try {
      const url = AnalyticsApis.menuDetails({
        restaurantId,
        dateFrom,
        dateTo,
        timezone,
        page: nextPage,
        pageSize,
        sortBy,
        sortDir,
        search: nextSearch.trim() || undefined,
        category: nextCategory.trim() || undefined,
      });

      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load menu analytics details");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load menu analytics details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && restaurantId) {
      if (skipNextAutoFetchRef.current) {
        skipNextAutoFetchRef.current = false;
        return;
      }
      fetchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, restaurantId, dateFrom, dateTo, sortBy, sortDir, pageSize, page, category]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const applySearch = () => {
    const nextPage = 1;
    skipNextAutoFetchRef.current = true;
    setPage(nextPage);
    fetchDetails({ page: nextPage });
  };

  const selectCategory = (nextCategory: string) => {
    const resolvedCategory = nextCategory === category ? "" : nextCategory;
    const nextPage = 1;
    skipNextAutoFetchRef.current = true;
    setCategory(resolvedCategory);
    setPage(nextPage);
    fetchDetails({ page: nextPage, category: resolvedCategory });
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
            <h1 className="text-2xl font-bold tracking-tight">Menu Analytics</h1>
            <p className="text-muted-foreground">Sales performance by menu item.</p>
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
            <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Item name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Sort</Label>
            <Select value={sortBy} onValueChange={(v) => { setPage(1); setSortBy(v as any); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="quantity_sold">Quantity</SelectItem>
                <SelectItem value="avg_price">Avg Price</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Direction</Label>
            <Select value={sortDir} onValueChange={(v) => { setPage(1); setSortDir(v as any); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
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

          <div className="md:col-span-1 flex items-end">
            <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" onClick={applySearch} disabled={loading}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => selectCategory("")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                !category
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
              )}
            >
              All
            </button>
            {categoriesLoading ? (
              <div className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground whitespace-nowrap">
                Loading categories...
              </div>
            ) : categories.length > 0 ? (
              categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                    category === cat
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                  )}
                >
                  {cat}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">
                No categories found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Results</h2>
          {data ? (
            <Badge variant="outline">
              {data.total_items.toLocaleString()} items
            </Badge>
          ) : null}
        </div>
        {data ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={loading || page <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <Badge variant="outline">
              Page {data.page} / {data.total_pages}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min((data.total_pages || p + 1), p + 1))}
              disabled={loading || page >= data.total_pages}
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
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty Sold</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
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
            ) : (data?.items?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                  No results found for the selected range.
                </TableCell>
              </TableRow>
            ) : (
              (data?.items || []).map((it) => (
                <TableRow key={it.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-muted-foreground">{it.category || "—"}</TableCell>
                  <TableCell className="text-right">{Number(it.quantity_sold || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">Rs. {money.format(Number(it.avg_sale_price || 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    Rs. {money.format(Number(it.revenue || 0))}
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
