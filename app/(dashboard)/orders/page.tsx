"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/api-client";
import { OrderApis, TableApis, KotApis } from "@/lib/api/endpoints";
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
  LayoutGrid,
  ClipboardList,
  History,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  ChefHat
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { OrderCard } from "@/components/orders/order-card";
import { OrderHistoryCard } from "@/components/orders/order-history-card";
import Link from "next/link";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { DateRange } from "react-day-picker";
import { financeSalesApi } from "@/lib/api/finance-sales-api";
import { OrdersNewOrderSheet } from "@/components/orders/orders-new-order-sheet";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { PageTabs } from "@/components/patterns/navigation/page-tabs";
import { SearchField } from "@/components/patterns/controls/search-field";
import { FilterBar } from "@/components/patterns/controls/filter-bar";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState as SharedEmptyState } from "@/components/patterns/feedback/feedback-state";
import type { FinanceOrderSettlementSummary } from "@/types/finance-sales";

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

type OrderDetailFilters = {
    status: string;
    channel: string;
    tableCategory: string;
    tableName: string;
    createdBy: string;
    minTotal: string;
    maxTotal: string;
};

type OrderTimeScope = "all" | "today" | "yesterday" | "last7" | "thisMonth";

const orderTimeScopes: Array<{ value: OrderTimeScope; label: string }> = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7", label: "Last 7 days" },
    { value: "thisMonth", label: "This month" },
    { value: "all", label: "All time" },
];

const emptyOrderDetailFilters: OrderDetailFilters = {
    status: "",
    channel: "",
    tableCategory: "",
    tableName: "",
    createdBy: "",
    minTotal: "",
    maxTotal: "",
};

function orderMatchesDetailFilters(order: any, filters: OrderDetailFilters, staffField: "created" | "completed" = "created") {
    const normalized = (value: unknown) => String(value || "").trim().toLowerCase();
    if (filters.status && normalized(order.status) !== normalized(filters.status)) return false;
    if (filters.channel && normalized(order.channel) !== normalized(filters.channel)) return false;
    if (filters.tableCategory && normalized(order.table_category_name || order.table_category) !== normalized(filters.tableCategory)) return false;
    if (filters.tableName && normalized(order.table_name) !== normalized(filters.tableName)) return false;
    const staffName = staffField === "completed"
        ? order.completed_by_name || order.completed_by?.name || order.completed_by?.full_name
        : order.created_by_name || order.waiter_name;
    if (filters.createdBy && normalized(staffName) !== normalized(filters.createdBy)) return false;
    const total = Number(order.grand_total || 0);
    const min = Number(filters.minTotal);
    const max = Number(filters.maxTotal);
    if (filters.minTotal && Number.isFinite(min) && total < min) return false;
    if (filters.maxTotal && Number.isFinite(max) && total > max) return false;
    return true;
}

function filterCount(filters: OrderDetailFilters) {
    return Object.values(filters).filter(Boolean).length;
}

function readableFilterValue(value: string) {
    return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchesOrderTimeScope(value: string | undefined, scope: OrderTimeScope) {
    if (scope === "all") return true;
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return false;
    if (scope === "today") return isToday(date);
    if (scope === "yesterday") return isYesterday(date);
    if (scope === "last7") return date >= startOfDay(subDays(new Date(), 6)) && date <= endOfDay(new Date());
    return date >= startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) && date <= endOfDay(new Date());
}

