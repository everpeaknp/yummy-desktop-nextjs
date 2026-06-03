"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalyticsDashboardViewModel } from "@/types/analytics";
import {
  listMetricsFromSection,
  topItemQuantitySold,
  type AnalyticsMainTab,
} from "@/lib/analytics-dashboard-mapper";
import { PaymentMethodBreakdown } from "@/components/analytics/payment-method-breakdown";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import type { PieSlice, TrendPoint } from "@/lib/analytics-dashboard-mapper";

type AnalyticsTabContentProps = {
  activeTab: AnalyticsMainTab;
  viewModel: AnalyticsDashboardViewModel;
  trendsData: TrendPoint[];
  pieData: PieSlice[];
  pieTitle: string;
  pieDescription: string;
  chartTitle: string;
  loading: boolean;
  useHourlyChart: boolean;
};

export function AnalyticsTabContent({
  activeTab,
  viewModel,
  trendsData,
  pieData,
  pieTitle,
  pieDescription,
  chartTitle,
  loading,
  useHourlyChart,
}: AnalyticsTabContentProps) {
  const { tabs } = viewModel;

  switch (activeTab) {
    case "finance":
      return (
        <FinanceTabPanel
          viewModel={viewModel}
          trendsData={trendsData}
          chartTitle={chartTitle}
          loading={loading}
          useHourlyChart={useHourlyChart}
        />
      );
    case "orders":
      return <OrdersTabPanel tabs={tabs} pieData={pieData} pieTitle={pieTitle} pieDescription={pieDescription} loading={loading} />;
    case "menu":
      return <MenuTabPanel tabs={tabs} />;
    case "staff":
      return <StaffTabPanel tabs={tabs} />;
    default:
      return (
        <OverviewTabPanel
          viewModel={viewModel}
          trendsData={trendsData}
          pieData={pieData}
          pieTitle={pieTitle}
          pieDescription={pieDescription}
          chartTitle={chartTitle}
          loading={loading}
          useHourlyChart={useHourlyChart}
        />
      );
  }
}

