"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, TrendingDown, DollarSign, CreditCard, Activity, Lock, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [activeRange, setActiveRange] = useState("today");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me);
  const router = useRouter();
  const { restaurant } = useRestaurant();

  // 1. Session Restoration & Auth Guard
  useEffect(() => {
    const checkAuth = async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && token) await me();
        
        const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!user && !updatedToken) router.push('/auth');
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user?.restaurant_id) return;
      setLoading(true);
      try {
        // Construct date params based on activeRange
        const now = new Date();
        let dateFrom = now.toISOString().split('T')[0];
        let dateTo = now.toISOString().split('T')[0];

        if (activeRange === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            dateFrom = y.toISOString().split('T')[0];
            dateTo = y.toISOString().split('T')[0];
        } else if (activeRange === 'last7') {
            const l7 = new Date(now);
            l7.setDate(l7.getDate() - 7);
            dateFrom = l7.toISOString().split('T')[0];
        } else if (activeRange === 'last30') {
            const l30 = new Date(now);
            l30.setDate(l30.getDate() - 30);
            dateFrom = l30.toISOString().split('T')[0];
        } else if (activeRange === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFrom = m.toISOString().split('T')[0];
        }

        const url = AnalyticsApis.dashboard({
            restaurantId: user.restaurant_id,
            dateFrom,
            dateTo
        });

        const response = await apiClient.get(url);
        
        if (response.data.status === "success") {
          setData(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.restaurant_id) {
        fetchAnalytics();
    }
  }, [user, activeRange]);

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider text-orange-500 font-semibold">
             {restaurant?.name || "YUMMY"}
          </p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg border border-border overflow-x-auto">
            <FilterButton label="Today" active={activeRange === 'today'} onClick={() => setActiveRange('today')} icon={<Calendar className="w-3 h-3" />} />
            <FilterButton label="Yesterday" active={activeRange === 'yesterday'} onClick={() => setActiveRange('yesterday')} />
            <FilterButton label="Last 7 Days" active={activeRange === 'last7'} onClick={() => setActiveRange('last7')} />
            <FilterButton label="Last 30 Days" active={activeRange === 'last30'} onClick={() => setActiveRange('last30')} />
            <FilterButton label="This Month" active={activeRange === 'month'} onClick={() => setActiveRange('month')} />
            <FilterButton label="Custom" active={activeRange === 'custom'} onClick={() => setActiveRange('custom')} icon={<Calendar className="w-3 h-3" />} />
        </div>
      </div>

      {loading && !data ? (
          <AnalyticsSkeleton />
      ) : (
        <>
          {/* Period Snapshot */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">Period Snapshot</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SnapshotCard 
                    label="CURRENT INCOME" 
                    value={data?.kpis?.gross_sales || 0} 
                    icon={<TrendingUp className="w-4 h-4" />}
                    color="text-indigo-400"
                    bgColor="bg-indigo-900/20"
                    borderColor="border-indigo-900/50"
                />
                <SnapshotCard 
                    label="CURRENT EXPENSE" 
                    value={data?.kpis?.total_expense || 0} 
                    icon={<TrendingDown className="w-4 h-4" />}
                    color="text-blue-400"
                    bgColor="bg-blue-900/20"
                    borderColor="border-blue-900/50"
                />
                <SnapshotCard 
                    label="CURRENT PROFIT" 
                    value={(data?.kpis?.gross_sales || 0) - (data?.kpis?.total_expense || 0)} 
                    icon={<Wallet className="w-4 h-4" />}
                    color="text-pink-400"
                    bgColor="bg-pink-900/20"
                    borderColor="border-pink-900/50"
                />
            </div>
          </section>

          {/* Operations & Menu Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Operations</CardTitle>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">View details</Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <OperationRow label="Peak hour" value={data?.operations?.peak_hour || "—"} />
                      <OperationRow label="Slow hour" value={data?.operations?.slow_hour || "—"} />
                      <OperationRow label="Avg service time" value={data?.operations?.avg_service_time ? `${data.operations.avg_service_time} min` : "—"} />
                      <OperationRow label="Cancellations" value={data?.operations?.cancellations || "—"} />
                  </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Menu performance</CardTitle>
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">View all</Button>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Lock className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No menu insights available yet</p>
                  </CardContent>
              </Card>
          </div>

          {/* Bottom Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <BigMetricCard 
                  label="TOTAL INCOME" 
                  value={data?.kpis?.gross_sales || 0} 
                  trend={100} 
                  icon={<DollarSign className="w-4 h-4" />}
                  color="text-orange-500" 
                  tagColor="bg-orange-500/20 text-orange-500"
               />
               <BigMetricCard 
                  label="NET PROFIT" 
                  value={(data?.kpis?.gross_sales || 0) * 0.2} // Mock margin if not in API
                  trend={100} 
                  icon={<Wallet className="w-4 h-4" />}
                  color="text-emerald-500" 
                  tagColor="bg-emerald-500/20 text-emerald-500"
               />
               <BigMetricCard 
                  label="ORDERS" 
                  value={data?.kpis?.total_orders || 0} 
                  noCurrency 
                  icon={<CreditCard className="w-4 h-4" />}
                  color="text-blue-500" 
               />
               <BigMetricCard 
                  label="MARGIN" 
                  value="0%" 
                  noCurrency 
                  activeValue 
                  icon={<Activity className="w-4 h-4" />}
                  color="text-purple-500" 
               />
          </div>
        </>
      )}
    </div>
  );
}

function FilterButton({ label, active, onClick, icon }: any) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                active 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
            )}
        >
            {icon}
            {label}
        </button>
    )
}

function SnapshotCard({ label, value, icon, color, bgColor, borderColor }: any) {
    return (
        <Card className={cn("border bg-card overflow-hidden relative group shadow-sm", borderColor.replace('slate-800', 'border'))}>
            <div className={cn("absolute top-0 left-0 w-1 h-full opacity-50", color.replace('text-', 'bg-'))} />
             {/* Gradient Background Effect */}
            <div className={cn("absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity", bgColor)} />
            
            <CardContent className="p-6 relative z-10">
                <div className={cn("mb-4 p-2 rounded-lg w-fit", bgColor)}>
                    <div className={color}>{icon}</div>
                </div>
                <div className={cn("text-xs font-bold tracking-wider mb-1 uppercase opacity-70", color)}>{label}</div>
                <div className="text-2xl font-bold text-foreground">Rs. {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </CardContent>
        </Card>
    )
}

function OperationRow({ label, value }: any) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className="text-sm font-bold text-foreground">{value}</span>
        </div>
    )
}

function BigMetricCard({ label, value, trend, icon, color, tagColor, noCurrency, activeValue }: any) {
    return (
        <Card className="bg-card border-border hover:shadow-md transition-colors shadow-sm">
            <CardContent className="p-6 flex flex-col justify-between h-40">
                <div className="flex justify-between items-start">
                    <div className={cn("p-2 rounded-lg bg-muted border border-border", color)}>
                        {icon}
                    </div>
                    {trend && (
                         <Badge variant="outline" className={cn("border-0 text-[10px]", tagColor)}>
                             <ArrowDownRight className="w-3 h-3 mr-1" /> {trend.toFixed(1)}%
                         </Badge>
                    )}
                </div>
                
                <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-2xl font-bold text-foreground">
                        {noCurrency ? value : `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function AnalyticsSkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            <div className="h-48 bg-slate-900 rounded-lg w-full" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-64 bg-slate-900 rounded-lg" />
                <div className="h-64 bg-slate-900 rounded-lg" />
            </div>
        </div>
    )
}
