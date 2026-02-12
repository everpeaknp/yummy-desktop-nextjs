"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { useOrderFull } from "@/hooks/use-order-full";
import { OrderApis, KotApis, TableApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  ShoppingCart,
  Receipt,
  Clock,
  ChefHat,
  Activity,
  FileText,
  Users,
  MapPin,
  Utensils,
  AlertCircle,
  RefreshCw,
  XCircle,
  CheckCircle,
  Circle,
  Timer,
  Ban,
  Plus,
  CreditCard,
  Armchair,
  Eye,
  Table2,
  Hash,
  ShoppingBag,
  Zap,
  Calendar,
  Truck,
} from "lucide-react";
import { 
  getStatusColor, 
  getChannelIcon, 
  getStatusBadgeColor 
} from "@/components/orders/order-card";
import type {
  Order,
  OrderFullContext,
  OrderTableSummary,
  KOTUpdate,
  OrderEvent,
  OrderItem,
  OrderPayment,
} from "@/types/order";

// ── Helpers ──────────────────────────────────────────
function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getStatusConfig(s: string) {
  switch (s.toLowerCase()) {
    case "pending": return { label: "Pending", color: "#f59e0b", bg: "bg-amber-500/10", icon: Clock };
    case "running": return { label: "Running", color: "#3b82f6", bg: "bg-blue-500/10", icon: Activity };
    case "preparing": return { label: "Preparing", color: "#f97316", bg: "bg-orange-500/10", icon: ChefHat };
    case "ready": return { label: "Ready", color: "#10b981", bg: "bg-emerald-500/10", icon: CheckCircle };
    case "completed": return { label: "Completed", color: "#10b981", bg: "bg-emerald-500/10", icon: CheckCircle };
    case "canceled": return { label: "Canceled", color: "#ef4444", bg: "bg-red-500/10", icon: XCircle };
    default: return { label: s, color: "#64748b", bg: "bg-slate-500/10", icon: Circle };
  }
}

