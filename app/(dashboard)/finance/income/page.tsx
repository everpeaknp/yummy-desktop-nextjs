"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { IncomeApis, ExpenseApis, AnalyticsApis, FinanceApis } from "@/lib/api/endpoints";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, DollarSign, TrendingUp, Receipt, Download, ArrowLeft, TrendingDown, Utensils, Hotel, CreditCard, Tag, AlertCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { startOfMonth, startOfWeek, endOfDay, subDays } from "date-fns";
// import * as XLSX from "xlsx"; // Removed for optimization
import Link from "next/link";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { FinanceSectionTabs } from "@/components/finance/finance-section-tabs";
import type { FinanceOverviewResponse } from "@/types/finance";

function hasFinanceActivity(metrics: FinanceOverviewResponse["metrics"] | undefined): boolean {
  if (!metrics) return false;
  return [
    metrics.sales_total,
    metrics.discount_total,
    metrics.collections_total,
    metrics.credit_sales,
    metrics.refund_total,
    metrics.manual_income_total,
    metrics.manual_operating_expense,
    metrics.inventory_cash_outflow,
    metrics.inventory_asset_acquired,
    metrics.inventory_cogs,
    metrics.refund_liabilities,
    metrics.supplier_payables,
    metrics.supplier_payments,
    metrics.paid_open_orders_count,
    metrics.paid_open_orders_amount,
  ].some((value) => Math.abs(Number(value) || 0) > 0.0001);
}

