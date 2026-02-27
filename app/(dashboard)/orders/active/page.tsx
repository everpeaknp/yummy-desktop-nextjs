"use client";

import { useEffect, useState } from "react";
import { Order } from "@/types/order";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus, RefreshCw, Zap, Armchair, ShoppingBag, Clock, Utensils, AlertCircle, Receipt } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OrderApis, TableApis } from "@/lib/api/endpoints";
import { OrderCard } from "@/components/orders/order-card";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActiveOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const user = useAuth(state => state.user);
    const me = useAuth(state => state.me); // Get me action
    const restaurant = useRestaurant(state => state.restaurant);
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
                // Fetch both tables and orders to bypass Azure table_name bug
                const [response, tablesRes] = await Promise.all([
                    apiClient.get(url),
                    apiClient.get(TableApis.tableSummary(user.restaurant_id)).catch(() => null)
                ]);
                
                if (response.data.status === "success") {
                    const fetchedOrders: Order[] = response.data.data.orders;
                    
                    let tablesLookup: Record<number, any> = {};
                    if (tablesRes && tablesRes.data.status === "success") {
                        const tablesArr = tablesRes.data.data || [];
                        tablesArr.forEach((t: any) => {
                           tablesLookup[t.id] = t;
                        });
                    }
                    
                    // FIX: Clean up stale table_name from backend bug
                    const cleanedOrders = fetchedOrders.map(order => {
                        if (order.table_category_name && order.table_category_name.includes(',')) {
                            const categories = order.table_category_name.split(',');
                            order.table_category_name = categories[categories.length - 1].trim();
                        }
                        
                        if (order.table_id && tablesLookup[order.table_id]) {
                            const tableData = tablesLookup[order.table_id];
                            order.table_name = tableData.table_name || tableData.name;
                            if (tableData.table_type_name) {
                                order.table_category_name = tableData.table_type_name;
                            }
                        } else if (order.table_name && order.table_name.includes(',')) {
                            const names = order.table_name.split(',');
                            order.table_name = names[names.length - 1].trim();
                        }
                        
                        return order;
                    });
                    
                    setOrders(cleanedOrders);
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
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
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
                    label="Active Orders"
                    value={orders.length.toString()}
                    subSelect="In progress"
                    icon={<RefreshCw className="h-6 w-6" />}
                    color="blue"
                    active
                />
                <StatCard
                    label="Total Value"
                    value={totalValue.toLocaleString()}
                    prefix={restaurant?.currency || user?.currency || "Rs."}
                    subSelect="Revenue today"
                    icon={<span className="text-xl font-bold">$</span>}
                    color="orange"
                />
                <StatCard
                    label="Pending Action"
                    value={pendingCount.toString()}
                    subSelect="Needs attention"
                    icon={<Clock className="h-6 w-6" />}
                    color="yellow"
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
                        Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="bg-card border border-border rounded-xl p-5 h-[160px] shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-12 rounded-full" />
                            </div>
                            <div className="space-y-3 pt-2">
                                <div className="flex gap-3">
                                   <Skeleton className="h-8 w-8 rounded-lg" />
                                   <div className="space-y-2 flex-1">
                                      <Skeleton className="h-3 w-full" />
                                      <Skeleton className="h-2 w-1/2" />
                                   </div>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                   <Skeleton className="h-3 w-20" />
                                   <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                          </div>
                        ))
                    ) : filteredOrders.map((order) => (
                        <Link key={order.id} href={`/orders/${order.id}`}>
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

function StatCard({ label, value, subSelect, icon, color = "blue", active, className, prefix = "" }: any) {
    const colors: any = {
        blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-900/30", ring: "ring-blue-500/20" },
        orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-900/30", ring: "ring-orange-500/20" },
        yellow: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-900/30", ring: "ring-yellow-500/20" },
        green: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-900/30", ring: "ring-emerald-500/20" },
    };

    const c = colors[color] || colors.blue;

    return (
        <Card className={cn(
            "relative overflow-hidden border shadow-sm transition-all duration-300 hover:shadow-md group bg-card",
            active ? `ring-1 ${c.ring}` : "",
            className
        )}>
            <CardContent className="p-5 flex items-center gap-4">
                <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center transition-colors shrink-0",
                    c.bg,
                    c.text
                )}>
                    {icon}
                </div>
                
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                    <div className="flex items-baseline gap-1">
                        {prefix && <span className="text-sm font-semibold text-muted-foreground">{prefix}</span>}
                        <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
                    </div>
                    {subSelect && (
                         <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5 flex items-center gap-1.5">
                            {active && <span className={cn("h-1.5 w-1.5 rounded-full", c.bg.replace('/10', ''))} />}
                            {subSelect}
                         </p>
                    )}
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