function getKOTStatusConfig(s: string) {
  switch (s.toLowerCase()) {
    case "pending": return { label: "Pending", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    case "acknowledged": return { label: "Acknowledged", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
    case "preparing": return { label: "Preparing", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
    case "ready": return { label: "Ready", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "completed": return { label: "Completed", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "rejected": return { label: "Rejected", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    case "cancelled": return { label: "Cancelled", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    default: return { label: s, color: "text-muted-foreground", bg: "bg-muted border-border/40" };
  }
}

type TabKey = "details" | "kots" | "events";

// ── Main Page ────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams();
  const orderId = Number(params.id);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const me = useAuth((s) => s.me);

  const { context, loading, error, fetchContext, isFullyPaid, allKotsServed } = useOrderFull(orderId);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [changeTableOpen, setChangeTableOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [changingTable, setChangingTable] = useState(false);
  const [availableTables, setAvailableTables] = useState<any[]>([]);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) await me();
      const updatedToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && !updatedToken) router.push("/");
    };
    const timer = setTimeout(checkAuth, 500);
    return () => clearTimeout(timer);
  }, [user, me, router]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!orderId) return;
    setEventsLoading(true);
    try {
      const res = await apiClient.get(OrderApis.getOrderEvents(orderId));
      if (res.data.status === "success") {
        setEvents(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setEventsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (activeTab === "events" && events.length === 0) {
      fetchEvents();
    }
  }, [activeTab, fetchEvents, events.length]);

  // Cancel order
  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCanceling(true);
    try {
      await apiClient.post(OrderApis.cancelOrder(orderId), { reason: cancelReason });
      setCancelOpen(false);
      setCancelReason("");
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to cancel order:", err);
    } finally {
      setCanceling(false);
    }
  };

  // Complete order
  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiClient.patch(OrderApis.updateOrderStatus(orderId), { status: "completed" });
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to complete order:", err);
    } finally {
      setCompleting(false);
    }
  };

  // Fetch available tables
  const fetchAvailableTables = useCallback(async () => {
    if (!context?.order?.restaurant_id) return;
    try {
      const res = await apiClient.get(TableApis.tableSummary(context.order.restaurant_id));
      if (res.data.status === "success") {
        const tables = res.data.data || [];
        // Filter for available tables ONLY
        setAvailableTables(tables.filter((t: any) => t.status?.toUpperCase() === "FREE"));
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    }
  }, [context?.order?.restaurant_id]);

  // Open change table dialog
  const handleOpenChangeTable = () => {
    fetchAvailableTables();
    setChangeTableOpen(true);
  };

  // Change table
  const handleChangeTable = async () => {
    if (!selectedTableId) return;
    setChangingTable(true);
    try {
      // Update order with new table
      await apiClient.patch(OrderApis.updateOrder(orderId), {
        table_id: Number(selectedTableId),
      });
      setChangeTableOpen(false);
      setSelectedTableId("");
      await fetchContext();
    } catch (err: any) {
      console.error("Failed to change table:", err);
    } finally {
      setChangingTable(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !context) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={fetchContext}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  if (!context) return null;

  const order = context.order;
  const statusColors = getStatusColor(order.status);
  const statusBadgeColor = getStatusBadgeColor(order.status);
  const ChannelIcon = getChannelIcon(order.channel);
  const isEditable = !["completed", "canceled"].includes(order.status);
  const isCancellable = !["completed", "canceled"].includes(order.status);
  const isTableOrder = order.channel === "table";
  const tableName = order.table_name;
  
  // Format Title
  let title = `Order #${order.restaurant_order_id || order.id}`;
  if (order.table_name) {
    title = order.table_category_name 
      ? `${order.table_category_name} - ${order.table_name}`
      : order.table_name;
  }

  // Format Subtitle
  let subtitle = order.channel.toUpperCase().replace('_', ' ');
  if (order.channel === 'table' || order.table_name) subtitle = 'DINE-IN';
  if (order.customer_name) subtitle = order.customer_name;

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "details", label: "Details", icon: FileText },
    { key: "kots", label: "KOTs", icon: ChefHat, count: context.kots?.length || 0 },
    { key: "events", label: "Events", icon: Activity },
  ];

  console.log("Rendering Order Detail", orderId);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center flex-shrink-0">
               <ChannelIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight leading-none">{title}</h1>
                <div
                  className={cn(
                    "px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest",
                    statusBadgeColor
                  )}
                >
                  {order.status}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">{subtitle}</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs font-medium">{timeAgo(order.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Secondary / Icons */}
          <div className="flex items-center gap-1 mr-2 border-r border-border/40 pr-3">
             <Button variant="ghost" size="icon" onClick={fetchContext} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="Refresh">
                <RefreshCw className="h-4 w-4" />
             </Button>

             <Link href={`/orders/${orderId}/receipt`}>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="View Receipt">
                   <Eye className="h-4 w-4" />
                </Button>
             </Link>
             
             {isTableOrder && isEditable && (
                <Button variant="ghost" size="icon" onClick={handleOpenChangeTable} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground" title="Change Table">
                   <Table2 className="h-4 w-4" />
                </Button>
             )}
          </div>

          {/* Primary Actions */}
          {isEditable && (
            <>
               <Link href={`/orders/${orderId}/edit`}>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 font-semibold">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Items</span>
                </Button>
              </Link>
              
              {!isFullyPaid && (
                  <Link href={`/orders/${orderId}/checkout`}>
                    <Button size="sm" className="gap-2 rounded-xl h-9 shadow-sm font-bold">
                      <Receipt className="h-4 w-4" /> Checkout
                    </Button>
                  </Link>
              )}
              
             {isFullyPaid && allKotsServed && order.status !== 'completed' && (
                <Button 
                  size="sm"
                  className="gap-2 rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold"
                  onClick={handleComplete}
                  disabled={completing}
                >
                  {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  Complete
                </Button>
              )}
            </>
          )}
          
          {/* Destructive Action */}
          {isCancellable && (
             <Button
               variant="ghost"
               size="sm"
               className="gap-2 rounded-xl h-9 text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold"
               onClick={() => setCancelOpen(true)}
             >
               <Ban className="h-4 w-4" /> <span className="hidden sm:inline">Cancel</span>
             </Button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl border border-border/40 w-fit">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200",
                activeTab === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black",
                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === "details" && <DetailsTab order={order} tables={context.tables} />}
          {activeTab === "kots" && <KOTsTab kots={context.kots} />}
          {activeTab === "events" && <EventsTab events={events} loading={eventsLoading} />}
        </div>

          {/* Right: Summary Sidebar */}
        <div className="space-y-4">
          {/* Order Summary */}
          <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
            <CardContent className="p-0">
              <div className="p-5 space-y-3">
                <h3 className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-4">Order Summary</h3>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums font-medium">{formatCurrency(order.subtotal)}</span>
                </div>

                {order.tax_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums font-medium">{formatCurrency(order.tax_total)}</span>
                  </div>
                )}

                {order.service_charge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Charge</span>
                    <span className="tabular-nums font-medium">{formatCurrency(order.service_charge)}</span>
                  </div>
                )}

                {(order.discount_total > 0 || order.manual_discount_amount > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Discount</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      -{formatCurrency((order.discount_total || 0) + (order.manual_discount_amount || 0))}
                    </span>
                  </div>
                )}

                {/* Payments Summary */}
                {context.payments.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2 pt-2">
                       <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Payments</span>
                       {context.payments.map((p) => (
                         <div key={p.id} className="flex items-center justify-between text-sm">
                           <div className="flex items-center gap-2">
                             <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                             <span className="capitalize font-medium">{p.method}</span>
                           </div>
                           <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                             {formatCurrency(p.amount)}
                           </span>
                         </div>
                       ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            
            {/* Total Footer */}
            <div className="bg-muted/30 px-5 py-4 border-t border-border/20 flex justify-between items-center rounded-b-xl">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Total Amount</span>
              <span className="text-2xl font-black tracking-tight tabular-nums text-foreground">
                <span className="text-sm mr-1.5 font-bold text-muted-foreground/50">Rs.</span>
                {order.grand_total.toLocaleString()}
              </span>
            </div>
          </Card>

          {/* Quick Info */}
          <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Quick Info</h3>

              {tableName && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Armchair className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{tableName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{order.table_category_name || "Table"}</p>
                  </div>
                </div>
              )}

              {order.customer_name && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{order.customer_name}</p>
                    {order.customer_phone && (
                      <p className="text-[10px] text-muted-foreground">{order.customer_phone}</p>
                    )}
                  </div>
                </div>
              )}

              {order.number_of_guests && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{order.number_of_guests} Guests</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 rounded-lg bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{formatTime(order.created_at)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {order.notes && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border/30 text-sm text-muted-foreground italic">
                  {order.notes}
                </div>
              )}
            </CardContent>
          </Card>


          {/* Actions - Redundant Sidebar */}
          <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Actions</h3>

              {isEditable && (
                <>
                  {!isFullyPaid && (
                      <Link href={`/orders/${orderId}/checkout`} className="block">
                        <Button className="w-full gap-2 h-11 font-bold shadow-lg rounded-xl">
                          <Receipt className="h-4 w-4" /> Checkout
                        </Button>
                      </Link>
                  )}
                  
                  {isFullyPaid && allKotsServed && order.status !== 'completed' && (
                    <Button 
                      className="w-full gap-2 h-11 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-lg"
                      onClick={handleComplete}
                      disabled={completing}
                    >
                      {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Complete Order
                    </Button>
                  )}
                </>
              )}

              {/* Cancel Order - Available for all non-cancelled orders */}
              {isCancellable && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-11 font-bold rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20 mt-2"
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="h-4 w-4" /> Cancel Order
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Cancel Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Go Back</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling || !cancelReason.trim()}
              className="gap-2"
            >
              {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {canceling ? "Canceling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change Table Dialog ── */}
      <Dialog open={changeTableOpen} onOpenChange={setChangeTableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Table</DialogTitle>
            <DialogDescription>
              Select a new table for this order. The order will be moved to the selected table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedTableId} onValueChange={setSelectedTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {availableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id.toString()}>
                    {table.table_name} {table.capacity && `(${table.capacity} seats)`}
                  </SelectItem>
                ))}
                {availableTables.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No available tables found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeTableOpen(false)}>Cancel</Button>
            <Button
              onClick={handleChangeTable}
              disabled={changingTable || !selectedTableId}
              className="gap-2"
            >
              {changingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
              {changingTable ? "Changing..." : "Change Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Details Tab ─────────────────────────────────────
function DetailsTab({ order, tables }: { order: Order; tables: OrderTableSummary[] }) {
  return (
    <div className="space-y-4">
      {/* Items Card */}
      <Card className="border-border/40 bg-white dark:bg-[#1a1a1a] overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              <span className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Ordered Items
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] font-black">
              {order.items.length} items
            </Badge>
          </div>

          <div className="divide-y divide-border/20">
            {order.items.map((item: OrderItem) => (
              <div key={item.id} className="px-5 py-4 hover:bg-muted/5 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">{item.name_snapshot}</p>
                    {item.category_name_snapshot && (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {item.category_name_snapshot}
                      </p>
                    )}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.modifiers.map((m) => (
                          <Badge key={m.id} variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                            {m.modifier_name_snapshot}
                            {m.price_adjustment_snapshot !== 0 && (
                              <span className="ml-1 text-muted-foreground">+{formatCurrency(m.price_adjustment_snapshot)}</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1.5">📝 {item.notes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">×{item.qty}</span>
                      <span className="font-bold text-sm tabular-nums">{formatCurrency(item.line_total)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      @ {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tables Card */}
      {tables.length > 0 && (
        <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-black text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Tables</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {tables.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/30">
                  <Armchair className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="font-bold text-sm">{t.name || `Table ${t.id}`}</span>
                  {t.capacity && (
                    <span className="text-[10px] text-muted-foreground">({t.capacity} seats)</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── KOTs Tab ────────────────────────────────────────
function KOTsTab({ kots }: { kots: KOTUpdate[] }) {
  if (!kots || kots.length === 0) {
    return (
      <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
        <CardContent className="p-12 flex flex-col items-center justify-center text-muted-foreground">
          <ChefHat className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-bold text-sm">No KOTs Found</p>
          <p className="text-xs mt-1">Kitchen order tickets will appear here when items are sent to kitchen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {kots.map((kot) => {
        const statusConfig = getKOTStatusConfig(kot.status);
        return (
          <Card key={kot.id} className={cn("border overflow-hidden bg-white dark:bg-[#1a1a1a]", statusConfig.bg)}>
            <CardContent className="p-0">
              {/* KOT Header */}
              <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background/80">
                    <ChefHat className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm">KOT #{kot.id}</span>
                      <Badge variant="secondary" className={cn("text-[10px] font-black uppercase tracking-wider", statusConfig.color)}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider capitalize">{kot.station}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider capitalize">{kot.type}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span className="text-[10px] text-muted-foreground">{formatTime(kot.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KOT Items */}
              <div className="divide-y divide-border/10">
                {kot.items.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm font-medium">{item.name_snapshot}</span>
                      {item.notes && (
                        <span className="text-[10px] text-muted-foreground italic">({item.notes})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums">×{item.qty}</span>
                      {item.fulfilled_qty !== undefined && item.fulfilled_qty > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.fulfilled_qty}/{item.qty} done
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Events Tab ──────────────────────────────────────
function EventsTab({ events, loading }: { events: OrderEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
        <CardContent className="p-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
        <CardContent className="p-12 flex flex-col items-center justify-center text-muted-foreground">
          <Activity className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-bold text-sm">No Events Yet</p>
          <p className="text-xs mt-1">Order activity will appear here as things happen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-white dark:bg-[#1a1a1a]">
      <CardContent className="p-5">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-3 bottom-3 w-px bg-border/40" />

          <div className="space-y-0">
            {events.map((event, index) => {
              const isFirst = index === 0;
              return (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div className={cn(
                    "relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 border-2",
                    isFirst
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted border-border/40 text-muted-foreground"
                  )}>
                    <Activity className="h-4 w-4" />
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 pt-1.5">
                    <p className="font-bold text-sm text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.result}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      {event.triggered_by?.name && (
                        <>
                          <span className="font-medium">{event.triggered_by.name}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        </>
                      )}
                      {event.triggered_at && (
                        <span>{new Date(event.triggered_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
