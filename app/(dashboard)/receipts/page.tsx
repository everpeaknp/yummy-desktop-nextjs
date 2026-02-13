"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { 
  Loader2, 
  Search, 
  Calendar, 
  Receipt,
  Download,
  Filter,
  CreditCard,
  User,
  MoreVertical,
  ChevronRight,
  Clock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";

export default function ReceiptsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!user && token) {
        await me();
      }
      setAuthChecked(true);
      if (!user && !token && authChecked) router.push("/");
    };
    checkAuth();
  }, [user, me, router, authChecked]);

  const fetchOrders = useCallback(async () => {
    if (!authChecked) return;
    
    if (!user?.restaurant_id) {
       setLoading(false);
       return;
    }

    setLoading(true);
    try {
      // Use listOrders endpoint directly, expecting standard success response
      // Filter by status 'completed' to match Flutter receipt logic
      // Note: Endpoint typically supports query params via standard Axios config params if designedRESTfully
      // If not, we might need to adjust based on backend. Flutter uses listOrders with filters.
      // Based on endpoints.ts, OrderApis.listOrders is just '/orders/'. 
      // We'll append params manually or via config.
      
      const params: any = {
        restaurant_id: user.restaurant_id,
        status: 'completed'
      };

      if (date) {
        // Simple date filtering (might need refinement based on backend expectation)
        // Flutter sends date_from/date_to. 
        // For single date selection, we can send start/end of day or just 'date' if supported.
        // Let's assume date_from/date_to covers the day.
        const startOfDay = new Date(date);
        startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23,59,59,999);
        
        params.date_from = startOfDay.toISOString();
        params.date_to = endOfDay.toISOString();
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await apiClient.get(OrderApis.listOrders, { params });
      
      if (response.data.status === "success") {
        const data = response.data.data;
        // Handle array or wrapped object
        const list = Array.isArray(data) ? data : (data.orders || []);
        setOrders(list);
      }
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.restaurant_id, authChecked, date, searchQuery]);

  // Debounce search/date changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const openReceipt = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailsOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Receipt className="h-8 w-8 text-primary" />
            Receipts
          </h1>
          <p className="text-muted-foreground mt-1">View and manage past transaction records</p>
        </div>
        <div className="flex gap-2">
           {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "justify-start text-left font-normal rounded-xl h-11 border-dashed",
                  !date && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Filter by Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" className="h-11 w-11 p-0 rounded-xl" onClick={() => { setDate(undefined); setSearchQuery(""); }}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by Order ID, Customer Name or Phone..." 
          className="pl-10 h-11 rounded-xl bg-card border-none shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* List Content */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted-foreground">Loading receipts...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center gap-4 bg-slate-50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="h-24 w-24 rounded-[32px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Receipt className="h-12 w-12 text-slate-300 dark:text-slate-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No receipts found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Try adjusting your filters or search query.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div 
              key={order.id}
              onClick={() => openReceipt(order.id)}
              className="group relative bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-border rounded-[24px] p-5 transition-all hover:shadow-lg cursor-pointer flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5" />
                   </div>
                   <div>
                     <h3 className="font-bold text-base">Order #{order.restaurant_order_id || order.id}</h3>
                     <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {order.customer_name || "Guest"}
                     </span>
                   </div>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 uppercase text-[10px] tracking-wider font-bold">
                  {order.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm bg-muted/40 p-3 rounded-xl border border-border/50">
                 <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Date</span>
                    <span className="font-semibold flex items-center gap-1.5">
                       <Clock className="h-3.5 w-3.5 opacity-70" />
                       {format(new Date(order.created_at || order.started_at), "MMM d, h:mm a")}
                    </span>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Amount</span>
                    <span className="font-bold text-primary flex items-center gap-1">
                       <CreditCard className="h-3.5 w-3.5 opacity-70" />
                       {parseFloat(order.grand_total || order.total_amount || 0).toFixed(2)}
                    </span>
                 </div>
              </div>
              
              <div className="flex justify-between items-end mt-auto">
                 <div className="text-xs text-muted-foreground font-medium">
                   {order.items?.length || 0} items • {order.table_name || order.channel}
                 </div>
                 <div className="bg-primary/10 text-primary p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4" />
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ReceiptDetailSheet 
        orderId={selectedOrderId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
