"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { useAuth } from "@/hooks/use-auth"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import {
  mapServiceEfficiency,
  preferHourlyTrends,
  sortTopItemsByUnitsSold,
  topItemQuantitySold,
} from "@/lib/analytics-dashboard-mapper"
import {
  buildExportFilename,
  getCompareLabel,
  getDashboardHealth,
  getPeriodLabel,
  mergeDashboardInsights,
} from "@/lib/dashboard-utils"
import { cn } from "@/lib/utils"
import { DashboardStatusBanner } from "@/components/dashboard/dashboard-status-banner"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { UnifiedInsightsCard } from "@/components/dashboard/unified-insights-card"
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
  Armchair,
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Info,
  Lightbulb,
  Plus,
  QrCode,
  ReceiptText,
  Smartphone,
  Siren,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  AlertCircle,
  XCircle,
  Briefcase,
  ExternalLink,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"

export default function DashboardPage() {
  const user = useAuth(state => state.user)
  const [activeRange, setActiveRange] = useState<DateRangePreset>("today")
  const [date, setDate] = useState<DateRange | undefined>()

  const {
    data,
    analyticsData,
    occupancy,
    trendsData,
    categoryData,
    activities,
    deltaData,
    loading,
    refreshing,
    lastUpdated,
    error,
    analyticsError,
    analyticsUnavailable,
    dateFrom,
    dateTo,
    retry,
  } = useDashboardData(user, activeRange, date)

  const connectionHealth = getDashboardHealth(error, analyticsError, Boolean(data))
  const periodLabel = getPeriodLabel(activeRange)
  const compareLabel = getCompareLabel(activeRange)

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
  const healthSnapshot = data?.health
  const overview =
    analyticsData?.tabs?.overview?.overview || analyticsData?.overview || {}
  const v2Kpis = data?.kpis
  const currency = analyticsData?.meta?.currency || data?.meta?.currency || "NPR"
  const analyticsTopItems =
    analyticsData?.tabs?.menu?.top_items?.items ||
    analyticsData?.tabs?.orders?.top_selling_items?.items ||
    analyticsData?.tabs?.menu?.menu_snapshot?.top_items ||
    analyticsData?.menu_snapshot?.top_items ||
    []
  // Analytics uses completed sales for the selected date range; V2 live items only reflect active orders (often qty 1).
  const topItems = sortTopItemsByUnitsSold(
    analyticsTopItems.length > 0
      ? analyticsTopItems
      : topItemsLive.length > 0
        ? topItemsLive
        : data?.breakdowns?.top_items || []
  )
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
  const mapCompareTrend = (pct?: number, prevValue?: number) => {
    if (pct === undefined || pct === null) return undefined;
    const base = { previous_value: prevValue };
    if (pct > 0) return { direction: 'UP', delta_percent: pct, ...base };
    if (pct < 0) return { direction: 'DOWN', delta_percent: Math.abs(pct), ...base };
    return { direction: 'SAME', delta_percent: 0, ...base };
  }

  const executiveMetrics = analyticsData?.tabs?.overview?.executive_summary?.metrics || [];
  const findExecutiveMetric = (keys: string[]) => {
    for (const key of keys) {
      const found = executiveMetrics.find((m: any) => m?.key === key);
      if (found) return found;
    }
    return null;
  };
  const incomeExecutive = findExecutiveMetric(["income", "sales"]);
  const ordersExecutive = findExecutiveMetric(["orders"]);
  const executiveIncomeDelta = incomeExecutive?.delta?.vs_previous_period_pct;
  const executiveOrdersDelta = ordersExecutive?.delta?.vs_previous_period_pct;
  const executivePrevIncome = incomeExecutive?.delta?.previous_value;
  const executivePrevOrders = ordersExecutive?.delta?.previous_value;

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
    cancelled_today: shiftPulse?.cancelled ?? healthSnapshot?.cancelled_today ?? 0,
    refunded_today: shiftPulse?.refunded ?? healthSnapshot?.refunded_today ?? 0,
  }

  const handleExport = async () => {
    const XLSX = await import("xlsx")
    const exportData = [
      { Metric: "Period", Value: periodLabel },
      { Metric: "Date From", Value: dateFrom },
      { Metric: "Date To", Value: dateTo },
      { Metric: "Gross Sales", Value: kpis.gross_sales },
      { Metric: "Net Profit", Value: kpis.net_profit },
      { Metric: "Profit Margin %", Value: kpis.profit_margin },
      { Metric: "Total Orders", Value: kpis.total_orders },
      { Metric: "Avg Order Value", Value: kpis.average_order_value },
      { Metric: "Total Expenses", Value: kpis.total_expense },
      { Metric: "Cancelled", Value: kpis.cancelled_today },
      { Metric: "Refunded", Value: kpis.refunded_today },
    ]
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Summary")
    XLSX.writeFile(wb, buildExportFilename(activeRange, dateFrom, dateTo))
  }

  const aiInsights =
    analyticsData?.insights ||
    analyticsData?.tabs?.overview?.alert_insights?.items ||
    []
  const mergedInsights = mergeDashboardInsights(quickInsights, aiInsights)

  const salesVsLabel =
    activeRange === "today" ? "Sales vs Yesterday" : `Sales vs ${compareLabel}`;
  const ordersVsLabel =
    activeRange === "today" ? "Orders vs Yesterday" : `Orders vs ${compareLabel}`;

  const salesTrendPct = executiveIncomeDelta ?? deltaData?.deltas?.income_pct;
  const salesTrendPrev = executivePrevIncome ?? deltaData?.previous?.income;
  const ordersTrendPct = executiveOrdersDelta ?? deltaData?.deltas?.orders_pct;
  const ordersTrendPrev = executivePrevOrders ?? deltaData?.previous?.orders;

  const serviceEfficiency = mapServiceEfficiency(analyticsData)

  const trendCards = [
    {
      label: salesVsLabel,
      trend:
        mapCompareTrend(salesTrendPct, salesTrendPrev) ||
        data?.trends?.sales_vs_yesterday,
    },
    {
      label: ordersVsLabel,
      trend:
        mapCompareTrend(ordersTrendPct, ordersTrendPrev) ||
        data?.trends?.orders_vs_yesterday,
    },
  ];

  const healthBadge =
    connectionHealth === "live"
      ? {
          label: "Live",
          className:
            "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
          dot: "bg-emerald-500 animate-pulse",
        }
      : connectionHealth === "degraded"
        ? {
            label: "Degraded",
            className:
              "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
            dot: "bg-amber-500",
          }
        : {
            label: "Offline",
            className:
              "bg-destructive/10 text-destructive border-destructive/20",
            dot: "bg-destructive",
          }

  return (
    <div className="dashboard-ui relative flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4">
      {refreshing ? (
        <div className="pointer-events-none absolute right-4 top-0 z-10 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Refreshing…
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="dc-page-title">Executive Dashboard</h1>
          <p className="dc-page-subtitle">
            Real-time operational overview for {data?.meta?.outlet_name || "your outlet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeDropdown
            activeRange={activeRange}
            setActiveRange={setActiveRange}
            date={date}
            setDate={setDate}
          />
          {connectionHealth === "live" ? (
            <Badge
              variant="secondary"
              className="gap-2 shrink-0 border border-green-200 bg-green-500/10 py-1 px-3 text-green-600"
            >
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              System Online
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className={cn("gap-2 shrink-0 border py-1 px-3", healthBadge.className)}
            >
              <div className={cn("h-2 w-2 rounded-full", healthBadge.dot)} />
              {healthBadge.label}
            </Badge>
          )}
        </div>
      </div>

      <DashboardStatusBanner
        error={error}
        analyticsError={analyticsError}
        refreshing={refreshing}
        onRetry={retry}
      />

      {/* Live shift metrics — not affected by date filter */}
      <div className="flex flex-col gap-3">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <HealthCard
          label="Active Orders"
          value={shiftPulse?.active_orders ?? healthSnapshot?.active_orders ?? 0}
          icon={<Activity className="h-5 w-5" />}
          color="text-primary"
          hoverTitle="Active Orders"
          hoverDetail={(count) => (
            <>
              A total of <strong className="text-foreground font-bold">{count}</strong> orders are
              currently active{" "}
              <span className="underline decoration-muted-foreground/30 underline-offset-4">
                in this shift.
              </span>
            </>
          )}
        />
        <HealthCard
          label="KOT Pending"
          value={shiftPulse?.kot_pending ?? healthSnapshot?.kot_pending ?? 0}
          icon={<Clock className="h-5 w-5" />}
          color="text-amber-500"
          hoverTitle="Pending KOTs"
          hoverDetail={(count) => (
            <>
              A total of <strong className="text-foreground font-bold">{count}</strong> kitchen
              tickets are pending{" "}
              <span className="underline decoration-muted-foreground/30 underline-offset-4">
                right now.
              </span>
            </>
          )}
        />
        <HealthCard
          label="Delayed KOTs"
          value={shiftPulse?.kot_delayed ?? healthSnapshot?.kot_delayed ?? 0}
          icon={<AlertCircle className="h-5 w-5" />}
          color="text-destructive"
          pulse={(shiftPulse?.kot_delayed ?? healthSnapshot?.kot_delayed ?? 0) > 0}
          hoverTitle="Delayed KOTs"
          hoverDetail={(count) => (
            <>
              A total of <strong className="text-foreground font-bold">{count}</strong> KOT
              {count === 1 ? " is" : "s are"} delayed{" "}
              <span className="underline decoration-muted-foreground/30 underline-offset-4">
                right now.
              </span>
            </>
          )}
        />
      </section>

      {/* 1.1 Summary Bar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div className="group relative overflow-hidden dc-card min-h-[108px] p-5 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 cursor-default">
              <div className="absolute top-0 right-0 w-28 h-28 bg-destructive/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20 group-hover:bg-destructive/15 transition-colors shadow-sm">
                  <XCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="dc-metric-label mb-1">Cancelled Today</p>
                  <p className="text-2xl font-black tracking-tight tabular-nums">{kpis.cancelled_today}</p>
                </div>
              </div>
              <TrendingUp className="h-6 w-6 text-muted-foreground opacity-10 group-hover:opacity-20 transition-opacity" />
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="start" side="bottom" sideOffset={8} className="w-[var(--radix-hover-card-trigger-width)] p-0 overflow-hidden rounded-2xl border-border/40 shadow-xl bg-card">
            <div className="flex items-start gap-4 p-5 border-b border-border/40">
              <div className="p-2.5 rounded-full text-destructive bg-destructive/10">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-[15px] text-foreground tracking-tight">Cancelled Orders</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">Detailed insights</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                A total of <strong className="text-foreground font-bold">{kpis.cancelled_today}</strong> orders were cancelled <span className="underline decoration-muted-foreground/30 underline-offset-4">by today.</span>
              </p>
            </div>
            <div className="px-5 py-4 border-t border-border/40 flex justify-between items-center bg-card">
              <span className="text-[13px] text-muted-foreground">Data as of</span>
              <span className="text-[13px] font-medium text-muted-foreground">
                {new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
              </span>
            </div>
          </HoverCardContent>
        </HoverCard>

        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div className="group relative overflow-hidden dc-card min-h-[108px] p-5 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 cursor-default">
              <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/5 rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/15 transition-colors shadow-sm">
                  <CreditCard className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="dc-metric-label mb-1">Refunded Today</p>
                  <p className="text-2xl font-black tracking-tight tabular-nums">{kpis.refunded_today}</p>
                </div>
              </div>
              <TrendingUp className="h-6 w-6 text-muted-foreground opacity-10 group-hover:opacity-20 transition-opacity" />
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="start" side="bottom" sideOffset={8} className="w-[var(--radix-hover-card-trigger-width)] p-0 overflow-hidden rounded-2xl border-border/40 shadow-xl bg-card">
            <div className="flex items-start gap-4 p-5 border-b border-border/40">
              <div className="p-2.5 rounded-full text-blue-500 bg-blue-500/10">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-[15px] text-foreground tracking-tight">Refunded Orders</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">Detailed insights</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                A total of <strong className="text-foreground font-bold">{kpis.refunded_today}</strong> items were refunded <span className="underline decoration-muted-foreground/30 underline-offset-4">by today.</span>
              </p>
            </div>
            <div className="px-5 py-4 border-t border-border/40 flex justify-between items-center bg-card">
              <span className="text-[13px] text-muted-foreground">Data as of</span>
              <span className="text-[13px] font-medium text-muted-foreground">
                {new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
              </span>
            </div>
          </HoverCardContent>
        </HoverCard>
      </section>
      </div>

      {/* Priorities */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <AlertsBanner alerts={alerts} attentionItems={attentionItems} />
        <QuickActionsCard actions={quickActions} />
        <DayCloseCashWatchCard
          dayCloseStatus={dayCloseStatus}
          cashWatch={cashWatch}
          currency={currency}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <AttentionItemsCard items={attentionItems} />
          <TrendComparisonSection trendCards={trendCards} />
        </div>
        <UnifiedInsightsCard
          insights={mergedInsights}
          loading={loading}
          unavailable={analyticsUnavailable}
        />
      </section>

      {/* Financial summary — moved up */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="dc-card-title text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Financial Summary
            </h2>
            <p className="dc-page-subtitle mt-1">
              KPIs for {periodLabel}
              {dateFrom !== dateTo ? ` (${dateFrom} – ${dateTo})` : ` (${dateFrom})`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="dc-filter-refresh h-9 gap-2 rounded-2xl px-4">
              <Link href="/analytics">
                Full analytics
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              onClick={handleExport}
              size="sm"
              className="dc-btn-close-day h-9 gap-2 rounded-2xl px-4 font-medium"
              disabled={analyticsUnavailable && !data}
            >
              <Download className="h-4 w-4" />
              Export summary
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryMetric label="Gross Sales" value={kpis.gross_sales} prefix={currency} icon={<DollarSign className="h-4 w-4" />} trend={mapCompareTrend(salesTrendPct, salesTrendPrev) || data?.trends?.sales_vs_yesterday} compareLabel={compareLabel} />
          <SummaryMetric label="Net Profit" value={kpis.net_profit} prefix={currency} icon={<TrendingUp className="h-4 w-4" />} trend={mapCompareTrend(deltaData?.deltas?.profit_pct, deltaData?.previous?.profit)} compareLabel={compareLabel} />
          <SummaryMetric label="Profit Margin %" value={kpis.profit_margin} suffix="%" icon={<Lightbulb className="h-4 w-4" />} trend={mapCompareTrend(deltaData?.deltas?.margin_pct, deltaData?.previous?.margin)} compareLabel={compareLabel} />
          <SummaryMetric label="Total Orders" value={kpis.total_orders} icon={<Briefcase className="h-4 w-4" />} trend={mapCompareTrend(ordersTrendPct, ordersTrendPrev) || data?.trends?.orders_vs_yesterday} compareLabel={compareLabel} />
          <SummaryMetric label="Avg Order Value" value={kpis.average_order_value} prefix={currency} icon={<ReceiptText className="h-4 w-4" />} trend={mapCompareTrend(deltaData?.deltas?.aov_pct, deltaData?.previous?.aov)} compareLabel={compareLabel} />
          <SummaryMetric label="Total Expenses" value={kpis.total_expense} prefix={currency} icon={<Wallet className="h-4 w-4" />} trend={mapCompareTrend(deltaData?.deltas?.expense_pct, deltaData?.previous?.expense)} compareLabel={compareLabel} />
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {analyticsUnavailable ? (
          <Card className="lg:col-span-2 dc-card border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Revenue and source breakdown charts require the reports.analytics.view permission.
            </CardContent>
          </Card>
        ) : analyticsError ? (
          <Card className="lg:col-span-2 dc-card border-destructive/30 bg-destructive/5">
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

      {/* Operational pulse */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OccupancyCard tables={occupancy} occupancySnapshot={home?.occupancy} />
        <OperationalPulseCard efficiency={serviceEfficiency} unavailable={analyticsUnavailable} />
      </section>

      {/* 3.1 Staff activity & order status */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed activities={activities} />
        <OrderStatusCard statuses={orderStatus} />
      </section>

      {/* 4. Performers & Staff Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
            <Card className="h-full dc-card">
                <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10">
                    <CardTitle className="dc-card-title flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-primary" />
                        Top Performing Items
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-5">
                       {topItems.slice(0, 8).map((item: any, index: number) => (
                         <div key={item.item_id ?? item.id ?? `${item.name}-${index}`} className="flex items-center justify-between group">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate pr-4 group-hover:text-primary transition-colors">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{topItemQuantitySold(item)} units sold</p>
                            </div>
                            <div className="text-right">
                                <p className="dc-amount text-sm">{currency} {item.revenue?.toLocaleString()}</p>
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

    </div>
  )
}

function HealthCard({
  label,
  value,
  icon,
  color,
  pulse = false,
  hoverTitle,
  hoverDescription = "Detailed insights",
  hoverDetail,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  pulse?: boolean
  hoverTitle?: string
  hoverDescription?: string
  hoverDetail?: (value: number) => React.ReactNode
}) {
  const showAlert = pulse && value > 0
  const panelTitle = hoverTitle ?? label
  const detail =
    hoverDetail?.(value) ?? (
      <>
        A total of <strong className="text-foreground font-bold">{value}</strong>{" "}
        {label.toLowerCase()}{" "}
        <span className="underline decoration-muted-foreground/30 underline-offset-4">
          in this shift.
        </span>
      </>
    )

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "group block cursor-default",
            showAlert ? "animate-none" : ""
          )}
        >
          <Card
            className={cn(
              "dc-card relative overflow-hidden transition-all duration-300 hover:-translate-y-1",
              showAlert ? "border-destructive/30 ring-1 ring-destructive/50 shadow-destructive/10" : "",
            )}
          >
            <div className="pointer-events-none absolute top-0 right-0 -mr-4 -mt-4 h-28 w-28 rounded-bl-[100px] bg-[#fbfbfb] transition-transform group-hover:scale-110 dark:bg-white/[0.04]" />
            <CardContent className="relative z-10 flex min-h-[108px] items-center justify-between p-5">
              <div>
                <p className="dc-metric-label mb-1.5">{label}</p>
                <p
                  className={cn(
                    "text-3xl font-black tabular-nums tracking-tight text-foreground",
                    showAlert ? "animate-pulse text-destructive" : "",
                  )}
                >
                  {value}
                </p>
              </div>
              <div
                className={cn(
                  "relative z-20 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white shadow-sm transition-colors duration-300 group-hover:scale-110 dark:border-white/15 dark:bg-muted [&_svg]:h-5 [&_svg]:w-5",
                  color,
                  showAlert ? "border-destructive/20 bg-destructive/[0.06]" : "group-hover:bg-primary/5",
                )}
              >
                {icon}
              </div>
            </CardContent>
          </Card>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[var(--radix-hover-card-trigger-width)] p-0 overflow-hidden rounded-2xl border-border/40 shadow-xl bg-card"
      >
        <div className="flex items-start gap-4 p-5 border-b border-border/40">
          <div className={cn("p-2.5 rounded-full bg-muted/30", color)}>{icon}</div>
          <div>
            <p className="font-bold text-[15px] text-foreground tracking-tight">{panelTitle}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{hoverDescription}</p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-[14px] text-muted-foreground leading-relaxed">{detail}</p>
        </div>
        <div className="px-5 py-4 border-t border-border/40 flex justify-between items-center bg-card">
          <span className="text-[13px] text-muted-foreground">Data as of</span>
          <span className="text-[13px] font-medium text-muted-foreground">
            {new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function TrendCard({ label, trend }: { label: string, trend: any }) {
  const hasTrend = trend && trend.delta_percent !== undefined && trend.delta_percent !== null
  const direction = String(trend?.direction || "SAME").toUpperCase()
  const isUp = direction === "UP"
  const isDown = direction === "DOWN"
  const delta = Math.abs(Number(trend?.delta_percent || 0))

  return (
    <Card className="dc-card hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
      <CardContent className="p-6 relative z-10">
        <div className="dc-metric-label mb-1">{label}</div>
        <div className="flex items-end gap-3">
          <span className="dc-metric-value text-3xl">
            {hasTrend ? `${delta.toFixed(1)}%` : "—"}
          </span>
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

function OccupancyCard({ tables, occupancySnapshot }: { tables: any[]; occupancySnapshot?: any }) {
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
    <Link href="/tables" className="block h-full">
    <Card className="dc-card h-full overflow-hidden transition-all hover:-translate-y-1">
      <CardHeader className="pb-2 border-b border-black/[0.08] dark:border-white/10">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Live Table Occupancy
          <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="dc-metric-value text-3xl">{occupied}</span>
            <span className="text-muted-foreground text-xs ml-1 font-medium">/ {total} Tables Active</span>
          </div>
          <Badge className={cn("font-bold px-2 py-1", pct > 80 ? "bg-destructive text-white" : "bg-green-500 text-white")}>
            {pct}% Busy
          </Badge>
        </div>
        <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
          <div className={cn("h-full transition-all duration-700", pct > 80 ? "bg-destructive" : pct > 50 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-muted/50 p-2 rounded-lg text-center border border-black/[0.08] dark:border-white/15">
            <p className="dc-eyebrow">Available</p>
            <p className="dc-metric-value text-sm">{free}</p>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center border border-black/[0.08] dark:border-white/15">
            <p className="dc-eyebrow">Capacity</p>
            <p className="dc-metric-value text-sm">{capacity}</p>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  )
}

function OperationalPulseCard({
  efficiency,
  unavailable = false,
}: {
  efficiency: ReturnType<typeof mapServiceEfficiency>
  unavailable?: boolean
}) {
  const peakHourLabel = efficiency.peak_hour || "—"
  const avgPrepLabel =
    efficiency.avg_service_time_min === null
      ? "—"
      : efficiency.completed_orders === 0
        ? "—"
        : `${Number(efficiency.avg_service_time_min).toFixed(
            efficiency.avg_service_time_min < 10 ? 1 : 0
          )} mins`
  const cancellationPct = efficiency.order_cancellation_pct
  const cancellationLabel =
    cancellationPct === null ? "—" : `${Number(cancellationPct).toFixed(1)}%`

  return (
    <Link href="/analytics" className="block h-full">
    <Card className="dc-card h-full transition-all hover:-translate-y-1">
      <CardHeader className="pb-2 border-b border-black/[0.08] dark:border-white/10">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-500" />
          Service Efficiency
          <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {unavailable ? (
          <p className="text-sm text-muted-foreground">
            Analytics access is required to load service efficiency metrics.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="dc-metric-label">
                  Peak Demand Hour
                </p>
                <p className="truncate text-sm font-semibold">{peakHourLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="dc-metric-label">
                  Avg Prep Time
                </p>
                <p className="text-sm font-semibold">{avgPrepLabel}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-black/[0.08] dark:border-white/10 pt-2">
              <span className="dc-metric-label">
                Cancellation Rate
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "font-bold",
                  cancellationPct !== null && cancellationPct > 10
                    ? "border-destructive/20 bg-destructive/5 text-destructive"
                    : "border-green-200 bg-green-50/50 text-green-600"
                )}
              >
                {cancellationLabel}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </Link>
  )
}

function AlertsBanner({
  alerts,
  attentionItems = [],
}: {
  alerts: any[]
  attentionItems?: any[]
}) {
  const primary = alerts[0]
  const severity = String(primary?.severity || "LOW").toUpperCase()
  const tone =
    severity === "HIGH" || severity === "CRITICAL"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : severity === "MEDIUM" || severity === "WARNING"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-600"
        : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"

  const firstAttention = attentionItems[0]
  const href = firstAttention?.route
    ? firstAttention.route === "/running-orders" && firstAttention.entity_id
      ? `/orders/${firstAttention.entity_id}`
      : firstAttention.route
    : alerts.length > 0
      ? "/analytics"
      : undefined

  const content = (
    <Card
      className={cn(
        "dc-card h-full transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group",
        tone,
        href && "cursor-pointer",
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Siren className="h-4 w-4" />
          Alerts
          {href ? <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-60" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-semibold">
          {primary?.message || "No critical operational alerts right now."}
        </p>
        <p className="text-xs text-muted-foreground">
          {primary?.action_hint ||
            (alerts.length > 1
              ? `+${alerts.length - 1} more alerts available.`
              : "System is stable.")}
        </p>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

const QUICK_ACTION_ROUTE_MAP: Record<string, string> = {
  create_order: "/orders/new",
  running_orders: "/orders/active",
  kot: "/kitchen",
  tables: "/tables",
  reservations: "/reservations",
  day_close: "/day-close",
}

const QUICK_ACTION_LEGACY_ROUTE_MAP: Record<string, string> = {
  "/orders/create": "/orders/new",
  "/running-orders": "/orders/active",
  "/kot-management": "/kitchen",
}

const QUICK_ACTION_ICON_MAP: Record<string, LucideIcon> = {
  create_order: Plus,
  running_orders: ClipboardList,
  kot: ChefHat,
  tables: Armchair,
  reservations: Calendar,
  day_close: ReceiptText,
}

function resolveQuickActionHref(action: { key?: string; route?: string }) {
  if (action.key && QUICK_ACTION_ROUTE_MAP[action.key]) {
    return QUICK_ACTION_ROUTE_MAP[action.key]
  }
  if (action.route && QUICK_ACTION_LEGACY_ROUTE_MAP[action.route]) {
    return QUICK_ACTION_LEGACY_ROUTE_MAP[action.route]
  }
  return action.route || "#"
}

function resolveQuickActionIcon(action: { key?: string }): LucideIcon {
  if (action.key && QUICK_ACTION_ICON_MAP[action.key]) {
    return QUICK_ACTION_ICON_MAP[action.key]
  }
  return Zap
}

function QuickActionsCard({ actions }: { actions: any[] }) {
  const enabledActions = actions.filter((action: any) => action.enabled).slice(0, 6)
  return (
    <Card className="dc-card transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-2">
        <CardTitle className="dc-card-title">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {enabledActions.map((action: any) => {
            const Icon = resolveQuickActionIcon(action)
            return (
              <Link
                key={action.key}
                href={resolveQuickActionHref(action)}
                className={cn(
                  "group/btn relative flex flex-col items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-black/[0.08] bg-transparent px-3 py-4 text-center transition-all dark:border-white/15",
                  "hover:-translate-y-0.5 hover:border-black/[0.12] hover:bg-primary/5 hover:text-primary dark:hover:border-white/25",
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100" />
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-primary shadow-sm transition-transform group-hover/btn:scale-105 dark:border-white/15 dark:bg-muted">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="relative z-10 text-xs font-medium leading-tight text-foreground">
                  {action.title}
                </p>
              </Link>
            )
          })}
          {enabledActions.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground md:col-span-3">
              No quick actions available.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DayCloseCashWatchCard({
  dayCloseStatus,
  cashWatch,
  currency,
}: {
  dayCloseStatus: any
  cashWatch: any
  currency: string
}) {
  const status = String(dayCloseStatus?.status || "unavailable").replace(/_/g, " ")
  const actionLabel = dayCloseStatus?.action_label || "Start Day Close"
  const cashRows = [
    { label: "Cash", value: cashWatch?.cash_collected || 0 },
    { label: "Digital", value: cashWatch?.digital_collected || 0 },
    { label: "Credit", value: cashWatch?.credit_sales || 0 },
    { label: "Outstanding", value: cashWatch?.total_outstanding || 0 },
  ]

  return (
    <Card className="dc-card relative overflow-hidden transition-all duration-300 group hover:-translate-y-1">
      <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-bl-[80px] bg-primary/5 transition-transform group-hover:scale-110" />
      <CardHeader className="relative z-10 pb-3">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Day Close
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-medium capitalize text-foreground">{status}</p>
            <p className="dc-page-subtitle">Today&apos;s settlement status</p>
          </div>
          <Button asChild size="sm" className="dc-btn-close-day h-9 shrink-0 gap-2 rounded-2xl px-4 font-medium">
            <Link href={dayCloseStatus?.route || "/day-close"}>
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="border-t border-border/40 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-500" />
            <p className="dc-card-title text-sm">Cash Watch</p>
          </div>
          {cashWatch?.available === false ? (
            <p className="text-sm text-muted-foreground">
              {cashWatch?.reason || "Cash watch is unavailable."}
            </p>
          ) : (
            <div className="space-y-3">
              {cashRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold tabular-nums dc-amount">
                    {currency} {Number(row.value || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
      <div className="flex items-center justify-between gap-3">
        <h3 className="dc-card-title">Needs Attention</h3>
        {visibleItems.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Swipe through issues</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="dc-filter-control h-7 w-7 rounded-full shrink-0"
                onClick={() => advanceAttentionItem(-1)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                aria-label="Previous issue"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="dc-filter-control h-7 w-7 rounded-full shrink-0"
                onClick={() => advanceAttentionItem(1)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                aria-label="Next issue"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
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
        </div>
      ) : (
        <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/[0.05]">
          <CardContent className="py-5 text-sm font-medium">No urgent operational issues right now.</CardContent>
        </Card>
      )}
    </div>
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
    <Card className="dc-card transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-3">
        <CardTitle className="dc-card-title">Order Status</CardTitle>
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

const PAYMENT_METHOD_VISUALS: Record<
  string,
  { icon: LucideIcon; iconClass: string; barClass: string; bgClass: string }
> = {
  cash: {
    icon: Banknote,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    barClass: "bg-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
  card: {
    icon: CreditCard,
    iconClass: "text-blue-600 dark:text-blue-400",
    barClass: "bg-blue-500",
    bgClass: "bg-blue-500/10",
  },
  digital: {
    icon: Smartphone,
    iconClass: "text-purple-600 dark:text-purple-400",
    barClass: "bg-purple-500",
    bgClass: "bg-purple-500/10",
  },
  fonepay: {
    icon: QrCode,
    iconClass: "text-fuchsia-600 dark:text-fuchsia-400",
    barClass: "bg-fuchsia-500",
    bgClass: "bg-fuchsia-500/10",
  },
  credit: {
    icon: Wallet,
    iconClass: "text-orange-600 dark:text-orange-400",
    barClass: "bg-orange-500",
    bgClass: "bg-orange-500/10",
  },
}

const PAYMENT_METHOD_FALLBACK_COLORS = [
  { barClass: "bg-amber-500", bgClass: "bg-amber-500/10", iconClass: "text-amber-600" },
  { barClass: "bg-rose-500", bgClass: "bg-rose-500/10", iconClass: "text-rose-600" },
  { barClass: "bg-sky-500", bgClass: "bg-sky-500/10", iconClass: "text-sky-600" },
]

function resolvePaymentMethodVisual(method: string, index: number) {
  const key = String(method || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")

  if (PAYMENT_METHOD_VISUALS[key]) {
    return PAYMENT_METHOD_VISUALS[key]
  }

  if (key.includes("cash")) return PAYMENT_METHOD_VISUALS.cash
  if (key.includes("card")) return PAYMENT_METHOD_VISUALS.card
  if (key.includes("digital") || key.includes("qr")) return PAYMENT_METHOD_VISUALS.digital
  if (key.includes("fonepay") || key.includes("fone")) return PAYMENT_METHOD_VISUALS.fonepay
  if (key.includes("credit") || key.includes("outstanding")) return PAYMENT_METHOD_VISUALS.credit

  const fallback = PAYMENT_METHOD_FALLBACK_COLORS[index % PAYMENT_METHOD_FALLBACK_COLORS.length]
  return {
    icon: Wallet,
    iconClass: fallback.iconClass,
    barClass: fallback.barClass,
    bgClass: fallback.bgClass,
  }
}

function PaymentSplitCard({ payments, currency }: { payments: any[]; currency: string }) {
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return (
    <Card className="dc-card h-full transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
      <CardHeader className="pb-4 border-b border-black/[0.08] dark:border-white/10 relative z-10">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          Payment Split
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {payments.length > 0 ? payments.map((payment: any, index: number) => {
          const ratio = total > 0 ? (Number(payment.amount || 0) / total) * 100 : 0
          const visual = resolvePaymentMethodVisual(payment.method, index)
          const Icon = visual.icon
          return (
            <div key={`${payment.method}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40",
                      visual.bgClass
                    )}
                  >
                    <Icon className={cn("h-4 w-4", visual.iconClass)} />
                  </div>
                  <span className="truncate text-sm font-bold">{payment.method}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums dc-amount">
                  {currency} {Number(payment.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pl-12 text-xs text-muted-foreground">
                <span>{Math.round(ratio)}% of captured sales</span>
              </div>
              <div className="ml-12 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", visual.barClass)}
                  style={{ width: `${ratio}%` }}
                />
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
    <Card className="dc-card overflow-hidden h-full flex flex-col transition-all duration-300 hover:-translate-y-1 relative group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
      <CardHeader className="pb-4 bg-muted/10 border-b border-black/[0.08] dark:border-white/10 shrink-0 relative z-10">
        <CardTitle className="dc-card-title flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Real-time Staff Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto flex-1 thin-scrollbar max-h-[465px]">
        <div className="divide-y divide-border/20">
          {activities.length > 0 ? (
            activities.map((log: any) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-muted/20 transition-all cursor-default group">
                <div className="w-8 h-8 rounded-full bg-background border border-black/[0.08] dark:border-white/15 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors">
                    <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="flex-1 min-w-0">
	                  <div className="flex items-center justify-between gap-2 mb-1">
	                    <span className="text-xs font-semibold text-foreground truncate tracking-tight">
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

function SummaryMetric({ label, value, prefix = "", suffix = "", icon, trend, compareLabel = "previous period" }: any) {
  const isUp = trend?.direction?.toUpperCase() === 'UP';
  const isDown = trend?.direction?.toUpperCase() === 'DOWN';
  const isSame = trend?.direction?.toUpperCase() === 'SAME';
  const trendColor = isUp ? "bg-emerald-500/10 text-emerald-500" : isDown ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <Card className="dc-card hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative cursor-default">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary/40 to-primary group-hover:w-full group-hover:opacity-5 transition-all duration-500" />
          <CardContent className="p-5 flex flex-col justify-center h-full relative z-10">
            <div className="flex items-center gap-2 mb-2">
               <div className="p-1.5 rounded-md border border-black/[0.08] bg-white text-muted-foreground group-hover:text-primary group-hover:border-black/[0.12] transition-colors dark:border-white/15 dark:bg-muted">
                  {icon}
               </div>
               <p className="dc-metric-label">
                 {label}
               </p>
            </div>
            <div className="dc-metric-value tabular-nums">
              <span className="text-xs font-normal mr-0.5 opacity-50">{prefix}</span>
              {Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span className="text-xs font-normal ml-0.5 opacity-50">{suffix}</span>
            </div>
          </CardContent>
        </Card>
      </HoverCardTrigger>
      <HoverCardContent align="start" side="bottom" sideOffset={8} className="w-[max(320px,var(--radix-hover-card-trigger-width))] p-0 overflow-hidden rounded-2xl border-border/40 shadow-xl bg-card">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-border/40">
           <div className="p-2.5 flex items-center justify-center rounded-full text-primary bg-primary/10">
             {icon}
           </div>
           <div>
             <p className="font-bold text-[15px] text-foreground tracking-tight">Total Amount of {label}</p>
             <p className="text-[13px] text-muted-foreground mt-0.5">Detailed insights</p>
           </div>
        </div>
        
        {/* Performance Box */}
        {trend && (
          <div className="p-5 space-y-6">
             <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-2xl border border-black/[0.08] dark:border-white/15">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-semibold text-foreground">PERFORMANCE</span>
                  <Badge variant="outline" className={cn("border-transparent rounded-lg px-2.5 py-0.5 text-[13px] font-medium flex items-center gap-1.5", trendColor)}>
                    {`${isUp ? '+' : isDown ? '-' : ''}${trend.delta_percent}%`}
                    {isUp && <TrendingUp className="w-4 h-4" />}
                    {isDown && <TrendingDown className="w-4 h-4" />}
                  </Badge>
                </div>
                <p className="text-[14px] text-muted-foreground">
                   {`Compared to ${compareLabel}${trend.previous_value !== undefined ? ` (was ${prefix}${Number(trend.previous_value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix})` : ''}`}
                </p>
             </div>

             <p className="text-[14px] text-muted-foreground leading-relaxed">
               A total {String(label).toLowerCase().includes("income") || String(label).toLowerCase().includes("sales") ? "income of" : "of"} <strong className="text-foreground font-bold">{prefix}{Number(value).toLocaleString()}{suffix}</strong> was {String(label).toLowerCase().includes("income") || String(label).toLowerCase().includes("sales") ? "earned" : "generated"} <span className="underline decoration-muted-foreground/30 underline-offset-4">by today.</span>
             </p>
          </div>
        )}

        {!trend && (
          <div className="p-5">
             <p className="text-[14px] text-muted-foreground leading-relaxed">
               A total {String(label).toLowerCase().includes("income") || String(label).toLowerCase().includes("sales") ? "income of" : "of"} <strong className="text-foreground font-bold">{prefix}{Number(value).toLocaleString()}{suffix}</strong> was {String(label).toLowerCase().includes("income") || String(label).toLowerCase().includes("sales") ? "earned" : "generated"} <span className="underline decoration-muted-foreground/30 underline-offset-4">by today.</span>
             </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/40 flex justify-between items-center bg-card">
          <span className="text-[13px] text-muted-foreground">Data as of</span>
          <span className="text-[13px] font-medium text-muted-foreground">
            {new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

