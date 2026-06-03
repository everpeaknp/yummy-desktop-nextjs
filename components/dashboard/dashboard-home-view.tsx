"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChefHat,
  Clock,
  CreditCard,
  Lightbulb,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DashboardThroughputChart } from "@/components/dashboard/dashboard-throughput-chart";
import { formatDashboardCurrency, throughputToChartData } from "@/lib/dashboard-v2-query";
import type { DashboardV2Home, DashboardV2Meta } from "@/types/dashboard-v2";

type DashboardHomeViewProps = {
  meta: DashboardV2Meta;
  home: DashboardV2Home;
  loading?: boolean;
};

export function DashboardHomeView({ meta, home, loading }: DashboardHomeViewProps) {
  const currency = meta.currency || "NPR";

  return (
    <div className="flex flex-col gap-8">
      {home.alerts.available && home.alerts.items.length > 0 ? (
        <section className="space-y-2">
          {home.alerts.items.map((alert, idx) => (
            <div
              key={`${alert.type}-${idx}`}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-start gap-3",
                alert.severity === "HIGH"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{alert.message}</p>
                {alert.action_hint ? (
                  <p className="text-xs text-muted-foreground mt-1">{alert.action_hint}</p>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {home.shift_pulse.available ? (
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Active Orders" value={home.shift_pulse.active_orders} icon={<Activity className="h-5 w-5" />} />
          <MetricCard label="KOT Pending" value={home.shift_pulse.kot_pending} icon={<Clock className="h-5 w-5" />} />
          <MetricCard
            label="KOT Delayed"
            value={home.shift_pulse.kot_delayed}
            icon={<AlertCircle className="h-5 w-5" />}
            highlight={home.shift_pulse.kot_delayed > 0}
          />
          <MetricCard label="Cancelled" value={home.shift_pulse.cancelled} icon={<AlertCircle className="h-5 w-5" />} />
          <MetricCard label="Refunded" value={home.shift_pulse.refunded} icon={<CreditCard className="h-5 w-5" />} />
        </section>
      ) : null}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {home.action_queue.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Action Queue</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <QueueMetric label="Delayed KOTs" value={home.action_queue.delayed_kots} />
              <QueueMetric label="Oldest Active (min)" value={home.action_queue.oldest_active_order_minutes} />
              <QueueMetric label="Stale Open Orders" value={home.action_queue.stale_open_orders ?? 0} />
              <QueueMetric label="Credit Unsettled" value={home.action_queue.credit_orders_unsettled} />
              <QueueMetric label="Refunds Pending" value={home.action_queue.refunds_pending} />
              <QueueMetric label="High Cancellation" value={home.action_queue.high_cancellation} />
            </CardContent>
          </Card>
        ) : null}

        {home.cash_watch.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Cash Watch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MoneyRow label="Cash Collected" value={formatDashboardCurrency(home.cash_watch.cash_collected, currency)} />
              <MoneyRow label="Digital Collected" value={formatDashboardCurrency(home.cash_watch.digital_collected, currency)} />
              <MoneyRow label="Credit Sales" value={formatDashboardCurrency(home.cash_watch.credit_sales, currency)} />
              <MoneyRow label="Outstanding" value={formatDashboardCurrency(home.cash_watch.total_outstanding, currency)} />
            </CardContent>
          </Card>
        ) : null}

        {home.day_close_status.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Day Close</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary" className="uppercase tracking-wider">
                {home.day_close_status.status}
              </Badge>
              <Button asChild className="w-full">
                <Link href={home.day_close_status.route}>{home.day_close_status.action_label}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {home.quick_actions.available && home.quick_actions.items.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {home.quick_actions.items.map((action) => (
              <QuickActionButton key={action.key} route={action.route} title={action.title} enabled={action.enabled} reason={action.reason} />
            ))}
          </div>
        </section>
      ) : null}

      {home.attention_items.available && home.attention_items.items.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Needs Attention</h2>
          <div className="grid gap-3">
            {home.attention_items.items.map((item, idx) => (
              <AttentionRow key={`${item.type}-${idx}`} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {home.throughput.available ? (
          <DashboardThroughputChart
            data={throughputToChartData(home.throughput.points)}
            loading={loading}
            title="Throughput"
            description={`Sales and orders (${home.throughput.comparison_basis.replace(/_/g, " ")})`}
          />
        ) : null}

        {home.pipeline.available ? (
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Order Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {home.pipeline.status_counts.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.status}</span>
                    <span className="font-bold tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t grid grid-cols-3 gap-2 text-center">
                {Object.entries(home.pipeline.aging_buckets).map(([bucket, count]) => (
                  <div key={bucket} className="rounded-lg bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">{bucket.replace(/_/g, " ")}</p>
                    <p className="font-bold">{count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {home.occupancy.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4" /> Occupancy
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <QueueMetric label="Tables Occupied" value={home.occupancy.occupied_tables} />
              <QueueMetric label="Tables Free" value={home.occupancy.free_tables} />
              <QueueMetric label="Rooms Occupied" value={home.occupancy.occupied_rooms} />
              <QueueMetric label="Rooms Free" value={home.occupancy.free_rooms} />
            </CardContent>
          </Card>
        ) : null}

        {home.reservations_today.available ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Reservations Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-sm">
                <Badge variant="outline">Pending {home.reservations_today.pending_count}</Badge>
                <Badge variant="outline">Confirmed {home.reservations_today.confirmed_count}</Badge>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {home.reservations_today.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No reservations today.</p>
                ) : (
                  home.reservations_today.items.map((reservation) => (
                    <div key={reservation.reservation_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold">{reservation.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {reservation.reservation_time} • {reservation.guest_count} guests
                          {reservation.table_name ? ` • ${reservation.table_name}` : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">{reservation.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {home.top_items_live.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ChefHat className="h-4 w-4" /> Top Items Live
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {home.top_items_live.items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No item sales yet.</p>
              ) : (
                home.top_items_live.items.slice(0, 8).map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatDashboardCurrency(item.revenue, currency)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}

        {home.active_orders_preview.available ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-auto">
              {home.active_orders_preview.items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No active orders.</p>
              ) : (
                home.active_orders_preview.items.map((order) => (
                  <Link
                    key={order.order_id}
                    href={`/orders/${order.order_id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{order.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.channel} • {order.status} • {order.age_minutes}m
                      </p>
                    </div>
                    <span className="font-bold tabular-nums shrink-0">
                      {order.grand_total != null ? formatDashboardCurrency(order.grand_total, currency) : "—"}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>

      {home.quick_insights.available && home.quick_insights.items.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quick Insights</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {home.quick_insights.items.map((insight, idx) => (
              <Card key={`${insight.type}-${idx}`} className="border-indigo-500/20">
                <CardContent className="p-4 flex gap-3">
                  <Lightbulb className="h-5 w-5 text-indigo-500 shrink-0" />
                  <div>
                    <Badge variant="outline" className="mb-2 uppercase text-[10px]">
                      {insight.type}
                    </Badge>
                    <p className="text-sm">{insight.message}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-destructive/40")}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className={cn("text-2xl font-black tabular-nums", highlight && "text-destructive")}>{value}</p>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function QuickActionButton({
  route,
  title,
  enabled,
  reason,
}: {
  route: string;
  title: string;
  enabled: boolean;
  reason?: string | null;
}) {
  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed px-3 py-4 text-center opacity-60" title={reason ?? undefined}>
        <Zap className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
      <Link href={route}>
        <Zap className="h-4 w-4" />
        <span className="text-xs font-semibold text-center">{title}</span>
      </Link>
    </Button>
  );
}

function AttentionRow({
  item,
}: {
  item: {
    title: string;
    subtitle: string;
    severity: string;
    route: string;
    age_minutes?: number | null;
  };
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(item.route)}
      className="w-full text-left rounded-xl border px-4 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="font-semibold text-sm">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.age_minutes != null ? (
          <Badge variant="outline">{item.age_minutes}m</Badge>
        ) : null}
        <Badge variant={item.severity === "HIGH" ? "destructive" : "secondary"}>{item.severity}</Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-[360px] rounded-xl" />
    </div>
  );
}
