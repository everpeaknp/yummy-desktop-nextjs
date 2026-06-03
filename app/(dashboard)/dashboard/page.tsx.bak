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


export default function DashboardPage() {
  const user = useAuth(state => state.user);
  const [data, setData] = useState<AdminDashboardV2Data | null>(null);
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
            router.push('/auth');
        }
    };
    
    // Small delay to allow hydration
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // 2. Data Fetching
  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user?.restaurant_id) return; // Strict: Need restaurant_id
      
      try {
        // Use strict API endpoint builder
        const url = DashboardApis.dashboardDataV2({
            restaurantId: user.restaurant_id
        });
        
        const response = await apiClient.get(url);
        if (response.data.status === "success") {
          setData(response.data.data);
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
        const interval = setInterval(fetchDashboard, 10000);
        return () => clearInterval(interval);
    }
  }, [user]);

  if (loading && !data) {
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

  const { health, kpis, trends, meta, breakdowns } = data!;

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {meta.outlet_name} | {meta.date}
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

      {/* Trends Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Trends</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TrendCard 
                label="Sales vs Yesterday" 
                trend={trends.sales_vs_yesterday} 
            />
            <TrendCard 
                label="Orders vs Yesterday" 
                trend={trends.orders_vs_yesterday} 
            />
        </div>
      </section>

      {/* Key Metrics Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Gross Sales" value={kpis.gross_sales} prefix={meta.currency} />
            <MetricCard label="Net Sales" value={kpis.net_sales} prefix={meta.currency} />
            <MetricCard label="Total Orders" value={kpis.total_orders} />
            <MetricCard label="Avg Order Value" value={kpis.average_order_value} prefix={meta.currency} />
            
            <MetricCard label="Total Discounts" value={kpis.total_discounts} prefix={meta.currency} />
            <MetricCard label="Tax Collected" value={kpis.total_tax_collected} prefix={meta.currency} />
            <MetricCard label="Cash Sales" value={kpis.cash_sales} prefix={meta.currency} />
            <MetricCard label="Non-Cash Sales" value={kpis.non_cash_sales} prefix={meta.currency} />
        </div>
      </section>

      {/* Breakdown Section - Keeping existing logic but restyled */}
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
                    {breakdowns.top_items.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between group">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.quantity} units sold</span>
                        </div>
                        <div className="text-sm font-semibold">
                          {meta.currency} {item.revenue?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {(!breakdowns.top_items || breakdowns.top_items.length === 0) && (
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
                    {breakdowns.payment_split.map((payment) => {
                      const percentage = kpis.gross_sales > 0 ? (payment.amount / kpis.gross_sales) * 100 : 0;
                      return (
                        <div key={payment.method} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize">{payment.method.toLowerCase()}</span>
                            <span className="text-muted-foreground">{meta.currency} {payment.amount?.toLocaleString()} ({percentage.toFixed(0)}%)</span>
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
                     {(!breakdowns.payment_split || breakdowns.payment_split.length === 0) && (
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

function MetricCard({ label, value, prefix = "" }: { label: string, value: number, prefix?: string }) {
    return (
        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col justify-center h-full">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <div className="text-xl font-bold text-foreground tracking-tight">
                    {prefix} {value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
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
                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-24 bg-slate-800 rounded" />)}
            </div>
         </div>
    )
}
