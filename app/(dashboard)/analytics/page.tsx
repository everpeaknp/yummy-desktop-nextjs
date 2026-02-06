"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, TrendingDown, DollarSign, CreditCard, Activity, Lock, Wallet, ArrowUpRight, ArrowDownRight, ReceiptText, ChevronRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { RevenueChart } from "@/components/analytics/revenue-chart";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import { DayCloseModal } from "@/components/analytics/day-close-modal";

export default function AnalyticsPage() {
  const [activeRange, setActiveRange] = useState("today");
  const [data, setData] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [breakdownType, setBreakdownType] = useState<'source' | 'payment' | 'category' | 'supplier'>('category');
  const [loading, setLoading] = useState(true);
  const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
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
        // Helper to format date as YYYY-MM-DD in LOCAL time
        const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const now = new Date();
        let dateFrom = formatDate(now);
        let dateTo = formatDate(now);

        if (activeRange === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            dateFrom = formatDate(y);
            dateTo = formatDate(y);
        } else if (activeRange === 'last7') {
            const l7 = new Date(now);
            l7.setDate(l7.getDate() - 7);
            dateFrom = formatDate(l7);
        } else if (activeRange === 'last30') {
            const l30 = new Date(now);
            l30.setDate(l30.getDate() - 30);
            dateFrom = formatDate(l30);
        } else if (activeRange === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFrom = formatDate(m);
        }

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // 1. Fetch KPI Data
        const dashboardUrl = AnalyticsApis.dashboard({
            restaurantId: user.restaurant_id,
            dateFrom,
            dateTo,
            timezone
        });

        // 2. Fetch Trends Data (Revenue)
        const trendsUrl = AnalyticsApis.trends({
            restaurantId: user.restaurant_id,
            metric: 'gross_sales',
            dateFrom,
            dateTo,
            timezone
        });

        // 3. Fetch Breakdown Data (Category)
        const breakdownUrl = AnalyticsApis.breakdown({
            restaurantId: user.restaurant_id,
            type: breakdownType,
            dateFrom,
            dateTo,
            timezone
        });

        const [dashboardRes, trendsRes, breakdownRes] = await Promise.all([
            apiClient.get(dashboardUrl),
            apiClient.get(trendsUrl),
            apiClient.get(breakdownUrl)
        ]);
        
        if (dashboardRes.data.status === "success") {
          setData(dashboardRes.data.data);
        }

        if (trendsRes.data.status === "success" && Array.isArray(trendsRes.data.data)) {
            // Map backend data to chart format { date: string, value: number }
            const mappedTrends = trendsRes.data.data.map((item: any) => ({
                date: item.date || item.interval,
                // Backend returns 'income' or 'amount' usually
                value: Number(item.income || item.amount || item.value || item.total || item.gross_sales || 0)
            }));
            setTrendsData(mappedTrends);
        }

        if (breakdownRes.data.status === "success" && Array.isArray(breakdownRes.data.data)) {
             // Map backend data to pie format { name: string, value: number }
             const mappedCategory = breakdownRes.data.data.map((item: any) => ({
                 name: item.label || item.category_name || item.name || item.source || item.category || "Unknown",
                 // Backend returns 'amount' for breakdowns
                 value: Number(item.amount || item.value || item.total || item.gross_sales || 0)
             }));
             setCategoryData(mappedCategory);
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
  }, [user, activeRange, breakdownType]);

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
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
        </div>
      </div>

      {loading && !data ? (
          <AnalyticsSkeleton />
      ) : (
        <>
          {/* Period Snapshot */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SnapshotCard 
                    label="CURRENT INCOME" 
                    // Backend returns data.overview.total_income
                    value={data?.overview?.total_income || data?.kpis?.gross_sales || 0} 
                    icon={<DollarSign className="w-4 h-4" />}
                    color="text-orange-500"
                    bgColor="bg-orange-500/10"
                    borderColor="border-orange-500/20"
                />
                <SnapshotCard 
                    label="CURRENT EXPENSE" 
                    value={data?.overview?.total_expense || data?.kpis?.total_expense || 0} 
                    icon={<TrendingDown className="w-4 h-4" />}
                    color="text-red-500"
                    bgColor="bg-red-500/10"
                    borderColor="border-red-500/20"
                />
                <SnapshotCard 
                    label="CURRENT PROFIT" 
                    value={data?.overview?.net_profit || ((data?.kpis?.gross_sales || 0) - (data?.kpis?.total_expense || 0))} 
                    icon={<Wallet className="w-4 h-4" />}
                    color="text-emerald-500"
                    bgColor="bg-emerald-500/10"
                    borderColor="border-emerald-500/20"
                />
            </div>
          </section>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <div className="lg:col-span-4">
                  <RevenueChart data={trendsData} loading={loading} />
              </div>
              <div className="lg:col-span-3">
                  {/* Breakdown Tabs */}
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
                      <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                          <h3 className="font-semibold text-lg">Breakdown</h3>
                          <div className="flex bg-muted p-1 rounded-lg text-xs">
                              {/* Tabs: Source, Payment, Category, Supplier */}
                              {(['source', 'payment', 'category', 'supplier'] as const).map((type) => (
                                  <button
                                      key={type}
                                      onClick={() => setBreakdownType(type)}
                                      className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                                          breakdownType === type 
                                            ? 'bg-background text-foreground shadow-sm font-medium' 
                                            : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                  >
                                      {type}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="flex-1 p-4 min-h-[300px]">
                            <CategoryPieChart data={categoryData} loading={loading} />
                      </div>
                  </div>
              </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* ... existing BigMetricCards ... */}
               <BigMetricCard 
                  label="TOTAL ORDERS" 
                  value={data?.overview?.orders_count || data?.kpis?.total_orders || 0} 
                  noCurrency 
                  icon={<CreditCard className="w-4 h-4" />}
                  color="text-blue-500" 
                  tagColor="bg-blue-500/10 text-blue-500"
               />
               <BigMetricCard 
                  label="AVG ORDER VALUE" 
                  value={data?.overview?.avg_order_value || data?.kpis?.avg_order_value || 0} 
                  icon={<Activity className="w-4 h-4" />}
                  color="text-purple-500" 
                  tagColor="bg-purple-500/10 text-purple-500"
               />
               <BigMetricCard 
                    label="PEAK HOUR"
                    value={data?.operations?.peak_hour || "—"}
                    noCurrency
                    icon={<TrendingUp className="w-4 h-4" />}
                    color="text-pink-500"
               />
               <BigMetricCard 
                    label="CANCELLATIONS"
                    value={data?.operations?.cancellations || 0}
                    noCurrency
                    icon={<ArrowDownRight className="w-4 h-4" />}
                    color="text-rose-500"
               />
          </div>

          {/* Day Close Action */}
          <section>
             <div 
                className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:shadow-xl transition-all flex items-center gap-6"
                onClick={() => setIsDayCloseOpen(true)}
             >
                 <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <ReceiptText className="w-8 h-8 text-white" />
                 </div>
                 <div className="flex-1">
                     <h3 className="text-xl font-bold">Day Close</h3>
                     <p className="text-orange-50 opacity-90 text-sm mt-1">
                        End of day reconciliation for {new Date().toLocaleDateString()}
                     </p>
                 </div>
                 <ChevronRight className="w-6 h-6 text-white/80" />
             </div>
          </section>
        </>
      )}

      {user?.restaurant_id && (
        <DayCloseModal 
            isOpen={isDayCloseOpen} 
            onClose={() => setIsDayCloseOpen(false)} 
            restaurantId={user.restaurant_id} 
        />
      )}

      {/* Debug Info (Temporary) */}
      <div className="p-4 bg-slate-900 text-slate-400 text-xs font-mono rounded overflow-auto mt-8 border border-slate-800">
          <p className="font-bold text-slate-200 mb-2">DEBUG INFO (v3):</p>
          <div className="grid grid-cols-2 gap-4">
              <div>
                <p>Restaurant ID: {user?.restaurant_id}</p>
                <p>Date Range: {activeRange}</p>
                <p>Income: {data?.overview?.total_income}</p>
                <p>Orders: {data?.overview?.orders_count}</p>
                <p>Trends Count: {trendsData?.length}</p>
                <p>Breakdown Count: {categoryData?.length}</p>
              </div>
              <div>
                  <p>First Trend Item:</p>
                  <pre className="text-[10px] bg-slate-950 p-1 rounded max-w-full overflow-hidden">
                      {trendsData?.[0] ? JSON.stringify(trendsData[0], null, 2) : "None"}
                  </pre>
              </div>
          </div>
      </div>
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