function dateRangeForTimeScope(scope: OrderTimeScope): DateRange | undefined {
    const now = new Date();
    if (scope === "all") return undefined;
    if (scope === "today") return { from: startOfDay(now), to: endOfDay(now) };
    if (scope === "yesterday") {
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    if (scope === "last7") return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
}

function TimeScopeChips({ value, onChange }: { value: OrderTimeScope; onChange: (scope: OrderTimeScope) => void }) {
    return (
        <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Time period</p>
            <div className="flex flex-wrap gap-2">
                {orderTimeScopes.map((scope) => (
                    <FilterChip key={scope.value} active={value === scope.value} onClick={() => onChange(scope.value)} className="min-h-9 px-3 text-xs">
                        {scope.label}
                    </FilterChip>
                ))}
            </div>
        </section>
    );
}

function ChoiceChips({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
    if (options.length === 0) return null;
    return (
        <section className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <div className="flex flex-wrap gap-2">
                <FilterChip active={!value} onClick={() => onChange("")} className="min-h-9 px-3 text-xs">All</FilterChip>
                {options.map((option) => (
                    <FilterChip key={option.value} active={value === option.value} onClick={() => onChange(option.value)} className="min-h-9 px-3 text-xs">
                        {option.label}
                    </FilterChip>
                ))}
            </div>
        </section>
    );
}

function OrderDetailFilterFields({
    orders,
    filters,
    onChange,
    staffLabel = "Created by",
    staffRead = (order) => order.created_by_name || order.waiter_name,
}: {
    orders: any[];
    filters: OrderDetailFilters;
    onChange: (next: Partial<OrderDetailFilters>) => void;
    staffLabel?: string;
    staffRead?: (order: any) => unknown;
}) {
    const options = (read: (order: any) => unknown) => Array.from(
        new Set(orders.map(read).map((value) => String(value || "").trim()).filter(Boolean)),
    ).sort();
    const statuses = ["pending", "confirmed", "preparing", "ready", "scheduled"];
    const channels = ["table", "pickup", "quick_billing", "delivery", "reservation", "room_service"];
    const tableCategories = options((order) => order.table_category_name || order.table_category);
    const tables = options((order) => order.table_name).filter((table) => {
        if (!filters.tableCategory) return true;
        return orders.some(
            (order) => String(order.table_name || "").trim() === table && String(order.table_category_name || order.table_category || "").trim().toLowerCase() === filters.tableCategory.toLowerCase(),
        );
    });
    const users = options(staffRead);

    return (
        <div className="space-y-4">
            <ChoiceChips label="Status" value={filters.status} onChange={(status) => onChange({ status })} options={statuses.map((status) => ({ value: status, label: readableFilterValue(status) }))} />
            <ChoiceChips label="Order type" value={filters.channel} onChange={(channel) => onChange({ channel })} options={channels.map((channel) => ({ value: channel, label: readableFilterValue(channel) }))} />
            <ChoiceChips label="Table area" value={filters.tableCategory} onChange={(tableCategory) => onChange({ tableCategory, tableName: "" })} options={tableCategories.map((category) => ({ value: category, label: category }))} />
            <ChoiceChips label="Table" value={filters.tableName} onChange={(tableName) => onChange({ tableName })} options={tables.map((table) => ({ value: table, label: table }))} />
            <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">{staffLabel}</p>
                <Select value={filters.createdBy || "all"} onValueChange={(value) => onChange({ createdBy: value === "all" ? "" : value })}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card px-3 text-sm font-medium shadow-none transition-colors focus:border-primary">
                        <SelectValue placeholder="All staff" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 rounded-xl border-border p-1 shadow-lg">
                        <SelectItem value="all" className="rounded-lg py-2.5 text-sm">All staff</SelectItem>
                        {users.map((user) => <SelectItem key={user} value={user} className="rounded-lg py-2.5 text-sm">{user}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <p className="text-sm font-medium">Total amount</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                    <Input inputMode="decimal" type="number" min="0" placeholder="Min NPR" value={filters.minTotal} onChange={(event) => onChange({ minTotal: event.target.value })} className="h-11 rounded-xl" />
                    <Input inputMode="decimal" type="number" min="0" placeholder="Max NPR" value={filters.maxTotal} onChange={(event) => onChange({ maxTotal: event.target.value })} className="h-11 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

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
    const [orders, setOrders] = useState<any[]>([]);
    const [historyOrders, setHistoryOrders] = useState<any[]>([]);
    const [historySettlements, setHistorySettlements] = useState<Record<number, FinanceOrderSettlementSummary>>({});
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [kots, setKots] = useState<OrdersKot[]>([]);
    const [kotLoading, setKotLoading] = useState(false);
    const [kotStatusFilter, setKotStatusFilter] = useState<OrdersKotStatus | "ALL">("ALL");
    const [kotStationFilter, setKotStationFilter] = useState("All");
    const [kotTableFilter, setKotTableFilter] = useState("All");
    const [activeTimeScope, setActiveTimeScope] = useState<OrderTimeScope>("all");
    const [kotTimeScope, setKotTimeScope] = useState<OrderTimeScope>("today");
    const [activeDetailFilters, setActiveDetailFilters] = useState<OrderDetailFilters>(emptyOrderDetailFilters);
    const [historyDetailFilters, setHistoryDetailFilters] = useState<OrderDetailFilters>(emptyOrderDetailFilters);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [scopeNotice, setScopeNotice] = useState<ParsedScopeError | null>(null);
    const [suggestedRange, setSuggestedRange] = useState<DateRange | undefined>();
    const dateRangeInitialized = useRef(false);

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

    // 2. Fetch active orders
    const fetchActiveData = useCallback(async () => {
        if (!user?.restaurant_id) return;

        try {
            const ordersPromise = apiClient.get(`${OrderApis.activeOrders}`, {
                params: { 
                    restaurant_id: user.restaurant_id,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    _t: Date.now()
                }
            });

            const ordersRes = await ordersPromise;

            if (ordersRes.data.status === "success") {
                const fetchedOrders = [...(ordersRes.data.data.orders || [])]
                    .sort((a: any, b: any) => getOrderTimeMs(b) - getOrderTimeMs(a));
                setOrders(fetchedOrders);
                
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
            const params = new URLSearchParams({
                restaurant_id: String(user.restaurant_id),
                limit: "100",
                include_printer_config: "false",
            });
            const range = dateRangeForTimeScope(kotTimeScope);
            if (range?.from) params.set("date_from", range.from.toISOString());
            if (range?.to) params.set("date_to", range.to.toISOString());
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
    }, [user?.restaurant_id, kotTimeScope]);

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
            setHistorySettlements({});
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
                try {
                    const settlements = await financeSalesApi.getOrderSettlements(
                        Number(user.restaurant_id),
                        list.map((order: any) => Number(order.id)).filter((id: number) => id > 0),
                    );
                    setHistorySettlements(
                        Object.fromEntries(settlements.map((settlement) => [settlement.order_id, settlement])),
                    );
                } catch (settlementError) {
                    console.warn("Order settlement summaries are unavailable", settlementError);
                    setHistorySettlements({});
                }
            }
        } catch (err: unknown) {
            const parsed = parseApiScopeError(err, { role: primaryRole });
            if (parsed) {
                setScopeNotice(parsed);
                setHistoryOrders([]);
                setHistorySettlements({});
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

    const filteredHistoryOrders = useMemo(
        () => historyOrders.filter((order) => orderMatchesDetailFilters(order, historyDetailFilters, "completed")),
        [historyOrders, historyDetailFilters],
    );

    // Grouping logic for History
    const groupedHistory = useMemo(() => {
        const groups: Record<string, any[]> = {};
        
        filteredHistoryOrders.forEach(order => {
            const date = new Date(getOrderTimeMs(order));
            let label = "";
            if (isToday(date)) label = "Today";
            else if (isYesterday(date)) label = "Yesterday";
            else label = format(date, "MMM d, yyyy");

            if (!groups[label]) groups[label] = [];
            groups[label].push(order);
        });

        return groups;
    }, [filteredHistoryOrders]);

    const filteredActive = orders.filter(order => {
        if (order.is_split_parent && order.grand_total === 0) {
            return false;
        }

        if (!orderMatchesDetailFilters(order, activeDetailFilters)) {
            return false;
        }

        if (!matchesOrderTimeScope(order.started_at || order.created_at || order.updated_at, activeTimeScope)) {
            return false;
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
            .filter((kot) => matchesOrderTimeScope(kot.created_at, kotTimeScope))
            .filter((kot) => kotStatusFilter === "ALL" || String(kot.status).toUpperCase() === kotStatusFilter)
            .filter((kot) => kotStationFilter === "All" || (kot.station || "").toLowerCase() === kotStationFilter.toLowerCase())
            .filter((kot) => kotTableFilter === "All" || String(kot.table_name || "").toLowerCase() === kotTableFilter.toLowerCase())
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
    }, [kots, kotTimeScope, kotStatusFilter, kotStationFilter, kotTableFilter, searchQuery]);

    const ordersFilterCount = activeTab === "active"
        ? filterCount(activeDetailFilters) + Number(activeTimeScope !== "all")
        : activeTab === "kot"
            ? Number(kotTimeScope !== "today") + Number(kotStatusFilter !== "ALL") + Number(kotStationFilter !== "All") + Number(kotTableFilter !== "All")
            : filterCount(historyDetailFilters);
    const mobileOrdersFilterContent = activeTab === "active" ? (
        <>
            <TimeScopeChips value={activeTimeScope} onChange={setActiveTimeScope} />
            <OrderDetailFilterFields orders={orders} filters={activeDetailFilters} onChange={(next) => setActiveDetailFilters((current) => ({ ...current, ...next }))} />
        </>
    ) : activeTab === "kot" ? (
        <>
            <TimeScopeChips value={kotTimeScope} onChange={setKotTimeScope} />
            <ChoiceChips label="Kitchen status" value={kotStatusFilter === "ALL" ? "" : kotStatusFilter} onChange={(status) => setKotStatusFilter((status || "ALL") as OrdersKotStatus | "ALL")} options={(["PENDING", "PREPARING", "READY", "SERVED", "REJECTED"] as const).map((status) => ({ value: status, label: kotStatusLabel(status) }))} />
            <ChoiceChips label="Station" value={kotStationFilter === "All" ? "" : kotStationFilter} onChange={(station) => setKotStationFilter(station || "All")} options={Array.from(new Set(kots.map((kot) => kot.station).filter(Boolean) as string[])).map((station) => ({ value: station, label: station }))} />
            <ChoiceChips label="Table" value={kotTableFilter === "All" ? "" : kotTableFilter} onChange={(table) => setKotTableFilter(table || "All")} options={Array.from(new Set(kots.map((kot) => kot.table_name).filter(Boolean) as string[])).map((table) => ({ value: table, label: table }))} />
        </>
    ) : (
        <>
            <TimeScopeChips value={orderTimeScopes.find((scope) => {
                const range = dateRangeForTimeScope(scope.value);
                return range?.from?.getTime() === dateRange?.from?.getTime() && range?.to?.getTime() === dateRange?.to?.getTime();
            })?.value ?? "all"} onChange={(scope) => setDateRange(dateRangeForTimeScope(scope) ?? defaultHistoryDateRange(primaryRole, { user }))} />
            <label className="grid gap-1 text-sm font-medium">
                From
                <Input type="date" value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""} onChange={(event) => setDateRange((current) => ({ from: event.target.value ? startOfDay(new Date(`${event.target.value}T00:00:00`)) : undefined, to: current?.to }))} className="h-11 rounded-xl" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
                To
                <Input type="date" value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""} onChange={(event) => setDateRange((current) => ({ from: current?.from, to: event.target.value ? endOfDay(new Date(`${event.target.value}T00:00:00`)) : undefined }))} className="h-11 rounded-xl" />
            </label>
            <OrderDetailFilterFields orders={historyOrders} filters={historyDetailFilters} staffLabel="Completed by" staffRead={(order) => order.completed_by_name || order.completed_by?.name || order.completed_by?.full_name} onChange={(next) => setHistoryDetailFilters((current) => ({ ...current, ...next }))} />
        </>
    );

    return (
        <AppPage width="wide" className="pb-24 md:pb-10">
            <PageHeader
                title="Orders"
                actions={
                    <div className="flex w-full min-w-0 items-center gap-2 md:w-auto">
                        <SearchField
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onClear={() => setSearchQuery("")}
                            placeholder="Search orders or customers"
                            containerClassName="min-w-0 flex-1 md:w-[320px]"
                        />
                        <FilterBar
                            className="shrink-0 md:hidden"
                            title={activeTab === "active" ? "Active order filters" : activeTab === "kot" ? "Kitchen ticket filters" : "Order history filters"}
                            activeCount={ordersFilterCount}
                            mobileContent={mobileOrdersFilterContent}
                            mobileFooter={
                                activeTab === "active" ? <Button variant="outline" className="w-full" onClick={() => { setActiveTimeScope("all"); setActiveDetailFilters(emptyOrderDetailFilters); }}>Clear filters</Button> :
                                activeTab === "kot" ? <Button variant="outline" className="w-full" onClick={() => { setKotTimeScope("today"); setKotStatusFilter("ALL"); setKotStationFilter("All"); setKotTableFilter("All"); }}>Clear filters</Button> :
                                <Button variant="outline" className="w-full" onClick={() => { setDateRange(defaultHistoryDateRange(primaryRole, { user })); setHistoryDetailFilters(emptyOrderDetailFilters); }}>Clear filters</Button>
                            }
                            mobileTriggerVariant="icon"
                        />
                    </div>
                }
            />

            {/* Tabs & Filters */}
            <div className="flex flex-col gap-4 md:gap-5">
                <PageTabs
                    value={activeTab}
                    onValueChange={(value) => setOrdersTab(value as "active" | "kot" | "history")}
                    mobileMode="equal"
                    items={[
                        { value: "active", label: "Active", icon: ClipboardList, count: filteredActive.length },
                        { value: "kot", label: "KOT", icon: ChefHat, count: filteredKots.length },
                        { value: "history", label: "History", icon: History },
                    ]}
                />

                <div className="min-w-0">

                    {activeTab === "history" && (
                        <FilterBar className="hidden md:block" title="History filters">
                            {canUseExtendedHistory ? <Badge variant="secondary" className="h-11 rounded-xl px-3 text-xs">Extended history</Badge> : null}
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                From
                                <Input
                                    type="date"
                                    value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                                    onChange={(event) => setDateRange((current) => ({
                                        from: event.target.value ? startOfDay(new Date(`${event.target.value}T00:00:00`)) : undefined,
                                        to: current?.to,
                                    }))}
                                    className="h-11 rounded-xl"
                                />
                            </label>
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                To
                                <Input
                                    type="date"
                                    value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                                    onChange={(event) => setDateRange((current) => ({
                                        from: current?.from,
                                        to: event.target.value ? endOfDay(new Date(`${event.target.value}T00:00:00`)) : undefined,
                                    }))}
                                    className="h-11 rounded-xl"
                                />
                            </label>
                            <FilterChip onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}>Today</FilterChip>
                            <FilterChip onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}>Last 7 days</FilterChip>
                            <Button variant="ghost" className="h-11 px-3 text-sm" onClick={() => setDateRange(defaultHistoryDateRange(primaryRole, { user }))}>Reset</Button>
                        </FilterBar>
                    )}

                    {activeTab === "kot" && (
                        <FilterBar className="hidden md:block" title="KOT filters" activeCount={(kotStatusFilter === "ALL" ? 0 : 1) + (kotStationFilter === "All" ? 0 : 1) + (kotTableFilter === "All" ? 0 : 1)}>
                            {(["ALL", "PENDING", "PREPARING", "READY", "SERVED", "REJECTED"] as const).map((status) => (
                                <FilterChip
                                    key={status}
                                    active={kotStatusFilter === status}
                                    onClick={() => setKotStatusFilter(status === "ALL" ? "ALL" : status)}
                                >
                                    {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                                </FilterChip>
                            ))}
                            <select
                                aria-label="Filter kitchen station"
                                value={kotStationFilter}
                                onChange={(event) => setKotStationFilter(event.target.value)}
                                className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground outline-none focus:border-primary"
                            >
                                {Array.from(new Set(["All", ...kots.map((kot) => kot.station).filter(Boolean) as string[]])).map((station) => (
                                    <option key={station} value={station}>{station}</option>
                                ))}
                            </select>
                            <select
                                aria-label="Filter table"
                                value={kotTableFilter}
                                onChange={(event) => setKotTableFilter(event.target.value)}
                                className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground outline-none focus:border-primary"
                            >
                                {Array.from(new Set(["All", ...kots.map((kot) => kot.table_name).filter(Boolean) as string[]])).map((table) => (
                                    <option key={table} value={table}>{table}</option>
                                ))}
                            </select>
                        </FilterBar>
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
                            <SharedEmptyState title="No active orders found" description="Try changing the active-order filter or search." icon={<ClipboardList className="h-5 w-5" />} />
                        ) : (
                            <>
                            <div className="mb-3 flex items-center gap-2 text-base font-bold sm:mb-4 sm:text-lg"><span className="h-2 w-2 rounded-full bg-emerald-500" />Now serving</div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4 lg:gap-5">
                                {filteredActive.map((order) => (
                                    <Link key={order.id} href={`/orders/${order.id}`} className="block h-full">
                                        <OrderCard order={order} />
                                    </Link>
                                ))}
                            </div>
                            </>
                        )
                    ) : activeTab === "kot" ? (
                        kotLoading && kots.length === 0 ? (
                            <LoadingGrid />
                        ) : filteredKots.length === 0 ? (
                            <SharedEmptyState title="No kitchen tickets found" description="Try changing the KOT filters or search." icon={<ChefHat className="h-5 w-5" />} />
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
                            <SharedEmptyState title="No order history found" description="Try a different date range or search." icon={<History className="h-5 w-5" />} />
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
                                                    <OrderHistoryCard order={order} settlement={historySettlements[order.id]} />
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
            <OrdersNewOrderSheet />

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
        </AppPage>
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
            <Card className="min-h-[224px] rounded-xl border-border/50 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:h-[340px] sm:rounded-2xl">
                <CardContent className="flex h-full flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5">
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

                    <div className="flex h-[76px] shrink-0 flex-col overflow-hidden border-y border-dashed border-border/50 py-2 sm:h-[132px] sm:py-3">
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

function LoadingGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
            ))}
        </div>
    );
}
