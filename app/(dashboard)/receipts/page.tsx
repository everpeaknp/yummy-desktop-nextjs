"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Receipt } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { ReceiptDetailSheet } from "@/components/receipts/receipt-detail-sheet";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataList, ListRow } from "@/components/patterns/data/data-list";
import { SearchField } from "@/components/patterns/controls/search-field";
import {
  EmptyState,
  LoadingState,
} from "@/components/patterns/feedback/feedback-state";
import { AppPage } from "@/components/patterns/page/app-page";
import { PageHeader } from "@/components/patterns/page/page-header";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

interface ReceiptOrder {
  id: number;
  restaurant_order_id?: string | number | null;
  grand_total?: number | string | null;
  total_amount?: number | string | null;
  created_at?: string | null;
  started_at?: string | null;
  customer_name?: string | null;
  fiscal_invoice_number?: string | number | null;
  invoice_number?: string | number | null;
}

function receiptDate(value: string | null | undefined, pattern: string) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : format(parsed, pattern);
}

export default function ReceiptsPage() {
  const [orders, setOrders] = useState<ReceiptOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const user = useAuth((state) => state.user);
  const me = useAuth((state) => state.me);
  const restaurant = useRestaurant((state) => state.restaurant);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      if (!user && token) await me();
      setAuthChecked(true);
      if (!user && !token) router.push("/");
    };
    checkAuth();
  }, [me, router, user]);

  const fetchOrders = useCallback(async () => {
    if (!authChecked) return;
    if (!user?.restaurant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        restaurant_id: user.restaurant_id,
        status: "completed",
      };
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        params.date_from = startOfDay.toISOString();
        params.date_to = endOfDay.toISOString();
      }
      if (searchQuery) params.search = searchQuery;

      const response = await apiClient.get(OrderApis.listOrders, { params });
      if (response.data.status === "success") {
        const data = response.data.data;
        setOrders(Array.isArray(data) ? data : (data.orders ?? []));
      }
    } catch (error) {
      console.error("Failed to fetch receipts:", error);
    } finally {
      setLoading(false);
    }
  }, [authChecked, date, searchQuery, user?.restaurant_id]);

  useEffect(() => {
    const timer = window.setTimeout(fetchOrders, 500);
    return () => window.clearTimeout(timer);
  }, [fetchOrders]);

  const dateFilter = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 shrink-0 rounded-xl",
            date
              ? "border-primary/30 text-foreground"
              : "text-muted-foreground",
          )}
          aria-label="Filter receipts by date"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">
            {date ? format(date, "MMM d, yyyy") : "Date"}
          </span>
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
  );

  const openReceipt = (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailsOpen(true);
  };

  return (
    <AppPage width="register">
      <div className="hidden md:block">
        <PageHeader
          title="Receipts"
          description="Review completed sales and their fiscal receipts."
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
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="No receipts found"
          description="Try another date or search term."
        />
      ) : (
        <>
          <DataList className="md:hidden">
            {orders.map((order) => {
              const amount = Number(
                order.grand_total ?? order.total_amount ?? 0,
              );
              return (
                <ListRow
                  key={order.id}
                  interactive
                  onClick={() => openReceipt(order.id)}
                  leading={<Receipt className="h-4 w-4 text-primary" />}
                  title={`Order #${order.restaurant_order_id || order.id}`}
                  description={`${receiptDate(order.created_at || order.started_at, "MMM d, h:mm a")} · ${order.customer_name || "Guest"}`}
                  meta={
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(amount, restaurant?.currency)}
                    </span>
                  }
                />
              );
            })}
          </DataList>

          <DataList className="hidden md:block">
            {orders.map((order) => {
              const amount = Number(
                order.grand_total ?? order.total_amount ?? 0,
              );
              const invoiceNumber =
                order.fiscal_invoice_number || order.invoice_number;
              return (
                <ListRow
                  key={order.id}
                  interactive
                  onClick={() => openReceipt(order.id)}
                  leading={<Receipt className="h-4 w-4 text-primary" />}
                  title={`Order #${order.restaurant_order_id || order.id}`}
                  description={`${receiptDate(order.created_at || order.started_at, "EEE, MMM d, yyyy · h:mm a")} · ${order.customer_name || "Guest"}`}
                  meta={
                    <span className="text-xs text-muted-foreground">
                      {invoiceNumber
                        ? `Invoice #${invoiceNumber}`
                        : "Completed sale"}
                    </span>
                  }
                  trailing={
                    <div className="min-w-32 text-right font-semibold tabular-nums text-foreground">
                      {formatCurrency(amount, restaurant?.currency)}
                    </div>
                  }
                />
              );
            })}
          </DataList>
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
