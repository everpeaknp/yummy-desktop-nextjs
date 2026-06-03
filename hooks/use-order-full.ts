import { useState, useCallback, useEffect, useRef } from "react";
import { OrderFullContext, Order, OrderTableSummary, KOTUpdate, OrderEvent } from "@/types/order";
import apiClient from "@/lib/api-client";
import { OrderApis, KotApis } from "@/lib/api/endpoints";
import { splitTableNames } from "@/lib/table-ops";
import { useSyncInvalidation } from "@/hooks/use-sync-invalidation";

function buildTableSummaries(
  order: Order,
  contextTables: OrderTableSummary[]
): OrderTableSummary[] {
  const ids =
    order.table_ids && order.table_ids.length > 0
      ? order.table_ids
      : order.table_id
        ? [order.table_id]
        : [];

  if (!ids.length) {
    return contextTables.length ? contextTables : [];
  }

  const names = splitTableNames(order.table_name);
  return ids.map((id, index) => {
    const fromContext = contextTables.find((t) => t.id === id);
    if (fromContext) return fromContext;
    return {
      id,
      name: names[index] ?? names[0] ?? `Table ${id}`,
      status: "occupied",
      capacity: null,
      table_type_id: null,
    };
  });
}

function patchOrderTableFields(order: Order, tables: OrderTableSummary[]): Order {
  const patched = { ...order };
  if (tables.length === 1) {
    patched.table_name = tables[0].name ?? patched.table_name;
  } else if (tables.length > 1) {
    patched.table_name = tables.map((t) => t.name || `Table ${t.id}`).join(", ");
  }
  if (patched.table_category_name?.includes(",")) {
    const cats = patched.table_category_name.split(",");
    patched.table_category_name = cats[cats.length - 1].trim();
  }
  return patched;
}

export function useOrderFull(orderId: string | number) {
  const [context, setContext] = useState<OrderFullContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      try {
        const res = await apiClient.get(OrderApis.getOrderFull(Number(orderId)));
        if (res.data.status === "success") {
          const raw = res.data.data as OrderFullContext;
          const tables = buildTableSummaries(raw.order, raw.tables ?? []);
          setContext({
            ...raw,
            tables,
            order: patchOrderTableFields(raw.order, tables),
          });
          return;
        }
      } catch {
        console.warn("Full context endpoint failed, falling back to individual fetches.");
      }

      const [orderRes, kotsRes, eventsRes] = await Promise.allSettled([
        apiClient.get(OrderApis.getOrder(Number(orderId))),
        apiClient.get(KotApis.getKotUpdatesByOrder(Number(orderId))),
        apiClient.get(OrderApis.getOrderEvents(Number(orderId))),
      ]);

      if (orderRes.status === "rejected") {
        throw orderRes.reason;
      }

      const orderData: Order = orderRes.value.data.data;

      let kotsData: KOTUpdate[] = [];
      if (kotsRes.status === "fulfilled" && kotsRes.value.data.status === "success") {
        kotsData = kotsRes.value.data.data;
      }

      let eventsData: OrderEvent[] = [];
      if (eventsRes.status === "fulfilled" && eventsRes.value.data.status === "success") {
        eventsData = eventsRes.value.data.data;
      }

      const tables = buildTableSummaries(orderData, []);
      const fullContext: OrderFullContext = {
        order: patchOrderTableFields(orderData, tables),
        tables,
        kots: kotsData,
        payments: orderData.payments || [],
      };

      setContext(fullContext);
    } catch (err: unknown) {
      console.error("Failed to fetch order context:", err);
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Failed to load order details";
      setError(typeof detail === "string" ? detail : "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchContext();
    }
  }, [orderId, fetchContext]);

  const fetchRef = useRef(fetchContext);
  fetchRef.current = fetchContext;

  useSyncInvalidation(
    ["orders", "tables", "transactions"],
    (detail) => {
      const targetId = detail.orderId != null ? Number(detail.orderId) : null;
      const currentId = Number(orderId);
      if (targetId != null && targetId !== currentId) return;
      void fetchRef.current();
    },
    [orderId]
  );

  const isFullyPaid = context
    ? context.payments
        .filter((p) => !p.status || p.status.toLowerCase() === "success")
        .reduce((sum, p) => sum + Number(p.amount), 0) >= Number(context.order.grand_total) - 0.01
    : false;
  const allKotsServed = context
    ? context.kots.length === 0 ||
      context.kots.every((kot) =>
        ["served", "completed", "ready", "rejected", "cancelled"].includes(
          kot.status?.toLowerCase() ?? ""
        )
      )
    : false;

  return { context, loading, error, fetchContext, isFullyPaid, allKotsServed };
}
