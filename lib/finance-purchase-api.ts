import type { AxiosInstance } from "axios";
import { GeneralPurchaseApis } from "@/lib/api/endpoints";
import type { BusinessLine } from "@/lib/api/endpoint-types";

const PURCHASE_PAGE_LIMIT = 200;

export type PurchaseRow = {
  id: number;
  status: string;
  payment_status: string;
  total_cost: number;
  business_line?: string;
  purchase_name?: string;
  supplier?: { name?: string };
  [key: string]: unknown;
};

export type PurchaseScopeTotals = {
  orderCount: number;
  paidReceivedTotal: number;
  pendingReceivedTotal: number;
  returnedCount: number;
};

function isPaidStatus(paymentStatus: string): boolean {
  const normalized = paymentStatus.trim().toLowerCase();
  return normalized === "paid";
}

function isPendingPayment(paymentStatus: string): boolean {
  const normalized = paymentStatus.trim().toLowerCase();
  return normalized === "pending" || normalized === "unpaid";
}

/** Paginate through general purchases for a business line (complete backend dataset). */
export async function fetchAllGeneralPurchases(
  client: AxiosInstance,
  restaurantId: number,
  businessLine: BusinessLine
): Promise<PurchaseRow[]> {
  const all: PurchaseRow[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;

  while (skip < total) {
    const url = GeneralPurchaseApis.list({
      restaurantId,
      businessLine,
      skip,
      limit: PURCHASE_PAGE_LIMIT,
    });
    const res = await client.get(url);
    if (res.data?.status !== "success") break;

    const data = res.data.data ?? {};
    const batch = Array.isArray(data.purchases) ? data.purchases : [];
    total = Number(data.total ?? batch.length);
    all.push(...(batch as PurchaseRow[]));
    skip += batch.length;
    if (!batch.length) break;
  }

  return all;
}

/**
 * KPI totals from full purchase list.
 * Paid + received affects close; pending received is informational payables.
 */
export function summarizePurchasesForScope(
  purchases: PurchaseRow[]
): PurchaseScopeTotals {
  let paidReceivedTotal = 0;
  let pendingReceivedTotal = 0;
  let returnedCount = 0;

  for (const purchase of purchases) {
    const status = String(purchase.status ?? "").toLowerCase();
    const paymentStatus = String(purchase.payment_status ?? "");
    const cost = Number(purchase.total_cost ?? 0);

    if (status === "returned") {
      returnedCount += 1;
      continue;
    }

    if (status !== "received") continue;

    if (isPaidStatus(paymentStatus)) {
      paidReceivedTotal += cost;
    } else if (isPendingPayment(paymentStatus)) {
      pendingReceivedTotal += cost;
    }
  }

  return {
    orderCount: purchases.length,
    paidReceivedTotal,
    pendingReceivedTotal,
    returnedCount,
  };
}