function OverviewTabPanel({
  viewModel,
  trendsData,
  pieData,
  pieTitle,
  pieDescription,
  chartTitle,
  loading,
  useHourlyChart,
}: Omit<AnalyticsTabContentProps, "activeTab">) {
  const insights = viewModel.insights ?? [];
  const today = viewModel.todaySnapshot;

  return (
    <div className="space-y-6">
      {(today.income > 0 || today.expense > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MiniStat label="Today income" value={today.income} />
          <MiniStat label="Today expense" value={today.expense} />
        </div>
      )}

      {insights.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-semibold text-lg">Alerts</h3>
          <div className="grid gap-2">
            {insights.slice(0, 5).map((item, index) => (
              <Card key={`${item.title}-${index}`} className="border-border">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm">{item.title}</p>
                  {item.message ? (
                    <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-4 min-w-0">
          <RevenueChart
            data={trendsData}
            loading={loading}
            hourlyData={useHourlyChart ? viewModel.hourlyChart : null}
            title={chartTitle}
          />
        </div>
        <div className="lg:col-span-3 min-w-0">
          <PiePanel title={pieTitle} description={pieDescription} data={pieData} loading={loading} />
        </div>
      </div>

      <PaymentMethodBreakdown
        title="Payment mix (sales)"
        description="Method totals with card/digital broken down by instrument."
        mix={viewModel.paymentMix}
      />
    </div>
  );
}

function FinanceTabPanel({
  viewModel,
  trendsData,
  chartTitle,
  loading,
  useHourlyChart,
}: Pick<
  AnalyticsTabContentProps,
  "viewModel" | "trendsData" | "chartTitle" | "loading" | "useHourlyChart"
>) {
  const pnlRows = listMetricsFromSection(viewModel.tabs.finance.pnl_summary);

  return (
    <div className="space-y-6">
      {pnlRows.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pnlRows.slice(0, 8).map((row) => (
            <Card key={row.key} className="border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  {row.label}
                </p>
                <p className="text-lg font-bold mt-1">
                  {row.unit === "pct" || row.key.includes("pct")
                    ? `${row.value.toFixed(1)}%`
                    : `Rs. ${row.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`}
                </p>
                {row.deltaPct !== undefined && row.deltaPct !== 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-2 text-[10px]",
                      row.deltaPct >= 0
                        ? "text-emerald-600 border-emerald-200"
                        : "text-red-600 border-red-200"
                    )}
                  >
                    {row.deltaPct >= 0 ? "+" : ""}
                    {row.deltaPct.toFixed(1)}%
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <RevenueChart
        data={trendsData}
        loading={loading}
        hourlyData={useHourlyChart ? viewModel.hourlyChart : null}
        title={chartTitle}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentMethodBreakdown
          title="Payment settlement mix"
          description="Settled amounts by method and instrument (finance tab)."
          mix={viewModel.paymentSettlementMix}
        />
        <PaymentMethodBreakdown
          title="Sales payment mix"
          description="Overview payment mix for the same window."
          mix={viewModel.paymentMix}
        />
      </div>
    </div>
  );
}

function OrdersTabPanel({
  tabs,
  pieData,
  pieTitle,
  pieDescription,
  loading,
}: {
  tabs: AnalyticsDashboardViewModel["tabs"];
  pieData: PieSlice[];
  pieTitle: string;
  pieDescription: string;
  loading: boolean;
}) {
  const pipeline = tabs.orders.live_pipeline;
  const topItems = tabs.orders.top_selling_items?.items ?? [];

  return (
    <div className="space-y-6">
      {pipeline?.available ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PipelineStat label="Completed" value={pipeline.completed ?? 0} />
          <PipelineStat label="Pending" value={pipeline.pending ?? 0} />
          <PipelineStat label="Delayed" value={pipeline.delayed ?? 0} />
          <PipelineStat label="Canceled" value={pipeline.canceled ?? 0} />
        </div>
      ) : null}

      <PiePanel title={pieTitle} description={pieDescription} data={pieData} loading={loading} />

      {topItems.length > 0 ? (
        <TopItemsList items={topItems} title="Top selling items" href="/analytics/menu" />
      ) : null}
    </div>
  );
}

function MenuTabPanel({ tabs }: { tabs: AnalyticsDashboardViewModel["tabs"] }) {
  const summary = listMetricsFromSection(tabs.menu.performance_summary);
  const items = tabs.menu.top_items?.items ?? [];

  return (
    <div className="space-y-6">
      {summary.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.slice(0, 6).map((row) => (
            <Card key={row.key} className="border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">{row.label}</p>
                <p className="text-lg font-bold mt-1">
                  Rs. {row.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {items.length > 0 ? (
        <TopItemsList items={items} title="Top menu items" href="/analytics/menu" />
      ) : (
        <p className="text-sm text-muted-foreground">No menu performance data for this period.</p>
      )}
    </div>
  );
}

function StaffTabPanel({ tabs }: { tabs: AnalyticsDashboardViewModel["tabs"] }) {
  const leaderboard = tabs.staff.leaderboard?.items ?? [];
  const top = tabs.staff.top_performer;

  return (
    <div className="space-y-6">
      {top?.available && top.name ? (
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top performer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{top.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Rs. {Number(top.revenue ?? 0).toLocaleString()} · {top.orders_count ?? 0} orders
            </p>
          </CardContent>
        </Card>
      ) : null}

      {leaderboard.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Leaderboard</h3>
            <Link href="/analytics/staff">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 8).map((row, index) => {
              const item = row as { name?: string; label?: string; revenue?: number; amount?: number };
              return (
                <div
                  key={String(item.name ?? item.label ?? index)}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <span className="font-medium text-sm truncate">
                    {index + 1}. {item.name ?? item.label ?? "Staff"}
                  </span>
                  <span className="text-sm font-bold shrink-0">
                    Rs. {Number(item.revenue ?? item.amount ?? 0).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No staff leaderboard for this period.</p>
      )}
    </div>
  );
}

function PiePanel({
  title,
  description,
  data,
  loading,
}: {
  title: string;
  description: string;
  data: PieSlice[];
  loading: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="p-4 min-w-0">
        <CategoryPieChart embedded data={data} loading={loading} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">Rs. {value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function PipelineStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 text-center">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function TopItemsList({
  items,
  title,
  href,
}: {
  items: Array<{ id?: number; name?: string; revenue?: number; quantity_sold?: number; quantity?: number }>;
  title: string;
  href: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Link href={href}>
          <Button variant="ghost" size="sm" className="gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.slice(0, 6).map((item) => (
          <Card key={item.id ?? item.name} className="border-border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{topItemQuantitySold(item)} sold</p>
              </div>
              <p className="text-sm font-bold shrink-0">
                Rs. {Number(item.revenue || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
