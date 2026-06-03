import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { unwrapApiEnvelope } from "@/lib/api-response";
import type { Order } from "@/types/order";

/** Refetch order from backend before a critical POS mutation (multi-terminal safety). */
export async function refetchOrderBeforeMutation(
  orderId: number
): Promise<Order | null> {
  try {
    const res = await apiClient.get(OrderApis.getOrder(orderId));
    if (res.data?.status !== "success") return null;
    return unwrapApiEnvelope<Order>(res);
  } catch {
    return null;
  }
}
