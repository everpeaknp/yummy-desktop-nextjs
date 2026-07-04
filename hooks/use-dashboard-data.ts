"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DateRange } from "react-day-picker"
import { DateRangePreset } from "@/components/ui/date-range-dropdown"
import apiClient from "@/lib/api-client"
import { DashboardApis, AnalyticsApis, TableApis, TransactionsApis } from "@/lib/api/endpoints"
import { hasAnalyticsViewPermission } from "@/lib/role-permissions"
import {
  mapAnalyticsTrends,
  mapBreakdownToPie,
  preferHourlyTrends,
} from "@/lib/analytics-dashboard-mapper"
import { formatDateYmd, resolveDateRange } from "@/lib/dashboard-utils"

const LIVE_POLL_MS = 30_000
const ANALYTICS_POLL_MS = 300_000

export function useDashboardData(
  user: {
    restaurant_id?: number | null
    role?: string | null
    roles?: string[] | null
    permissions?: string[]
  } | null,
  activeRange: DateRangePreset,
  date: DateRange | undefined
) {
  const [data, setData] = useState<any>(null)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [occupancy, setOccupancy] = useState<any[]>([])
  const [trendsData, setTrendsData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [deltaData, setDeltaData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsUnavailable, setAnalyticsUnavailable] = useState(false)

  const hasLoadedRef = useRef(false)
  const liveRequestRef = useRef(0)
  const analyticsRequestRef = useRef(0)

  const canViewAnalytics = hasAnalyticsViewPermission(user)

  const fetchLiveData = useCallback(async () => {
    if (!user?.restaurant_id) return

    const requestId = ++liveRequestRef.current
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      const [v2Res, occupancyRes] = await Promise.all([
        apiClient
          .get(
            DashboardApis.dashboardDataV2({
              restaurantId: user.restaurant_id,
              timezone,
              businessLine: "restaurant",
            })
          )
          .catch((err) => {
            console.error("V2 failed:", err)
            return null
          }),
        apiClient
          .get(TableApis.tableSummary(user.restaurant_id))
          .catch((err) => {
            console.error("Occupancy failed:", err)
            return null
          }),
      ])

      if (requestId !== liveRequestRef.current) return

      if (v2Res?.data?.status === "success") {
        setData(v2Res.data.data)
        setError(null)
      } else if (!hasLoadedRef.current) {
        setError("Failed to load live dashboard data.")
      }

      if (occupancyRes?.data?.status === "success") {
        setOccupancy(occupancyRes.data.data || [])
      }
    } catch (err) {
      console.error("Live dashboard fetch error:", err)
      if (requestId === liveRequestRef.current && !hasLoadedRef.current) {
        setError("Failed to synchronize live dashboard data.")
      }
    }
  }, [user?.restaurant_id])

  const fetchAnalyticsBundle = useCallback(async () => {
    if (!user?.restaurant_id) return

    const requestId = ++analyticsRequestRef.current
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { dateFrom, dateTo, startTime, endTime } = resolveDateRange(
      activeRange,
      date
    )

    if (!canViewAnalytics) {
      setAnalyticsData(null)
      setTrendsData([])
      setCategoryData([])
      setActivities([])
      setDeltaData(null)
      setAnalyticsUnavailable(true)
      setAnalyticsError(null)
      return
    }

    setAnalyticsUnavailable(false)

    try {
      const now = new Date()
      let compareStartTime = startTime
      let compareEndTime = endTime

      if (activeRange === "today") {
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)
        compareStartTime = startOfToday.toISOString()
        compareEndTime = new Date().toISOString()
      }

      const [deltaRes, analyticsRes, historyRes] = await Promise.all([
        apiClient
          .get(
            AnalyticsApis.compare({
              restaurantId: user.restaurant_id,
              dateFrom,
              dateTo,
              startTime: compareStartTime,
              endTime: compareEndTime,
              timezone,
              businessLine: "restaurant",
            })
          )
          .catch((err) => {
            console.error("Compare failed:", err)
            return null
          }),
        apiClient
          .get(
            AnalyticsApis.dashboard({
              restaurantId: user.restaurant_id,
              dateFrom,
              dateTo,
              startTime,
              endTime,
              timezone,
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
          }),
        apiClient
          .get(
            TransactionsApis.list({
              restaurantId: user.restaurant_id,
              dateFrom,
              dateTo,
              skip: 0,
              limit: 15,
            })
          )
          .catch((err) => {
            console.error("History failed:", err)
            return null
          }),
      ])

      if (requestId !== analyticsRequestRef.current) return

      let finalDeltaData =
        deltaRes?.data?.status === "success" ? deltaRes.data.data : null

      const dFrom = new Date(dateFrom)
      const dTo = new Date(dateTo)
      let prevDateFrom = dateFrom
      let prevDateTo = dateTo

      if (activeRange === "today") {
        const y = new Date(dFrom)
        y.setDate(y.getDate() - 1)
        prevDateFrom = formatDateYmd(y)
        prevDateTo = formatDateYmd(y)
      } else if (activeRange === "yesterday") {
        const y = new Date(dFrom)
        y.setDate(y.getDate() - 1)
        prevDateFrom = formatDateYmd(y)
        prevDateTo = formatDateYmd(y)
      } else if (activeRange === "last7") {
        const yStart = new Date(dFrom)
        yStart.setDate(yStart.getDate() - 7)
        const yEnd = new Date(dTo)
        yEnd.setDate(yEnd.getDate() - 7)
        prevDateFrom = formatDateYmd(yStart)
        prevDateTo = formatDateYmd(yEnd)
      } else if (activeRange === "last30") {
        const yStart = new Date(dFrom)
        yStart.setDate(yStart.getDate() - 30)
        const yEnd = new Date(dTo)
        yEnd.setDate(yEnd.getDate() - 30)
        prevDateFrom = formatDateYmd(yStart)
        prevDateTo = formatDateYmd(yEnd)
      } else if (activeRange === "month") {
        const yStart = new Date(dFrom)
        yStart.setMonth(yStart.getMonth() - 1)
        const yEnd = new Date(yStart.getFullYear(), yStart.getMonth() + 1, 0)
        prevDateFrom = formatDateYmd(yStart)
        prevDateTo = formatDateYmd(yEnd)
      } else if (activeRange === "lastMonth") {
        const previousStart = new Date(dFrom.getFullYear(), dFrom.getMonth() - 1, 1)
        const previousEnd = new Date(dFrom.getFullYear(), dFrom.getMonth(), 0)
        prevDateFrom = formatDateYmd(previousStart)
        prevDateTo = formatDateYmd(previousEnd)
      }

      const prevAnalyticsRes = await apiClient
        .get(
          AnalyticsApis.dashboard({
            restaurantId: user.restaurant_id,
            dateFrom: prevDateFrom,
            dateTo: prevDateTo,
            timezone,
            businessLine: "restaurant",
            include: "core,insights",
          })
        )
        .catch(() => null)

      if (requestId !== analyticsRequestRef.current) return

      if (
        analyticsRes?.data?.status === "success" &&
        prevAnalyticsRes?.data?.status === "success"
      ) {
        const currOverview =
          analyticsRes.data.data?.tabs?.overview?.overview ||
          analyticsRes.data.data?.overview ||
          {}
        const prevOverview =
          prevAnalyticsRes.data.data?.tabs?.overview?.overview ||
          prevAnalyticsRes.data.data?.overview ||
          {}

        const currOrders = currOverview.orders_count || 0
        const prevOrders = prevOverview.orders_count || 0
        const currAov =
          currOverview.avg_order_value || currOverview.average_order_value || 0
        const prevAov =
          prevOverview.avg_order_value || prevOverview.average_order_value || 0
        const currIncome =
          currOverview.total_income || currOverview.gross_sales || 1
        const prevIncome =
          prevOverview.total_income || prevOverview.gross_sales || 1
        const currMargin =
          ((currOverview.net_profit || currOverview.total_income || 0) /
            currIncome) *
          100
        const prevMargin =
          ((prevOverview.net_profit || prevOverview.total_income || 0) /
            prevIncome) *
          100

        const calcPct = (curr: number, prev: number) =>
          prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100

        finalDeltaData = {
          current: finalDeltaData?.current || {},
          previous: {
            ...(finalDeltaData?.previous || {}),
            orders: prevOrders,
            aov: prevAov,
            margin: prevMargin,
          },
          deltas: {
            ...(finalDeltaData?.deltas || {}),
            orders_pct: calcPct(currOrders, prevOrders),
            aov_pct: calcPct(currAov, prevAov),
            margin_pct: calcPct(currMargin, prevMargin),
          },
        }
      }

      setDeltaData(finalDeltaData)

      if (analyticsRes?.data?.status === "success") {
        const analytics = analyticsRes.data.data
        setAnalyticsData(analytics)
        setAnalyticsError(null)
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
    } catch (err) {
      console.error("Analytics dashboard fetch error:", err)
      if (requestId === analyticsRequestRef.current) {
        setAnalyticsError("Failed to load analytics data.")
      }
    }
  }, [user?.restaurant_id, activeRange, date, canViewAnalytics])

  const fetchAll = useCallback(
    async (options?: { initial?: boolean }) => {
      if (!user?.restaurant_id) return
      const isInitial = options?.initial ?? !hasLoadedRef.current

      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      await Promise.all([fetchLiveData(), fetchAnalyticsBundle()])

      hasLoadedRef.current = true
      setLastUpdated(new Date())
      setLoading(false)
      setRefreshing(false)
    },
    [user?.restaurant_id, fetchLiveData, fetchAnalyticsBundle]
  )

  const retry = useCallback(() => {
    fetchAll({ initial: false })
  }, [fetchAll])

  useEffect(() => {
    if (!user?.restaurant_id) return
    if (activeRange === "custom" && (!date?.from || !date?.to)) return

    hasLoadedRef.current = false
    fetchAll({ initial: true })
  }, [user?.restaurant_id, activeRange, date?.from, date?.to, fetchAll])

  useEffect(() => {
    if (!user?.restaurant_id) return
    if (activeRange === "custom" && (!date?.from || !date?.to)) return

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLiveData()
      }
    }

    const liveInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLiveData().then(() => setLastUpdated(new Date()))
      }
    }, LIVE_POLL_MS)

    const analyticsInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAnalyticsBundle().then(() => setLastUpdated(new Date()))
      }
    }, ANALYTICS_POLL_MS)

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearInterval(liveInterval)
      clearInterval(analyticsInterval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [
    user?.restaurant_id,
    activeRange,
    date?.from,
    date?.to,
    fetchLiveData,
    fetchAnalyticsBundle,
  ])

  const { dateFrom, dateTo } = resolveDateRange(activeRange, date)

  return {
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
    canViewAnalytics,
    dateFrom,
    dateTo,
    retry,
    fetchAll,
  }
}
