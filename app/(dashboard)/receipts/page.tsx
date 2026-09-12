"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { 
  Calendar, 
  Receipt,
  CreditCard,
  User,
  Clock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import { SearchField } from "@/components/patterns/controls/search-field";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { EmptyState, LoadingState } from "@/components/patterns/feedback/feedback-state";

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

  const dateFilter = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-11 rounded-xl", date ? "border-primary/30 text-foreground" : "text-muted-foreground")}
          aria-label="Filter receipts by date"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">{date ? format(date, "MMM d, yyyy") : "Date"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <CalendarComponent mode="single" selected={date} onSelect={setDate} initialFocus />
      </PopoverContent>
    </Popover>
  );

  return (
    <AppPage width="wide">
      <div className="hidden md:block">
        <PageHeader
          title="Receipts"
          description="Review completed order receipts."
          actions={dateFilter}
        />
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <SearchField
          containerClassName="flex-1"
          placeholder="Search order, guest, or phone"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onClear={() => setSearchQuery("")}
        />
        {dateFilter}
      </div>

      <SearchField
        containerClassName="hidden max-w-xl md:block"
        placeholder="Search order, guest, or phone"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onClear={() => setSearchQuery("")}
      />

      {loading ? (
        <LoadingState label="Loading receipts..." />
      ) : orders.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title="No receipts found" description="Try another date or search term." />
      ) : (
        <>
          <DataList className="md:hidden">
            {orders.map((order) => {
              const amount = Number.parseFloat(order.grand_total || order.total_amount || 0).toFixed(2);
              return (
                <ListRow
                  key={order.id}
                  interactive
                  onClick={() => openReceipt(order.id)}
                  leading={<Receipt className="h-4 w-4 text-orange-600" />}
                  title={`Order #${order.restaurant_order_id || order.id}`}
                  description={`${format(new Date(order.created_at || order.started_at), "MMM d, h:mm a")} · ${order.customer_name || "Guest"}`}
                  meta={<span className="font-semibold tabular-nums text-foreground">Rs. {amount}</span>}
                />
              );
            })}
          </DataList>

          <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
            <div 
              key={order.id}
              onClick={() => openReceipt(order.id)}
              className="group relative flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
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
                 <div className="rounded-full bg-primary/10 p-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4" />
                 </div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      <ReceiptDetailSheet 
        orderId={selectedOrderId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </AppPage>
  );
}
