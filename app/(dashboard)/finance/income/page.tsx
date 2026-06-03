"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { IncomeApis, ExpenseApis, AnalyticsApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign, TrendingUp, Receipt, Download, ArrowLeft, TrendingDown, Utensils, Hotel, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
// import * as XLSX from "xlsx"; // Removed for optimization
import Link from "next/link";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { PaymentMethodBreakdown } from "@/components/analytics/payment-method-breakdown";
import { mapIncomeDashboardPaymentMix } from "@/lib/finance-payment-mix";
import { getFinanceDateRange, type FinanceDateFilter } from "@/lib/finance-query";
import { useSyncInvalidation } from "@/hooks/use-sync-invalidation";


export default function IncomePage() {
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>("this_month");
  const [selectedStation, setSelectedStation] = useState("all");
  const [businessLine, setBusinessLine] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("00:00");
  const [customEndTime, setCustomEndTime] = useState("23:59");
  const [recentLimit, setRecentLimit] = useState(25);

  const restaurant = useRestaurant((s) => s.restaurant);

  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && token) await me();
      if (!user && !token) router.push('/');
    };
    checkAuth();
  }, [user, me, router]);

  const fetchData = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    setTrendsLoading(true);
    const { start, end } = getFinanceDateRange(dateFilter, {
      startDate: customStartDate,
      endDate: customEndDate,
    });
    const stationParam = selectedStation === 'all' ? undefined : selectedStation;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const dashboardUrl = IncomeApis.dashboard({
        restaurantId: user.restaurant_id,
        dateFrom: start,
        dateTo: end,
        station: stationParam,
        businessLine: businessLine === 'all' ? undefined : businessLine,
        timezone: tz
      });

      const [dashboardRes, recentRes, expenseSummaryRes] = await Promise.all([
        apiClient.get(dashboardUrl),
        apiClient.get(IncomeApis.recent, {
          params: { 
            restaurant_id: user.restaurant_id, 
            date_from: start, 
            date_to: end, 
            station: stationParam,
            business_line: businessLine === 'all' ? undefined : businessLine,
            limit: recentLimit,
            timezone: tz
          }
        }),
        apiClient.get(ExpenseApis.summaryTotal, {
          params: {
            restaurant_id: user.restaurant_id,
            date_from: start,
            date_to: end,
            station: stationParam,
            business_line: businessLine === 'all' ? undefined : businessLine,
            timezone: tz
          }
        })
      ]);

      if (dashboardRes.data.status === 'success') {
        setIncomeData((prev: any) => ({ ...prev, ...dashboardRes.data.data }));
      }
      if (recentRes.data.status === 'success') {
        setIncomeData((prev: any) => ({ ...prev, recent_entries: recentRes.data.data }));
      }
      if (expenseSummaryRes.data.status === 'success') {
        setExpenseSummary(expenseSummaryRes.data.data);
      }

      // Fetch trends asynchronously to ensure main finance page loads instantly
      try {
        let startTimeVal: string | undefined = undefined;
        let endTimeVal: string | undefined = undefined;

        if (dateFilter === 'custom') {
          const startDateStr = customStartDate || new Date().toISOString().split('T')[0];
          const endDateStr = customEndDate || new Date().toISOString().split('T')[0];
          const startTimeStr = customStartTime || "00:00";
          const endTimeStr = customEndTime || "23:59";
          
          try {
            const startLocal = new Date(`${startDateStr}T${startTimeStr}:00`);
            const endLocal = new Date(`${endDateStr}T${endTimeStr}:59`);
            if (!isNaN(startLocal.getTime())) {
              startTimeVal = startLocal.toISOString();
            }
            if (!isNaN(endLocal.getTime())) {
              endTimeVal = endLocal.toISOString();
            }
          } catch (e) {
            console.error("Failed to parse custom dates", e);
          }
        }

        const trendsUrl = AnalyticsApis.trends({
          metric: 'income',
          restaurantId: user.restaurant_id,
          dateFrom: dateFilter === 'custom' ? undefined : start,
          dateTo: dateFilter === 'custom' ? undefined : end,
          startTime: startTimeVal,
          endTime: endTimeVal,
          station: stationParam,
          timezone: tz
        });
        const trendsRes = await apiClient.get(trendsUrl);
        if (trendsRes.data.status === 'success') {
          setTrendsData(trendsRes.data.data);
        }
      } catch (trendErr) {
        console.error("Failed to fetch income trend history:", trendErr);
      }
    } catch (err) {
      console.error("Failed to fetch income data:", err);
    } finally {
      setLoading(false);
      setTrendsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.restaurant_id) {
      fetchData();
    }
  }, [user, selectedStation, dateFilter, businessLine, recentLimit, customStartDate, customEndDate, customStartTime, customEndTime]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useSyncInvalidation(
    ["finance", "analytics", "day-close", "transactions"],
    () => {
      void fetchDataRef.current();
    },
    [user?.restaurant_id]
  );

  const handleExport = async () => {
    if (!incomeData?.recent_entries?.length) return;
    const XLSX = await import("xlsx");
    const dataToExport = incomeData.recent_entries.map((entry: any) => {
      const isOrder = !!(entry.order_id || entry.orderId);
      const orderId = entry.order_id || entry.orderId;
      const orderNumber = entry.order_number || entry.orderNumber;
      const source = entry.source || entry.channel || "Dine-in";

      let displayDescription = "Manual Entry";
      if (isOrder) {
        displayDescription = `Order #${orderNumber || orderId} (${source})`;
      } else if (entry.description && entry.description !== "Manual Entry") {
        displayDescription = entry.description;
      } else if (entry.name || entry.title || entry.source_name || entry.notes) {
        displayDescription = entry.name || entry.title || entry.source_name || entry.notes;
      }

      return {
        "Description": displayDescription,
        "Amount": entry.amount,
        "Date": new Date(entry.paid_at).toLocaleDateString(),
        "Source": entry.source || "Day Close",
        "Payment Method": entry.payment_method || "-"
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income");
    XLSX.writeFile(wb, `Income_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Map income by source data for the Pie Chart
  const sourcePieData = (incomeData?.by_source || []).map((item: any) => ({
    name: item.source.replace('_', ' ').toUpperCase(),
    value: item.amount
  }));

  // Map daily trends data for the Area/Line Trend Chart
  const trendChartData = (trendsData || []).map((point: any) => ({
    ...point,
    value: point.income,
    revenue: point.income
  }));

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto p-6">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4">
            <Link href="/manage">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500">Income</h1>
              <p className="text-muted-foreground whitespace-nowrap">Track sales revenue and cash flow.</p>
            </div>
            <Link href="/finance/expenses">
              <Button variant="outline" size="sm" className="hidden sm:flex border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:hover:bg-red-950/20 gap-2">
                <TrendingDown className="h-4 w-4" />
                View Expenses
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            {restaurant?.hotel_enabled && (
               <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
                 <Button
                   variant={businessLine === 'all' ? 'secondary' : 'ghost'}
                   size="sm"
                   className={cn("h-8 px-3 text-xs gap-2", businessLine === 'all' && "bg-background shadow-sm")}
                   onClick={() => setBusinessLine('all')}
                 >
                   All
                 </Button>
                 <Button
                   variant={businessLine === 'restaurant' ? 'secondary' : 'ghost'}
                   size="sm"
                   className={cn("h-8 px-3 text-xs gap-2", businessLine === 'restaurant' && "bg-background shadow-sm")}
                   onClick={() => setBusinessLine('restaurant')}
                 >
                   <Utensils className="h-3.5 w-3.5 text-orange-500" />
                   Restaurant
                 </Button>
                 <Button
                   variant={businessLine === 'hotel' ? 'secondary' : 'ghost'}
                   size="sm"
                   className={cn("h-8 px-3 text-xs gap-2", businessLine === 'hotel' && "bg-background shadow-sm")}
                   onClick={() => setBusinessLine('hotel')}
                 >
                   <Hotel className="h-3.5 w-3.5 text-blue-500" />
                   Hotel
                 </Button>
               </div>
            )}

            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                <SelectItem value="kitchen">Kitchen</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="cafe">Cafe</SelectItem>
                {restaurant?.hotel_enabled && (
                  <SelectItem value="rooms">Rooms / Hotel</SelectItem>
                )}
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as FinanceDateFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end w-full animate-in fade-in slide-in-from-top-1 duration-200 bg-muted/30 p-3 rounded-xl border border-border">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Time Slice:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="flex h-9 w-[130px] rounded-md border border-input bg-background dark:bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="time"
              value={customStartTime}
              onChange={(e) => setCustomStartTime(e.target.value || "00:00")}
              className="flex h-9 w-[100px] rounded-md border border-input bg-background dark:bg-muted/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground font-semibold px-1">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="flex h-9 w-[130px] rounded-md border border-input bg-background dark:bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <input
              type="time"
              value={customEndTime}
              onChange={(e) => setCustomEndTime(e.target.value || "23:59")}
              className="flex h-9 w-[100px] rounded-md border border-input bg-background dark:bg-muted/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard
              label="Total Revenue"
              value={incomeData?.summary?.total_net_income || 0}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-emerald-500"
              bg="bg-emerald-50 dark:bg-emerald-950/20"
            />
            <MetricCard
              label="Gross Sales"
              value={incomeData?.summary?.gross_sales || 0}
              icon={<Receipt className="w-5 h-5" />}
              color="text-indigo-500"
              bg="bg-indigo-50 dark:bg-indigo-950/20"
            />
            <MetricCard
              label="Total Expenses"
              value={expenseSummary?.total_amount || 0}
              icon={<TrendingDown className="w-5 h-5" />}
              color="text-red-500"
              bg="bg-red-50 dark:bg-red-950/20"
              href="/finance/expenses"
            />
          </div>

          {/* Credit Receivables, Cash vs Digital Collections breakdown (Mobile alignment) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Credit sales & Receivables snapshots */}
             <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                   <div className="flex justify-between items-center pb-2 border-b border-border/40">
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                         <CreditCard className="w-4 h-4 text-blue-500" />
                         Credit Exposure & Receivables
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Staging status</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3.5 flex flex-col justify-between">
                         <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-1">Credit Sales (Period)</span>
                         <span className="text-xl font-bold">Rs. {Number(incomeData?.receivables?.credit_sales ?? 0).toLocaleString()}</span>
                         <span className="text-[9px] text-muted-foreground font-medium mt-1">{incomeData?.receivables?.credit_orders_count ?? 0} credit bills</span>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 flex flex-col justify-between">
                         <span className="text-[9px] font-black text-red-500 uppercase tracking-wider mb-1">Total Outstanding exposed</span>
                         <span className="text-xl font-bold text-red-600 dark:text-red-400">Rs. {Number(incomeData?.receivables?.total_outstanding ?? 0).toLocaleString()}</span>
                         <span className="text-[9px] text-muted-foreground font-medium mt-1">Outstanding credit book</span>
                      </div>
                   </div>
                </CardContent>
             </Card>

             <PaymentMethodBreakdown
               title="Income by Payment Method"
               description="From income dashboard aggregates (card/digital include instruments)."
               mix={mapIncomeDashboardPaymentMix(
                 incomeData?.by_payment_method,
                 incomeData?.by_payment_instrument
               )}
             />
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
             <div className="lg:col-span-3 flex flex-col h-full">
                <CategoryPieChart 
                  data={sourcePieData} 
                  loading={loading}
                  title="Income by Source"
                  description="Distribution of sales across different channels & manual entries."
                />
             </div>
             <div className="lg:col-span-4 flex flex-col h-full">
                <RevenueChart 
                  data={trendChartData} 
                  loading={trendsLoading}
                />
             </div>
          </div>

          <Card className="border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold">Recent Income Entries</h3>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!incomeData?.recent_entries?.length}>
                <Download className="w-4 h-4 mr-2" /> Export Excel
              </Button>
            </div>
            <CardContent className="p-0">
              {!incomeData?.recent_entries?.length ? (
                <div className="p-8 text-center text-muted-foreground">
                  No recent income entries found for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                      <tr>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {incomeData.recent_entries.filter((entry: any) => {
                        if (dateFilter !== 'custom') return true;
                        try {
                          const paidDate = new Date(entry.paid_at);
                          const startLocal = new Date(`${customStartDate || new Date().toISOString().split('T')[0]}T${customStartTime || "00:00"}:00`);
                          const endLocal = new Date(`${customEndDate || new Date().toISOString().split('T')[0]}T${customEndTime || "23:59"}:59`);
                          return paidDate >= startLocal && paidDate <= endLocal;
                        } catch (e) {
                          return true;
                        }
                      }).map((entry: any, idx: number) => {
                        const isOrder = !!(entry.order_id || entry.orderId);
                        const orderId = entry.order_id || entry.orderId;
                        const orderNumber = entry.order_number || entry.orderNumber;
                        const source = entry.source || entry.channel || "Dine-in";

                        let displayDescription = "Manual Entry";
                        if (isOrder) {
                          displayDescription = `Order #${orderNumber || orderId} (${source})`;
                        } else if (entry.description && entry.description !== "Manual Entry") {
                          displayDescription = entry.description;
                        } else if (entry.name || entry.title || entry.source_name || entry.notes) {
                          displayDescription = entry.name || entry.title || entry.source_name || entry.notes;
                        }

                        return (
                          <tr 
                            key={idx} 
                            className={cn("hover:bg-muted/30 transition-colors", isOrder && "cursor-pointer")}
                            onClick={() => {
                              if (isOrder) {
                                setSelectedOrderId(orderId);
                                setDetailsOpen(true);
                              }
                            }}
                          >
                            <td className="px-6 py-4 font-medium">
                              {displayDescription}
                            </td>
                            <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-500">+ Rs. {Number(entry.amount).toLocaleString()}</td>
                            <td className="px-6 py-4 text-muted-foreground">{new Date(entry.paid_at).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 capitalize">
                                {source}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {incomeData?.recent_entries?.length >= recentLimit && (
                <div className="p-4 border-t border-border flex justify-center bg-muted/10">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 font-semibold"
                    onClick={() => setRecentLimit(prev => prev + 25)}
                  >
                    View More Entries
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ReceiptDetailSheet 
        orderId={selectedOrderId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}

function MetricCard({ label, value, icon, color, bg, href }: any) {
  const content = (
    <Card className={cn(
        "overflow-hidden border-border bg-card transition-colors",
        href && "hover:bg-muted/50 cursor-pointer"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold">Rs. {Number(value || 0).toLocaleString()}</h3>
          </div>
          <div className={`p-3 rounded-xl ${bg} ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
