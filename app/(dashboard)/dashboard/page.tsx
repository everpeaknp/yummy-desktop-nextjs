"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import apiClient from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { hasAnalyticsViewPermission } from "@/lib/role-permissions"
import {
  mapAnalyticsTrends,
  mapBreakdownToPie,
  preferHourlyTrends,
  topItemQuantitySold,
} from "@/lib/analytics-dashboard-mapper"
import { cn } from "@/lib/utils"
import { DashboardApis, AnalyticsApis, TableApis, TransactionsApis } from "@/lib/api/endpoints"
import dynamic from "next/dynamic"
import { DateRangeDropdown, DateRangePreset } from "@/components/ui/date-range-dropdown"
import { DateRange } from "react-day-picker"

const RevenueChart = dynamic(() => import("@/components/analytics/revenue-chart").then(mod => mod.RevenueChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />
})

const CategoryPieChart = dynamic(() => import("@/components/analytics/category-pie").then(mod => mod.CategoryPieChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-xl" />
})

// import * as XLSX from "xlsx" // Removed for optimization
import { 
  Activity, 
  Clock, 
  Users,
  Zap,
  Lightbulb,
  TrendingDown,
  Info,
  AlertCircle,
  TrendingUp,
  ChefHat,
  Download,
  CheckCircle,
  XCircle,
  CreditCard,
  DollarSign,
  Briefcase,
  Calendar,
  ArrowRight,
  ChevronRight,
  Siren,
  Wallet,
  ReceiptText
} from "lucide-react"

