"use client"

import { useEffect, useState } from "react"
import { DateRange } from "react-day-picker"

import { Badge } from "@/components/ui/badge"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { DashboardStatusBanner } from "@/components/dashboard/dashboard-status-banner"
import { FigmaExecutiveDashboard } from "@/components/dashboard/figma-executive-dashboard"
import { MobileDashboardHome } from "@/components/dashboard/mobile-dashboard-home"
import { DateRangeDropdown, DateRangePreset } from "@/components/ui/date-range-dropdown"
import { useAuth } from "@/hooks/use-auth"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { mapAnalyticsTrends, mapBreakdownToPie, preferHourlyTrends } from "@/lib/analytics-dashboard-mapper"
import {
  buildExportFilename,
  getDashboardHealth,
} from "@/lib/dashboard-utils"
import { getTopMenuItemsWithPhotos } from "@/lib/dashboard-menu-items"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const user = useAuth((state) => state.user)
  const [activeRange, setActiveRange] = useState<DateRangePreset>("today")
  const [date, setDate] = useState<DateRange | undefined>()
  const [chartRange, setChartRange] = useState<"hourly" | "daily" | "weekly">("hourly")

  useEffect(() => {
    setChartRange(preferHourlyTrends(activeRange) ? "hourly" : "daily")
  }, [activeRange])

  const {
    data,
    analyticsData,
    trendsData,
    loading,
    refreshing,
    error,
    analyticsError,
    analyticsUnavailable,
    staff,
    occupancy,
    menuItems,
    dateFrom,
    dateTo,
    dateFilterOptions,
    retry,
  } = useDashboardData(user, activeRange, date)

  const connectionHealth = getDashboardHealth(error, analyticsError, Boolean(data))

  if (loading && !data) return <DashboardSkeleton />

  const home = data?.home
  const shiftPulse = home?.shift_pulse
  const cashWatch = home?.cash_watch
  const pipeline = home?.pipeline
  const attentionItems = home?.attention_items?.items || []
  const alerts = home?.alerts?.items || data?.health?.alerts || []
  const quickActions = home?.quick_actions?.items || []
  const health = data?.health
  const currency = analyticsData?.meta?.currency || data?.meta?.currency || "NPR"
  const financeMetrics = analyticsData?.tabs?.finance?.pnl_summary?.metrics || []
  const executiveMetrics = analyticsData?.tabs?.overview?.executive_summary?.metrics || []
  const orderStatuses = pipeline?.status_counts?.length
    ? pipeline.status_counts
    : data?.breakdowns?.order_status || []
  const metricValue = (metrics: any[], keys: string[], fallback = 0) => {
    for (const key of keys) {
      const metric = metrics.find((item: any) => item?.key === key)
      if (typeof metric?.value === "number") return metric.value
    }
    return fallback
  }
  const optionalMetricValue = (metrics: any[], keys: string[]) => {
    for (const key of keys) {
      const metric = metrics.find((item: any) => item?.key === key)
      if (typeof metric?.value === "number" && Number.isFinite(metric.value)) return metric.value
    }
    return undefined
  }
  const optionalMetricDelta = (metrics: any[], keys: string[]) => {
    for (const key of keys) {
      const metric = metrics.find((item: any) => item?.key === key)
      const delta = Number(metric?.delta?.vs_previous_period_pct)
      if (metric?.delta?.vs_previous_period_pct != null && Number.isFinite(delta)) return delta
    }
    return undefined
  }
  const netSales = metricValue(
    financeMetrics,
    ["net_sales"],
    metricValue(executiveMetrics, ["sales", "income"], data?.kpis?.gross_sales ?? 0),
  )
  const livePipelineCount = orderStatuses.reduce(
    (sum: number, item: any) => sum + Number(item.count || 0),
    0,
  )
  const totalOrders = metricValue(
    executiveMetrics,
    ["orders", "total_orders"],
    data?.kpis?.total_orders ?? livePipelineCount,
  )
  const totalSales = optionalMetricValue(financeMetrics, ["gross_income", "gross_sales", "income", "sales"])
    ?? (typeof data?.kpis?.gross_sales === "number" ? data.kpis.gross_sales : undefined)
  const averageOrderValue = optionalMetricValue(executiveMetrics, ["avg_order_value", "average_order_value"])
    ?? (totalOrders > 0 ? netSales / totalOrders : undefined)
  const totalSalesDelta = optionalMetricDelta(financeMetrics, ["gross_income", "gross_sales", "income", "sales"])
    ?? optionalMetricDelta(executiveMetrics, ["sales", "income"])
  const netSalesDelta = optionalMetricDelta(financeMetrics, ["net_sales"])
    ?? optionalMetricDelta(executiveMetrics, ["net_sales"])
  const averageOrderValueDelta = optionalMetricDelta(executiveMetrics, ["avg_order_value", "average_order_value"])
  const liveRevenueTrend = home?.throughput?.points?.map((point: any) => ({
    date: point.timestamp,
    value: Number(point.sales_collected || 0),
  })) || []
  const hourlyTrends = mapAnalyticsTrends(analyticsData, true)
  const dailyTrends = mapAnalyticsTrends(analyticsData, false)
  const paymentMix = mapBreakdownToPie(analyticsData, "payment")
  const sourceMix = mapBreakdownToPie(analyticsData, "source")
  const rankedItemRows = [
    ...(analyticsData?.tabs?.menu?.top_items?.items || []),
    ...(analyticsData?.tabs?.menu?.all_items?.items || []),
    ...(home?.top_items_live?.items || []),
  ]
  const topItemsWithPhotos = getTopMenuItemsWithPhotos({ rankedRows: rankedItemRows, catalog: menuItems })
  const selectedTrends = chartRange === "hourly" ? hourlyTrends : dailyTrends
  const trends = selectedTrends.length ? selectedTrends : trendsData.length ? trendsData : liveRevenueTrend

  const handleExport = async () => {
    const XLSX = await import("xlsx")
    const sheet = XLSX.utils.json_to_sheet([
      { Metric: "Date From", Value: dateFrom },
      { Metric: "Date To", Value: dateTo },
      { Metric: "Net Sales", Value: netSales },
      { Metric: "Total Orders", Value: totalOrders },
      { Metric: "Active Orders", Value: shiftPulse?.active_orders ?? health?.active_orders ?? 0 },
      { Metric: "Pending KOTs", Value: shiftPulse?.kot_pending ?? health?.kot_pending ?? 0 },
      { Metric: "Delayed KOTs", Value: shiftPulse?.kot_delayed ?? health?.kot_delayed ?? 0 },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Summary")
    XLSX.writeFile(workbook, buildExportFilename(activeRange, dateFrom, dateTo))
  }

  const healthBadge = connectionHealth === "live"
    ? { label: "Live", classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500 animate-pulse" }
    : connectionHealth === "degraded"
      ? { label: "Degraded", classes: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" }
      : { label: "Offline", classes: "border-destructive/20 bg-destructive/10 text-destructive", dot: "bg-destructive" }

  return (
    <>
      <MobileDashboardHome home={home} currency={currency} />
      <FigmaExecutiveDashboard
        userName={user?.full_name || ""}
        outletName={data?.meta?.outlet_name || "your outlet"}
        currency={currency}
        dateControl={
          <DateRangeDropdown
            activeRange={activeRange}
            setActiveRange={setActiveRange}
            date={date}
            setDate={setDate}
            presetOptions={dateFilterOptions.length ? dateFilterOptions : undefined}
            showLifetime={dateFilterOptions.some((option) => option.value === "lifetime")}
          />
        }
        statusControl={
          <Badge variant="secondary" className={cn("gap-2 border px-3 py-1", healthBadge.classes)}>
            <span className={cn("h-2 w-2 rounded-full", healthBadge.dot)} />
            {healthBadge.label}
          </Badge>
        }
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
        canShowHourly={preferHourlyTrends(activeRange) && (hourlyTrends.length > 0 || liveRevenueTrend.length > 0)}
        canShowWeekly={dailyTrends.length >= 14}
        connectionMessage={
          <DashboardStatusBanner
            error={error}
            analyticsError={analyticsUnavailable ? null : analyticsError}
            refreshing={refreshing}
            onRetry={retry}
          />
        }
        metrics={{
          activeOrders: shiftPulse?.active_orders ?? health?.active_orders ?? 0,
          kotPending: shiftPulse?.kot_pending ?? health?.kot_pending ?? 0,
          delayedKots: shiftPulse?.kot_delayed ?? health?.kot_delayed ?? 0,
          refunds: shiftPulse?.refunded ?? 0,
          netSales,
          totalOrders,
        }}
        financialSummary={{
          totalSales,
          netSales,
          averageOrderValue,
          totalSalesDelta,
          netSalesDelta,
          averageOrderValueDelta,
        }}
        trends={trends}
        attention={attentionItems.length ? attentionItems : alerts}
        quickActions={quickActions}
        orderStatuses={orderStatuses}
        cashWatch={cashWatch}
        activeOrders={home?.active_orders_preview?.items || []}
        topItems={topItemsWithPhotos}
        paymentMix={paymentMix}
        sourceMix={sourceMix}
        staff={staff}
        occupancy={occupancy}
        dayCloseStatus={home?.day_close_status}
        canViewAnalytics={!analyticsUnavailable}
        onExport={handleExport}
      />
    </>
  )
}
