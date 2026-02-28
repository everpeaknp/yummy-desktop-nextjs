import { useState, useCallback, useEffect } from "react";
import { OrderFullContext, Order, OrderTableSummary, KOTUpdate, OrderEvent, OrderPayment } from "@/types/order";
import apiClient from "@/lib/api-client";
import { OrderApis, KotApis } from "@/lib/api/endpoints";

export function useOrderFull(orderId: string | number) {
  const [context, setContext] = useState<OrderFullContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!orderId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Try fetching full context from optimized endpoint
      try {
        const res = await apiClient.get(OrderApis.getOrderFull(Number(orderId)));
        if (res.data.status === "success") {
          setContext(res.data.data);
          return;
        }
      } catch (err: any) {
        // If the /full endpoint fails (404, CORS error, etc.), we fallback to manual aggregation.
        // Azure production backend is known to be missing this endpoint currently.
        console.warn("Full context endpoint failed, falling back to individual fetches.");
      }

      // 2. Fallback: Fetch everything in parallel
      console.log("Fetching order context via fallback...");
      
      const [orderRes, kotsRes, eventsRes] = await Promise.allSettled([
        apiClient.get(OrderApis.getOrder(Number(orderId))),
        apiClient.get(KotApis.getKotUpdatesByOrder(Number(orderId))),
        apiClient.get(OrderApis.getOrderEvents(Number(orderId)))
      ]);

      // Process Order (Critical)
      if (orderRes.status === "rejected") {
        throw orderRes.reason;
      }
      
      const orderData: Order = orderRes.value.data.data;
      
      // Process KOTs
      let kotsData: KOTUpdate[] = [];
      if (kotsRes.status === "fulfilled" && kotsRes.value.data.status === "success") {
        kotsData = kotsRes.value.data.data;
      }
      
      // Process Events
      let eventsData: OrderEvent[] = [];
      if (eventsRes.status === "fulfilled" && eventsRes.value.data.status === "success") {
        eventsData = eventsRes.value.data.data;
      }
      
      // Construct basic context
      const fullContext: OrderFullContext = {
        order: orderData,
        tables: [], 
        kots: kotsData,
        payments: orderData.payments || [],
      };
      
      // Derive tables from order data if separate endpoint didn't exist
      if (orderData.table_id || (orderData.table_name)) {
        fullContext.tables.push({
          id: orderData.table_id || 0,
          name: orderData.table_name || "Unknown Table",
          status: "occupied", // inferred
          capacity: null,
          table_type_id: null
        });
      }

      setContext(fullContext);

    } catch (err: any) {
      console.error("Failed to fetch order context:", err);
      setError(err.response?.data?.detail || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchContext();
    }
  }, [orderId, fetchContext]);

  // FIX: Stale target table from Azure Backend
  useEffect(() => {
    if (!context || !context.order.table_id) return;

    // Filter tables array to only include the active table_id
    const validTables = context.tables.filter(t => t.id === context.order.table_id);
    
    // If the active table exists and there are stale tables, clean them up
    if (validTables.length > 0 && context.tables.length > 1) {
      setContext(prev => {
        if (!prev) return prev;
        
        const singleTable = validTables[0];
        
        // Correct the Order object's table_name to match the active table
        const patchedOrder = { ...prev.order };
        patchedOrder.table_name = singleTable.name || `Table ${prev.order.table_id}`;
        
        // Fix category name: the backend concatenates categories (e.g. "Main, Main") so take the last one
        if (prev.order.table_category_name && prev.order.table_category_name.includes(',')) {
          const cats = prev.order.table_category_name.split(',');
          patchedOrder.table_category_name = cats[cats.length - 1].trim();
        }

        return {
          ...prev,
          tables: [singleTable],
          order: patchedOrder
        };
      });
    }
  }, [context?.tables?.length, context?.order?.table_id]);

  const isFullyPaid = context ? context.payments.filter(p => !p.status || p.status.toLowerCase() === 'success').reduce((sum, p) => sum + Number(p.amount), 0) >= (Number(context.order.grand_total) - 0.01) : false;
  const allKotsServed = context ? (context.kots.length === 0 || context.kots.every(kot => ['served', 'completed', 'ready', 'rejected', 'cancelled'].includes(kot.status?.toLowerCase()))) : false;

  return { context, loading, error, fetchContext, isFullyPaid, allKotsServed };
}
