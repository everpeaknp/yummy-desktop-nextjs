"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, TrendingDown, DollarSign, CreditCard, Activity, Lock, Wallet, ArrowUpRight, ArrowDownRight, ReceiptText, ChevronRight, Bed, Utensils, LayoutGrid, Users, ChefHat, Boxes, ArrowLeftRight } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyticsViewAccess } from "@/hooks/use-analytics-view-access";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/hooks/use-restaurant";
import { AnalyticsApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { DateRangeDropdown, DateRangePreset } from "@/components/ui/date-range-dropdown";
import { DateRange } from "react-day-picker";
import Link from "next/link";
import {
  AnalyticsAccessDenied,
  AnalyticsAccessLoading,
  AnalyticsFetchError,
} from "@/components/analytics/analytics-access-states";

import { RevenueChart } from "@/components/analytics/revenue-chart";
import { CategoryPieChart } from "@/components/analytics/category-pie";
import { DayCloseModal } from "@/components/analytics/day-close-modal";
import {
    breakdownPieCopy,
    formatCancellationRate,
    mapAnalyticsTrends,
    mapBreakdownToPie,
    preferHourlyTrends,
    topItemQuantitySold,
    type BreakdownTab,
} from "@/lib/analytics-dashboard-mapper";

export default function AnalyticsPage() {
    const [activeRange, setActiveRange] = useState<DateRangePreset>("today");
    const [data, setData] = useState<any>(null);
    const [trendsData, setTrendsData] = useState<any[]>([]);
    const [categoryData, setCategoryData] = useState<any[]>([]);
    const [breakdownType, setBreakdownType] = useState<BreakdownTab>('source');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [date, setDate] = useState<DateRange | undefined>();
    const [isDayCloseOpen, setIsDayCloseOpen] = useState(false);
    const [businessLine, setBusinessLine] = useState<string | undefined>(undefined);
    const user = useAuth(state => state.user);
    const { ready, canViewAnalytics } = useAnalyticsViewAccess();
    const restaurant = useRestaurant((s) => s.restaurant);

    // Fetch all analytics from unified /analytics/dashboard (same as Flutter)
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!user?.restaurant_id || !canViewAnalytics) {
                setData(null);
                setTrendsData([]);
                setCategoryData([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            setFetchError(null);
            try {
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
                    l7.setDate(l7.getDate() - 6);
                    dateFrom = formatDate(l7);
                } else if (activeRange === 'last30') {
                    const l30 = new Date(now);
                    l30.setDate(l30.getDate() - 29);
                    dateFrom = formatDate(l30);
                } else if (activeRange === 'month') {
                    const m = new Date(now.getFullYear(), now.getMonth(), 1);
                    dateFrom = formatDate(m);
                } else if (activeRange === 'custom' && date?.from && date?.to) {
                    dateFrom = formatDate(date.from);
                    dateTo = formatDate(date.to);
                }

                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                const dashboardUrl = AnalyticsApis.dashboard({
                    restaurantId: user.restaurant_id,
                    dateFrom,
                    dateTo,
                    timezone,
                    businessLine,
                    include: "core",
                });

                const res = await apiClient.get(dashboardUrl);

                if (res.data?.status === "success") {
                    const d = res.data.data;
                    setData(d);
                    setTrendsData(
                        mapAnalyticsTrends(d, preferHourlyTrends(activeRange))
                    );
                } else {
                    setFetchError(res.data?.message || "Failed to load analytics dashboard");
                }

            } catch (err: any) {
                const message =
                    err?.response?.data?.detail ||
                    err?.response?.data?.message ||
                    "Failed to load analytics dashboard";
                setFetchError(message);
            } finally {
                setLoading(false);
            }
        };

        if (!ready) return;
        if (user?.restaurant_id) {
            if (activeRange === 'custom' && (!date?.from || !date?.to)) {
                return; // Wait until range is fully selected
            }
            fetchAnalytics();
        }
    }, [ready, canViewAnalytics, user, activeRange, businessLine, date, fetchTrigger]);

    useEffect(() => {
        if (!data?.breakdown) {
            setCategoryData([]);
            return;
        }
        setCategoryData(mapBreakdownToPie(data.breakdown, breakdownType));
    }, [data, breakdownType]);

    const pieCopy = breakdownPieCopy(breakdownType);
    const topMenuItems = data?.menu_snapshot?.top_items || [];

    if (!ready) return <AnalyticsAccessLoading />;
    if (!canViewAnalytics) return <AnalyticsAccessDenied />;

    return (
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
            {fetchError ? (
                <AnalyticsFetchError
                    message={fetchError}
                    onRetry={() => setFetchTrigger((t) => t + 1)}
                />
            ) : null}
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground text-sm uppercase tracking-wider text-orange-500 font-semibold">
                        {restaurant?.name || "YUMMY"}
                    </p>
                </div>

                <DateRangeDropdown 
                    activeRange={activeRange}
                    setActiveRange={setActiveRange}
                    date={date}
                    setDate={setDate}
                />
            </div>

            {/* Module Selector (Only if both enabled) */}
            {restaurant?.hotel_enabled && restaurant?.restaurant_enabled && (
                <div className="flex items-center gap-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">View Metrics For:</p>
                    <div className="flex bg-muted p-1 rounded-lg border border-border">
                        <FilterButton 
                            label="All Services" 
                            active={businessLine === undefined} 
                            onClick={() => setBusinessLine(undefined)} 
                            icon={<LayoutGrid className="w-3 h-3" />} 
                        />
                        <FilterButton 
                            label="Restaurant" 
                            active={businessLine === 'restaurant'} 
                            onClick={() => setBusinessLine('restaurant')} 
                            icon={<Utensils className="w-3 h-3" />} 
                        />
                        <FilterButton 
                            label="Hotel / Rooms" 
                            active={businessLine === 'hotel'} 
                            onClick={() => setBusinessLine('hotel')} 
                            icon={<Bed className="w-3 h-3" />} 
                        />
                    </div>
                </div>
            )}

            {/* Drilldowns */}
            <div className="flex flex-wrap items-center gap-2">
                <Link href="/analytics/menu">
                    <Button variant="outline" className="rounded-full gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        Menu Details
                    </Button>
                </Link>
                <Link href="/analytics/staff">
                    <Button variant="outline" className="rounded-full gap-2">
                        <Users className="w-4 h-4" />
                        Staff Details
                    </Button>
                </Link>
                <Link href="/analytics/kitchen">
                    <Button variant="outline" className="rounded-full gap-2">
                        <ChefHat className="w-4 h-4" />
                        Kitchen Details
                    </Button>
                </Link>
                <Link href="/analytics/inventory">
                    <Button variant="outline" className="rounded-full gap-2">
                        <Boxes className="w-4 h-4" />
                        Inventory Details
                    </Button>
                </Link>
                <Link href="/analytics/compare">
                    <Button variant="outline" className="rounded-full gap-2">
                        <ArrowLeftRight className="w-4 h-4" />
                        Compare
                    </Button>
                </Link>
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
                        <div className="lg:col-span-4 min-w-0">
                            <RevenueChart
                                data={trendsData}
                                loading={loading}
                                title={
                                    preferHourlyTrends(activeRange)
                                        ? "Hourly Revenue"
                                        : "Revenue Trends"
                                }
                            />
                        </div>
                        <div className="lg:col-span-3 min-w-0">
                            {/* Breakdown Tabs */}
                            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h3 className="font-semibold text-lg">{pieCopy.title}</h3>
                                        <p className="text-sm text-muted-foreground mt-0.5">{pieCopy.description}</p>
                                    </div>
                                    <div className="flex bg-muted p-1 rounded-lg text-xs">
                                        {/* Tabs: Source, Payment, Category (matching Flutter) */}
                                        {(['source', 'payment', 'category'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setBreakdownType(type)}
                                                className={`px-3 py-1.5 rounded-md capitalize transition-all ${breakdownType === type
                                                    ? 'bg-background text-foreground shadow-sm font-medium'
                                                    : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {type === 'source' ? 'channel' : type === 'category' ? 'menu' : type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 min-w-0">
                                    <CategoryPieChart
                                        embedded
                                        data={categoryData}
                                        loading={loading}
                                    />
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
                            label="CANCELLATION RATE"
                            value={formatCancellationRate(data?.operations)}
                            noCurrency
                            icon={<ArrowDownRight className="w-4 h-4" />}
                            color="text-rose-500"
                        />
                    </div>

                    {topMenuItems.length > 0 ? (
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">Top Menu Items</h3>
                                <Link href="/analytics/menu">
                                    <Button variant="ghost" size="sm" className="gap-1">
                                        View all <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {topMenuItems.slice(0, 5).map((item: any) => (
                                    <Card key={item.id ?? item.name} className="border-border shadow-sm">
                                        <CardContent className="p-4 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {topItemQuantitySold(item)} sold
                                                </p>
                                            </div>
                                            <p className="text-sm font-bold shrink-0">
                                                Rs. {Number(item.revenue || 0).toLocaleString()}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    ) : null}

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
        </div>
    );
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
            <div className="h-48 bg-muted rounded-lg w-full" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-64 bg-muted rounded-lg" />
                <div className="h-64 bg-muted rounded-lg" />
            </div>
        </div>
    )
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
