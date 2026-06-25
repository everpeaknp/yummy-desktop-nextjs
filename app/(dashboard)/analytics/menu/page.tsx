"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ReceiptText,
  Layers3,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeDropdown, type DateRangePreset } from "@/components/ui/date-range-dropdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";

type MenuDetailItem = {
  id: number;
  name: string;
  category: string | null;
  revenue: number;
  quantity_sold: number;
  avg_sale_price: number;
};

type MenuDetailsResponse = {
  items: MenuDetailItem[];
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type StationModifierSummary = {
  modifier_id: number | null;
  modifier_name: string;
  quantity_sold: number;
  add_on_revenue: number;
};

type StationItemSummary = {
  menu_item_id: number | null;
  item_name: string;
  category_name: string | null;
  quantity_sold: number;
  revenue: number;
  avg_unit_price: number;
  order_count: number;
  modifiers: StationModifierSummary[];
};

type StationCategorySummary = {
  category_name: string;
  quantity_sold: number;
  revenue: number;
  order_count: number;
  items: StationItemSummary[];
};

type StationSummary = {
  station: string;
  quantity_sold: number;
  revenue: number;
  order_count: number;
  categories: StationCategorySummary[];
};

type MenuStationBreakdownResponse = {
  stations: StationSummary[];
  total_quantity_sold: number;
  total_revenue: number;
  total_orders: number;
};

type OrderTraceModifier = {
  modifier_id: number | null;
  modifier_name: string;
  price_adjustment: number;
};

type OrderTraceRow = {
  order_item_id: number;
  order_id: number;
  restaurant_order_id: number | null;
  sold_at: string | null;
  station: string;
  category_name: string | null;
  menu_item_id: number | null;
  item_name: string;
  quantity_sold: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
  modifiers: OrderTraceModifier[];
};

type OrderTraceResponse = {
  rows: OrderTraceRow[];
  total_items: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type ViewMode = "flat" | "station";

const STATIONS = ["kitchen", "bar", "cafe"] as const;

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default function AnalyticsMenuPage() {
  const user = useAuth((s) => s.user);
  const { ready, canViewAnalytics } = useAnalyticsViewAccess();
  const restaurant = useRestaurant((s) => s.restaurant);

  const restaurantId = restaurant?.id || user?.restaurant_id || null;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<MenuDetailsResponse | null>(null);
  const [breakdownData, setBreakdownData] = useState<MenuStationBreakdownResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [activeRange, setActiveRange] = useState<DateRangePreset>("last30");
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from, to: today };
  });

  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [station, setStation] = useState<string>("");
  const [sortBy, setSortBy] = useState<"revenue" | "quantity_sold" | "name" | "avg_price" | "category">("revenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const skipNextAutoFetchRef = useRef(false);

  const [selectedItem, setSelectedItem] = useState<StationItemSummary | null>(null);
  const [orderTraceOpen, setOrderTraceOpen] = useState(false);
  const [orderTraceLoading, setOrderTraceLoading] = useState(false);
  const [orderTraceData, setOrderTraceData] = useState<OrderTraceResponse | null>(null);
  const [orderTracePage, setOrderTracePage] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "pdf" | null>(null);

  const money = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  const resolvedDateRange = useMemo(() => {
    const now = new Date();
    const normalize = (input: Date) => {
      const copy = new Date(input);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const endOfDay = (input: Date) => {
      const copy = new Date(input);
      copy.setHours(23, 59, 59, 999);
      return copy;
    };

    if (activeRange === "today") {
      return { from: normalize(now), to: endOfDay(now) };
    }
    if (activeRange === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: normalize(y), to: endOfDay(y) };
    }
    if (activeRange === "last7") {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: normalize(from), to: endOfDay(now) };
    }
    if (activeRange === "last30") {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: normalize(from), to: endOfDay(now) };
    }
    if (activeRange === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: normalize(from), to: endOfDay(now) };
    }
    const from = date?.from ? new Date(date.from) : new Date(now);
    const to = date?.to ? new Date(date.to) : new Date(from);
    return { from, to };
  }, [activeRange, date]);

  const dateFrom = useMemo(() => yyyyMmDd(resolvedDateRange.from), [resolvedDateRange]);
  const dateTo = useMemo(() => yyyyMmDd(resolvedDateRange.to), [resolvedDateRange]);

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
      console.error("Failed to load menu categories:", e);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchFlatDetails = async (overrides?: { page?: number; category?: string; search?: string }) => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    const nextPage = overrides?.page ?? page;
    const nextCategory = overrides?.category ?? category;
    const nextSearch = overrides?.search ?? search;

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
      return;
    }
    throw new Error(res.data?.message || "Failed to load menu analytics details");
  };

  const fetchStationBreakdown = async (overrides?: { category?: string; search?: string; station?: string }) => {
    if (!restaurantId) {
      toast.error("Restaurant not set");
      return;
    }
    const nextCategory = overrides?.category ?? category;
    const nextSearch = overrides?.search ?? search;
    const nextStation = overrides?.station ?? station;

    const url = AnalyticsApis.menuStationBreakdown({
      restaurantId,
      dateFrom,
      dateTo,
      timezone,
      category: nextCategory.trim() || undefined,
      search: nextSearch.trim() || undefined,
      station: nextStation || undefined,
    });
    const res = await apiClient.get(url);
    if (res.data?.status === "success") {
      setBreakdownData(res.data.data);
      return;
    }
    throw new Error(res.data?.message || "Failed to load station breakdown");
  };

  const fetchOrderTrace = async (item: StationItemSummary, tracePage = 1) => {
    if (!restaurantId || !item.menu_item_id) return;

    setOrderTraceLoading(true);
    try {
      const url = AnalyticsApis.menuStationBreakdownOrders({
        restaurantId,
        menuItemId: item.menu_item_id,
        dateFrom,
        dateTo,
        timezone,
        category: category.trim() || undefined,
        search: search.trim() || undefined,
        station: station || undefined,
        page: tracePage,
        pageSize: 20,
      });
      const res = await apiClient.get(url);
      if (res.data?.status === "success") {
        setOrderTraceData(res.data.data);
      } else {
        throw new Error(res.data?.message || "Failed to load order trace");
      }
    } catch (e: any) {
      toast.error(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load order trace",
      );
    } finally {
      setOrderTraceLoading(false);
    }
  };

  const fetchActiveView = async (overrides?: { page?: number; category?: string; search?: string; station?: string }) => {
    if (!canViewAnalytics) {
      setFetchError("You do not have permission to view analytics.");
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      if (viewMode === "flat") {
        await fetchFlatDetails(overrides);
      } else {
        await fetchStationBreakdown(overrides);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load menu analytics";
      setFetchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canViewAnalytics || !restaurantId) return;
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return;
    }
    fetchActiveView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canViewAnalytics, restaurantId, dateFrom, dateTo, sortBy, sortDir, pageSize, page, category, station, viewMode]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    if (!selectedItem || !orderTraceOpen) return;
    fetchOrderTrace(selectedItem, orderTracePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, orderTraceOpen, orderTracePage]);

  const applySearch = () => {
    const nextPage = 1;
    skipNextAutoFetchRef.current = true;
    setPage(nextPage);
    fetchActiveView({ page: nextPage });
  };

  const selectCategory = (nextCategory: string) => {
    const resolvedCategory = nextCategory === category ? "" : nextCategory;
    skipNextAutoFetchRef.current = true;
    setCategory(resolvedCategory);
    setPage(1);
    fetchActiveView({ page: 1, category: resolvedCategory });
  };

  const selectStation = (nextStation: string) => {
    const resolvedStation = nextStation === station ? "" : nextStation;
    skipNextAutoFetchRef.current = true;
    setStation(resolvedStation);
    fetchActiveView({ station: resolvedStation });
  };

  const openTrace = (item: StationItemSummary) => {
    if (!item.menu_item_id) {
      toast.error("This item does not have a menu item id for drilldown.");
      return;
    }
    setSelectedItem(item);
    setOrderTracePage(1);
    setOrderTraceData(null);
    setOrderTraceOpen(true);
  };

  const stationCards = breakdownData?.stations || [];

  const exportActiveView = async (format: "xlsx" | "pdf") => {
    try {
      setExportingFormat(format);
      if (viewMode === "flat") {
        const rows = (data?.items || []).map((item) => ({
          Item: item.name,
          Category: item.category || "",
          "Qty Sold": item.quantity_sold,
          "Avg Price": item.avg_sale_price,
          Revenue: item.revenue,
          "Date From": dateFrom,
          "Date To": dateTo,
        }));
        if (!rows.length) {
          toast.error("No flat view rows to export.");
          return;
        }
        if (format === "xlsx") {
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Menu Flat View");
          XLSX.writeFile(wb, `menu-flat-view-${dateFrom}-to-${dateTo}.xlsx`);
        } else {
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ unit: "pt", format: "a4" });
          let y = 40;
          pdf.setFontSize(16);
          pdf.text("Menu Analytics - Flat View", 40, y);
          y += 18;
          pdf.setFontSize(10);
          pdf.text(`Range: ${dateFrom} to ${dateTo}`, 40, y);
          y += 24;
          rows.forEach((row, index) => {
            if (y > 760) {
              pdf.addPage();
              y = 40;
            }
            pdf.setFontSize(11);
            pdf.text(`${index + 1}. ${row.Item}`, 40, y);
            y += 14;
            pdf.setFontSize(9);
            pdf.text(
              `Category: ${row.Category || "-"} | Qty: ${row["Qty Sold"]} | Avg: Rs. ${money.format(Number(row["Avg Price"] || 0))} | Revenue: Rs. ${money.format(Number(row.Revenue || 0))}`,
              52,
              y,
            );
            y += 18;
          });
          pdf.save(`menu-flat-view-${dateFrom}-to-${dateTo}.pdf`);
        }
        toast.success(`Flat view exported as ${format.toUpperCase()}.`);
        return;
      }

      const rows =
        breakdownData?.stations.flatMap((stationRow) =>
          stationRow.categories.flatMap((categoryRow) =>
            categoryRow.items.map((item) => ({
              Station: titleCase(stationRow.station),
              Category: categoryRow.category_name,
              Item: item.item_name,
              "Qty Sold": item.quantity_sold,
              Revenue: item.revenue,
              "Avg Unit Price": item.avg_unit_price,
              Orders: item.order_count,
              Modifiers: item.modifiers.map((modifier) => `${modifier.modifier_name} (${modifier.quantity_sold})`).join(", "),
              "Modifier Revenue": item.modifiers.reduce((sum, modifier) => sum + Number(modifier.add_on_revenue || 0), 0),
              "Date From": dateFrom,
              "Date To": dateTo,
            })),
          ),
        ) || [];

      if (!rows.length) {
        toast.error("No station breakdown rows to export.");
        return;
      }
      if (format === "xlsx") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Menu Station Breakdown");
        XLSX.writeFile(wb, `menu-station-breakdown-${dateFrom}-to-${dateTo}.xlsx`);
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        let y = 40;
        pdf.setFontSize(16);
        pdf.text("Menu Analytics - Station Breakdown", 40, y);
        y += 18;
        pdf.setFontSize(10);
        pdf.text(`Range: ${dateFrom} to ${dateTo}`, 40, y);
        y += 24;
        rows.forEach((row, index) => {
          if (y > 760) {
            pdf.addPage();
            y = 40;
          }
          pdf.setFontSize(11);
          pdf.text(`${index + 1}. ${row.Item}`, 40, y);
          y += 14;
          pdf.setFontSize(9);
          pdf.text(
            `Station: ${row.Station} | Category: ${row.Category} | Qty: ${row["Qty Sold"]} | Revenue: Rs. ${money.format(Number(row.Revenue || 0))} | Orders: ${row.Orders}`,
            52,
            y,
          );
          y += 12;
          const modifierText = row.Modifiers ? `Modifiers: ${row.Modifiers}` : "Modifiers: -";
          pdf.text(modifierText, 52, y);
          y += 18;
        });
        pdf.save(`menu-station-breakdown-${dateFrom}-to-${dateTo}.pdf`);
      }
      toast.success(`Station breakdown exported as ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  if (!ready) return <AnalyticsAccessLoading />;
  if (!canViewAnalytics) return <AnalyticsAccessDenied />;

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-6">
      {fetchError ? (
        <AnalyticsFetchError message={fetchError} onRetry={() => fetchActiveView()} />
      ) : null}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/analytics">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Menu Analytics</h1>
            <p className="text-muted-foreground">
              Switch between flat menu totals and station-wise sales drilldown.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchActiveView()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportActiveView("xlsx")} disabled={!!exportingFormat || loading}>
            {exportingFormat === "xlsx" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export XLSX
          </Button>
          <Button variant="outline" onClick={() => exportActiveView("pdf")} disabled={!!exportingFormat || loading}>
            {exportingFormat === "pdf" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
        <TabsList className="grid w-full max-w-[480px] grid-cols-2">
          <TabsTrigger value="flat">Flat View</TabsTrigger>
          <TabsTrigger value="station">Station Breakdown</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            {viewMode === "flat"
              ? "Classic item leaderboard for the selected range."
              : "Operational drilldown grouped by station, category, item, and modifiers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Date range</Label>
            <DateRangeDropdown
              activeRange={activeRange}
              setActiveRange={(range) => {
                setPage(1);
                setActiveRange(range);
              }}
              date={date}
              setDate={(nextDate) => {
                setPage(1);
                setDate(nextDate);
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={viewMode === "flat" ? "Item name..." : "Search item for breakdown..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>
          </div>

          {viewMode === "flat" ? (
            <>
              <div className="space-y-2 md:col-span-1">
                <Label>Sort</Label>
                <Select value={sortBy} onValueChange={(v) => { setPage(1); setSortBy(v as any); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="quantity_sold">Quantity</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
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
            </>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>Station</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectStation("")}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                    !station
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                  )}
                >
                  All Stations
                </button>
                {STATIONS.map((stationName) => (
                  <button
                    key={stationName}
                    type="button"
                    onClick={() => selectStation(stationName)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                      station === stationName
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
                    )}
                  >
                    {titleCase(stationName)}
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {viewMode === "flat" ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Results</h2>
              {data ? <Badge variant="outline">{data.total_items.toLocaleString()} items</Badge> : null}
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
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-2xl">Rs. {money.format(Number(breakdownData?.total_revenue || 0))}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardDescription>Total Qty Sold</CardDescription>
                <CardTitle className="text-2xl">{Number(breakdownData?.total_quantity_sold || 0).toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardDescription>Distinct Orders</CardDescription>
                <CardTitle className="text-2xl">{Number(breakdownData?.total_orders || 0).toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardDescription>Stations In Scope</CardDescription>
                <CardTitle className="text-2xl">{stationCards.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {loading && !breakdownData ? (
            <Card className="border-border">
              <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading station breakdown...
              </CardContent>
            </Card>
          ) : stationCards.length === 0 ? (
            <Card className="border-border">
              <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                No station breakdown data found for the selected range.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {stationCards.map((stationRow) => (
                <Card key={stationRow.station} className="border-border overflow-hidden">
                  <CardHeader className="border-b border-border/60 bg-muted/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-xl">{titleCase(stationRow.station)}</CardTitle>
                        <CardDescription>
                          {stationRow.categories.length} categories, {stationRow.order_count.toLocaleString()} orders
                        </CardDescription>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm md:min-w-[340px]">
                        <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
                          <div className="text-muted-foreground">Revenue</div>
                          <div className="font-semibold">Rs. {money.format(stationRow.revenue)}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
                          <div className="text-muted-foreground">Qty</div>
                          <div className="font-semibold">{stationRow.quantity_sold.toLocaleString()}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
                          <div className="text-muted-foreground">Orders</div>
                          <div className="font-semibold">{stationRow.order_count.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-4">
                    {stationRow.categories.map((categoryRow) => (
                      <div key={`${stationRow.station}-${categoryRow.category_name}`} className="rounded-2xl border border-border/70 bg-card/60">
                        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                              <Layers3 className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-semibold">{categoryRow.category_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {categoryRow.items.length} items, {categoryRow.order_count.toLocaleString()} orders
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <Badge variant="outline">Qty {categoryRow.quantity_sold.toLocaleString()}</Badge>
                            <Badge variant="outline">Revenue Rs. {money.format(categoryRow.revenue)}</Badge>
                          </div>
                        </div>
                        <div className="divide-y divide-border/50">
                          {categoryRow.items.map((item) => (
                            <div key={`${stationRow.station}-${categoryRow.category_name}-${item.menu_item_id ?? item.item_name}`} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-3">
                                <div>
                                  <div className="font-semibold">{item.item_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Qty {item.quantity_sold.toLocaleString()} · Orders {item.order_count.toLocaleString()} · Avg Rs. {money.format(item.avg_unit_price)}
                                  </div>
                                </div>
                                {item.modifiers.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {item.modifiers.map((modifier) => (
                                      <Badge key={`${item.menu_item_id}-${modifier.modifier_id ?? modifier.modifier_name}`} variant="secondary" className="rounded-full px-3 py-1">
                                        {modifier.modifier_name} · {modifier.quantity_sold} · Rs. {money.format(modifier.add_on_revenue)}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">No modifiers or add-ons recorded.</div>
                                )}
                              </div>
                              <div className="flex min-w-[220px] flex-col items-start gap-3 lg:items-end">
                                <div className="text-right">
                                  <div className="text-sm text-muted-foreground">Revenue</div>
                                  <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                                    Rs. {money.format(item.revenue)}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => openTrace(item)}
                                  disabled={!item.menu_item_id}
                                  className="w-full lg:w-auto"
                                >
                                  <ReceiptText className="mr-2 h-4 w-4" />
                                  View Order Trace
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={orderTraceOpen} onOpenChange={setOrderTraceOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedItem?.item_name || "Order Trace"}</SheetTitle>
            <SheetDescription>
              Exact sold orders for the selected item in the current station/category/date scope.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {selectedItem ? (
              <div className="grid gap-3 md:grid-cols-4">
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Revenue</div>
                    <div className="mt-1 font-semibold">Rs. {money.format(selectedItem.revenue)}</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Qty</div>
                    <div className="mt-1 font-semibold">{selectedItem.quantity_sold.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Orders</div>
                    <div className="mt-1 font-semibold">{selectedItem.order_count.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Avg Price</div>
                    <div className="mt-1 font-semibold">Rs. {money.format(selectedItem.avg_unit_price)}</div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <Card className="border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead>Modifiers / Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderTraceLoading && !orderTraceData ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                        Loading order trace...
                      </TableCell>
                    </TableRow>
                  ) : (orderTraceData?.rows?.length || 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No order trace rows found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (orderTraceData?.rows || []).map((row) => (
                      <TableRow key={row.order_item_id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.sold_at ? dateTime.format(new Date(row.sold_at)) : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.restaurant_order_id ? `#${row.restaurant_order_id}` : `Order ${row.order_id}`}
                        </TableCell>
                        <TableCell>{titleCase(row.station)}</TableCell>
                        <TableCell className="text-right">{row.quantity_sold.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">Rs. {money.format(row.line_total)}</TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {row.modifiers.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {row.modifiers.map((modifier) => (
                                  <Badge key={`${row.order_item_id}-${modifier.modifier_id ?? modifier.modifier_name}`} variant="secondary">
                                    {modifier.modifier_name}
                                    {modifier.price_adjustment ? ` · Rs. ${money.format(modifier.price_adjustment)}` : ""}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No modifiers</div>
                            )}
                            {row.notes ? <div className="text-sm text-muted-foreground">{row.notes}</div> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            {orderTraceData ? (
              <div className="flex items-center justify-between">
                <Badge variant="outline">
                  {orderTraceData.total_items.toLocaleString()} matching rows
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrderTracePage((p) => Math.max(1, p - 1))}
                    disabled={orderTraceLoading || orderTracePage <= 1}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Button>
                  <Badge variant="outline">
                    Page {orderTraceData.page} / {orderTraceData.total_pages || 1}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrderTracePage((p) => Math.min(orderTraceData.total_pages || p + 1, p + 1))}
                    disabled={orderTraceLoading || orderTracePage >= (orderTraceData.total_pages || 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
