"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import apiClient from "@/lib/api-client"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { DashboardApis, HistoryApis, AnalyticsApis, TableApis } from "@/lib/api/endpoints"
import { RevenueChart } from "@/components/analytics/revenue-chart"
import { CategoryPieChart } from "@/components/analytics/category-pie"
import * as XLSX from "xlsx"
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
  Briefcase
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

  const me = useAuth(state => state.me)
  const router = useRouter()

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
      if (!user && token) await me()
      if (!user && !token) router.push('/')
    }
    const timer = setTimeout(checkAuth, 300)
    return () => clearTimeout(timer)
  }, [user, me, router])

  // 2. Data Fetching
  const fetchDashboard = async () => {
    if (!user?.restaurant_id) return

    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const last30Days = new Date()
      last30Days.setDate(today.getDate() - 30)
      const last30DaysStr = last30Days.toISOString().split('T')[0]

      // Fetch V2 Dashboard (Health, Basic KPIs)
      const v2Res = await apiClient.get(DashboardApis.dashboardDataV2({
        restaurantId: user.restaurant_id
      })).catch(err => { console.error("V2 failed:", err); return null })

      // Fetch Advanced Analytics (Last 30 Days to match Analytics page)
      const analyticsRes = await apiClient.get(
        `/analytics/dashboard?restaurant_id=${user.restaurant_id}&date_from=${last30DaysStr}&date_to=${todayStr}`
      ).catch(err => { console.error("Analytics failed:", err); return null })

      // Fetch History
      const historyRes = await apiClient.get(HistoryApis.listAuditLogs(
        new URLSearchParams({ restaurant_id: user.restaurant_id.toString(), limit: "15" }).toString()
      )).catch(err => { console.error("History failed:", err); return null })

      // Fetch Occupancy
      const occupancyRes = await apiClient.get(TableApis.tableSummary(user.restaurant_id))
        .catch(err => { console.error("Occupancy failed:", err); return null })

      if (v2Res?.data?.status === "success") setData(v2Res.data.data)
      
      if (analyticsRes?.data?.status === "success") {
        const analytics = analyticsRes.data.data
        setAnalyticsData(analytics)
        
        if (analytics.trends) {
          setTrendsData(analytics.trends.map((item: any) => ({
            date: item.date,
            value: item.income
          })))
        }
        
        if (analytics.breakdown) {
          // User requested 'source breakdown' from analytics page to be used here
          const list = analytics.breakdown.income_by_source || [] 
          setCategoryData(list.map((item: any) => ({ name: item.label, value: item.amount })))
        }
      }

      if (historyRes?.data?.status === "success") {
        setActivities(historyRes.data.data.items || [])
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
      fetchDashboard()
      const interval = setInterval(fetchDashboard, 60000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Export Reporting
  const handleExport = () => {
    if (!analyticsData) return
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

  const health = data?.health
  const overview = analyticsData?.overview
  const v2Kpis = data?.kpis
  const currency = analyticsData?.meta?.currency || data?.meta?.currency || "NPR"
  const topItems = analyticsData?.menu_snapshot?.top_items || data?.breakdowns?.top_items || []
  
  const kpis = {
    gross_sales: overview?.total_income ?? v2Kpis?.gross_sales ?? 0,
    net_profit: overview?.net_profit ?? 0,
    profit_margin: overview?.profit_margin ?? 0,
    total_orders: overview?.orders_count ?? v2Kpis?.total_orders ?? 0,
    average_order_value: overview?.avg_order_value ?? v2Kpis?.average_order_value ?? 0,
    total_expense: overview?.total_expense ?? 0,
    cancelled_today: overview?.cancelled_count || 0,
    refunded_today: overview?.refunded_count || 0,
  }

  return (
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4">
      {/* 0. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground text-sm font-medium">Real-time operational overview for {data?.meta?.outlet_name || "your outlet"}</p>
        </div>
        <Badge variant="secondary" className="gap-2 py-1 px-3 bg-green-500/10 text-green-600 border border-green-200">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
           System Online
        </Badge>
      </div>

      {/* 1. Health Cards (Top) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthCard 
           label="Active Orders" 
           value={health?.active_orders || 0} 
           icon={<Activity className="h-5 w-5" />}
           color="text-primary"
        />
        <HealthCard 
           label="KOT Pending" 
           value={health?.kot_pending || 0} 
           icon={<Clock className="h-5 w-5" />}
           color="text-amber-500"
        />
        <HealthCard 
           label="Delayed KOTs" 
           value={health?.kot_delayed || 0} 
           icon={<AlertCircle className="h-5 w-5" />}
           color="text-destructive"
           pulse={ (health?.kot_delayed || 0) > 0 }
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

      {/* 2. Charts (Side-by-Side) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-[400px]">
           <RevenueChart data={trendsData} loading={loading} />
        </div>
        <div className="h-[400px]">
           <CategoryPieChart 
              data={categoryData} 
              loading={loading} 
              title="Sales by Source" 
              description="Breakdown of sales by order source (Dine-in, Takeaway, etc.)"
           />
        </div>
      </section>

      {/* 3. Operational Pulse & Intelligence */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <OccupancyCard tables={occupancy} />
          <OperationalPulseCard operations={analyticsData?.operations} />
          <InsightsCard insights={analyticsData?.insights} loading={loading} />
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
                                <p className="text-[10px] text-muted-foreground font-medium">{item.quantity} units sold</p>
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
            <ActivityFeed activities={activities} />
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

function OccupancyCard({ tables }: { tables: any[] }) {
  const occupied = tables.filter(t => t.status === 'occupied').length
  const total = tables.length || 1
  const pct = Math.round((occupied / total) * 100)

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
            <p className="text-sm font-black">{total - occupied}</p>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center border border-border/50">
            <p className="text-[9px] text-muted-foreground uppercase font-black">Capacity</p>
            <p className="text-sm font-black">{Math.round(tables.length ? tables.reduce((acc, t) => acc + (t.capacity || 0), 0) : 0)}</p>
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
                    <span className="font-bold text-foreground uppercase text-[10px]">{log.event.split('.').pop()}</span> for {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
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
