"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CreditCard, DollarSign, Users, TrendingUp, TrendingDown, AlertCircle, ChefHat, Clock, AlertTriangle } from "lucide-react";
import apiClient from "@/lib/api-client";
import { AdminDashboardV2Data } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { DashboardApis } from "@/lib/api/endpoints";
import { RevenueChart } from "@/components/analytics/revenue-chart";
import { CategoryPieChart } from "@/components/analytics/category-pie";


export default function DashboardPage() {
  const user = useAuth(state => state.user);
  const [data, setData] = useState<AdminDashboardV2Data | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const me = useAuth(state => state.me);
  const router = useRouter();

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      // If no user but we have a token, try to restore session
      if (!user && token) {
        await me();
      }

      // Final check: if still no user and no token, redirect
      const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!user && !updatedToken) {
        router.push('/');
      }
    };

    // Small delay to allow hydration
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Data Fetching
  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.restaurant_id) return;

      try {
        // Date range for analytics (today)
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        const lastWeekStr = lastWeek.toISOString().split('T')[0];

        // 1. Fetch Main Dashboard Data (health, kpis, top_items, payment_split)
        const v2Promise = apiClient.get(DashboardApis.dashboardDataV2({
          restaurantId: user.restaurant_id
        })).catch(err => { console.error("[Dashboard] V2 fetch failed:", err); return null; });

        // 2. Fetch Unified Analytics Dashboard (trends, breakdown, comparison) - same as Flutter
        const analyticsPromise = apiClient.get(
          `/analytics/dashboard?restaurant_id=${user.restaurant_id}&date_from=${lastWeekStr}&date_to=${todayStr}`
        ).catch(err => { console.error("[Dashboard] Analytics fetch failed:", err); return null; });

        const [v2Res, analyticsRes] = await Promise.all([v2Promise, analyticsPromise]);

        // Process V2 dashboard data (health, kpis, breakdowns with top_items & payment_split)
        if (v2Res && v2Res.data?.status === "success") {
          setData(v2Res.data.data);
        }

        // Process unified analytics data (KPIs, trends, breakdown, top items, payment methods)
        if (analyticsRes && analyticsRes.data?.status === "success") {
          const analytics = analyticsRes.data.data;
          setAnalyticsData(analytics);

          // Revenue Trends - from analytics.trends (array of {date, income, expense, profit})
          if (Array.isArray(analytics.trends) && analytics.trends.length > 0) {
            const chartData = analytics.trends.map((item: any) => ({
              date: item.date,
              value: item.income
            }));
            setTrendsData(chartData);
          }

          // Category Breakdown - from analytics.breakdown.income_by_category
          if (analytics.breakdown) {
            const list = analytics.breakdown.income_by_category
              || analytics.breakdown.income_by_source
              || [];
            if (list.length > 0) {
              const pieData = list.map((item: any) => ({
                name: item.label,
                value: item.amount,
              }));
              setCategoryData(pieData);
            }
          }
        }

      } catch (err: any) {
        console.error("Failed to fetch dashboard:", err);
        setError(err.response?.data?.detail || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
      fetchDashboard();
      const interval = setInterval(fetchDashboard, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (loading && !data && !analyticsData) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Derive display data: prefer analytics (7-day range) over V2 (today-only)
  const health = data?.health;
  const meta = data?.meta;
  const currency = analyticsData?.meta?.currency || meta?.currency || "NPR";
  const outletName = meta?.outlet_name || "";
  const dateLabel = analyticsData?.meta?.date_range
    ? `${analyticsData.meta.date_range.from} to ${analyticsData.meta.date_range.to}`
    : meta?.date || "";

  // KPIs: use analytics overview (7-day range) with V2 as fallback
  const overview = analyticsData?.overview;
  const v2Kpis = data?.kpis;
  const kpis = {
    gross_sales: overview?.total_income ?? v2Kpis?.gross_sales ?? 0,
    net_sales: overview?.net_profit != null ? overview.total_income - overview.total_expense : (v2Kpis?.net_sales ?? 0),
    total_orders: overview?.orders_count ?? v2Kpis?.total_orders ?? 0,
    average_order_value: overview?.avg_order_value ?? v2Kpis?.average_order_value ?? 0,
    net_profit: overview?.net_profit ?? 0,
    profit_margin: overview?.profit_margin ?? 0,
    total_expense: overview?.total_expense ?? 0,
  };

  // Top items: use analytics menu_snapshot (7-day) with V2 breakdowns as fallback
  const analyticsTopItems: any[] = analyticsData?.menu_snapshot?.top_items || [];
  const v2TopItems = data?.breakdowns?.top_items || [];
  const topItems = analyticsTopItems.length > 0
    ? analyticsTopItems.map((item: any) => ({
      item_id: item.id || 0,
      name: item.name || "Unknown",
      quantity: item.quantity_sold || 0,
      revenue: item.revenue || 0,
    }))
    : v2TopItems;

  // Payment methods: use analytics breakdown (7-day) with V2 as fallback
  const analyticsPayments: any[] = analyticsData?.breakdown?.income_by_payment_method || [];
  const v2Payments = data?.breakdowns?.payment_split || [];
  const paymentMethods = analyticsPayments.length > 0
    ? analyticsPayments.map((item: any) => ({
      method: item.label || "Unknown",
      amount: item.amount || 0,
    }))
    : v2Payments;

  const totalPaymentAmount = paymentMethods.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {outletName}{outletName && dateLabel ? " | " : ""}{dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-background">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        </div>
      </div>

      {/* Health & Alerts Section */}
      {health && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Health & Alerts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigStatCard
              title="ACTIVE ORDERS"
              value={health.active_orders}
              className="bg-primary/5 border border-primary/10 text-primary dark:bg-card dark:text-white"
              valueColor="text-primary dark:text-white"
            />
            <BigStatCard
              title="KOT PENDING"
              value={health.kot_pending}
              className="bg-card border-border text-card-foreground shadow-sm"
              valueColor="text-foreground"
            />
            <BigStatCard
              title="DELAYED"
              value={health.kot_delayed}
              className="bg-destructive/10 text-destructive border-destructive/20"
              valueColor="text-destructive"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border text-card-foreground p-4 rounded-lg flex justify-between items-center text-sm shadow-sm">
              <span className="text-muted-foreground">Cancelled Today</span>
              <span className="font-bold text-lg">{health.cancelled_today}</span>
            </div>
            <div className="bg-card border border-border text-card-foreground p-4 rounded-lg flex justify-between items-center text-sm shadow-sm">
              <span className="text-muted-foreground">Refunded Today</span>
              <span className="font-bold text-lg">{health.refunded_today}</span>
            </div>
          </div>

          {/* Alerts Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.alerts.find(a => a.severity === 'HIGH') ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-4 items-start">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-destructive font-semibold mb-1">Critical Alert</h3>
                  <p className="text-sm text-destructive opacity-90">{health.alerts.find(a => a.severity === 'HIGH')?.message}</p>
                </div>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex gap-4 items-start">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-green-700 dark:text-green-500 font-semibold mb-1">System Healthy</h3>
                  <p className="text-sm text-green-600 dark:text-green-400 opacity-90">No critical alerts at this moment.</p>
                </div>
              </div>
            )}

            {data?.quick_insights && data.quick_insights.length > 0 && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 flex items-center">
                <p className="text-indigo-700 dark:text-indigo-400 font-medium">{data?.quick_insights[0].message}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Trends & Charts Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Analytics & Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <RevenueChart data={trendsData} loading={loading} />
          <CategoryPieChart data={categoryData} loading={loading} />
        </div>
      </section>

      {/* Key Metrics Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Income" value={kpis.gross_sales} prefix={currency} />
          <MetricCard label="Net Profit" value={kpis.net_profit} prefix={currency} />
          <MetricCard label="Total Orders" value={kpis.total_orders} />
          <MetricCard label="Avg Order Value" value={kpis.average_order_value} prefix={currency} />

          <MetricCard label="Total Expense" value={kpis.total_expense} prefix={currency} />
          <MetricCard label="Profit Margin" value={kpis.profit_margin} suffix="%" />
        </div>
      </section>

      {/* Breakdown Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 pt-4">
        <Card className="col-span-4 bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topItems.map((item: any, idx: number) => (
                <div key={item.item_id || idx} className="flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.quantity} units sold</span>
                  </div>
                  <div className="text-sm font-semibold">
                    {currency} {item.revenue?.toLocaleString()}
                  </div>
                </div>
              ))}
              {topItems.length === 0 && (
                <p className="text-sm text-muted-foreground opacity-50 text-center py-6">No items sold yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {paymentMethods.map((payment: any) => {
                const percentage = totalPaymentAmount > 0 ? (payment.amount / totalPaymentAmount) * 100 : 0;
                return (
                  <div key={payment.method} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{payment.method.toLowerCase()}</span>
                      <span className="text-muted-foreground">{currency} {payment.amount?.toLocaleString()} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {paymentMethods.length === 0 && (
                <p className="text-sm text-muted-foreground opacity-50 text-center py-6">No payments yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BigStatCard({ title, value, className, valueColor = "text-foreground" }: { title: string, value: number, className?: string, valueColor?: string }) {
  return (
    <Card className={cn("border shadow-sm flex flex-col items-center justify-center py-8", className)}>
      <div className={cn("text-4xl font-bold mb-2 tracking-tighter", valueColor)} >{value}</div>
      <div className="text-xs font-medium uppercase tracking-widest opacity-70 text-muted-foreground">{title}</div>
    </Card>
  )
}

function TrendCard({ label, trend }: { label: string, trend: any }) {
  const isUp = trend?.direction === 'UP';
  const isDown = trend?.direction === 'DOWN';
  const isSame = trend?.direction === 'SAME';

  // For sales/orders, UP is generally good (green), DOWN is bad (red)
  // Make sure to handle 0 values gracefully

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-6">
        <div className="text-xs text-muted-foreground font-medium mb-1">{label}</div>
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-foreground">
            {Math.abs(trend?.delta_percent || 0).toFixed(1)}%
          </span>
          <div className={cn(
            "flex items-center text-sm font-medium mb-1 px-2 py-0.5 rounded-full",
            isUp ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" : isDown ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500" : "bg-muted text-muted-foreground"
          )}>
            {isUp ? <TrendingUp className="w-3 h-3 mr-1" /> : isDown ? <TrendingDown className="w-3 h-3 mr-1" /> : null}
            {isUp ? "Inc" : isDown ? "Dec" : "Flat"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({ label, value, prefix = "", suffix = "" }: { label: string, value: number, prefix?: string, suffix?: string }) {
  return (
    <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col justify-center h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <div className="text-xl font-bold text-foreground tracking-tight">
          {prefix}{prefix ? " " : ""}{value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}{suffix}
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-800 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-slate-800 rounded" />
        <div className="h-32 bg-slate-800 rounded" />
        <div className="h-32 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-24 bg-slate-800 rounded" />
        <div className="h-24 bg-slate-800 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-24 bg-slate-800 rounded" />)}
      </div>
    </div>
  )
}
