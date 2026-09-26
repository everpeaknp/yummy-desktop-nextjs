"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BarChart3, ChefHat, ClipboardList, Clock3, DollarSign, Heart, Minus, Plus, ReceiptText, Sparkles, Star, Users, Wallet } from "lucide-react"
import { formatElapsedMinutes, getLiveOrderStatusKind, matchesLiveOrderFilter, type LiveOrderFilter } from "@/lib/dashboard-live-orders"
import { assignPaymentChartColors, paymentInstrumentKey } from "@/lib/payment-chart-colors"
import { completeRevenueSources, revenueSourceColor } from "@/lib/dashboard-source-mix"

type DataRow = Record<string, unknown>
type DashboardProps = {
  userName: string
  outletName: string
  currency: string
  dateControl: ReactNode
  statusControl: ReactNode
  chartRange: "hourly" | "daily" | "weekly"
  onChartRangeChange: (range: "hourly" | "daily" | "weekly") => void
  canShowHourly: boolean
  canShowWeekly: boolean
  connectionMessage?: ReactNode
  metrics: { activeOrders: number; kotPending: number; delayedKots: number; refunds: number; netSales: number; totalOrders: number }
  financialSummary: {
    totalSales?: number
    netSales: number
    averageOrderValue?: number
    totalSalesDelta?: number
    netSalesDelta?: number
    averageOrderValueDelta?: number
  }
  trends: DataRow[]
  attention: DataRow[]
  quickActions: DataRow[]
  orderStatuses: DataRow[]
  cashWatch?: DataRow
  activeOrders: DataRow[]
  topItems: DataRow[]
  paymentMix: DataRow[]
  sourceMix: DataRow[]
  staff: DataRow[]
  occupancy: DataRow[]
  dayCloseStatus?: DataRow
  canViewAnalytics: boolean
  onExport: () => void
}

function value(row: DataRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const item = row[key]
    if (typeof item === "string" && item.trim()) return item
    if (typeof item === "number") return String(item)
  }
  return fallback
}

function amount(value: unknown, currency: string) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function greetingForTime(date: Date) {
  const hour = date.getHours()
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

function menuImageUrl(path: string) {
  return path.startsWith("asset:") ? `/${path.replace("asset:", "assets/")}` : path
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</section>
}

function Metric({ label, value, detail, tone = "orange" }: { label: string; value: ReactNode; detail: string; tone?: "orange" | "blue" | "rose" | "green" | "slate" }) {
  const styles = {
    orange: { card: "border-orange-200/80 bg-orange-50/70 dark:border-border dark:bg-card", icon: "bg-orange-100 text-orange-700 dark:bg-muted dark:text-muted-foreground", bar: "bg-orange-500 dark:bg-orange-400", Icon: ReceiptText },
    blue: { card: "border-blue-200/80 bg-blue-50/70 dark:border-border dark:bg-card", icon: "bg-blue-100 text-blue-700 dark:bg-muted dark:text-muted-foreground", bar: "bg-blue-500 dark:bg-blue-300", Icon: ChefHat },
    rose: { card: "border-rose-200/80 bg-rose-50/70 dark:border-border dark:bg-card", icon: "bg-rose-100 text-rose-700 dark:bg-muted dark:text-muted-foreground", bar: "bg-rose-500 dark:bg-rose-300", Icon: AlertTriangle },
    green: { card: "border-emerald-200/80 bg-emerald-50/70 dark:border-border dark:bg-card", icon: "bg-emerald-100 text-emerald-700 dark:bg-muted dark:text-muted-foreground", bar: "bg-emerald-500 dark:bg-emerald-300", Icon: DollarSign },
    slate: { card: "border-slate-200/80 bg-slate-50/70 dark:border-border dark:bg-card", icon: "bg-slate-200 text-slate-700 dark:bg-muted dark:text-muted-foreground", bar: "bg-slate-500 dark:bg-slate-400", Icon: Wallet },
  }[tone]
  const Icon = styles.Icon
  return <div className={`relative flex min-h-[116px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-4 ${styles.card}`}>
    <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}><Icon className="h-4 w-4" /></span></div>
    <div><p className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p></div>
    <div className={`absolute inset-x-0 bottom-0 h-1 ${styles.bar}`} />
  </div>
}

function Empty({ children }: { children: string }) {
  return <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">{children}</div>
}

