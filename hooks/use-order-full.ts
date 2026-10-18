import { useState, useCallback, useEffect } from "react";
import { OrderFullContext, Order, OrderTableSummary, KOTUpdate, OrderEvent, OrderPayment } from "@/types/order";
import apiClient from "@/lib/api-client";
import { OrderApis, KotApis } from "@/lib/api/endpoints";

function contextsEqual(left: OrderFullContext | null, right: OrderFullContext) {
  if (left === right) return true;
  if (!left) return false;
  // Context responses are JSON API payloads; comparing their serialized form
  // keeps polling from replacing stable state and re-rendering the whole view.
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useOrderFull(orderId: string | number, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [context, setContext] = useState<OrderFullContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quietly refresh additions without replacing the accepted bill with a loader.
  useEffect(() => {
    if (!context?.order.table_id || ["completed", "canceled", "cancelled"].includes(context.order.status)) return;
    let disposed = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await apiClient.get(OrderApis.getOrderFull(Number(orderId)));
        if (!disposed && response.data.status === "success") setContext(current => {
          const next = response.data.data as OrderFullContext;
          return current?.order.id === Number(orderId) && contextsEqual(current, next)
            ? current
            : next;
        });
      } catch { /* Preserve the last confirmed bill; explicit refresh surfaces errors. */ }
    }, 10000);
    return () => { disposed = true; clearInterval(timer); };
  }, [enabled, orderId, context?.order.table_id, context?.order.status]);

  const fetchContext = useCallback(async () => {
    if (!enabled || !orderId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Try fetching full context from optimized endpoint
      try {
        const res = await apiClient.get(OrderApis.getOrderFull(Number(orderId)));
        if (res.data.status === "success") {
          setContext((current) => contextsEqual(current, res.data.data) ? current : res.data.data);
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
        apiClient.get(OrderApis.getOrderEvents(Number(orderId), "group"))
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
      
      const fallbackTableIds =
        orderData.table_ids?.length
          ? orderData.table_ids
          : orderData.table_id
            ? [orderData.table_id]
            : [];
      for (const tableId of fallbackTableIds) {
        fullContext.tables.push({
          id: tableId,
          name:
            tableId === orderData.table_id
              ? orderData.table_name || `Table ${tableId}`
              : `Table ${tableId}`,
          status: "occupied",
          capacity: null,
          table_type_id: null,
        });
      }

      setContext((current) => contextsEqual(current, fullContext) ? current : fullContext);

    } catch (err: any) {
      console.error("Failed to fetch order context:", err);
      setError(err.response?.data?.detail || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [enabled, orderId]);

  // Replace the cached context with an API mutation response without toggling
  // the page-level loading state or unmounting the order detail UI.
  const replaceContextLocal = useCallback((nextContext: OrderFullContext) => {
    if (!nextContext?.order || nextContext.order.id !== Number(orderId)) return;
    setContext(nextContext);
  }, [orderId]);

  // Background refresh for embedded consumers: keep their current UI mounted
  // while syncing order versions and items after a mutation elsewhere.
  const fetchContextQuiet = useCallback(async () => {
    if (!enabled || !orderId) return false;
    try {
      const response = await apiClient.get(OrderApis.getOrderFull(Number(orderId)), {
        params: { _t: Date.now() },
      });
      const nextContext = response.data?.status === "success" ? response.data.data : null;
      if (!nextContext?.order || nextContext.order.id !== Number(orderId)) return false;
      setContext((current) => contextsEqual(current, nextContext) ? current : nextContext);
      return true;
    } catch {
      return false;
    }
  }, [enabled, orderId]);

  useEffect(() => {
    if (enabled && orderId) {
      fetchContext();
    }
  }, [enabled, orderId, fetchContext]);

  // Drop stale table rows not in the order's assigned table_ids (keep multi-table intact).
  useEffect(() => {
    if (!context) return;

    const expectedIds =
      context.order.table_ids?.length
        ? context.order.table_ids
        : context.order.table_id
          ? [context.order.table_id]
          : [];
    if (expectedIds.length === 0) return;

    const expectedSet = new Set(expectedIds);
    const pruned = context.tables.filter((t) => expectedSet.has(t.id));
    if (pruned.length === context.tables.length) return;

    setContext((prev) => {
      if (!prev) return prev;

      const patchedOrder = { ...prev.order };
      const primary =
        pruned.find((t) => t.id === patchedOrder.table_id) ?? pruned[0];
      if (primary) {
        patchedOrder.table_name = primary.name || patchedOrder.table_name;
      }
      if (patchedOrder.table_category_name?.includes(",")) {
        const cats = patchedOrder.table_category_name.split(",");
        patchedOrder.table_category_name = cats[cats.length - 1].trim();
      }

      return { ...prev, tables: pruned, order: patchedOrder };
    });
  }, [context?.tables, context?.order?.table_id, context?.order?.table_ids]);

  // Update a single ticket locally so status actions do not reload the whole
  // order context (and consequently reset the user's scroll position).
  const updateKotLocal = useCallback((kotId: number, patch: Partial<KOTUpdate>) => {
    setContext((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        kots: prev.kots.map((kot) =>
          kot.id === kotId ? { ...kot, ...patch } : kot,
        ),
      };
    });
  }, []);

  const isFullyPaid = context ? context.payments.filter(p => !p.status || p.status.toLowerCase() === 'success').reduce((sum, p) => sum + Number(p.amount), 0) >= (Number(context.order.grand_total) - 0.01) : false;
  const allKotsServed = context ? (context.kots.length === 0 || context.kots.every(kot => ['served', 'completed', 'ready', 'rejected', 'cancelled'].includes(kot.status?.toLowerCase()))) : false;

  return { context, loading, error, fetchContext, fetchContextQuiet, replaceContextLocal, updateKotLocal, isFullyPaid, allKotsServed };
}
