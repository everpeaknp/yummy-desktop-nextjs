"use client"

import Link from "next/link"
import {
  Activity,
  Armchair,
  BarChart3,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock3,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import { type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  home: any
  outletName?: string
  currency: string
}

const actionRoutes: Record<string, string> = {
  create_order: "/orders/new",
  running_orders: "/orders/active",
  kot: "/kitchen",
  tables: "/tables",
  reservations: "/reservations",
  day_close: "/day-close",
  "/orders/create": "/orders/new",
  "/running-orders": "/orders/active",
  "/kot-management": "/kitchen",
}

const actionIcons: Record<string, LucideIcon> = {
  create_order: Plus,
  running_orders: ClipboardList,
  kot: ChefHat,
  tables: Armchair,
  reservations: CalendarDays,
  day_close: ReceiptText,
}

const explore = [
  { label: "Reservations", href: "/reservations", icon: CalendarDays },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Customers", href: "/customers", icon: Users },
]

function resolveActionHref(action: any) {
  return actionRoutes[action?.key] || actionRoutes[action?.route] || action?.route || "/dashboard"
}

function money(value: unknown, currency: string) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{children}</h2>
}

export function MobileDashboardHome({ home, outletName, currency }: Props) {
  const shift = home?.shift_pulse
  const cash = home?.cash_watch
  const pipeline = home?.pipeline
  const attention = home?.attention_items?.items || []
  const quickActions = (home?.quick_actions?.items || []).filter((item: any) => item.enabled).filter((item: any) => !["tables", "reservations"].includes(item.key)).slice(0, 6)
  const topItems = (home?.top_items_live?.items || []).slice(0, 4)
  const insight = home?.quick_insights?.items?.[0] || home?.alerts?.items?.[0]
  const completed = (pipeline?.status_counts || []).filter((item: any) => String(item.status).toUpperCase() === "COMPLETED").reduce((total: number, item: any) => total + Number(item.count || 0), 0)
  const liveMetrics = [
    { label: "Active", value: shift?.active_orders ?? 0, detail: "In progress", icon: Activity, tone: "text-teal-600 bg-teal-500/10" },
    { label: "Value", value: money(shift?.active_orders_amount, currency), detail: "Active order total", icon: WalletCards, tone: "text-violet-600 bg-violet-500/10" },
    { label: "KOT pending", value: shift?.kot_pending ?? 0, detail: shift?.kot_delayed ? `${shift.kot_delayed} delayed` : "Kitchen queue", icon: Clock3, tone: "text-amber-600 bg-amber-500/10" },
  ]

  return (
    <main className="mx-auto max-w-md space-y-7 px-4 pb-5 pt-4 md:hidden">
      <header>
        <p className="text-sm text-muted-foreground">Today at {outletName || "your outlet"}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Operations</h1>
      </header>

      <section className="space-y-3">
        <SectionTitle>Live status</SectionTitle>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {liveMetrics.map((metric) => {
            const Icon = metric.icon
            return <div key={metric.label} className="w-40 shrink-0 snap-start rounded-xl border border-border bg-card p-3">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", metric.tone)}><Icon className="h-4 w-4" /></span>
              <p className="mt-3 text-xs font-medium text-muted-foreground">{metric.label}</p>
              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">{metric.value}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{metric.detail}</p>
            </div>
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">Cancelled</p><p className="mt-1 font-semibold tabular-nums">{shift?.cancelled ?? 0}</p></div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">Completed</p><p className="mt-1 font-semibold tabular-nums">{completed}</p></div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-4 gap-y-4">
          {quickActions.map((action: any) => {
            const Icon = actionIcons[action.key] || ReceiptText
            return <Link key={action.key || action.title} href={resolveActionHref(action)} className="flex min-w-0 flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-primary"><Icon className="h-5 w-5" /></span>
              <span className="line-clamp-2 text-[11px] font-medium leading-3 text-muted-foreground">{action.title}</span>
            </Link>
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Money snapshot</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Cash collected" value={money(cash?.cash_collected, currency)} tone="border-teal-500/20 bg-teal-500/5" />
          <Metric label="Digital collected" value={money(cash?.digital_collected, currency)} tone="border-blue-500/20 bg-blue-500/5" />
          <Metric label="Credit sales" value={money(cash?.credit_sales, currency)} />
          <Metric label="Outstanding" value={money(cash?.total_outstanding, currency)} />
        </div>
      </section>

      {attention.length > 0 && <section className="space-y-3"><SectionTitle>Needs attention</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{attention.slice(0, 3).map((item: any) => <Link key={`${item.type}-${item.entity_id}-${item.title}`} href={resolveActionHref({ route: item.route })} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span></Link>)}</div></section>}

      <section className="space-y-3"><SectionTitle>Explore</SectionTitle><div className="grid grid-cols-4 gap-2">{explore.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="flex min-w-0 flex-col items-center gap-2 rounded-xl py-1 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><Icon className="h-5 w-5" /></span><span className="truncate text-[11px] font-medium text-muted-foreground">{item.label}</span></Link> })}</div></section>

      {insight && <section className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-sm font-medium">{insight.title || "Quick insight"}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{insight.message || insight.subtitle}</p></section>}

      <section className="space-y-3"><SectionTitle>Pipeline</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{(pipeline?.status_counts || []).slice(0, 5).map((item: any) => <div key={item.status} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-0"><span className="text-sm capitalize">{String(item.status || "Unknown").toLowerCase()}</span><span className="font-semibold tabular-nums">{item.count || 0}</span></div>)}</div></section>

      <section className="space-y-3"><SectionTitle>Top items</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{topItems.length ? topItems.map((item: any, index: number) => <div key={item.item_id || item.name || index} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-0"><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.qty || 0} sold</span></span><span className="text-sm font-semibold tabular-nums">{money(item.revenue, currency)}</span></div>) : <p className="px-3 py-4 text-sm text-muted-foreground">No live item activity yet.</p>}</div></section>
    </main>
  )
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card p-3", tone)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-semibold tabular-nums">{value}</p></div>
}
