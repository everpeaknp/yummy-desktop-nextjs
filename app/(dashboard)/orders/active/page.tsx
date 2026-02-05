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
  
  const user = useAuth(state => state.user);
  const me = useAuth(state => state.me); // Get me action
  const router = useRouter();

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
      if (filter === "all") return true;
      if (filter === "table") return order.channel === "table"; 
      if (filter === "pickup") return order.channel === "pickup";
      // Cast to any if backend sends quick_billing but type differs, or assume type update coming
      if (filter === "quick_billing") return (order.channel as string) === "quick_billing" || (order.channel as string) === "takeaway";
      if (filter === "reservation") return (order.channel as string) === "reservation";
      return true;
  });

  // Calculate stats
  const totalValue = orders.reduce((sum, order) => sum + (order.grand_total || 0), 0);
  const pendingCount = orders.filter(o => (o.status as string).toLowerCase() === 'pending' || (o.status as string).toLowerCase() === 'confirmed').length;

  return (
    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
      {/* Header with Search and New Order */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>
        <div className="flex items-center gap-3">
             <div className="relative">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input className="pl-8 bg-muted/50 border-border w-64" placeholder="Search order #, table..." />
             </div>
             <div className="border border-border rounded-full p-2 bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                 <RefreshCw className="h-4 w-4" />
             </div>
             <div className="border border-border rounded-full p-2 bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                 <AlertCircle className="h-4 w-4" />
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
            "relative overflow-hidden border-none shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group bg-white dark:bg-card",
            className
        )}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 pointer-events-none" />
            <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className={cn(
                        "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110",
                        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                         {icon}
                    </div>
                    {active && (
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
                    )}
                </div>
                <div>
                     <div className="text-3xl font-extrabold text-foreground mb-1 tracking-tight flex items-baseline">
                        {prefix && <span className="text-lg mr-1 font-medium text-muted-foreground">{prefix}</span>}
                        {value}
                     </div>
                     <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
                     {subSelect && <div className="text-[10px] text-muted-foreground-light mt-1 opacity-70">{subSelect}</div>}
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
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap shadow-sm hover:shadow-md active:scale-95 duration-200",
                active 
                    ? "bg-primary text-white shadow-primary/25" 
                    : "bg-white dark:bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
            )}
        >
            {icon}
            {label}
        </button>
    )
}

function OrderCard({ order }: { order: Order }) {
    const isTable = order.channel === 'table' || (order.channel as string) === 'dine_in';
    const isQuick = (order.channel as string) === 'quick_billing';
    
    // Status color mapping (normalized to lowercase)
    const status = (order.status as string).toLowerCase();

    const getStatusStyles = (s: string) => {
        switch(s) {
            case 'pending': return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' };
            case 'confirmed': return { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' };
            case 'preparing': return { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' };
            case 'ready': return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' };
            default: return { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' };
        }
    };

    const style = getStatusStyles(status);

    return (
        <Card className="bg-white dark:bg-card border-none shadow-md hover:shadow-xl transition-all duration-300 group rounded-2xl overflow-hidden relative isolate">
            {/* Background Gradient Hover */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 z-0",
                status === 'pending' ? 'bg-amber-500' : 'bg-primary'
            )} />

            <CardContent className="p-0 z-10 relative">
                {/* Header Section */}
                <div className="p-5 pb-3">
                    <div className="flex items-start justify-between mb-3">
                         <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105",
                                isTable ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                            )}>
                                {isTable ? <Armchair className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground text-lg leading-tight tracking-tight">
                                    {(() => {
                                        if (order.table_name) {
                                            if (order.table_category_name) {
                                                return `${order.table_category_name} - ${order.table_name}`;
                                            }
                                            return order.table_name;
                                        }
                                        return order.customer_name || `Order #${order.restaurant_order_id || order.id}`;
                                    })()}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 h-4 rounded-md uppercase tracking-wider bg-muted text-muted-foreground">
                                        {isTable ? 'DINE-IN' : 'QUICK BILL'}
                                    </Badge>
                                </div>
                            </div>
                         </div>
                         <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border shadow-sm", style.color, style.bg, style.border)}>
                             {order.status}
                         </Badge>
                    </div>
                </div>

                {/* Divider with Ticket notches (simulated) */}
                <div className="relative h-4 w-full">
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/60"></div>
                     <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background border border-border/10"></div>
                     <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-background border border-border/10"></div>
                </div>

                {/* Details Section */}
                <div className="p-5 pt-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-md">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium text-xs">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Utensils className="h-3.5 w-3.5" />
                            <span className="font-medium">{order.items?.length || 0} Items</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                        <span className="text-xl font-black text-primary tracking-tight">
                            Rs. {(order.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </span>
                    </div>
                </div>
                
                {/* Visual Accent Bar at bottom */}
                <div className={cn("h-1.5 w-full", style.bg)} />
            </CardContent>
        </Card>
    )
}
