"use client"

import Link from "next/link"
import {
  Activity,
  Armchair,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock3,
  CreditCard,
  Package,
  Plus,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react"

import { type ReactNode } from "react"

import { MetricCard } from "@/components/cards/metric-card"

type Props = {
  home: any
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

function resolveActionHref(action: any) {
  return actionRoutes[action?.key] || actionRoutes[action?.route] || action?.route || "/dashboard"
}

function money(value: unknown, currency: string) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{children}</h2>
}

export function MobileDashboardHome({ home, currency }: Props) {
  const shift = home?.shift_pulse
  const cash = home?.cash_watch
  const pipeline = home?.pipeline
  const attention = home?.attention_items?.items || []
  const quickActions = (home?.quick_actions?.items || []).filter((item: any) => item.enabled).filter((item: any) => !["tables", "reservations"].includes(item.key)).slice(0, 6)
  const topItems = (home?.top_items_live?.items || []).slice(0, 4)
  const insight = home?.quick_insights?.items?.[0] || home?.alerts?.items?.[0]
  const completed = (pipeline?.status_counts || []).filter((item: any) => String(item.status).toUpperCase() === "COMPLETED").reduce((total: number, item: any) => total + Number(item.count || 0), 0)
  const serviceMetrics = [
    { label: "Active orders", value: shift?.active_orders ?? 0, detail: "In progress", icon: Activity, tone: "info" as const },
    { label: "KOT pending", value: shift?.kot_pending ?? 0, detail: "Kitchen queue", icon: Clock3, tone: "warning" as const },
    { label: "Delayed", value: shift?.kot_delayed ?? 0, detail: shift?.kot_delayed ? "Needs attention" : "On time", icon: Clock3, tone: shift?.kot_delayed ? ("danger" as const) : ("success" as const) },
  ]

  return (
    <main className="mx-auto max-w-md space-y-6 pb-24 md:hidden">
      <section className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {serviceMetrics.map((metric) => {
            const Icon = metric.icon
            return <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} icon={<Icon className="h-4 w-4" />} tone={metric.tone} className="min-w-0 rounded-xl p-2.5 [&_div.text-xl]:text-lg [&_div.text-xs]:text-[10px]" />
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Completed" value={completed} detail="This shift" className="rounded-xl p-3 [&_div.text-xl]:text-lg" />
          <MetricCard label="Cancelled" value={shift?.cancelled ?? 0} detail="This shift" tone="danger" className="rounded-xl p-3 [&_div.text-xl]:text-lg" />
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
          <MetricCard label="Cash collected" value={money(cash?.cash_collected, currency)} tone="success" className="rounded-xl p-3 [&_div.text-xl]:text-base" />
          <MetricCard label="Digital collected" value={money(cash?.digital_collected, currency)} tone="info" className="rounded-xl p-3 [&_div.text-xl]:text-base" />
          <MetricCard label="Credit sales" value={money(cash?.credit_sales, currency)} className="rounded-xl p-3 [&_div.text-xl]:text-base" />
          <MetricCard label="Outstanding" value={money(cash?.total_outstanding, currency)} tone="warning" className="rounded-xl p-3 [&_div.text-xl]:text-base" />
        </div>
      </section>

      {attention.length > 0 && <section className="space-y-3"><SectionTitle>Needs attention</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{attention.slice(0, 3).map((item: any) => <Link key={`${item.type}-${item.entity_id}-${item.title}`} href={resolveActionHref({ route: item.route })} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span></Link>)}</div></section>}

      {insight && <section className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-sm font-medium">{insight.title || "Quick insight"}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{insight.message || insight.subtitle}</p></section>}

      <section className="space-y-3"><SectionTitle>Pipeline</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{(pipeline?.status_counts || []).slice(0, 5).map((item: any) => <div key={item.status} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-0"><span className="text-sm capitalize">{String(item.status || "Unknown").toLowerCase()}</span><span className="font-semibold tabular-nums">{item.count || 0}</span></div>)}</div></section>

      <section className="space-y-3"><SectionTitle>Top items</SectionTitle><div className="overflow-hidden rounded-xl border border-border bg-card">{topItems.length ? topItems.map((item: any, index: number) => <div key={item.item_id || item.name || index} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-0"><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.qty || 0} sold</span></span><span className="text-sm font-semibold tabular-nums">{money(item.revenue, currency)}</span></div>) : <p className="px-3 py-4 text-sm text-muted-foreground">No live item activity yet.</p>}</div></section>
    </main>
  )
}