export default function DashboardPage() {
  const user = useAuth(state => state.user)
  const [data, setData] = useState<any>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [occupancy, setOccupancy] = useState<any[]>([])
  const [trendsData, setTrendsData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false)
  const [activeRange, setActiveRange] = useState<DateRangePreset>("today")
  const [date, setDate] = useState<DateRange | undefined>()

  // Auth/session: RoleGuard + SessionBootstrap (avoid duplicate redirects in Electron).

  // 2. Data Fetching
  const fetchDashboard = async () => {
    if (!user?.restaurant_id) return

    const canViewAnalytics = hasAnalyticsViewPermission(user)

    try {
      setError(null)
      setAnalyticsError(null)
      if (!canViewAnalytics) {
        setAnalyticsData(null)
        setTrendsData([])
        setCategoryData([])
        setAnalyticsUnavailable(true)
      } else {
        setAnalyticsUnavailable(false)
      }
      const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
      };
      const now = new Date();
      let dateFrom = formatDate(now);
      let dateTo = formatDate(now);

      if (activeRange === 'yesterday') {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          dateFrom = formatDate(y);
          dateTo = formatDate(y);
      } else if (activeRange === 'last7') {
          const l7 = new Date(now);
          l7.setDate(l7.getDate() - 6);
          dateFrom = formatDate(l7);
      } else if (activeRange === 'last30') {
          const l30 = new Date(now);
          l30.setDate(l30.getDate() - 29);
          dateFrom = formatDate(l30);
      } else if (activeRange === 'month') {
          const m = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFrom = formatDate(m);
      } else if (activeRange === 'custom' && date?.from) {
          dateFrom = formatDate(date.from);
          dateTo = date.to ? formatDate(date.to) : dateFrom;
      }
      let startTime: string | undefined = undefined;
      let endTime: string | undefined = undefined;

      if (activeRange === 'custom' && date?.from) {
          startTime = date.from.toISOString();
          endTime = date.to ? date.to.toISOString() : date.from.toISOString();
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Fetch V2 Dashboard (Health, Basic KPIs)
      const v2Res = await apiClient.get(DashboardApis.dashboardDataV2({
        restaurantId: user.restaurant_id,
        timezone,
        businessLine: "restaurant",
      })).catch(err => { console.error("V2 failed:", err); return null })

      // Fetch Advanced Analytics (Date filtered) — only when explicitly permitted
      let analyticsRes = null
      if (canViewAnalytics) {
        analyticsRes = await apiClient
          .get(
            AnalyticsApis.dashboard({
              restaurantId: user.restaurant_id,
              dateFrom,
              dateTo,
              startTime,
              endTime,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              businessLine: "restaurant",
              include: "core,insights",
            })
          )
          .catch((err) => {
            const message =
              err?.response?.data?.detail ||
              err?.response?.data?.message ||
              "Analytics data is unavailable."
            setAnalyticsError(message)
            return null
          })
      }

      // Audit logs were removed; use Transactions as the unified activity timeline.
      const historyRes = canViewAnalytics
        ? await apiClient
            .get(
              TransactionsApis.list({
                restaurantId: user.restaurant_id,
                dateFrom: dateFrom,
                dateTo: dateTo,
                skip: 0,
                limit: 15,
              })
            )
            .catch((err) => {
              console.error("History failed:", err)
              return null
            })
        : null

      // Fetch Occupancy
      const occupancyRes = await apiClient.get(TableApis.tableSummary(user.restaurant_id))
        .catch(err => { console.error("Occupancy failed:", err); return null })

      if (v2Res?.data?.status === "success") setData(v2Res.data.data)
      
      if (analyticsRes?.data?.status === "success") {
        const analytics = analyticsRes.data.data
        setAnalyticsData(analytics)

        setTrendsData(
          mapAnalyticsTrends(analytics, preferHourlyTrends(activeRange))
        )

        setCategoryData(mapBreakdownToPie(analytics, "source"))
      }

      if (historyRes?.data?.status === "success") {
        const items = historyRes.data.data.items || []
        setActivities(
          items.map((it: any) => ({
            id: it.id,
            actor_name: it.user_name || it.actor_name || "System",
            created_at: it.created_at,
            event: it.type || "transaction",
            title: it.title,
            entity_type: it.type,
            entity_id: null,
          }))
        )
      }

      if (occupancyRes?.data?.status === "success") {
        setOccupancy(occupancyRes.data.data || [])
      }

    } catch (err: any) {
      console.error("Dashboard fetch error:", err)
      setError("Failed to synchronize dashboard data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.restaurant_id) {
      if (activeRange === 'custom' && (!date?.from || !date?.to)) {
        return; // wait until full range is selected
      }
      setLoading(true)
      fetchDashboard()
      const interval = setInterval(fetchDashboard, 60000)
      return () => clearInterval(interval)
    }
  }, [user, activeRange, date])

  // Export Reporting
  const handleExport = async () => {
    if (!analyticsData) return
    
    // Dynamic import for optimization
    const XLSX = await import("xlsx")
    
    const exportData = [
      { Metric: "Gross Sales", Value: kpis.gross_sales },
      { Metric: "Net Profit", Value: kpis.net_profit },
      { Metric: "Profit Margin %", Value: kpis.profit_margin },
      { Metric: "Total Orders", Value: kpis.total_orders },
      { Metric: "Avg Order Value", Value: kpis.average_order_value },
      { Metric: "Total Expenses", Value: kpis.total_expense },
      { Metric: "Cancelled Today", Value: kpis.cancelled_today },
      { Metric: "Refunded Today", Value: kpis.refunded_today },
    ]
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Financial Summary")
    XLSX.writeFile(wb, `Business_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading && !data) return <DashboardSkeleton />

  const home = data?.home
  const shiftPulse = home?.shift_pulse
  const actionQueue = home?.action_queue
  const cashWatch = home?.cash_watch
  const pipeline = home?.pipeline
  const alerts = home?.alerts?.items || data?.health?.alerts || []
  const quickInsights = home?.quick_insights?.items || data?.quick_insights || []
  const quickActions = home?.quick_actions?.items || []
  const attentionItems = home?.attention_items?.items || []
  const dayCloseStatus = home?.day_close_status
  const topItemsLive = home?.top_items_live?.items || []
  const health = data?.health
  const overview = analyticsData?.overview
  const v2Kpis = data?.kpis
  const currency = analyticsData?.meta?.currency || data?.meta?.currency || "NPR"
  const topItems =
    topItemsLive.length > 0
      ? topItemsLive
      : analyticsData?.menu_snapshot?.top_items || data?.breakdowns?.top_items || []
  const paymentSplit =
    data?.breakdowns?.payment_split?.length
      ? data.breakdowns.payment_split
      : cashWatch?.available !== false
        ? [
            { method: "Cash", amount: cashWatch?.cash_collected || 0 },
            { method: "Digital", amount: cashWatch?.digital_collected || 0 },
            { method: "Credit", amount: cashWatch?.credit_sales || 0 },
          ].filter((item) => item.amount > 0)
        : []
  const orderStatus =
    data?.breakdowns?.order_status?.length
      ? data.breakdowns.order_status
      : pipeline?.status_counts || []
  const trendCards = [
    {
      label: "Sales vs Yesterday",
      trend: data?.trends?.sales_vs_yesterday,
    },
    {
      label: "Orders vs Yesterday",
      trend: data?.trends?.orders_vs_yesterday,
    },
  ]
  
  const kpis = {
    gross_sales:
      overview?.total_income ??
      v2Kpis?.gross_sales ??
      ((cashWatch?.cash_collected || 0) + (cashWatch?.digital_collected || 0) + (cashWatch?.credit_sales || 0)),
    net_profit: overview?.net_profit ?? 0,
    profit_margin: overview?.profit_margin ?? 0,
    total_orders:
      overview?.orders_count ??
      v2Kpis?.total_orders ??
      orderStatus.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0),
    average_order_value: overview?.avg_order_value ?? v2Kpis?.average_order_value ?? 0,
    total_expense: overview?.total_expense ?? 0,
    cancelled_today: shiftPulse?.cancelled ?? health?.cancelled_today ?? 0,
    refunded_today: shiftPulse?.refunded ?? health?.refunded_today ?? 0,
  }

  return (
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4">
      {/* 0. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground text-sm font-medium">Real-time operational overview for {data?.meta?.outlet_name || "your outlet"}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeDropdown 
              activeRange={activeRange}
              setActiveRange={setActiveRange}
              date={date}
              setDate={setDate}
          />
          <Badge variant="secondary" className="gap-2 py-1 px-3 bg-green-500/10 text-green-600 border border-green-200 shrink-0">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             System Online
          </Badge>
        </div>
      </div>

      {/* 1. Health Cards (Top) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthCard 
           label="Active Orders" 
           value={shiftPulse?.active_orders ?? health?.active_orders ?? 0} 
           icon={<Activity className="h-5 w-5" />}
           color="text-primary"
        />
        <HealthCard 
           label="KOT Pending" 
           value={shiftPulse?.kot_pending ?? health?.kot_pending ?? 0} 
           icon={<Clock className="h-5 w-5" />}
           color="text-amber-500"
        />
        <HealthCard 
           label="Delayed KOTs" 
           value={shiftPulse?.kot_delayed ?? health?.kot_delayed ?? 0} 
           icon={<AlertCircle className="h-5 w-5" />}
           color="text-destructive"
           pulse={ (shiftPulse?.kot_delayed ?? health?.kot_delayed ?? 0) > 0 }
        />
      </section>

      {/* 1.1 Summary Bar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cancelled Today</p>
                    <p className="text-2xl font-black">{kpis.cancelled_today}</p>
                </div>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground opacity-20" />
         </div>
         <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Refunded Today</p>
                    <p className="text-2xl font-black">{kpis.refunded_today}</p>
                </div>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground opacity-20" />
         </div>
      </section>

      {/* 1.2 Dashboard V2 Priorities */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AlertsBanner alerts={alerts} />
        <QuickActionsCard actions={quickActions} />
        <DayCloseStatusCard dayCloseStatus={dayCloseStatus} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttentionItemsCard items={attentionItems} />
        <QuickInsightsStack insights={quickInsights} />
      </section>

      {/* 2. Charts (Side-by-Side) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {analyticsUnavailable ? (
          <Card className="lg:col-span-2 border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Revenue and source breakdown charts require the reports.analytics.view permission.
            </CardContent>
          </Card>
        ) : analyticsError ? (
          <Card className="lg:col-span-2 border-destructive/30 bg-destructive/5">
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-destructive">Analytics data unavailable</p>
              <p className="text-xs text-muted-foreground">{analyticsError}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="h-[400px]">
              <RevenueChart
                data={trendsData}
                loading={loading}
                title={preferHourlyTrends(activeRange) ? "Hourly Revenue" : "Revenue Trend"}
                description={
                  preferHourlyTrends(activeRange)
                    ? "Hour-by-hour gross sales for the selected day."
                    : "Your gross sales over the selected period."
                }
              />
            </div>
            <div className="h-[400px]">
              <CategoryPieChart
                data={categoryData}
                loading={loading}
                title="Sales by Source"
                description="Breakdown of sales by order source (Dine-in, Takeaway, etc.)"
              />
            </div>
          </>
        )}
      </section>

      {/* 3. Operational Pulse & Intelligence */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <OccupancyCard tables={occupancy} occupancySnapshot={home?.occupancy} />
          <OperationalPulseCard operations={analyticsData?.operations} />
          <CashWatchCard cashWatch={cashWatch} currency={currency} />
      </section>

      {/* 3.1 V2 Comparisons */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendComparisonSection trendCards={trendCards} />
        <OrderStatusCard statuses={orderStatus} />
      </section>

      {/* 4. Performers & Staff Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
            <Card className="h-full border-border shadow-sm">
                <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-primary" />
                        Top Performing Items
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-5">
                       {topItems.slice(0, 8).map((item: any) => (
                         <div key={item.name} className="flex items-center justify-between group">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate pr-4 group-hover:text-primary transition-colors">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{topItemQuantitySold(item)} units sold</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black">{currency} {item.revenue?.toLocaleString()}</p>
                            </div>
                         </div>
                       ))}
                       {topItems.length === 0 && <p className="text-center py-10 text-muted-foreground italic text-sm">No sales data recorded yet.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-7">
            <PaymentSplitCard payments={paymentSplit} currency={currency} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <ActivityFeed activities={activities} />
        </div>
        <div className="lg:col-span-5">
          <InsightsCard insights={analyticsData?.insights || []} loading={loading} />
        </div>
      </section>

      {/* 5. Downloads & Final Summary (Moved to Bottom) */}
      <section className="mt-8 pt-10 border-t border-border/50 bg-muted/20 -mx-4 px-4 pb-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    Business Summary & Reports
                </h2>
                <p className="text-xs text-muted-foreground font-medium">Consolidated financial overview and export tools.</p>
            </div>
            <Button onClick={handleExport} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md">
                <Download className="h-4 w-4" /> Export Data to Excel
            </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <SummaryMetric label="Gross Sales" value={kpis.gross_sales} prefix={currency} icon={<DollarSign className="h-4 w-4" />} />
            <SummaryMetric label="Net Profit" value={kpis.net_profit} prefix={currency} icon={<TrendingUp className="h-4 w-4" />} />
            <SummaryMetric label="Margin" value={kpis.profit_margin} suffix="%" icon={<Zap className="h-4 w-4" />} />
            <SummaryMetric label="Total Orders" value={kpis.total_orders} icon={<Activity className="h-4 w-4" />} />
            <SummaryMetric label="Avg Ticket" value={kpis.average_order_value} prefix={currency} icon={<Receipt className="h-4 w-4" />} />
            <SummaryMetric label="Total Expenses" value={kpis.total_expense} prefix={currency} icon={<TrendingDown className="h-4 w-4" />} />
        </div>
      </section>
    </div>
  )
}

function HealthCard({ label, value, icon, color, borderColor, bgColor, pulse }: any) {
    return (
        <Card className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                   <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 opacity-70">{label}</p>
                   <p className={cn("text-3xl font-black tracking-tighter text-foreground", pulse ? "animate-pulse" : "")}>{value}</p>
                </div>
                <div className={cn("p-2.5 rounded-lg bg-muted/40 border border-border/50 transition-colors", color)}>
                   {icon}
                </div>
            </CardContent>
        </Card>
    )
}

function TrendCard({ label, trend }: { label: string, trend: any }) {
  const direction = String(trend?.direction || "SAME").toUpperCase()
  const isUp = direction === "UP"
  const isDown = direction === "DOWN"
  const delta = Math.abs(Number(trend?.delta_percent || 0))

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-6">
        <div className="text-xs text-muted-foreground font-medium mb-1">{label}</div>
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-foreground">{delta.toFixed(1)}%</span>
          <div
            className={cn(
              "flex items-center text-sm font-medium mb-1 px-2 py-0.5 rounded-full",
              isUp
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500"
                : isDown
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : isDown ? <TrendingDown className="w-3 h-3 mr-1" /> : null}
            {isUp ? "Inc" : isDown ? "Dec" : "Flat"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OccupancyCard({ tables, occupancySnapshot }: { tables: any[], occupancySnapshot?: any }) {
  const hasSnapshot = occupancySnapshot?.available !== false && occupancySnapshot
  const occupied = hasSnapshot
    ? Number(occupancySnapshot?.occupied_tables || 0)
    : tables.filter(t => t.status === 'occupied').length
  const free = hasSnapshot
    ? Number(occupancySnapshot?.free_tables || 0)
    : Math.max(tables.length - occupied, 0)
  const total = Math.max(occupied + free, 1)
  const pct = Math.round((occupied / total) * 100)
  const capacity = Math.round(tables.length ? tables.reduce((acc, t) => acc + (t.capacity || 0), 0) : 0)

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden">
      <CardHeader className="pb-2 border-b border-border/30">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Live Table Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="text-3xl font-black">{occupied}</span>
            <span className="text-muted-foreground text-xs ml-1 font-bold">/ {total} Tables Active</span>
          </div>
          <Badge className={cn("font-bold px-2 py-1", pct > 80 ? "bg-destructive text-white" : "bg-green-500 text-white")}>
            {pct}% Busy
          </Badge>
        </div>
        <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
          <div className={cn("h-full transition-all duration-700", pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-muted/50 p-2 rounded-lg text-center border border-border/50">
            <p className="text-[9px] text-muted-foreground uppercase font-black">Available</p>
            <p className="text-sm font-black">{free}</p>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center border border-border/50">
            <p className="text-[9px] text-muted-foreground uppercase font-black">Capacity</p>
            <p className="text-sm font-black">{capacity}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OperationalPulseCard({ operations }: { operations: any }) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-2 border-b border-border/30">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-500" />
          Service Efficiency
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-black uppercase">Peak Demand Hour</p>
            <p className="text-sm font-bold truncate">{operations?.peak_hour || "N/A"}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-black uppercase">Avg Prep Time</p>
            <p className="text-sm font-bold">{Math.round(operations?.avg_service_time_min || 0)} mins</p>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex justify-between items-center">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Cancellation Rate</span>
          <Badge variant="outline" className={cn("font-bold", (operations?.order_cancellation_pct || 0) > 10 ? "text-destructive border-destructive/20 bg-destructive/5" : "text-green-600 border-green-200 bg-green-50/50")}>
            {operations?.order_cancellation_pct || 0}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function InsightsCard({ insights = [], loading }: { insights: any[], loading: boolean }) {
  const topInsight = insights?.[0]

  return (
    <Card className="bg-card border-indigo-500/30 shadow-sm border-2 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -mr-12 -mt-12" />
      <CardHeader className="pb-2 border-b border-indigo-500/10">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-600">
          <Lightbulb className="h-4 w-4" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
           <div className="flex flex-col items-center justify-center py-6 text-center">
             <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2 animate-pulse" />
             <p className="text-xs text-muted-foreground italic">Crunching latest figures...</p>
           </div>
        ) : topInsight ? (
          <div className="space-y-4">
            <div className={cn("p-4 rounded-xl border-l-4 shadow-sm", topInsight.level === 'warning' ? "bg-amber-500/5 border-amber-500/50" : "bg-indigo-500/5 border-indigo-500/50")}>
              <div className="flex gap-4">
                {topInsight.level === 'warning' ? (
                  <TrendingDown className="h-6 w-6 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-indigo-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground mb-1 leading-tight">{topInsight.message}</p>
                  <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                    {topInsight.suggested_action}
                  </p>
                </div>
              </div>
            </div>
            {insights.length > 1 && (
              <p className="text-[9px] text-indigo-600 font-black uppercase text-center tracking-widest pt-2 border-t border-indigo-500/10">
                + {insights.length - 1} Additional Suggestions Available
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 border border-indigo-500/20">
              <CheckCircle className="h-8 w-8 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-foreground">Performance is Optimal</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px] mt-1">No significant anomalies detected in recent data trends.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AlertsBanner({ alerts }: { alerts: any[] }) {
  const primary = alerts[0]
  const severity = String(primary?.severity || "LOW").toUpperCase()
  const tone =
    severity === "HIGH" || severity === "CRITICAL"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : severity === "MEDIUM" || severity === "WARNING"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
        : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"

  return (
    <Card className={cn("shadow-sm", tone)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Siren className="h-4 w-4" />
          Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-semibold">{primary?.message || "No critical operational alerts right now."}</p>
        <p className="text-xs text-muted-foreground">
          {primary?.action_hint || (alerts.length > 1 ? `+${alerts.length - 1} more alerts available.` : "System is stable." )}
        </p>
      </CardContent>
    </Card>
  )
}

function QuickActionsCard({ actions }: { actions: any[] }) {
  const enabledActions = actions.filter((action: any) => action.enabled).slice(0, 6)
  return (
    <Card className="shadow-sm border-border/70 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {enabledActions.map((action: any) => (
            <Link
              key={action.key}
              href={action.route}
              className={cn(
                "rounded-2xl border border-border/60 bg-background/70 px-3 py-4 transition-all hover:bg-background hover:border-primary/30 hover:shadow-sm"
              )}
            >
              <p className="text-sm font-bold leading-tight">{action.title}</p>
              <p className="text-[11px] text-muted-foreground mt-2">Open module</p>
            </Link>
          ))}
          {enabledActions.length === 0 && <p className="col-span-2 md:col-span-3 text-sm text-muted-foreground">No quick actions available.</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function DayCloseStatusCard({ dayCloseStatus }: { dayCloseStatus: any }) {
  const status = String(dayCloseStatus?.status || "unavailable").replace(/_/g, " ")
  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Day Close
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black capitalize">{status}</p>
          <p className="text-xs text-muted-foreground">{dayCloseStatus?.action_label || "Open Day Close"}</p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href={dayCloseStatus?.route || "/day-close"}>
            {dayCloseStatus?.action_label || "Open Day Close"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

const ATTENTION_DRAG_THRESHOLD_PX = 10

function AttentionItemsCard({ items }: { items: any[] }) {
  const visibleItems = items.slice(0, 5)
  const itemCount = visibleItems.length
  const infiniteLoop = itemCount > 1
  const carouselItems = useMemo(
    () => (infiniteLoop ? [...visibleItems, ...visibleItems, ...visibleItems] : visibleItems),
    [visibleItems, infiniteLoop],
  )
  const middleStartIndex = infiniteLoop ? itemCount : 0

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    didDrag: false,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  })
  const suppressClickRef = useRef(false)
  const momentumFrameRef = useRef<number | null>(null)
  const loopMetricsRef = useRef({ middleScrollLeft: 0, setWidth: 0 })
  const isLoopAdjustingRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPointerDown, setIsPointerDown] = useState(false)

  const attentionCursor = isDragging || isPointerDown ? "grabbing" : "grab"

  const cancelAttentionMomentum = () => {
    if (momentumFrameRef.current != null) {
      cancelAnimationFrame(momentumFrameRef.current)
      momentumFrameRef.current = null
    }
  }

  const getAttentionCardScrollLeft = (card: HTMLElement) => {
    const container = scrollRef.current
    if (!container) return 0
    const containerRect = container.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    return container.scrollLeft + (cardRect.left - containerRect.left)
  }

  const updateAttentionLoopMetrics = useCallback(() => {
    if (!infiniteLoop) return
    const middle = cardRefs.current[middleStartIndex]
    const thirdStart = cardRefs.current[itemCount * 2]
    if (!middle || !thirdStart) return

    const middleScrollLeft = getAttentionCardScrollLeft(middle)
    const setWidth = getAttentionCardScrollLeft(thirdStart) - middleScrollLeft
    loopMetricsRef.current = { middleScrollLeft, setWidth }
  }, [infiniteLoop, itemCount, middleStartIndex])

  const normalizeAttentionInfiniteScroll = useCallback(() => {
    if (!infiniteLoop || isLoopAdjustingRef.current) return
    const container = scrollRef.current
    if (!container) return

    updateAttentionLoopMetrics()
    const { middleScrollLeft, setWidth } = loopMetricsRef.current
    if (setWidth <= 0) return

    const x = container.scrollLeft
    const leftBound = middleScrollLeft - setWidth * 0.15
    const rightBound = middleScrollLeft + setWidth - 1

    if (x < leftBound) {
      isLoopAdjustingRef.current = true
      container.scrollLeft = x + setWidth
      requestAnimationFrame(() => {
        isLoopAdjustingRef.current = false
      })
    } else if (x >= rightBound) {
      isLoopAdjustingRef.current = true
      container.scrollLeft = x - setWidth
      requestAnimationFrame(() => {
        isLoopAdjustingRef.current = false
      })
    }
  }, [infiniteLoop, updateAttentionLoopMetrics])

  const syncAttentionActiveIndex = useCallback(() => {
    const container = scrollRef.current
    if (!container || itemCount === 0) return

    let nearestRef = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const left = getAttentionCardScrollLeft(card)
      const distance = Math.abs(container.scrollLeft - left)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestRef = index
      }
    })

    setActiveIndex(infiniteLoop ? nearestRef % itemCount : nearestRef)
  }, [itemCount, infiniteLoop])

  const scrollAttentionToRef = (refIndex: number, behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current
    const target = cardRefs.current[refIndex]
    if (!container || !target) return
    container.scrollTo({
      left: getAttentionCardScrollLeft(target),
      behavior,
    })
  }

  const snapAttentionToNearest = (behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current
    if (!container || itemCount === 0) return

    let nearestRef = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const left = getAttentionCardScrollLeft(card)
      const distance = Math.abs(container.scrollLeft - left)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestRef = index
      }
    })

    const target = cardRefs.current[nearestRef]
    if (!target) return

    setActiveIndex(infiniteLoop ? nearestRef % itemCount : nearestRef)
    container.scrollTo({
      left: getAttentionCardScrollLeft(target),
      behavior,
    })
    if (behavior === "auto") {
      normalizeAttentionInfiniteScroll()
    }
  }

  const runAttentionMomentum = (initialVelocity: number) => {
    const container = scrollRef.current
    if (!container) return

    cancelAttentionMomentum()
    let velocity = initialVelocity
    let lastFrame = performance.now()
    const minVelocity = 0.015

    const step = (now: number) => {
      const dt = Math.min(32, now - lastFrame)
      lastFrame = now

      if (Math.abs(velocity) < minVelocity) {
        momentumFrameRef.current = null
        snapAttentionToNearest("smooth")
        return
      }

      container.scrollLeft -= velocity * dt
      normalizeAttentionInfiniteScroll()
      syncAttentionActiveIndex()
      velocity *= Math.pow(0.9, dt / 16)
      momentumFrameRef.current = requestAnimationFrame(step)
    }

    momentumFrameRef.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    return () => cancelAttentionMomentum()
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      normalizeAttentionInfiniteScroll()
      syncAttentionActiveIndex()
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [normalizeAttentionInfiniteScroll, syncAttentionActiveIndex, carouselItems.length])

  useEffect(() => {
    setActiveIndex(0)
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        if (infiniteLoop) {
          const middle = cardRefs.current[middleStartIndex]
          if (middle) {
            scrollRef.current.scrollLeft = getAttentionCardScrollLeft(middle)
            updateAttentionLoopMetrics()
            normalizeAttentionInfiniteScroll()
          }
        } else {
          scrollRef.current.scrollTo({ left: 0, behavior: "auto" })
        }
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [visibleItems.length, infiniteLoop, middleStartIndex, updateAttentionLoopMetrics, normalizeAttentionInfiniteScroll])

  useEffect(() => {
    if (visibleItems.length <= 1 || isPaused) return

    const interval = window.setInterval(() => {
      advanceAttentionItem(1)
    }, 2000)

    return () => window.clearInterval(interval)
  }, [visibleItems.length, isPaused])

  const advanceAttentionItem = (direction: 1 | -1) => {
    if (itemCount <= 1) return
    cancelAttentionMomentum()

    const nextLogical = (activeIndex + direction + itemCount) % itemCount
    let targetRef = middleStartIndex + nextLogical

    if (infiniteLoop && direction === 1 && activeIndex === itemCount - 1) {
      targetRef = itemCount * 2
    } else if (infiniteLoop && direction === -1 && activeIndex === 0) {
      targetRef = itemCount - 1
    }

    setActiveIndex(nextLogical)
    scrollAttentionToRef(targetRef, "smooth")
  }

  const resolveAttentionHref = (item: any) => {
    if (!item?.route) return "#"
    if (item.route === "/running-orders" && item.entity_id) {
      return `/orders/${item.entity_id}`
    }
    return item.route
  }

  const endAttentionPointerSession = () => {
    if (!dragRef.current.active) return

    const didDrag = dragRef.current.didDrag
    const velocity = dragRef.current.velocity
    dragRef.current.active = false
    setIsDragging(false)
    setIsPointerDown(false)

    if (scrollRef.current) {
      const focused = document.activeElement
      if (focused instanceof HTMLElement && scrollRef.current.contains(focused)) {
        focused.blur()
      }
    }

    if (didDrag) {
      suppressClickRef.current = true
      if (Math.abs(velocity) > 0.03) {
        runAttentionMomentum(velocity)
      } else {
        snapAttentionToNearest("smooth")
        requestAnimationFrame(() => normalizeAttentionInfiniteScroll())
      }
    }
  }

  const handleAttentionPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el || e.button !== 0) return

    cancelAttentionMomentum()
    suppressClickRef.current = false

    const now = performance.now()
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      didDrag: false,
      lastX: e.clientX,
      lastTime: now,
      velocity: 0,
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragRef.current.active || !scrollRef.current) return

      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY

      if (
        !dragRef.current.didDrag &&
        (Math.abs(dx) > ATTENTION_DRAG_THRESHOLD_PX || Math.abs(dy) > ATTENTION_DRAG_THRESHOLD_PX)
      ) {
        dragRef.current.didDrag = true
        setIsDragging(true)
        setIsPaused(true)
      }

      if (dragRef.current.didDrag) {
        const moveNow = performance.now()
        const dt = moveNow - dragRef.current.lastTime
        if (dt > 0) {
          dragRef.current.velocity = (ev.clientX - dragRef.current.lastX) / dt
        }
        dragRef.current.lastX = ev.clientX
        dragRef.current.lastTime = moveNow
        scrollRef.current.scrollLeft = dragRef.current.scrollLeft - dx
        normalizeAttentionInfiniteScroll()
        syncAttentionActiveIndex()
      }
    }

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)
      setIsPointerDown(false)
      endAttentionPointerSession()
    }

    setIsPointerDown(true)

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
  }

  const handleAttentionLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault()
      suppressClickRef.current = false
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Needs Attention</h3>
        {visibleItems.length > 1 ? <span className="text-[11px] text-muted-foreground">Swipe through issues</span> : null}
      </div>
      {visibleItems.length > 0 ? (
        <div className="relative">
          <div
            ref={scrollRef}
            className={cn(
              "flex gap-3 overflow-x-auto pb-2 touch-pan-x",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              "[-webkit-overflow-scrolling:touch]",
              infiniteLoop ? "snap-none" : "snap-x snap-mandatory",
              isDragging ? "select-none" : "",
              "[&_a]:![cursor:inherit] [&_*]:![cursor:inherit]",
            )}
            style={{ scrollBehavior: "auto", cursor: attentionCursor }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => {
              setIsPaused(false)
              setIsPointerDown(false)
            }}
            onPointerDown={handleAttentionPointerDown}
          >
            {carouselItems.map((item: any, index: number) => {
            const logicalIndex = infiniteLoop ? index % itemCount : index
            const severity = String(item.severity || "LOW").toUpperCase()
            const tone =
              severity === "HIGH"
                ? "border-destructive/30 bg-destructive/[0.05]"
                : severity === "MEDIUM"
                  ? "border-amber-500/30 bg-amber-500/[0.06]"
                  : "border-blue-500/25 bg-blue-500/[0.05]"
            return (
              <Link
                key={`attention-${index}-${item.type}-${item.entity_id ?? item.title}`}
                ref={(node) => {
                  cardRefs.current[index] = node
                }}
                href={resolveAttentionHref(item)}
                draggable={false}
                onClick={handleAttentionLinkClick}
                style={{ cursor: attentionCursor }}
                className={cn(
                  "min-w-[85%] lg:min-w-[48%] snap-start rounded-2xl border p-4 transition-all hover:shadow-sm",
                  activeIndex === logicalIndex ? "ring-1 ring-border/60" : "",
                  tone
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-2 truncate">{item.subtitle}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize bg-background/70">
                    {String(item.severity || "low").toLowerCase()}
                  </Badge>
                </div>
              </Link>
            )
            })}
          </div>
          {visibleItems.length > 1 ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 rounded-full px-3 text-xs"
                onClick={() => advanceAttentionItem(1)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/[0.05]">
          <CardContent className="py-5 text-sm font-medium">No urgent operational issues right now.</CardContent>
        </Card>
      )}
    </div>
  )
}

function QuickInsightsStack({ insights }: { insights: any[] }) {
  const visibleInsights = insights.slice(0, 4)
  return (
    <Card className="shadow-sm border-border/70 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Quick Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleInsights.length > 0 ? visibleInsights.map((insight: any, index: number) => (
          <div key={`${insight.type || "info"}-${index}`} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  String(insight?.type || "INFO").toUpperCase() === "POSITIVE"
                    ? "bg-emerald-500"
                    : String(insight?.type || "INFO").toUpperCase() === "WARNING"
                      ? "bg-amber-500"
                      : "bg-sky-500"
                )}
              />
              <p className="text-sm leading-6">{insight?.message}</p>
            </div>
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">No notable operational changes right now.</p>
        )}
      </CardContent>
    </Card>
  )
}

function CashWatchCard({ cashWatch, currency }: { cashWatch: any, currency: string }) {
  const rows = [
    { label: "Cash", value: cashWatch?.cash_collected || 0 },
    { label: "Digital", value: cashWatch?.digital_collected || 0 },
    { label: "Credit", value: cashWatch?.credit_sales || 0 },
    { label: "Outstanding", value: cashWatch?.total_outstanding || 0 },
  ]

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-2 border-b border-border/30">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-500" />
          Cash Watch
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {cashWatch?.available === false ? (
          <p className="text-sm text-muted-foreground">{cashWatch?.reason || "Cash watch is unavailable."}</p>
        ) : rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="text-sm font-black">{currency} {Number(row.value || 0).toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TrendComparisonSection({ trendCards }: { trendCards: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {trendCards.map((item) => (
        <TrendCard key={item.label} label={item.label} trend={item.trend} />
      ))}
    </div>
  )
}

function OrderStatusCard({ statuses }: { statuses: any[] }) {
  const total = statuses.reduce((sum, item) => sum + Number(item.count || 0), 0)
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold">Order Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statuses.length > 0 ? statuses.map((status: any) => {
          const ratio = total > 0 ? (Number(status.count || 0) / total) * 100 : 0
          return (
            <div key={status.status} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold">{status.status}</span>
                <span className="text-xs text-muted-foreground">{status.count}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
              </div>
            </div>
          )
        }) : <p className="text-sm text-muted-foreground">No order status data for this window.</p>}
      </CardContent>
    </Card>
  )
}

function PaymentSplitCard({ payments, currency }: { payments: any[], currency: string }) {
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"]
  return (
    <Card className="h-full border-border shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          Payment Split
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {payments.length > 0 ? payments.map((payment: any) => {
          const ratio = total > 0 ? (Number(payment.amount || 0) / total) * 100 : 0
          return (
            <div key={payment.method} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", colors[payments.indexOf(payment) % colors.length])} />
                  <span className="text-sm font-bold">{payment.method}</span>
                </div>
                <span className="text-sm font-black">{currency} {Number(payment.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>{Math.round(ratio)}% of captured sales</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", colors[payments.indexOf(payment) % colors.length])} style={{ width: `${ratio}%` }} />
              </div>
            </div>
          )
        }) : <p className="text-sm text-muted-foreground">No payment data for this window.</p>}
      </CardContent>
    </Card>
  )
}

function ActivityFeed({ activities }: { activities: any[] }) {
  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-4 bg-muted/10 border-b border-border/50 shrink-0">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Real-time Staff Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto flex-1 thin-scrollbar max-h-[465px]">
        <div className="divide-y divide-border/20">
          {activities.length > 0 ? (
            activities.map((log: any) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-muted/20 transition-all cursor-default group">
                <div className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors">
                    <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
	                  <div className="flex items-center justify-between gap-2 mb-1">
	                    <span className="text-xs font-black text-foreground truncate uppercase tracking-tight">
	                      {log.actor_name || "System"}
	                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
	                  </div>
	                  <p className="text-[11px] text-muted-foreground leading-snug">
	                    <span className="font-bold text-foreground uppercase text-[10px]">{String(log.event || "").split('.').pop()}</span>
	                    {log.title ? (
	                      <>: {log.title}</>
	                    ) : (
	                      <> for {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}</>
	                    )}
	                  </p>
	                </div>
	              </div>
	            ))
          ) : (
            <div className="p-16 text-center">
              <p className="text-sm text-muted-foreground font-medium opacity-50 italic">No activity logs found for today.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryMetric({ label, value, prefix = "", suffix = "", icon }: any) {
  return (
    <Card className="bg-card border-border shadow-md hover:border-primary/40 transition-all group overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardContent className="p-5 flex flex-col justify-center h-full">
        <div className="flex items-center gap-2 mb-2">
           <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
              {icon}
           </div>
           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
             {label}
           </p>
        </div>
        <div className="text-xl font-black text-foreground tabular-nums">
          <span className="text-xs font-normal mr-0.5 opacity-50">{prefix}</span>
          {Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          <span className="text-xs font-normal ml-0.5 opacity-50">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function Receipt({ className }: { className?: string }) { return <CreditCard className={className} /> }

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96 transition-all" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* Health Cards Skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 flex justify-between items-center shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        ))}
      </section>

      {/* Summary Bar Skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        ))}
      </section>

      {/* Charts Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-xl p-6 h-[400px] shadow-sm flex flex-col gap-4">
           <Skeleton className="h-6 w-48" />
           <Skeleton className="flex-1 w-full" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 h-[400px] shadow-sm flex flex-col gap-4">
           <Skeleton className="h-6 w-32" />
           <div className="flex-1 flex items-center justify-center">
              <Skeleton className="h-64 w-64 rounded-full" />
           </div>
        </div>
      </section>
    </div>
  )
}