export default function IncomePage() {
  const [loading, setLoading] = useState(false);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [financeOverview, setFinanceOverview] = useState<FinanceOverviewResponse | null>(null);
  const [dateFilter, setDateFilter] = useState("this_month");
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

  const getDateRange = () => {
    const now = new Date();
    let start = "";
    let end = endOfDay(now).toISOString().split('T')[0];

    if (dateFilter === 'today') {
      start = now.toISOString().split('T')[0];
    } else if (dateFilter === 'yesterday') {
      const yesterday = subDays(now, 1);
      start = yesterday.toISOString().split('T')[0];
      end = endOfDay(yesterday).toISOString().split('T')[0];
    } else if (dateFilter === 'this_week') {
      start = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
    } else if (dateFilter === 'this_month') {
      start = startOfMonth(now).toISOString().split('T')[0];
    } else if (dateFilter === 'custom') {
      start = customStartDate || now.toISOString().split('T')[0];
      end = customEndDate || now.toISOString().split('T')[0];
    } else {
      start = subDays(now, 365).toISOString().split('T')[0];
    }
    return { start, end };
  };

  const fetchData = async () => {
    if (!user?.restaurant_id) return;
    setLoading(true);
    setTrendsLoading(true);
    const { start, end } = getDateRange();
    const stationParam = selectedStation === 'all' ? undefined : selectedStation;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
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

    try {
      const dashboardUrl = IncomeApis.dashboard({
        restaurantId: user.restaurant_id,
        dateFrom: start,
        dateTo: end,
        station: stationParam,
        businessLine: businessLine === 'all' ? undefined : businessLine,
        timezone: tz
      });
      const financeOverviewUrl = FinanceApis.overview({
        restaurantId: user.restaurant_id,
        dateFrom: start,
        dateTo: end,
        station: stationParam,
        businessLine: businessLine === 'all' ? undefined : businessLine,
        timezone: tz,
        startTime: startTimeVal,
        endTime: endTimeVal,
      });

      const [dashboardRes, recentRes, expenseSummaryRes, financeOverviewRes] = await Promise.all([
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
            timezone: tz
          }
        }),
        apiClient.get(financeOverviewUrl).catch(() => null)
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
      if (financeOverviewRes?.data?.status === 'success') {
        setFinanceOverview(financeOverviewRes.data.data);
      } else {
        setFinanceOverview(null);
      }

      // Fetch trends asynchronously to ensure main finance page loads instantly
      try {
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
  const financeMetrics = hasFinanceActivity(financeOverview?.metrics) ? financeOverview?.metrics : null;
  const netSales = financeMetrics
    ? financeMetrics.net_sales
    : incomeData?.summary?.total_net_income || 0;
  const manualIncome = financeMetrics?.manual_income_total ?? incomeData?.summary?.manual_income_total ?? 0;
  const collectionsTotal = financeMetrics?.collections_total ?? (incomeData?.by_payment_method || [])
    .filter((item: any) => String(item.method || "").toLowerCase() !== "credit")
    .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const creditSales = financeMetrics?.credit_sales ?? incomeData?.receivables?.credit_sales ?? 0;
  const refundTotal = financeMetrics?.refund_total ?? incomeData?.summary?.refund_total ?? 0;
  const refundLiabilities = financeMetrics?.refund_liabilities ?? 0;
  const discountTotal = financeMetrics?.discount_total ?? incomeData?.summary?.total_discount ?? incomeData?.summary?.discount_total ?? 0;
  const currentPeriodSalesCollected = financeMetrics?.current_period_sales_collected ?? 0;
  const priorPeriodPaymentsApplied = financeMetrics?.prior_period_payments_applied ?? 0;
  const postPeriodPaymentsApplied = financeMetrics?.post_period_payments_applied ?? 0;
  const collectionsForOtherPeriodSales = financeMetrics?.collections_for_other_period_sales ?? 0;
  const uncollectedSalesBalance = financeMetrics?.uncollected_sales_balance ?? 0;
  const salesCollectionGap = financeMetrics?.sales_collection_gap ?? netSales - collectionsTotal;
  const paidOpenOrdersCount = financeMetrics?.paid_open_orders_count ?? 0;
  const paidOpenOrdersAmount = financeMetrics?.paid_open_orders_amount ?? 0;
  const operatingExpenses = financeMetrics
    ? financeMetrics.manual_operating_expense + financeMetrics.inventory_cogs
    : expenseSummary?.total_amount || 0;
  const operatingProfit = financeMetrics?.operating_profit ?? netSales - operatingExpenses;
  const paymentMethodRows = financeOverview?.payment_method_breakdown?.length
    ? financeOverview.payment_method_breakdown
    : incomeData?.by_payment_method || [];
  const paymentInstrumentRows = financeOverview?.payment_instrument_breakdown?.length
    ? financeOverview.payment_instrument_breakdown
    : incomeData?.by_payment_instrument || [];

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

            <Select value={dateFilter} onValueChange={setDateFilter}>
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

        <FinanceSectionTabs />

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
          <FinanceMetricSection title="Sales Earned">
            <MetricCard
              label="Net Sales"
              value={netSales}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-emerald-500"
              bg="bg-emerald-50 dark:bg-emerald-950/20"
            />
            <MetricCard
              label="Discounts"
              value={discountTotal}
              icon={<Tag className="w-5 h-5" />}
              color="text-amber-500"
              bg="bg-amber-50 dark:bg-amber-950/20"
            />
            <MetricCard
              label="Refunds"
              value={refundTotal}
              icon={<TrendingDown className="w-5 h-5" />}
              color="text-red-500"
              bg="bg-red-50 dark:bg-red-950/20"
            />
            <MetricCard
              label="Operating Profit"
              value={operatingProfit}
              icon={<TrendingUp className="w-5 h-5" />}
              color={operatingProfit >= 0 ? "text-blue-500" : "text-red-500"}
              bg={operatingProfit >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-red-50 dark:bg-red-950/20"}
            />
          </FinanceMetricSection>

          <FinanceMetricSection title="Money Collected">
            <MetricCard
              label="Collections"
              value={collectionsTotal}
              icon={<CreditCard className="w-5 h-5" />}
              color="text-indigo-500"
              bg="bg-indigo-50 dark:bg-indigo-950/20"
            />
            <MetricCard
              label="Manual Income"
              value={manualIncome}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-teal-500"
              bg="bg-teal-50 dark:bg-teal-950/20"
            />
          </FinanceMetricSection>

          <FinanceMetricSection title="Money Owed">
            <MetricCard
              label="Credit Sales"
              value={creditSales}
              icon={<Receipt className="w-5 h-5" />}
              color="text-blue-500"
              bg="bg-blue-50 dark:bg-blue-950/20"
            />
            <MetricCard
              label="Refund Liabilities"
              value={refundLiabilities}
              icon={<AlertCircle className="w-5 h-5" />}
              color="text-orange-500"
              bg="bg-orange-50 dark:bg-orange-950/20"
            />
          </FinanceMetricSection>

          <FinanceMetricSection title="Costs">
            <MetricCard
              label="Operating Expenses"
              value={operatingExpenses}
              icon={<TrendingDown className="w-5 h-5" />}
              color="text-rose-500"
              bg="bg-rose-50 dark:bg-rose-950/20"
              href="/finance/expenses"
            />
          </FinanceMetricSection>

          <FinanceMetricSection title="Exceptions">
            <MetricCard
              label="Paid Open Orders"
              value={paidOpenOrdersCount}
              noCurrency
              icon={<AlertCircle className="w-5 h-5" />}
              color={paidOpenOrdersCount > 0 ? "text-red-500" : "text-muted-foreground"}
              bg={paidOpenOrdersCount > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/40"}
            />
            <MetricCard
              label="Paid Open Amount"
              value={paidOpenOrdersAmount}
              icon={<Wallet className="w-5 h-5" />}
              color={paidOpenOrdersAmount > 0 ? "text-red-500" : "text-muted-foreground"}
              bg={paidOpenOrdersAmount > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/40"}
            />
          </FinanceMetricSection>

          <SalesToCashReconciliation
            netSales={netSales}
            collectionsTotal={collectionsTotal}
            creditSales={creditSales}
            currentPeriodSalesCollected={currentPeriodSalesCollected}
            priorPeriodPaymentsApplied={priorPeriodPaymentsApplied}
            postPeriodPaymentsApplied={postPeriodPaymentsApplied}
            collectionsForOtherPeriodSales={collectionsForOtherPeriodSales}
            uncollectedSalesBalance={uncollectedSalesBalance}
            salesCollectionGap={salesCollectionGap}
          />

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
                         <span className="text-xl font-bold">Rs. {Number(financeMetrics?.credit_sales ?? incomeData?.receivables?.credit_sales ?? 0).toLocaleString()}</span>
                         <span className="text-[9px] text-muted-foreground font-medium mt-1">{incomeData?.receivables?.credit_orders_count ?? 0} credit bills</span>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 flex flex-col justify-between">
                         <span className="text-[9px] font-black text-red-500 uppercase tracking-wider mb-1">Total Outstanding exposed</span>
                         <span className="text-xl font-bold text-red-600 dark:text-red-400">Rs. {Number(financeMetrics?.outstanding_receivables ?? incomeData?.receivables?.total_outstanding ?? 0).toLocaleString()}</span>
                         <span className="text-[9px] text-muted-foreground font-medium mt-1">Outstanding credit book</span>
                      </div>
                   </div>
                </CardContent>
             </Card>

             {/* Payment split analysis */}
             <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                   <div className="flex justify-between items-center pb-2 border-b border-border/40">
                      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                         <TrendingUp className="w-4 h-4 text-emerald-500" />
                         Income Split by Payment Method
                      </h3>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Collections split</span>
                   </div>
                   <div className="space-y-2">
                      {paymentMethodRows.map((pm: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0">
                            <span className="capitalize text-muted-foreground font-medium">{pm.method}</span>
                            <div className="flex items-center gap-4">
                               <span className="font-bold">Rs. {Number(pm.amount).toLocaleString()}</span>
                               <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-bold">{Math.round((pm.percentage ?? 0) * 100)}%</span>
                            </div>
                         </div>
                      ))}
                      {paymentMethodRows.length === 0 && (
                         <div className="text-center py-4 text-xs text-muted-foreground">No payments split available</div>
                      )}
                   </div>

                   <div className="pt-2 mt-1 border-t border-border/30">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Card/QR Collections by Instrument
                      </div>
                      <div className="space-y-2">
                        {paymentInstrumentRows.map((item: any, idx: number) => (
                          <div key={`instrument-${idx}`} className="flex justify-between items-center text-xs py-1 border-b border-border/10 last:border-0">
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate">{item.instrument || item.instrument_name || "Unspecified"}</div>
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{String(item.method || "").toUpperCase()}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-bold">Rs. {Number(item.amount || 0).toLocaleString()}</span>
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-bold">
                                {Math.round((item.percentage ?? 0) * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                        {paymentInstrumentRows.length === 0 && (
                          <div className="text-center py-3 text-xs text-muted-foreground">
                            No instrument-level card/QR collection data.
                          </div>
                        )}
                      </div>
                   </div>
                </CardContent>
             </Card>
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

function SalesToCashReconciliation({
  netSales,
  collectionsTotal,
  creditSales,
  currentPeriodSalesCollected,
  priorPeriodPaymentsApplied,
  postPeriodPaymentsApplied,
  collectionsForOtherPeriodSales,
  uncollectedSalesBalance,
  salesCollectionGap,
}: {
  netSales: number;
  collectionsTotal: number;
  creditSales: number;
  currentPeriodSalesCollected: number;
  priorPeriodPaymentsApplied: number;
  postPeriodPaymentsApplied: number;
  collectionsForOtherPeriodSales: number;
  uncollectedSalesBalance: number;
  salesCollectionGap: number;
}) {
  const fmtMoney = (value: number) =>
    `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = [
    { label: "Collected from this period's sales", value: currentPeriodSalesCollected, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Credit sales from this period", value: creditSales, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Prior-period payments applied", value: priorPeriodPaymentsApplied, tone: "text-amber-600 dark:text-amber-400" },
    { label: "Later payments applied", value: postPeriodPaymentsApplied, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Collections for other-period sales", value: collectionsForOtherPeriodSales, tone: "text-indigo-600 dark:text-indigo-400" },
    { label: "Uncollected sales balance", value: uncollectedSalesBalance, tone: Number(uncollectedSalesBalance || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground" },
  ];

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Sales to Cash Reconciliation</h3>
            <p className="text-xs text-muted-foreground">Net sales and collections use different timing rules. This bridge explains the gap.</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Sales - Collections</p>
            <p className="text-lg font-black text-foreground">{fmtMoney(salesCollectionGap)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Sales</p>
            <p className="text-xl font-black text-foreground">{fmtMoney(netSales)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Collections</p>
            <p className="text-xl font-black text-foreground">{fmtMoney(collectionsTotal)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Sales Collected</p>
            <p className="text-xl font-black text-foreground">{fmtMoney(currentPeriodSalesCollected)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">{row.label}</span>
              <span className={cn("text-sm font-black whitespace-nowrap", row.tone)}>{fmtMoney(row.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceMetricSection({ title, children }: { title: string; children: any }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, icon, color, bg, href, noCurrency }: any) {
  const content = (
    <Card className={cn(
        "overflow-hidden border-border bg-card transition-colors",
        href && "hover:bg-muted/50 cursor-pointer"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold">
              {noCurrency ? Number(value || 0).toLocaleString() : `Rs. ${Number(value || 0).toLocaleString()}`}
            </h3>
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
