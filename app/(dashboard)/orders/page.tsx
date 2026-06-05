"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { OrderApis, AnalyticsApis, TableApis } from "@/lib/api/endpoints";
import { hasAnalyticsViewPermission } from "@/lib/role-permissions";
import {
  defaultHistoryDateRange,
  resolvePrimaryRole,
  validateHistoryDateRange,
  validationToScopeError,
} from "@/lib/date-scope-policy";
import { parseApiScopeError, type ParsedScopeError } from "@/lib/parse-api-scope-error";
import { HistoryScopeNotice } from "@/components/shared/history-scope-notice";
import { 
  Search, 
  RefreshCw, 
  Clock, 
  LayoutGrid,
  ClipboardList,
  History,
  TrendingUp,
  Receipt,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday, startOfDay, endOfDay, subDays } from "date-fns";
import { 
    Popover,
    PopoverContent,
    PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { OrderCard } from "@/components/orders/order-card";
import Link from "next/link";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { DateRange } from "react-day-picker";

function getOrderTimeMs(order: any): number {
    const raw = order?.started_at || order?.created_at || order?.updated_at;
    const ms = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
}

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [activeFilter, setActiveFilter] = useState<"today" | "all">("today");

    // Hydrate activeFilter from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("orders:activeFilter");
        if (saved === "all" || saved === "today") {
            setActiveFilter(saved);
        }
    }, []);

    const setPersistedActiveFilter = (val: "today" | "all") => {
        setActiveFilter(val);
        localStorage.setItem("orders:activeFilter", val);
    };

    const [orders, setOrders] = useState<any[]>([]);
    const [historyOrders, setHistoryOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [scopeNotice, setScopeNotice] = useState<ParsedScopeError | null>(null);
    const [suggestedRange, setSuggestedRange] = useState<DateRange | undefined>();
    const dateRangeInitialized = useRef(false);
    const [stats, setStats] = useState({
        activeCount: 0,
        totalRevenue: 0,
        pendingAction: 0,
        activeOrdersValue: 0
    });

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [historyLimit, setHistoryLimit] = useState(50);
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab !== "history" || historyLoading) return;

        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && historyOrders.length >= historyLimit) {
                    setHistoryLimit(prev => prev + 50);
                }
            },
            { threshold: 0.1 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [activeTab, historyLoading, historyOrders.length, historyLimit]);

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me);
    const restaurant = useRestaurant(state => state.restaurant);
    const primaryRole = useMemo(() => resolvePrimaryRole(user), [user]);

    useEffect(() => {
        if (!user || dateRangeInitialized.current) return;
        setDateRange(defaultHistoryDateRange(primaryRole));
        dateRangeInitialized.current = true;
    }, [user, primaryRole]);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isHistoryRoute =
        pathname === "/orders/history" || pathname === "/order-history";

    const setOrdersTab = useCallback(
        (tab: "active" | "history") => {
            setActiveTab(tab);
            router.replace(tab === "history" ? "/orders/history" : "/orders", { scroll: false });
        },
        [router],
    );

    // Route + legacy ?tab=history query
    useEffect(() => {
        if (isHistoryRoute || searchParams?.get("tab") === "history") {
            setActiveTab("history");
            if (searchParams?.get("tab") === "history" && pathname === "/orders") {
                router.replace("/orders/history", { scroll: false });
            }
        } else {
            setActiveTab("active");
        }
    }, [isHistoryRoute, searchParams, pathname, router]);

    // 1. Session Restoration
    useEffect(() => {
        const checkAuth = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && token) await me();
            if (!user && !token) router.push('/');
        };
        checkAuth();
    }, [user, me, router]);

    // 2. Fetch Active Orders & Stats
    const fetchActiveData = useCallback(async () => {
        if (!user?.restaurant_id) return;

        try {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const ordersPromise = apiClient.get(`${OrderApis.activeOrders}`, {
                params: { 
                    restaurant_id: user.restaurant_id,
                    timezone: timezone,
                    _t: Date.now()
                }
            });

            const canViewAnalytics = hasAnalyticsViewPermission(user);
            const analyticsPromise = canViewAnalytics
                ? apiClient.get(AnalyticsApis.dashboard({
                    restaurantId: user.restaurant_id,
                    dateFrom: todayStr,
                    dateTo: todayStr,
                    timezone: timezone,
                    include: "core",
                })).catch(err => {
                    console.warn("Analytics revenue stat unavailable:", err.message);
                    return { data: { status: "error", data: null } };
                })
                : Promise.resolve({ data: { status: "skipped", data: null } });

            const [ordersRes, analyticsRes] = await Promise.all([ordersPromise, analyticsPromise]);

            if (ordersRes.data.status === "success") {
                const fetchedOrders = [...(ordersRes.data.data.orders || [])]
                    .sort((a: any, b: any) => getOrderTimeMs(b) - getOrderTimeMs(a));
                setOrders(fetchedOrders);
                
                const pending = fetchedOrders.filter((o: any) => 
                    ['pending', 'confirmed', 'preparing', 'requested'].includes((o.status as string).toLowerCase())
                ).length;

                const activeValue = fetchedOrders.reduce((sum: number, o: any) => sum + (o.grand_total || 0), 0);

                setStats(prev => ({
                    ...prev,
                    activeCount: fetchedOrders.length,
                    pendingAction: pending,
                    activeOrdersValue: activeValue
                }));
            }

            if (analyticsRes.data.status === "success") {
                const d = analyticsRes.data.data;
                setStats(prev => ({
                    ...prev,
                    totalRevenue: d.overview?.total_income || d.kpis?.gross_sales || 0
                }));
            } else if (!canViewAnalytics) {
                setStats(prev => ({ ...prev, totalRevenue: 0 }));
            }
        } catch (err) {
            console.error("Failed to fetch active data:", err);
        } finally {
            setLoading(false);
        }
    }, [user?.restaurant_id, user]);

    // 3. Fetch History Orders
    const fetchHistoryData = useCallback(async () => {
        if (!user?.restaurant_id || activeTab !== "history") return;

        const validation = validateHistoryDateRange(dateRange, {
            role: primaryRole,
            effectivePlan: restaurant?.effective_plan,
        });
        if (!validation.allowed) {
            setScopeNotice(validationToScopeError(validation));
            setSuggestedRange(validation.suggestedRange);
            setHistoryOrders([]);
            setHistoryLoading(false);
            return;
        }

        setScopeNotice(null);
        setSuggestedRange(undefined);
        setHistoryLoading(true);
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const params: any = {
                restaurant_id: user.restaurant_id,
                status: ['completed', 'canceled'],
                timezone: timezone,
                limit: historyLimit
            };

            if (dateRange?.from) {
                params.date_from = format(dateRange.from, "yyyy-MM-dd");
            }
            if (dateRange?.to) {
                params.date_to = format(dateRange.to, "yyyy-MM-dd");
            } else if (dateRange?.from) {
                params.date_to = format(dateRange.from, "yyyy-MM-dd");
            }

            if (searchQuery) {
                params.search = searchQuery;
            }

            // Note: axios formats arrays in params as status[]=val1&status[]=val2 by default.
            // But FastAPI expects status=val1&status=val2.
            // We can use a custom paramsSerializer or just build the string.
            const queryString = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => queryString.append(key, v));
                } else if (value !== undefined && value !== null) {
                    queryString.append(key, String(value));
                }
            });

            const res = await apiClient.get(`${OrderApis.listOrders}?${queryString.toString()}`);
            if (res.data.status === "success") {
                const data = res.data.data;
                const list = [...(data.orders || [])]
                    .sort((a: any, b: any) => getOrderTimeMs(b) - getOrderTimeMs(a));
                setHistoryOrders(list);
            }
        } catch (err: unknown) {
            const parsed = parseApiScopeError(err, { role: primaryRole });
            if (parsed) {
                setScopeNotice(parsed);
                setHistoryOrders([]);
                if (parsed.kind === "role_manager_limit") {
                    setSuggestedRange({ from: subDays(new Date(), 30), to: new Date() });
                } else if (parsed.maxDays) {
                    setSuggestedRange({
                        from: subDays(new Date(), parsed.maxDays - 1),
                        to: new Date(),
                    });
                }
                return;
            }
            toast.error("Failed to load history");
        } finally {
            setHistoryLoading(false);
        }
    }, [
        user?.restaurant_id,
        activeTab,
        dateRange,
        searchQuery,
        historyLimit,
        primaryRole,
        restaurant?.effective_plan,
    ]);

    const applySuggestedHistoryRange = useCallback(() => {
        if (suggestedRange) {
            setDateRange(suggestedRange);
            setScopeNotice(null);
            setSuggestedRange(undefined);
        }
    }, [suggestedRange]);

    useEffect(() => {
        if (user?.restaurant_id) {
            fetchActiveData();
            if (activeTab === "active") {
                const interval = setInterval(fetchActiveData, 10000);
                return () => clearInterval(interval);
            }
        }
    }, [user, fetchActiveData, activeTab]);

    useEffect(() => {
        if (activeTab === "history") {
            const timer = setTimeout(fetchHistoryData, 500);
            return () => clearTimeout(timer);
        }
    }, [fetchHistoryData, activeTab]);

    const openReceipt = (orderId: number) => {
        setSelectedOrderId(orderId);
        setDetailsOpen(true);
    };

    // Grouping logic for History
    const groupedHistory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        
        historyOrders.forEach(order => {
            const date = new Date(order.created_at || order.started_at);
            let label = "";
            if (isToday(date)) label = "Today";
            else if (isYesterday(date)) label = "Yesterday";
            else label = format(date, "MMM d, yyyy");

            if (!groups[label]) groups[label] = [];
            groups[label].push(order);
        });

        return groups;
    }, [historyOrders]);

    const activeStats = useMemo(() => {
        // Exclude parent split orders if they are fully split (total is 0) to align with backend
        const activeList = orders.filter(o => {
            if (o.is_split_parent && o.grand_total === 0) {
                return false;
            }
            return true;
        });

        const todayOrders = activeList.filter(o => {
            const raw = o.started_at || o.created_at || o.updated_at;
            return raw && isToday(new Date(raw));
        });

        const targetOrders = activeFilter === "today" ? todayOrders : activeList;

        const activeCount = targetOrders.length;
        const pendingAction = targetOrders.filter((o: any) => 
            ['pending', 'confirmed', 'preparing', 'requested'].includes((o.status as string).toLowerCase())
        ).length;
        const activeOrdersValue = targetOrders.reduce((sum: number, o: any) => sum + (o.grand_total || 0), 0);

        return {
            activeCount,
            pendingAction,
            activeOrdersValue
        };
    }, [orders, activeFilter]);

    const filteredActive = orders.filter(order => {
        if (order.is_split_parent && order.grand_total === 0) {
            return false;
        }

        if (activeFilter === "today") {
            const raw = order.started_at || order.created_at || order.updated_at;
            if (raw && !isToday(new Date(raw))) return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (order.table_name || "").toLowerCase().includes(q) ||
            (order.customer_name || "").toLowerCase().includes(q) ||
            String(order.restaurant_order_id || order.id).includes(q)
        );
    }).sort((a: any, b: any) => getOrderTimeMs(b) - getOrderTimeMs(a));

    return (
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Orders</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="h-1 w-1 rounded-full bg-primary" />
                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                            {format(new Date(), "PPpp")}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative group min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                            className="pl-10 bg-card border-border/40 h-12 rounded-2xl focus-visible:ring-primary/20 transition-all font-medium text-sm" 
                            placeholder="Search orders, customers..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                    </div>
                    <Button variant="outline" className="h-12 w-12 rounded-2xl p-0" onClick={() => activeTab === "active" ? fetchActiveData() : fetchHistoryData()}>
                       <RefreshCw className={cn("h-5 w-5", (loading || historyLoading) && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Active"
                    value={activeTab === "active" ? activeStats.activeCount.toString() : stats.activeCount.toString()}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's in progress" : "All in progress") : "In progress"}
                    icon={<RefreshCw className="h-6 w-6" />}
                    color="blue"
                    active={activeTab === "active"}
                />
                <StatCard
                    label="Value"
                    value={activeTab === "active" ? activeStats.activeOrdersValue.toLocaleString() : stats.totalRevenue.toLocaleString()}
                    prefix={restaurant?.currency || "Rs."}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's active value" : "Total active value") : "Total revenue"}
                    icon={<TrendingUp className="h-6 w-6" />}
                    color="orange"
                />
                <StatCard
                    label="Pending"
                    value={activeTab === "active" ? activeStats.pendingAction.toString() : stats.pendingAction.toString()}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's need action" : "All need action") : "Need action"}
                    icon={<Clock className="h-6 w-6" />}
                    color="yellow"
                />
            </div>

            {/* Tabs & Filters */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div className="flex items-center gap-6">
                        <TabButton 
                            label="Active" 
                            active={activeTab === "active"} 
                            onClick={() => setOrdersTab("active")} 
                            icon={<ClipboardList className="h-4 w-4" />}
                        />
                        <TabButton 
                            label="History" 
                            active={activeTab === "history"} 
                            onClick={() => setOrdersTab("history")} 
                            icon={<History className="h-4 w-4" />}
                        />
                    </div>

                    {activeTab === "active" && (
                         <div className="flex items-center bg-muted p-1 rounded-xl border border-border/40 shrink-0">
                             <button
                                 onClick={() => setPersistedActiveFilter("today")}
                                 className={cn(
                                     "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                                     activeFilter === "today"
                                         ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                                         : "text-muted-foreground hover:text-foreground"
                                 )}
                             >
                                 Today
                             </button>
                             <button
                                 onClick={() => setPersistedActiveFilter("all")}
                                 className={cn(
                                     "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                                     activeFilter === "all"
                                         ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                                         : "text-muted-foreground hover:text-foreground"
                                 )}
                             >
                                 All Active
                             </button>
                         </div>
                    )}

                    {activeTab === "history" && (
                        <div className="flex items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-10 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest">
                                        <CalendarIcon className="h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            "Select Date Range"
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-auto p-0 flex shadow-2xl border border-border/40 rounded-[24px] overflow-hidden bg-background"
                                    align="center"
                                    style={{ fontFamily: "inherit" }}
                                >
                                    {/* Quick Select */}
                                    <div className="flex flex-col p-5 border-r border-border/40 bg-muted/20 w-[140px] shrink-0">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500 mb-4">Quick Select</p>
                                        <div className="flex flex-col gap-1 flex-1">
                                            <PresetButton
                                                label="Today"
                                                onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                                                active={dateRange?.from && isToday(dateRange.from) && (!dateRange.to || isToday(dateRange.to))}
                                            />
                                            <PresetButton
                                                label="Yesterday"
                                                onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) })}
                                                active={dateRange?.from && isYesterday(dateRange.from)}
                                            />
                                            <PresetButton
                                                label="Last 7 Days"
                                                onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                                                active={dateRange?.from && format(dateRange.from, 'yyyy-MM-dd') === format(subDays(new Date(), 7), 'yyyy-MM-dd')}
                                            />
                                            <PresetButton
                                                label="Last 30 Days"
                                                onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) })}
                                                active={dateRange?.from && format(dateRange.from, 'yyyy-MM-dd') === format(subDays(new Date(), 30), 'yyyy-MM-dd')}
                                            />
                                        </div>
                                        <button
                                            className="text-[9px] font-bold uppercase tracking-widest text-destructive/40 hover:text-destructive transition-colors mt-4 text-left"
                                            onClick={() => setDateRange(defaultHistoryDateRange(primaryRole))}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    {/* Calendar */}
                                    <div className="p-4">
                                        <CalendarComponent
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from || new Date()}
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            numberOfMonths={1}
                                            className="p-0"
                                            weekStartsOn={1}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-8">
                    {activeTab === "history" && scopeNotice ? (
                        <HistoryScopeNotice
                            error={scopeNotice}
                            onUseSuggestedRange={
                                suggestedRange ? applySuggestedHistoryRange : undefined
                            }
                            suggestedRangeLabel="Use allowed date range"
                        />
                    ) : null}
                    {activeTab === "active" ? (
                        loading ? (
                            <LoadingGrid />
                        ) : filteredActive.length === 0 ? (
                            <EmptyState label="No active orders found" icon={<ClipboardList />} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredActive.map((order) => (
                                    <Link key={order.id} href={`/orders/${order.id}`}>
                                        <OrderCard order={order} />
                                    </Link>
                                ))}
                            </div>
                        )
                    ) : scopeNotice ? null : historyLoading ? (
                            <LoadingGrid />
                        ) : historyOrders.length === 0 ? (
                            <EmptyState label="No order history found" icon={<History />} />
                        ) : (
                            <div className="flex flex-col gap-8">
                                {Object.entries(groupedHistory).map(([label, orders]) => (
                                    <div key={label} className="flex flex-col gap-4">
                                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
                                            <span className="h-[1px] flex-1 bg-border/40" />
                                            {label}
                                            <span className="h-[1px] flex-1 bg-border/40" />
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {orders.map((order) => (
                                                <Link key={order.id} href={`/orders/${order.id}`}>
                                                    <OrderCard order={order} />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div ref={observerTarget} className="h-16 w-full flex items-center justify-center mt-6">
                                    {historyOrders.length >= historyLimit && (
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>

            <ReceiptDetailSheet 
                orderId={selectedOrderId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}

function StatCard({ label, value, subSelect, icon, color, active }: any) {
    const colors: any = {
        blue: "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:border-blue-900/30",
        orange: "bg-orange-500/10 text-orange-600 border-orange-200/50 dark:border-orange-900/30",
        yellow: "bg-yellow-500/10 text-yellow-600 border-yellow-200/50 dark:border-yellow-900/30",
    };

    return (
        <Card className={cn(
            "relative overflow-hidden border shadow-sm group bg-card transition-all duration-300",
            active && "ring-2 ring-primary/20 border-primary/30 shadow-md"
        )}>
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                    colors[color]
                )}>
                    {icon}
                </div>
                <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                    <h3 className="text-3xl font-black tracking-tighter">{value}</h3>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{subSelect}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function TabButton({ label, active, onClick, icon }: any) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 pb-4 px-1 border-b-2 transition-all relative",
                active 
                    ? "border-primary text-foreground font-black uppercase tracking-widest text-sm" 
                    : "border-transparent text-muted-foreground font-bold uppercase tracking-widest text-sm hover:text-foreground"
            )}
        >
            {icon}
            {label}
        </button>
    );
}

function LoadingGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
            ))}
        </div>
    );
}

function EmptyState({ label, icon }: any) {
    return (
        <div className="h-96 flex flex-col items-center justify-center text-center gap-6 bg-muted/20 rounded-[40px] border-2 border-dashed border-border/40">
            <div className="h-24 w-24 rounded-[32px] bg-muted flex items-center justify-center text-muted-foreground">
                {icon}
            </div>
            <div>
                <h3 className="text-xl font-bold">{label}</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">Try adjusting your filters or search query.</p>
            </div>
        </div>
    );
}

function PresetButton({ label, onClick, active, className }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center w-full px-3 py-2.5 rounded-xl text-left text-[10px] font-semibold transition-all duration-200",
                active
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground",
                className
            )}
        >
            {label}
        </button>
    );
}
