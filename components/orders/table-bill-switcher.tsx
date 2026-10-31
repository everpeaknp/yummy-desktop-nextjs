"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { groupOrderApprovals } from "@/lib/order-approval-groups";
import { cn, formatCurrency } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderRequestReview } from "@/components/orders/order-request-review";
import type { Order } from "@/types/order";

export function TableBillSwitcher({ order, checkout = false, canApproveRequests = false, canRejectRequests = false }: {
  order: Order;
  checkout?: boolean;
  canApproveRequests?: boolean;
  canRejectRequests?: boolean;
}) {
  const currency = useRestaurant(s => s.restaurant?.currency || "NPR");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reviewRequests, setReviewRequests] = useState<Order[] | null>(null);
  const requestVersion = useRef(0);
  const eligible = order.channel === "table" && !!order.table_id &&
    !["completed", "canceled", "cancelled"].includes(order.status);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = await apiClient.get(OrderApis.activeOrders, {
        params: { restaurant_id: order.restaurant_id, table_id: order.table_id, limit: 5000 },
      });
      if (response.data.status !== "success") throw new Error("Could not load table bills");
      if (version === requestVersion.current) {
        setOrders((response.data.data.orders as Order[]).filter(bill =>
          bill.restaurant_id === order.restaurant_id &&
          (bill.table_id === order.table_id || bill.table_ids?.includes(order.table_id!))));
        setError(false);
      }
    } catch {
      if (version === requestVersion.current) setError(true);
    } finally {
      if (version === requestVersion.current) setLoaded(true);
    }
  }, [order.restaurant_id, order.table_id]);

  useEffect(() => {
    if (!eligible) return;
    setOrders([]);
    setError(false);
    setLoaded(false);
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10000);
    return () => { ++requestVersion.current; clearInterval(timer); };
  }, [eligible, order.id, order.restaurant_id, order.table_id, load]);

  if (!eligible) return null;
  const { visible, additions } = groupOrderApprovals(orders);
  const handleRequestResolved = async (requestId: number) => {
    setReviewRequests(current => {
      const remaining = current?.filter(request => request.id !== requestId) || [];
      return remaining.length ? remaining : null;
    });
    await load();
  };
  return (
    <>
    <section aria-label="Table bills" className="min-w-0">
      {error && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not refresh table bills.
        <Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button>
      </div>}
      {!error && !loaded && <p role="status" className="text-sm text-muted-foreground">Loading table bills…</p>}
      {!error && loaded && visible.length === 0 && <p role="status" className="text-sm text-muted-foreground">No active bills found. Refresh the order to check its status.</p>}
      <nav aria-label="Select table bill" className="flex flex-wrap items-center gap-2">
        {visible.map(bill => {
          const selected = bill.id === order.id;
          const pending = additions.get(bill.id)?.length || 0;
          return (
            <Link key={bill.id} href={`/orders/${bill.id}${checkout && bill.status !== "requested" ? "/checkout" : ""}`} scroll={false}
              aria-current={selected ? "page" : undefined}
              onClick={event => {
                const requests = bill.status === "requested" ? [bill] : additions.get(bill.id) || [];
                if (!requests.length) return;
                event.preventDefault();
                setReviewRequests(requests);
              }}
              className={cn("inline-flex min-h-9 min-w-0 max-w-full touch-manipulation items-center gap-2 rounded-full border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", selected ? "border-primary bg-primary/10 hover:bg-primary/15" : "border-border bg-card hover:bg-muted")}>
              <span aria-hidden="true" className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{bill.customer_name ? "C" : "G"}</span>
              <span className="max-w-40 truncate font-medium">{bill.customer_name || "Walk-in guest"}</span>
              <span className="shrink-0 border-l border-border/70 pl-2 text-xs font-medium tabular-nums">{formatCurrency(bill.grand_total, currency)}</span>
              {(bill.status === "requested" || pending > 0) && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{bill.status === "requested" ? "Awaiting approval" : `${pending} awaiting approval`}</span>}
            </Link>
          );
        })}
      </nav>
    </section>
    <Dialog open={Boolean(reviewRequests?.length)} onOpenChange={open => { if (!open) setReviewRequests(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review order request</DialogTitle>
          <DialogDescription>Review the requested items before accepting them or rejecting the request.</DialogDescription>
        </DialogHeader>
        {reviewRequests?.map(request => (
          <OrderRequestReview
            key={request.id}
            order={request}
            canApprove={canApproveRequests}
            canReject={canRejectRequests}
            onResolved={() => handleRequestResolved(request.id)}
            embedded
          />
        ))}
      </DialogContent>
    </Dialog>
    </>
  );
}
