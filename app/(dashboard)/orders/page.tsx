"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { OrderApis, AnalyticsApis, TableApis, KotApis } from "@/lib/api/endpoints";
import { hasAnalyticsViewPermission } from "@/lib/role-permissions";
import {
  defaultHistoryDateRange,
  hasExtendedHistoryAccess,
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
  Loader2,
  ChefHat
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { entitlementLimit } from "@/lib/subscription/entitlements";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday, startOfDay, endOfDay, subDays } from "date-fns";
import { 
    Popover,
    PopoverContent,
    PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { OrderCard } from "@/components/orders/order-card";
import { OrderHistoryCard } from "@/components/orders/order-history-card";
import Link from "next/link";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { DateRange } from "react-day-picker";

interface OrdersKotItem {
    id: number;
    item_name: string;
    qty_change: number;
    qty_ready?: number;
    qty_served?: number;
    notes?: string;
    is_deleted?: number;
}

interface OrdersKot {
    id: number;
    kot_number: string;
    station?: string;
    status: string;
    order_id: number;
    created_at: string;
    items: OrdersKotItem[];
    table_name?: string;
    table_category?: string;
    order_created_at?: string;
    created_by_staff_name?: string;
    customer_name?: string;
}

interface OrdersKotActivity {
    id: number;
    event: string;
    change_field?: string | null;
    old_value?: Record<string, any> | null;
    new_value?: Record<string, any> | null;
    actor_name?: string | null;
    actor_role?: string | null;
    created_at: string;
}

type OrdersKotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "REJECTED";

function nextKotStatus(status: string): OrdersKotStatus | null {
    switch (String(status || "PENDING").toUpperCase()) {
        case "PENDING": return "PREPARING";
        case "PREPARING": return "READY";
        case "READY": return "SERVED";
        default: return null;
    }
}

function kotStatusLabel(status: string): string {
    const normalized = String(status || "PENDING").toUpperCase();
    return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

function kotNextActionLabel(status: string): string {
    switch (nextKotStatus(status)) {
        case "PREPARING": return "Start Cooking";
        case "READY": return "Mark Ready";
        case "SERVED": return "Complete";
        default: return "Completed";
    }
}

function getOrderTimeMs(order: any): number {
    const status = String(order?.status || "").toLowerCase();
    const raw = ["completed", "canceled"].includes(status)
        ? order?.completed_at || order?.canceled_at || order?.updated_at || order?.created_at || order?.started_at
        : order?.started_at || order?.created_at || order?.updated_at;
    const ms = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(ms) ? ms : 0;
}

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState<"active" | "kot" | "history">("active");
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
    const [kots, setKots] = useState<OrdersKot[]>([]);
    const [kotLoading, setKotLoading] = useState(false);
    const [kotStatusFilter, setKotStatusFilter] = useState<OrdersKotStatus | "ALL">("ALL");
    const [kotStationFilter, setKotStationFilter] = useState("All");
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
    const [kotDetailsOpen, setKotDetailsOpen] = useState(false);
    const [selectedKot, setSelectedKot] = useState<OrdersKot | null>(null);
    const [kotActivity, setKotActivity] = useState<OrdersKotActivity[]>([]);
    const [kotActivityLoading, setKotActivityLoading] = useState(false);
    const [kotStatusUpdating, setKotStatusUpdating] = useState(false);
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
    const subscriptionEntitlements = useSubscriptionStore((state) => state.current?.entitlements);
    const historyDays = entitlementLimit(subscriptionEntitlements, "finance.history_days");
    const primaryRole = useMemo(() => resolvePrimaryRole(user), [user]);
    const canUseExtendedHistory = useMemo(() => hasExtendedHistoryAccess(user), [user]);

    useEffect(() => {
        if (!user || dateRangeInitialized.current) return;
        setDateRange(defaultHistoryDateRange(primaryRole, { user }));
        dateRangeInitialized.current = true;
    }, [user, primaryRole]);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isHistoryRoute =
        pathname === "/orders/history" || pathname === "/order-history";

    const setOrdersTab = useCallback(
        (tab: "active" | "kot" | "history") => {
            setActiveTab(tab);
            router.replace(
                tab === "history" ? "/orders/history" : tab === "kot" ? "/orders?tab=kot" : "/orders",
                { scroll: false },
            );
        },
        [router],
    );

    // Route + tab query keep the selected view shareable without creating a separate KOT page.
    useEffect(() => {
        if (isHistoryRoute || searchParams?.get("tab") === "history") {
            setActiveTab("history");
            if (searchParams?.get("tab") === "history" && pathname === "/orders") {
                router.replace("/orders/history", { scroll: false });
            }
        } else if (searchParams?.get("tab") === "kot") {
            setActiveTab("kot");
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

            const ordersPromise = apiClient.get(`${OrderApis.activeOrders}`, {
                params: { 
                    restaurant_id: user.restaurant_id,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    _t: Date.now()
                }
            });

            const canViewAnalytics = hasAnalyticsViewPermission(user);
            const analyticsPromise = canViewAnalytics
                ? apiClient.get(AnalyticsApis.dashboard({
                    restaurantId: user.restaurant_id,
                    dateFrom: todayStr,
                    dateTo: todayStr,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
            console.error("Failed to fetch active data response:", (err as any)?.response?.data);
            console.error("Failed to fetch active data response json:", JSON.stringify((err as any)?.response?.data ?? null));
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchKotData = useCallback(async () => {
        if (!user?.restaurant_id) return;
        setKotLoading(true);
        try {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const params = new URLSearchParams({
                restaurant_id: String(user.restaurant_id),
                limit: "100",
                include_printer_config: "false",
                date_from: start.toISOString(),
                date_to: end.toISOString(),
            });
            const res = await apiClient.get(`${KotApis.searchKots}?${params.toString()}`);
            if (res.data?.status === "success") {
                const next = Array.isArray(res.data.data) ? res.data.data : [];
                setKots(next as OrdersKot[]);
            }
        } catch (error) {
            console.error("Failed to fetch KOT data:", error);
            toast.error("Failed to load kitchen tickets");
        } finally {
            setKotLoading(false);
        }
    }, [user?.restaurant_id]);

    // 3. Fetch History Orders
    const fetchHistoryData = useCallback(async () => {
        if (!user?.restaurant_id || activeTab !== "history") return;

        const validation = validateHistoryDateRange(dateRange, {
            role: primaryRole,
            effectivePlan: restaurant?.effective_plan,
            historyDays,
            user,
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
        user,
        activeTab,
        dateRange,
        searchQuery,
        historyLimit,
        primaryRole,
        restaurant?.effective_plan,
        historyDays,
    ]);

    const applySuggestedHistoryRange = useCallback(() => {
        if (suggestedRange) {
            setDateRange(suggestedRange);
            setScopeNotice(null);
            setSuggestedRange(undefined);
        }
    }, [suggestedRange]);

    useEffect(() => {
        if (user?.restaurant_id && activeTab === "active") {
            fetchActiveData();
            const interval = setInterval(fetchActiveData, 10000);
            return () => clearInterval(interval);
        }
        if (user?.restaurant_id && activeTab === "kot") {
            fetchKotData();
            const interval = setInterval(fetchKotData, 15000);
            return () => clearInterval(interval);
        }
    }, [user, fetchActiveData, fetchKotData, activeTab]);

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

    useEffect(() => {
        if (!kotDetailsOpen || !selectedKot) return;

        let cancelled = false;
        setKotActivityLoading(true);
        apiClient
            .get(KotApis.getKotActivity(selectedKot.id), { params: { skip: 0, limit: 100 } })
            .then((res) => {
                if (cancelled) return;
                setKotActivity(res.data?.status === "success" ? (res.data?.data?.items || []) : []);
            })
            .catch(() => {
                if (!cancelled) setKotActivity([]);
            })
            .finally(() => {
                if (!cancelled) setKotActivityLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [kotDetailsOpen, selectedKot]);

    const openKotDetails = (kot: OrdersKot) => {
        setSelectedKot(kot);
        setKotActivity([]);
        setKotDetailsOpen(true);
    };

    const updateKotStatus = useCallback(async (kotId: number, newStatus: OrdersKotStatus) => {
        if (kotStatusUpdating) return;
        setKotStatusUpdating(true);
        try {
            await apiClient.patch(KotApis.updateKotStatus(kotId), { status: newStatus });
            setSelectedKot((current) => current && current.id === kotId ? { ...current, status: newStatus } : current);
            setKots((current) => current.map((kot) => kot.id === kotId ? { ...kot, status: newStatus } : kot));
            toast.success(`KOT marked ${newStatus.toLowerCase()}`);
            // Keep counts, filters, and server-derived fields in sync after the update.
            await fetchKotData();
        } catch (error: any) {
            const detail = error?.response?.data?.detail || error?.response?.data?.message;
            toast.error(typeof detail === "string" ? detail : "Failed to update KOT status");
        } finally {
            setKotStatusUpdating(false);
        }
    }, [fetchKotData, kotStatusUpdating]);

    const rejectKot = useCallback(async (kotId: number) => {
        if (kotStatusUpdating || !window.confirm("Reject this kitchen ticket?")) return;
        setKotStatusUpdating(true);
        try {
            await apiClient.post(KotApis.rejectKot(kotId));
            setSelectedKot((current) => current && current.id === kotId ? { ...current, status: "REJECTED" } : current);
            setKots((current) => current.map((kot) => kot.id === kotId ? { ...kot, status: "REJECTED" } : kot));
            toast.success("KOT rejected");
            await fetchKotData();
        } catch (error: any) {
            const detail = error?.response?.data?.detail || error?.response?.data?.message;
            toast.error(typeof detail === "string" ? detail : "Failed to reject KOT");
        } finally {
            setKotStatusUpdating(false);
        }
    }, [fetchKotData, kotStatusUpdating]);

    // Grouping logic for History
    const groupedHistory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        
        historyOrders.forEach(order => {
            const date = new Date(getOrderTimeMs(order));
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

    const filteredKots = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return kots
            .filter((kot) => kotStatusFilter === "ALL" || String(kot.status).toUpperCase() === kotStatusFilter)
            .filter((kot) => kotStationFilter === "All" || (kot.station || "").toLowerCase() === kotStationFilter.toLowerCase())
            .filter((kot) => {
                if (!query) return true;
                const haystack = [
                    kot.kot_number,
                    kot.table_name,
                    kot.station,
                    kot.customer_name,
                    kot.created_by_staff_name,
                    ...(kot.items || []).map((item) => item.item_name),
                ].filter(Boolean).join(" ").toLowerCase();
                return haystack.includes(query);
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [kots, kotStatusFilter, kotStationFilter, searchQuery]);

    const kotStats = useMemo(() => ({
        active: kots.filter((kot) => !["SERVED", "REJECTED"].includes(String(kot.status).toUpperCase())).length,
        ready: kots.filter((kot) => String(kot.status).toUpperCase() === "READY").length,
        pending: kots.filter((kot) => String(kot.status).toUpperCase() === "PENDING").length,
    }), [kots]);

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
                    <Button variant="outline" className="h-12 w-12 rounded-2xl p-0" onClick={() => activeTab === "active" ? fetchActiveData() : activeTab === "kot" ? fetchKotData() : fetchHistoryData()}>
                       <RefreshCw className={cn("h-5 w-5", (loading || historyLoading || kotLoading) && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label={activeTab === "kot" ? "Tickets" : "Active"}
                    value={activeTab === "active" ? activeStats.activeCount.toString() : activeTab === "kot" ? kotStats.active.toString() : stats.activeCount.toString()}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's in progress" : "All in progress") : activeTab === "kot" ? "Kitchen work in progress" : "In progress"}
                    icon={<RefreshCw className="h-6 w-6" />}
                    color="blue"
                    active={activeTab !== "history"}
                />
                <StatCard
                    label={activeTab === "kot" ? "Ready" : "Value"}
                    value={activeTab === "active" ? activeStats.activeOrdersValue.toLocaleString() : activeTab === "kot" ? kotStats.ready.toString() : stats.totalRevenue.toLocaleString()}
                    prefix={activeTab === "kot" ? "" : restaurant?.currency || "Rs."}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's active value" : "Total active value") : activeTab === "kot" ? "Ready for service" : "Total revenue"}
                    icon={<TrendingUp className="h-6 w-6" />}
                    color="orange"
                />
                <StatCard
                    label="Pending"
                    value={activeTab === "active" ? activeStats.pendingAction.toString() : activeTab === "kot" ? kotStats.pending.toString() : stats.pendingAction.toString()}
                    subSelect={activeTab === "active" ? (activeFilter === "today" ? "Today's need action" : "All need action") : activeTab === "kot" ? "Waiting to start" : "Need action"}
                    icon={<Clock className="h-6 w-6" />}
                    color="yellow"
                />
            </div>

            {/* Tabs & Filters */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-6">
                        <TabButton 
                            label="Active" 
                            active={activeTab === "active"} 
                            onClick={() => setOrdersTab("active")} 
                            icon={<ClipboardList className="h-4 w-4" />}
                        />
                        <TabButton
                            label="KOT"
                            active={activeTab === "kot"}
                            onClick={() => setOrdersTab("kot")}
                            icon={<ChefHat className="h-4 w-4" />}
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
                             {canUseExtendedHistory ? (
                                <Badge variant="secondary" className="h-10 rounded-xl px-3 text-[10px] font-bold uppercase tracking-widest">
                                    Extended history
                                </Badge>
                             ) : null}
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
                                            onClick={() => setDateRange(defaultHistoryDateRange(primaryRole, { user }))}
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

                    {activeTab === "kot" && (
                        <div className="flex flex-wrap items-center gap-2">
                            {(["ALL", "PENDING", "PREPARING", "READY", "SERVED", "REJECTED"] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setKotStatusFilter(status === "ALL" ? "ALL" : status)}
                                    className={cn(
                                        "rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors",
                                        kotStatusFilter === status
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                    )}
                                >
                                    {status === "ALL" ? `All ${kots.length}` : status.replace("_", " ")}
                                </button>
                            ))}
                            <select
                                aria-label="Filter kitchen station"
                                value={kotStationFilter}
                                onChange={(event) => setKotStationFilter(event.target.value)}
                                className="h-9 rounded-xl border border-border/50 bg-background px-3 text-xs font-semibold text-muted-foreground outline-none focus:border-primary"
                            >
                                {Array.from(new Set(["All", ...kots.map((kot) => kot.station).filter(Boolean) as string[]])).map((station) => (
                                    <option key={station} value={station}>{station}</option>
                                ))}
                            </select>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5">
                                {filteredActive.map((order) => (
                                    <Link key={order.id} href={`/orders/${order.id}`} className="block h-full">
                                        <OrderCard order={order} />
                                    </Link>
                                ))}
                            </div>
                        )
                    ) : activeTab === "kot" ? (
                        kotLoading && kots.length === 0 ? (
                            <LoadingGrid />
                        ) : filteredKots.length === 0 ? (
                            <EmptyState label="No kitchen tickets found" icon={<ChefHat />} />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5">
                                {filteredKots.map((kot) => (
                                    <KotOrderCard key={kot.id} kot={kot} onClick={openKotDetails} />
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5">
                                            {orders.map((order) => (
                                                <Link key={order.id} href={`/orders/${order.id}`} className="block h-full">
                                                    <OrderHistoryCard order={order} />
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

            <Dialog
                open={kotDetailsOpen}
                onOpenChange={(open) => {
                    setKotDetailsOpen(open);
                    if (!open) {
                        setSelectedKot(null);
                        setKotActivity([]);
                    }
                }}
            >
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[760px] overflow-hidden rounded-2xl p-0 sm:rounded-2xl">
                    <DialogHeader className="border-b border-border/50 bg-muted/20 p-6 pr-12 text-left">
                        {selectedKot ? (
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Kitchen ticket</p>
                                    <DialogTitle className="mt-1 text-2xl font-black tracking-tight">
                                        KOT {selectedKot.kot_number || `#${selectedKot.id}`}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 truncate text-sm">
                                        {[selectedKot.table_name || selectedKot.customer_name || "Walk-in order", selectedKot.station || "Kitchen"]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </DialogDescription>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                                            String(selectedKot.status).toUpperCase() === "REJECTED"
                                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                                : String(selectedKot.status).toUpperCase() === "SERVED"
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                                    : "border-primary/30 bg-primary/10 text-primary"
                                        )}
                                    >
                                        {kotStatusLabel(selectedKot.status)}
                                    </Badge>
                                    {nextKotStatus(selectedKot.status) ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={kotStatusUpdating}
                                            className="h-9 rounded-lg px-3 text-xs font-bold"
                                            onClick={() => {
                                                const next = nextKotStatus(selectedKot.status);
                                                if (next) void updateKotStatus(selectedKot.id, next);
                                            }}
                                        >
                                            {kotNextActionLabel(selectedKot.status)}
                                        </Button>
                                    ) : null}
                                    {String(selectedKot.status).toUpperCase() !== "REJECTED" && String(selectedKot.status).toUpperCase() !== "SERVED" ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={kotStatusUpdating}
                                            className="h-9 rounded-lg px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => void rejectKot(selectedKot.id)}
                                        >
                                            Reject
                                        </Button>
                                    ) : null}
                                    {kotStatusUpdating ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                                </div>
                            </div>
                        ) : (
                            <DialogTitle>KOT details</DialogTitle>
                        )}
                    </DialogHeader>

                    {selectedKot ? (
                        <div className="max-h-[calc(90vh-130px)] space-y-5 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-border/50 bg-card p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Created</p>
                                    <p className="mt-1 text-sm font-bold">
                                        {selectedKot.created_at ? format(new Date(selectedKot.created_at), "MMM d, yyyy · h:mm a") : "—"}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-card p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recorded by</p>
                                    <p className="mt-1 truncate text-sm font-bold">{selectedKot.created_by_staff_name || "System"}</p>
                                </div>
                                <div className="rounded-xl border border-border/50 bg-card p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order</p>
                                    <Link href={`/orders/${selectedKot.order_id}`} className="mt-1 inline-block text-sm font-bold text-primary hover:underline">
                                        Order #{selectedKot.order_id}
                                    </Link>
                                </div>
                            </div>

                            <section className="rounded-xl border border-border/50 bg-card">
                                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                                    <div>
                                        <h3 className="text-sm font-black">Items to prepare</h3>
                                        <p className="text-xs text-muted-foreground">Everything recorded on this kitchen ticket.</p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-lg text-xs">
                                        {selectedKot.items?.filter((item) => !item.is_deleted && Math.abs(item.qty_change || 0) > 0).length || 0} items
                                    </Badge>
                                </div>
                                <div className="divide-y divide-border/40">
                                    {(selectedKot.items || [])
                                        .filter((item) => !item.is_deleted && Math.abs(item.qty_change || 0) > 0)
                                        .map((item) => {
                                            const quantity = Math.abs(item.qty_change || 0);
                                            const ready = Math.min(Math.abs(item.qty_ready || 0), quantity);
                                            return (
                                                <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold">{item.item_name}</p>
                                                        {item.notes ? <p className="mt-0.5 text-xs text-muted-foreground">Note: {item.notes}</p> : null}
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-muted-foreground">
                                                        <span>×{quantity}</span>
                                                        <span className={cn("rounded-md px-2 py-1", ready >= quantity ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")}>
                                                            {ready}/{quantity} ready
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {!(selectedKot.items || []).some((item) => !item.is_deleted && Math.abs(item.qty_change || 0) > 0) ? (
                                        <p className="px-4 py-6 text-sm text-muted-foreground">No active items on this ticket.</p>
                                    ) : null}
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/50 bg-card">
                                <div className="border-b border-border/50 px-4 py-3">
                                    <h3 className="text-sm font-black">Activity</h3>
                                    <p className="text-xs text-muted-foreground">Status and preparation changes for this ticket.</p>
                                </div>
                                <div className="divide-y divide-border/40">
                                    {kotActivityLoading ? (
                                        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
                                        </div>
                                    ) : kotActivity.length === 0 ? (
                                        <p className="px-4 py-6 text-sm text-muted-foreground">No activity recorded yet.</p>
                                    ) : (
                                        kotActivity.map((activity) => (
                                            <div key={activity.id} className="flex items-start justify-between gap-4 px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold">{String(activity.event || "Ticket updated").replaceAll("_", " ")}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{activity.actor_name || activity.actor_role || "System"}</p>
                                                </div>
                                                <time className="shrink-0 text-xs text-muted-foreground">
                                                    {activity.created_at ? format(new Date(activity.created_at), "MMM d · h:mm a") : "—"}
                                                </time>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    ) : null}
                    <DialogFooter className="border-t border-border/50 bg-muted/20 p-4 sm:p-5">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full rounded-xl sm:w-auto"
                            onClick={() => setKotDetailsOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function KotOrderCard({ kot, onClick }: { kot: OrdersKot; onClick: (kot: OrdersKot) => void }) {
    const status = String(kot.status || "PENDING").toUpperCase();
    const statusClass = {
        PENDING: "border-amber-300/60 bg-amber-50/60 text-amber-700",
        PREPARING: "border-blue-300/60 bg-blue-50/60 text-blue-700",
        READY: "border-emerald-300/60 bg-emerald-50/60 text-emerald-700",
        SERVED: "border-slate-300/60 bg-slate-50 text-slate-600",
        REJECTED: "border-red-300/60 bg-red-50 text-red-700",
    }[status as OrdersKotStatus] || "border-border/50 bg-muted/30 text-muted-foreground";
    const items = (kot.items || []).filter((item) => !item.is_deleted && Math.abs(item.qty_change || 0) > 0);
    const previewItems = items.slice(0, 5);
    const itemCount = items.reduce((sum, item) => sum + Math.abs(item.qty_change || 0), 0);
    const readyCount = items.reduce((sum, item) => sum + Math.min(Math.abs(item.qty_ready || 0), Math.abs(item.qty_change || 0)), 0);
    const timestamp = kot.created_at || kot.order_created_at;

    return (
            <button type="button" onClick={() => onClick(kot)} className="block h-full w-full text-left">
            <Card className="h-[330px] border-border/50 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:h-[340px]">
                <CardContent className="flex h-full flex-col gap-4 overflow-hidden p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                <ChefHat className="h-4 w-4 text-primary" />
                                KOT {kot.kot_number || `#${kot.id}`}
                            </div>
                            <h3 className="mt-2 truncate text-lg font-black">{kot.table_name || kot.customer_name || "Walk-in order"}</h3>
                            <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                                {[kot.station, kot.created_by_staff_name].filter(Boolean).join(" · ") || "Kitchen ticket"}
                            </p>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase", statusClass)}>
                            {status.replace("_", " ")}
                        </Badge>
                    </div>

                    <div className="flex h-[132px] shrink-0 flex-col border-y border-dashed border-border/50 py-3">
                        <div className="space-y-1">
                        {previewItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-xs leading-4">
                                <span className="truncate font-semibold">{item.item_name}</span>
                                <span className="shrink-0 font-bold text-muted-foreground">×{Math.abs(item.qty_change || 0)}</span>
                            </div>
                        ))}
                        {items.length === 0 && <p className="text-sm text-muted-foreground">No active items</p>}
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                        <span>{readyCount}/{itemCount || 0} ready</span>
                        <span>{timestamp ? format(new Date(timestamp), "h:mm a") : ""}</span>
                    </div>
                </CardContent>
            </Card>
            </button>
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