const actionRoutes: Record<string, string> = {
  create_order: "/orders/new", running_orders: "/orders/active", kot: "/kitchen",
  tables: "/tables", reservations: "/reservations", day_close: "/day-close",
  "/orders/create": "/orders/new", "/running-orders": "/orders/active", "/kot-management": "/kitchen",
}
const actionIcons: Record<string, typeof ClipboardList> = {
  create_order: ReceiptText, running_orders: ClipboardList, kot: ChefHat,
  tables: ClipboardList, reservations: ReceiptText, day_close: Wallet,
}
function statusTone(status: string) {
  const tone = getLiveOrderStatusKind(status)
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
  if (tone === "info") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
  return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300"
}

function statusDotTone(status: string) {
  const tone = getLiveOrderStatusKind(status)
  return tone === "danger" ? "bg-rose-500 dark:bg-rose-400" : tone === "success" ? "bg-emerald-500 dark:bg-emerald-400" : tone === "info" ? "bg-blue-500 dark:bg-blue-400" : tone === "warning" ? "bg-amber-500 dark:bg-amber-400" : "bg-orange-500 dark:bg-orange-300"
}

export function FigmaExecutiveDashboard({
  userName, outletName, currency, dateControl, statusControl, chartRange, onChartRangeChange,
  canShowHourly, canShowWeekly, connectionMessage, metrics, financialSummary, trends, attention, quickActions, orderStatuses,
  cashWatch, activeOrders, topItems, paymentMix, sourceMix, staff, occupancy, dayCloseStatus, canViewAnalytics, onExport,
}: DashboardProps) {
  const rawChartData = trends.map((row, index) => ({
    label: value(row, ["date", "label", "timestamp"], String(index + 1)),
    amount: Number(row.value ?? row.revenue ?? row.sales_collected ?? 0),
  }))
  const chartData = chartRange === "weekly"
    ? rawChartData.reduce<{ label: string; amount: number }[]>((weeks, point, index) => {
        const weekIndex = Math.floor(index / 7)
        if (!weeks[weekIndex]) weeks[weekIndex] = { label: point.label, amount: 0 }
        weeks[weekIndex].amount += point.amount
        return weeks
      }, [])
    : rawChartData
  const orderedStatuses = [...orderStatuses].sort((a, b) => Number(b.count || 0) - Number(a.count || 0)).slice(0, 5)
  const pipelineOrdersTotal = orderStatuses.reduce((sum, row) => sum + Number(row.count || 0), 0)
  const actions = quickActions.filter((action) => {
    const key = value(action, ["key"])
    return action.enabled !== false && Boolean(actionRoutes[key] || actionRoutes[value(action, ["route"])] || value(action, ["route"]))
  }).slice(0, 4)
  const hasAction = (route: string) => actions.some((action) => {
    const key = value(action, ["key"])
    return actionRoutes[key] === route || actionRoutes[value(action, ["route"])] === route || value(action, ["route"]) === route
  })
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [showAllStaff, setShowAllStaff] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [liveOrderFilter, setLiveOrderFilter] = useState<LiveOrderFilter>("all")
  const alerts = showAllAlerts ? attention : attention.slice(0, 3)
  const visibleLiveOrders = activeOrders.filter((order) => matchesLiveOrderFilter(order, liveOrderFilter))
  const liveOrderFilters: { key: LiveOrderFilter; label: string; count: number }[] = [
    { key: "all", label: "All Running", count: metrics.activeOrders },
    { key: "kitchen", label: "Kitchen KOT", count: metrics.kotPending },
    { key: "pickup", label: "Ready for pickup", count: activeOrders.filter((order) => matchesLiveOrderFilter(order, "pickup")).length },
    { key: "bill", label: "Bill Requested", count: activeOrders.filter((order) => matchesLiveOrderFilter(order, "bill")).length },
  ]
  const highlightItem = topItems[0]
  const [greeting, setGreeting] = useState("Good morning")
  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForTime(new Date()))
    updateGreeting()
    const timer = window.setInterval(updateGreeting, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const payments = cashWatch?.available === false ? [] : cashWatch ? [
    { label: "Cash collected", value: cashWatch?.cash_collected },
    { label: "Digital collected", value: cashWatch?.digital_collected },
    { label: "Credit sales", value: cashWatch?.credit_sales },
  ] : []
  const hasPaymentActivity = paymentMix.some((item) => Number(item.value || 0) > 0)
  const paymentChartData = hasPaymentActivity ? paymentMix : [{ name: "No payments", value: 1 }]
  const paymentColors = assignPaymentChartColors(paymentMix.map((item) => value(item, ["name"], "Other")))
  const revenueSources = completeRevenueSources(sourceMix.map((source) => ({
    name: value(source, ["name"], "Other"),
    value: Number(source.value || 0),
  })))
  const hasSourceRevenue = revenueSources.some((source) => source.value > 0)

  return <div className="hidden md:block">
    <main className="dashboard-executive mx-auto w-full max-w-[1600px] space-y-4 bg-[#faf9f6] px-5 pb-12 pt-6 text-foreground dark:bg-background xl:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {userName || "there"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your live overview for {outletName || "your outlet"}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{dateControl}{statusControl}</div>
      </header>

      {connectionMessage ? <div>{connectionMessage}</div> : null}

      <section aria-label="Current shift" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label="Active orders" value={metrics.activeOrders} detail="Current shift · In progress" tone="orange" />
        <Metric label="Kitchen tickets" value={metrics.kotPending} detail="Current shift · Waiting to be prepared" tone="blue" />
        <Metric label="Delayed tickets" value={metrics.delayedKots} detail={metrics.delayedKots ? "Current shift · Needs follow-up" : "Current shift · On schedule"} tone={metrics.delayedKots ? "rose" : "green"} />
        <Metric label="Refunds" value={metrics.refunds} detail="Selected period" tone="slate" />
        <Metric label="Sales" value={amount(metrics.netSales, currency)} detail="Selected period" tone="green" />
      </section>


      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)]">
        <div className="min-w-0 space-y-4">
<Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold">{chartRange === "hourly" ? "Today’s sales" : "Sales trend"}</h2><p className="mt-1 text-xs text-muted-foreground">Sales collected over the selected period</p></div>
            <div className="flex rounded-lg bg-muted p-1" aria-label="Sales chart range">
              {(["hourly", "daily", "weekly"] as const).map((range) => <button key={range} type="button" disabled={(range === "hourly" && !canShowHourly) || (range === "weekly" && !canShowWeekly)} aria-pressed={chartRange === range} onClick={() => onChartRangeChange(range)} className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${chartRange === range ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{range}</button>)}
            </div>
          </div>
          <div className="h-[260px]">
            {chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs><linearGradient id="dashboard-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--dashboard-chart-orange)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--dashboard-chart-orange)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis width={72} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(n) => Number(n) >= 1000 ? `${Math.round(Number(n) / 1000)}k` : String(n)} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-semibold text-primary">{amount(payload[0]?.value, currency)}</p></div> : null} />
                <Area type="monotone" dataKey="amount" stroke="var(--dashboard-chart-orange)" strokeWidth={2} fill="url(#dashboard-sales-fill)" activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer> : <Empty>No sales activity for this period.</Empty>}
          </div>
        </Panel>
<Panel className="dashboard-muted-card min-w-0 overflow-hidden border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 dark:border-blue-950 dark:from-card dark:to-blue-950/20">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="text-lg font-semibold">Financial Summary</h2>
      {dayCloseStatus?.status ? <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Day close: {formatStatus(String(dayCloseStatus.status))}</span> : null}
    </div>
    <Link href="/day-close" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View Shift Logs <ArrowRight className="h-4 w-4" /></Link>
  </div>
  <p className="mt-1.5 text-sm text-muted-foreground">Your sales and payment mix for the selected period</p>
  <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
    {[
      { label: "Total Sales", value: financialSummary.totalSales, delta: financialSummary.totalSalesDelta },
      { label: "Net Sales", value: financialSummary.netSales, delta: financialSummary.netSalesDelta },
      { label: "Avg. Order Value", value: financialSummary.averageOrderValue, delta: financialSummary.averageOrderValueDelta },
    ].map((metric) => {
      const DeltaIcon = metric.delta != null && metric.delta > 0 ? ArrowUp : metric.delta != null && metric.delta < 0 ? ArrowDown : Minus
      const deltaTone = metric.delta == null || metric.delta === 0 ? "text-muted-foreground" : metric.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      return <div key={metric.label} className="flex min-h-[76px] min-w-0 flex-col justify-center rounded-xl border border-border bg-background/80 px-3 py-2.5">
      <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{metric.value == null ? "—" : amount(metric.value, currency)}</p>
      {metric.delta != null ? <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium tabular-nums ${deltaTone}`}><DeltaIcon className="h-3.5 w-3.5" />{metric.delta > 0 ? "+" : ""}{metric.delta.toFixed(1)}%</p> : null}
    </div>
    })}
  </div>
  <div className="mt-3 min-w-0">
    <div className="min-w-0 rounded-2xl border border-border bg-background/70 p-4">
      <h3 className="mb-2 text-sm font-semibold">Sales by Payment Method</h3>
      {paymentMix.length ? <div className="grid min-w-0 items-center gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
        <div className="mx-auto h-[180px] w-full min-w-0 max-w-[180px]">
          <ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={paymentChartData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={hasPaymentActivity ? 3 : 0}>
              {hasPaymentActivity ? paymentMix.map((item, index) => <Cell key={`${value(item, ["name"])}-${index}`} fill={paymentColors[paymentInstrumentKey(value(item, ["name"], "Other"))]} />) : <Cell fill="#cbd5e1" />}
            </Pie>
            {hasPaymentActivity ? <Tooltip formatter={(value) => amount(value, currency)} /> : null}
          </PieChart></ResponsiveContainer>
        </div>
        <div className="min-w-0 space-y-2.5">
          {(showAllPayments ? paymentMix : paymentMix.slice(0, 6)).map((item, index) => <div key={`${value(item, ["name"])}-${index}`} className={`flex min-w-0 items-center justify-between gap-2 text-sm ${hasPaymentActivity ? "" : "text-muted-foreground"}`}>
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hasPaymentActivity ? paymentColors[paymentInstrumentKey(value(item, ["name"], "Other"))] : "#cbd5e1" }} /><span className="truncate">{value(item, ["name"], "Other")}</span></span>
            <span className="shrink-0 tabular-nums">{amount(item.value, currency)}</span>
          </div>)}
          {paymentMix.length > 6 ? <button type="button" onClick={() => setShowAllPayments((shown) => !shown)} className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-primary transition-colors hover:bg-muted">{showAllPayments ? "Show less" : `View more (${paymentMix.length - 6})`}<ArrowRight className="h-3.5 w-3.5" /></button> : null}
        </div>
      </div> : <Empty>Payment breakdown is unavailable for this period.</Empty>}
    </div>
  </div>
</Panel>
<Panel className="dashboard-muted-card border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/60 p-5 dark:border-emerald-950 dark:from-card dark:to-emerald-950/20"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-muted dark:text-muted-foreground"><Star className="h-4 w-4 fill-current"/></span><div><h2 className="text-base font-semibold">Top performing items</h2><p className="text-xs text-muted-foreground">Best sellers with photos from your menu</p></div></div><div className="flex flex-wrap gap-2">{canViewAnalytics ? <Link href="/analytics" className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-border dark:bg-muted dark:text-muted-foreground"><BarChart3 className="h-4 w-4"/>View analytics</Link> : null}<Link href="/menu/items" className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-slate-700"><Plus className="h-4 w-4"/>Manage menu items</Link></div></div>{topItems.length ? <div className="grid grid-cols-6 gap-2">{topItems.slice(0, 6).map((item,index)=>{const image = value(item,["image"]);const imageSrc = menuImageUrl(image);const name = value(item,["name","label"],"Menu item");return <div key={`${value(item,["id","item_id","name","label"])}-${index}`} className="group min-w-0 rounded-xl border border-emerald-100 bg-white/90 p-2 text-center transition-shadow hover:shadow-md dark:border-border dark:bg-card"><div className="relative mb-2 h-16 overflow-hidden rounded-lg border border-orange-100/80 bg-orange-50 sm:h-20 dark:border-border dark:bg-muted"><Image src={imageSrc} alt={name} title={name} fill unoptimized sizes="(max-width: 1279px) 12vw, 180px" className="object-contain p-1 transition-transform duration-300 group-hover:scale-105 dark:brightness-90"/></div><p title={name} className="line-clamp-2 min-h-8 whitespace-normal break-words text-[10px] font-medium leading-4 sm:text-xs">{name}</p><p className="truncate text-[9px] leading-3 text-muted-foreground sm:text-[10px]">{value(item,["qty","quantity_sold","quantity","orders"],"0")} sold</p><p className="mt-0.5 truncate text-[10px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400 sm:text-xs">{amount(item.revenue ?? item.value, currency)}</p></div>})}</div> : <Empty>No top-selling menu items with photos for this period.</Empty>}</Panel>
        </div>
        <div className="min-w-0 space-y-4">
<Panel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h2 className="text-base font-semibold">Needs attention</h2></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{attention.length} actions</span></div>
          <div className="space-y-3">
            {alerts.map((item, index) => {
              const route = value(item, ["route", "href", "action_url"])
              const severity = value(item, ["severity"], "warning").toLowerCase()
              const title = value(item, ["title", "type"], "Action required")
              const tone = severity === "critical" || severity === "high"
                ? { card: "border-rose-200 bg-rose-50/50 dark:border-border dark:bg-card", label: "text-rose-700 dark:text-rose-300", badge: "bg-rose-100 text-rose-700 dark:bg-muted dark:text-rose-300" }
                : severity === "info"
                  ? { card: "border-blue-200 bg-blue-50/50 dark:border-border dark:bg-card", label: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 text-blue-700 dark:bg-muted dark:text-blue-300" }
                  : { card: "border-amber-200 bg-amber-50/50 dark:border-border dark:bg-card", label: "text-amber-800 dark:text-amber-300", badge: "bg-amber-100 text-amber-800 dark:bg-muted dark:text-amber-300" }
              const age = value(item, ["age_minutes"])
              const action = value(item, ["action_hint"], route ? "Review" : "")
              const content = <div className={`rounded-xl border p-3 ${tone.card}`}>
                <div className="flex items-center justify-between gap-2"><p className={`truncate text-[11px] font-semibold uppercase tracking-wide ${tone.label}`}>{value(item, ["type"], title)}</p><span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${tone.badge}`}>{age ? `${age}m` : severity}</span></div>
                <p className="mt-2 text-sm font-semibold leading-5">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{value(item, ["subtitle", "message"], "Review this item")}</p>
                {action && route ? <span className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-lg border border-current/20 bg-background/80 px-3 text-xs font-semibold">{action}<ArrowRight className="h-3.5 w-3.5" /></span> : null}
              </div>
              return route ? <Link href={route} key={`${route}-${index}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : <div key={`${title}-${index}`}>{content}</div>
            })}
            {alerts.length === 0 ? <Empty>No urgent issues right now.</Empty> : null}
          </div>
          {attention.length > 3 ? <button type="button" onClick={() => setShowAllAlerts((shown) => !shown)} className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-primary transition-colors hover:bg-muted">{showAllAlerts ? "Show less" : `View more (${attention.length - 3})`}<ArrowRight className="h-4 w-4" /></button> : null}
          {hasAction("/orders/active") ? <Link href="/orders/active" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Review active orders <ArrowRight className="h-4 w-4" /></Link> : null}
        </Panel>
<Panel className="p-5"><div className="mb-4 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary"/><h2 className="text-base font-semibold">Floor staff on duty</h2></div><span className="text-xs text-muted-foreground">{staff.length} active</span></div>{staff.length ? <div className="space-y-2">{(showAllStaff ? staff : staff.slice(0, 5)).map((member,index)=><div key={value(member,["id","user_id"],String(index))} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span className="min-w-0"><span className="block truncate text-sm font-medium">{value(member,["user_name","name"],"Team member")}</span><span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">{value(member,["role","primary_role"],"Staff")}</span></span><span className="rounded-full bg-muted px-2 py-1 text-xs">{value(member,["active_orders","assigned_orders"],"On duty")}</span></div>)}</div> : <Empty>No staff profiles available.</Empty>}{staff.length > 5 ? <button type="button" onClick={() => setShowAllStaff((shown) => !shown)} className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-primary transition-colors hover:bg-muted">{showAllStaff ? "Show less" : `View more (${staff.length - 5})`}<ArrowRight className="h-4 w-4" /></button> : null}{occupancy.length ? <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Table occupancy data is available in the tables workspace.</p> : null}</Panel>

        </div>
      </section>
      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <Panel className="dashboard-muted-card flex h-full min-w-0 flex-col border-violet-100 bg-gradient-to-br from-white via-white to-violet-50/60 p-5 dark:border-violet-950 dark:from-card dark:to-violet-950/20">
  <div className="mb-4 flex items-start justify-between gap-3">
    <div><h2 className="text-base font-semibold">Revenue by Source</h2><p className="mt-1 text-xs text-muted-foreground">Real-time split across dine-in, takeaway &amp; delivery</p></div>
    {financialSummary.averageOrderValue != null ? <span className="shrink-0 text-xs text-muted-foreground">Avg Ticket: {amount(financialSummary.averageOrderValue, currency)}</span> : null}
  </div>
  {hasSourceRevenue ? <>
    <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted" aria-label="Revenue by source distribution">
      {revenueSources.filter((source) => source.value > 0).map((source) => {
        const total = revenueSources.reduce((sum, row) => sum + row.value, 0)
        const share = total ? source.value / total * 100 : 0
        return <span key={source.name} className="h-full" style={{ backgroundColor: revenueSourceColor(source.name), width: `${share}%` }} />
      })}
    </div>
    <div className="space-y-3">
      {revenueSources.slice(0, 5).map((source) => {
        const total = revenueSources.reduce((sum, row) => sum + row.value, 0)
        const share = total ? source.value / total * 100 : 0
        const hasRevenue = source.value > 0
        return <div key={source.name} className={`flex items-center justify-between gap-3 text-sm ${hasRevenue ? "" : "text-muted-foreground"}`}>
          <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hasRevenue ? revenueSourceColor(source.name) : "#94a3b8" }} /><span className="truncate capitalize">{source.name}</span></span>
          <span className="shrink-0 text-right"><span className={`block font-semibold tabular-nums ${hasRevenue ? "" : "text-muted-foreground"}`}>{amount(source.value, currency)}</span><span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span></span>
        </div>
      })}
    </div>
  </> : <div className="flex min-h-56 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-6 py-8 text-center">
    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"><ReceiptText className="h-5 w-5" /></span>
    <h3 className="text-base font-semibold">No revenue yet</h3>
    <p className="mt-1 max-w-xs text-sm text-muted-foreground">Revenue by source will appear here once a sale is recorded for this period.</p>
    {hasAction("/orders/new") ? <Link href="/orders/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:bg-orange-400 dark:text-slate-950 dark:hover:bg-orange-300"><Plus className="h-4 w-4" />New order<ArrowRight className="h-4 w-4" /></Link> : null}
  </div>}
  {hasSourceRevenue && highlightItem ? <div className="mt-auto flex items-center justify-between gap-3 border-t border-violet-100 pt-3 text-xs dark:border-violet-950"><span className="min-w-0 truncate text-muted-foreground">Most popular: <strong className="font-medium text-foreground">{value(highlightItem, ["name", "label"], "Menu item")}</strong></span><span className="shrink-0 font-medium">{value(highlightItem, ["qty", "quantity_sold", "quantity", "orders"], "0")} sold</span></div> : null}
</Panel>
        <div className="min-w-0 space-y-4">
                {actions.length ? <Panel className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div><h2 className="text-base font-semibold">Quick Actions</h2><p className="mt-1 text-xs text-muted-foreground">Jump straight into a task</p></div>
                    <span aria-hidden="true" className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700 dark:bg-muted dark:text-muted-foreground">{actions.length} shortcuts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                    {actions.map((action, index) => {
                      const key = value(action, ["key"])
                      const route = actionRoutes[key] || actionRoutes[value(action, ["route"])] || value(action, ["route"], "#")
                      const Icon = actionIcons[key] || ReceiptText
                      const isPrimary = route === "/orders/new"
                      return <Link key={`${key}-${index}`} href={route} className={`group flex min-h-[72px] min-w-0 items-center gap-2 rounded-xl border p-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:gap-2.5 sm:p-3 ${isPrimary ? "border-orange-300 bg-orange-50/80 shadow-sm hover:border-orange-400 hover:bg-orange-100/80 dark:border-orange-500/40 dark:bg-orange-500/15 dark:hover:bg-orange-500/20" : "border-border bg-background/70 hover:border-orange-200 hover:bg-orange-50/50 hover:shadow-sm dark:bg-background/40 dark:hover:border-orange-500/35 dark:hover:bg-orange-500/10"}`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${isPrimary ? "bg-orange-500 text-white dark:bg-orange-400 dark:text-slate-950" : "bg-orange-100 text-orange-700 group-hover:bg-orange-500 group-hover:text-white dark:bg-muted dark:text-muted-foreground dark:group-hover:bg-orange-400 dark:group-hover:text-slate-950"}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="line-clamp-2 min-h-8 whitespace-normal break-words text-xs font-semibold leading-4 sm:text-sm">{value(action, ["title"], "Open")}</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{value(action, ["subtitle", "description"], "Open workspace")}</span></span>
                        <ArrowRight aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 text-orange-500 transition-transform group-hover:translate-x-0.5 dark:text-orange-300 sm:block" />
                      </Link>
                    })}
                  </div>
                </Panel> : null}


      <Panel className="dashboard-muted-card relative overflow-hidden border-orange-200/80 bg-gradient-to-r from-[#fff8ef] via-[#fff5e8] to-[#ffecd8] p-0 dark:border-orange-950 dark:from-orange-950/30 dark:via-card dark:to-amber-950/20">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-12 h-24 w-40 rounded-full bg-orange-200/40 dark:bg-slate-800/40" />
        {highlightItem ? <div className="relative flex min-h-[142px] items-center justify-between gap-2 px-5 py-4 sm:min-h-[158px] sm:px-7">
          <div className="relative z-10 min-w-0 flex-1">
            <div className="relative mb-2 inline-flex items-center">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute -left-7 -top-2 h-6 w-6 text-orange-500 dark:text-muted-foreground" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4"><path d="M12 1v6M4 4l4 4M1 12h6" /></svg>
              <span className="rounded-full bg-orange-100/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-muted dark:text-muted-foreground">Selected-period highlight</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute -right-7 -top-2 h-6 w-6 rotate-12 text-orange-500 dark:text-muted-foreground" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4"><path d="M12 1v6M4 4l4 4M1 12h6" /></svg>
            </div>
            <h2 className="truncate text-2xl font-extrabold leading-tight tracking-tight sm:text-[30px]">{value(highlightItem, ["name", "label"], "Top menu item")}</h2>
            <p className="mt-0.5 text-[21px] font-semibold leading-tight text-orange-600 dark:text-orange-300" style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}>is leading this period!</p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground sm:text-base">
              <span className="inline-flex items-center gap-1.5"><Users aria-hidden="true" className="h-4 w-4" />{value(highlightItem, ["qty", "quantity_sold", "quantity", "orders"], "0")} sold</span>
              <span aria-hidden="true" className="text-orange-400">|</span>
              <span className="text-emerald-600 dark:text-emerald-400">{amount(highlightItem.revenue ?? highlightItem.value, currency)}</span>
            </p>
          </div>
          {value(highlightItem, ["image"]) ? <div className="relative h-28 w-32 shrink-0 sm:h-36 sm:w-40">
            <div aria-hidden="true" className="absolute inset-1 rounded-full bg-white/55 dark:bg-white/5" />
            <Image src={menuImageUrl(value(highlightItem, ["image"]))} alt={value(highlightItem, ["name", "label"], "Top menu item")} fill unoptimized sizes="160px" className="relative z-10 object-contain p-1 drop-shadow-sm" />
            <Sparkles aria-hidden="true" className="absolute -right-1 top-0 z-20 h-5 w-5 text-orange-500 dark:text-muted-foreground" />
            <Heart aria-hidden="true" className="absolute bottom-0 left-1 z-20 h-5 w-5 -rotate-12 text-rose-500 dark:text-muted-foreground" />
          </div> : null}
        </div> : <div className="relative p-5"><span className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Selected-period highlight</span><p className="mt-2 text-sm text-muted-foreground">Item highlights appear when sales data is available.</p></div>}
      </Panel>
        </div>
      </section>
      <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel className="dashboard-muted-card flex h-full flex-col border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-5 dark:border-blue-950 dark:from-card dark:to-blue-950/20">
          <div className="mb-4 flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-600 dark:text-muted-foreground"/><h2 className="text-base font-semibold">Shift snapshot</h2></div>
          {payments.length ? <div className="grid grid-cols-3 gap-2">{payments.map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-blue-100 bg-white/70 px-2.5 py-3 dark:border-border dark:bg-background/50 sm:px-3"><span className="block truncate text-[11px] text-muted-foreground sm:text-xs">{item.label}</span><span className="mt-1 block truncate text-sm font-semibold tabular-nums sm:text-base">{amount(item.value, currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No collection data available for this shift.</p>}
          <div className="mt-auto flex flex-wrap gap-2 border-t border-blue-100 pt-3 dark:border-border">{hasAction("/kitchen") ? <Link href="/kitchen" className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white/70 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-slate-700"><ChefHat className="h-4 w-4"/>Kitchen tickets</Link> : null}{hasAction("/day-close") ? <Link href="/day-close" className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white/70 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-slate-700"><Clock3 className="h-4 w-4"/>Day close</Link> : null}</div>
        </Panel>
        <Panel className="h-full p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /><h2 className="text-base font-semibold">Current order pipeline</h2></div><span className="text-xs text-muted-foreground">{pipelineOrdersTotal} orders</span></div>
          {pipelineOrdersTotal > 0 && orderedStatuses.length ? <div className="space-y-4">{orderedStatuses.map((row, index) => { const status = value(row, ["status", "name"], "Orders"); const color = status.toLowerCase().includes("complete") ? "#10b981" : status.toLowerCase().includes("ready") ? "#14b8a6" : status.toLowerCase().includes("prep") ? "#3b82f6" : status.toLowerCase().includes("request") ? "#f59e0b" : "var(--dashboard-chart-orange)"; return <div key={`${status}-${index}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="truncate capitalize">{status.replaceAll("_", " ").toLowerCase()}</span><span className="font-medium tabular-nums">{Number(row.count || 0)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ backgroundColor: color, width: `${Math.min(100, Number(row.count || 0) / pipelineOrdersTotal * 100)}%` }} /></div></div>})}</div> : <div className="flex min-h-16 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />No orders in the pipeline right now.</div>}
        </Panel>
      </section>
      <Panel className="overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Live floor &amp; kitchen order monitor</h2>
            <span className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300">{metrics.activeOrders} Active</span>
          </div>
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="group" aria-label="Filter live orders">
            {liveOrderFilters.map((filter) => <button key={filter.key} type="button" aria-pressed={liveOrderFilter === filter.key} onClick={() => setLiveOrderFilter(filter.key)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${liveOrderFilter === filter.key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {filter.label} <span className="ml-0.5 tabular-nums">({filter.count})</span>
            </button>)}
          </div>
        </div>
        {visibleLiveOrders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"><tr>{["Order # / Table", "Server", "Ordered items summary", "Type", "Elapsed", "Bill total", "Status", "Quick actions"].map((heading) => <th key={heading} className="px-4 py-3.5 font-medium">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {visibleLiveOrders.map((order, index) => {
              const id = value(order, ["order_id", "id"], String(index))
              const status = value(order, ["status"], "open")
              const statusKey = status.toLowerCase()
              const dotTone = statusDotTone(status)
              return <tr key={id} className="transition-colors hover:bg-orange-50/40 dark:hover:bg-orange-950/10">
                <td className="whitespace-nowrap px-4 py-3.5"><div className="flex items-center gap-2.5"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotTone}`} /><span><span className="block font-semibold">{value(order, ["label", "table_name"], `Order #${id}`)}</span><span className="block text-xs text-muted-foreground">{value(order, ["ticket_number", "kot_number", "order_number"], `#${id}`)}</span></span></div></td>
                <td className="whitespace-nowrap px-4 py-3.5">{value(order, ["server_name"], "—")}</td>
                <td className="max-w-[340px] px-4 py-3.5"><span className="block truncate font-medium">{value(order, ["items_summary"], "Items updating")}</span>{value(order, ["note", "items_note", "station_name"]) ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{value(order, ["note", "items_note", "station_name"])}</span> : null}</td>
                <td className="whitespace-nowrap px-4 py-3.5"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">{value(order, ["channel"], "—").replaceAll("_", " ")}</span></td>
                <td className={`whitespace-nowrap px-4 py-3.5 text-xs tabular-nums ${statusKey.includes("delay") ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{formatElapsedMinutes(Number(value(order, ["age_minutes"], "0")))}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium tabular-nums">{order.grand_total == null ? "—" : amount(order.grand_total, currency)}</td>
                <td className="whitespace-nowrap px-4 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${statusTone(status)}`}>{status.replaceAll("_", " ")}</span></td>
                <td className="whitespace-nowrap px-4 py-3.5"><Link href={`/orders/${id}`} className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:border-orange-900 dark:hover:bg-orange-950/40">Open</Link></td>
              </tr>
            })}
          </tbody>
        </table></div> : <Empty>{activeOrders.length ? "No matching priority tickets in this preview." : "No active orders right now."}</Empty>}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Showing {visibleLiveOrders.length} priority {liveOrderFilter === "all" ? "live tickets" : "tickets"} of {metrics.activeOrders} total active orders</div>
      </Panel>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {canViewAnalytics ? <Link href="/analytics" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><BarChart3 className="h-4 w-4" /> Open detailed analytics <ArrowRight className="h-4 w-4" /></Link> : <span />}
        <button type="button" onClick={onExport} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><DollarSign className="h-4 w-4" /> Export summary</button>
      </footer>
    </main>
  </div>
}
