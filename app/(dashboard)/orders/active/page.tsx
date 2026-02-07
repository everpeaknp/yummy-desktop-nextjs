"use client";

import { useEffect, useState } from "react";
import { Order } from "@/types/order";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus, RefreshCw, Zap, Armchair, ShoppingBag, Clock, Utensils, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OrderApis } from "@/lib/api/endpoints";

export default function ActiveOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me); // Get me action
    const router = useRouter();

    // 1. Session Restoration & Auth Guard
    useEffect(() => {
        const checkAuth = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && token) await me();

            const updatedToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
            if (!user && !updatedToken) router.push('/');
        };
        const timer = setTimeout(checkAuth, 500);
        return () => clearTimeout(timer);
    }, [user, me, router]);

    // 2. Data Fetching
    useEffect(() => {
        const fetchOrders = async () => {
            if (!user?.restaurant_id) return;

            try {
                const url = `${OrderApis.activeOrders}?restaurant_id=${user.restaurant_id}`;
                const response = await apiClient.get(url);
                if (response.data.status === "success") {
                    setOrders(response.data.data.orders);
                }
            } catch (err) {
                console.error("Failed to fetch active orders:", err);
            } finally {
                setLoading(false);
            }
        };

        if (user?.restaurant_id) {
            fetchOrders();
            const interval = setInterval(fetchOrders, 10000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const filteredOrders = orders.filter(order => {
        // Channel filter
        if (filter === "table" && order.channel !== "table") return false;
        if (filter === "pickup" && order.channel !== "pickup") return false;
        if (filter === "quick_billing" && (order.channel as string) !== "quick_billing" && (order.channel as string) !== "takeaway") return false;
        if (filter === "reservation" && (order.channel as string) !== "reservation") return false;

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const tableName = (order.table_name || "").toLowerCase();
            const customerName = (order.customer_name || "").toLowerCase();
            const categoryName = (order.table_category_name || "").toLowerCase();
            const waiterName = (order.waiter_name || "").toLowerCase();
            const orderId = String(order.restaurant_order_id || order.id);
            if (
                !tableName.includes(q) &&
                !customerName.includes(q) &&
                !categoryName.includes(q) &&
                !waiterName.includes(q) &&
                !orderId.startsWith(q)
            ) return false;
        }

        return true;
    });

    // Calculate stats
    const totalValue = orders.reduce((sum, order) => sum + (order.grand_total || 0), 0);
    const pendingCount = orders.filter(o => (o.status as string).toLowerCase() === 'pending' || (o.status as string).toLowerCase() === 'confirmed').length;

    return (
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
            {/* Header with Search and New Order */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase">Orders</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="h-1 w-1 rounded-full bg-primary" />
                        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input className="pl-10 bg-muted/30 border-border/40 w-72 h-11 rounded-xl focus-visible:ring-primary/20 transition-all font-medium text-sm" placeholder="Search orders, tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="h-11 w-11 flex items-center justify-center rounded-xl bg-muted/30 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-95">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button className="h-11 w-11 flex items-center justify-center rounded-xl bg-muted/30 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-95">
                            <AlertCircle className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Active"
                    value={orders.length.toString()}
                    subSelect="In progress"
                    icon={<RefreshCw className="h-4 w-4 text-blue-500" />}
                    active
                    className="border-l-4 border-l-blue-500"
                />
                <StatCard
                    label="Value"
                    value={totalValue.toLocaleString()}
                    prefix="Rs" // Assuming Rs from screenshot 
                    subSelect="Total revenue"
                    icon={<span className="text-orange-500 font-bold">$</span>}
                    className="border-l-4 border-l-orange-500"
                />
                <StatCard
                    label="Pending"
                    value={pendingCount.toString()}
                    subSelect="Need action"
                    icon={<Clock className="h-4 w-4 text-yellow-500" />}
                    className="border-l-4 border-l-yellow-500"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} icon={null} />
                    <FilterPill label="Table" active={filter === 'table'} onClick={() => setFilter('table')} icon={<Armchair className="h-3 w-3" />} />
                    <FilterPill label="Pickup" active={filter === 'pickup'} onClick={() => setFilter('pickup')} icon={<ShoppingBag className="h-3 w-3" />} />
                    <FilterPill label="Quick Billing" active={filter === 'quick_billing'} onClick={() => setFilter('quick_billing')} icon={<Zap className="h-3 w-3" />} />
                    <FilterPill label="Reservation" active={filter === 'reservation'} onClick={() => setFilter('reservation')} icon={<Clock className="h-3 w-3" />} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {loading ? (
                        <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Loading active orders...</p>
                        </div>
                    ) : filteredOrders.map((order) => (
                        <Link href={order.status ? `/orders/${order.id}/edit` : '#'} key={order.id}>
                            <OrderCard order={order} />
                        </Link>
                    ))}

                    {filteredOrders.length === 0 && !loading && (
                        <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20">
                            <p>No active orders found.</p>
                            <Link href="/orders/new" className="mt-4">
                                <Button variant="outline">Create New Order</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, subSelect, icon, active, className, prefix = "" }: any) {
    return (
        <Card className={cn(
            "relative overflow-hidden border border-border/40 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group bg-white dark:bg-[#1a1a1a]",
            active ? "ring-1 ring-primary/20" : "",
            className
        )}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {icon}
                            </div>
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{label}</span>
                        </div>

                        <div className="space-y-1">
                            <div className="text-3xl font-black text-foreground tracking-tight flex items-baseline">
                                {prefix && <span className="text-base mr-1 font-semibold text-muted-foreground/60">{prefix}</span>}
                                {value}
                            </div>
                            {subSelect && (
                                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <span className={cn("h-1 w-1 rounded-full", active ? "bg-primary animate-pulse" : "bg-muted-foreground/30")} />
                                    {subSelect}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Subtle Decorative Element */}
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}

function FilterPill({ label, active, onClick, icon }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 duration-200",
                active
                    ? "bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] shadow-lg shadow-black/10 dark:shadow-white/5"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {icon && <span className={cn("opacity-70", active ? "opacity-100" : "")}>{icon}</span>}
            <span className="uppercase tracking-widest">{label}</span>
        </button>
    )
}

function OrderCard({ order }: { order: Order }) {
    const isTable = order.channel === 'table' || (order.channel as string) === 'dine_in';
    const status = (order.status as string).toLowerCase();

    const getStatusConfig = (s: string) => {
        switch (s) {
            case 'pending': return { label: 'Pending', color: '#f59e0b', bg: 'bg-amber-500/10' };
            case 'confirmed': return { label: 'Confirmed', color: '#3b82f6', bg: 'bg-blue-500/10' };
            case 'preparing': return { label: 'Preparing', color: '#f97316', bg: 'bg-orange-500/10' };
            case 'ready': return { label: 'Ready', color: '#10b981', bg: 'bg-emerald-500/10' };
            default: return { label: s.toUpperCase(), color: '#64748b', bg: 'bg-slate-500/10' };
        }
    };

    const config = getStatusConfig(status);

    return (
        <Card className="group bg-white dark:bg-[#1a1a1a] border border-border/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-xl overflow-hidden relative">
            <CardContent className="p-0">
                {/* Header Status Bar */}
                <div className={cn("h-1 w-full opacity-60", config.bg)} style={{ backgroundColor: config.color }} />

                <div className="p-5 space-y-5">
                    {/* Top Row: Identifier & Status */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm",
                                isTable ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            )}>
                                {isTable ? <Armchair className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-black text-foreground text-base truncate leading-none mb-1.5 uppercase tracking-wide">
                                    {order.table_name || order.customer_name || `Order #${order.restaurant_order_id || order.id}`}
                                </h3>
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">
                                        {order.table_category_name ? `${order.table_category_name} • ` : ''}
                                        {isTable ? 'Dine-In' : 'Quick Bill'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div
                            className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                            style={{ borderColor: `${config.color}30`, color: config.color, backgroundColor: `${config.color}10` }}
                        >
                            {config.label}
                        </div>
                    </div>

                    {/* Middle Row: Meta Info */}
                    <div className="flex items-center justify-between py-1 px-0.5 border-y border-border/30">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase tracking-tighter">
                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Utensils className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase tracking-tighter">{order.items?.length || 0} ITEMS</span>
                        </div>
                    </div>

                    {/* Bottom Row: Price */}
                    <div className="flex items-end justify-between pt-1">
                        <div className="space-y-0.5 flex flex-col">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Total Amount</span>
                            <span className="text-2xl font-black text-foreground tracking-tighter tabular-nums">
                                <span className="text-sm mr-1 font-bold text-muted-foreground/40">Rs.</span>
                                {(order.grand_total || 0).toLocaleString()}
                            </span>
                        </div>

                        <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Plus className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
