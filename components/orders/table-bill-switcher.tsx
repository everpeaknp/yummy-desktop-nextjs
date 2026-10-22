"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { groupOrderApprovals } from "@/lib/order-approval-groups";
import { cn, formatCurrency } from "@/lib/utils";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types/order";

export function TableBillSwitcher({ order, checkout = false }: { order: Order; checkout?: boolean }) {
  const currency = useRestaurant(s => s.restaurant?.currency || "NPR");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const eligible = order.channel === "table" && !!order.table_id &&
    !["completed", "canceled", "cancelled"].includes(order.status);

  useEffect(() => {
    if (!eligible) return;
    let disposed = false;
    setOrders([]);
    setError(false);
    setLoaded(false);
    const load = async () => {
      try {
        const response = await apiClient.get(OrderApis.activeOrders, {
          params: { restaurant_id: order.restaurant_id, table_id: order.table_id, limit: 5000 },
        });
        if (response.data.status !== "success") throw new Error("Could not load table bills");
        if (!disposed) {
          setOrders((response.data.data.orders as Order[]).filter(bill =>
            bill.restaurant_id === order.restaurant_id &&
            (bill.table_id === order.table_id || bill.table_ids?.includes(order.table_id!))));
          setError(false);
        }
      } catch { if (!disposed) setError(true); }
      finally { if (!disposed) setLoaded(true); }
    };
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10000);
    return () => { disposed = true; clearInterval(timer); };
  }, [eligible, order.id, order.restaurant_id, order.table_id, attempt]);

  if (!eligible) return null;
  const { visible, additions } = groupOrderApprovals(orders);
  return (
    <section aria-label="Table bills" className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Table bills</h2>
        <span className="text-xs text-muted-foreground">Select a customer&apos;s bill to review it</span>
      </div>
      {error && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        Could not refresh table bills.
        <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
      </div>}
      {!error && !loaded && <p role="status" className="text-sm text-muted-foreground">Loading table bills…</p>}
      {!error && loaded && visible.length === 0 && <p role="status" className="text-sm text-muted-foreground">No active bills found. Refresh the order to check its status.</p>}
      <nav aria-label="Select table bill" className="flex flex-wrap gap-2">
        {visible.map(bill => {
          const selected = bill.id === order.id;
          const pending = additions.get(bill.id)?.length || 0;
          return (
            <Link key={bill.id} href={`/orders/${bill.id}${checkout && bill.status !== "requested" ? "/checkout" : ""}`} scroll={false}
              aria-current={selected ? "page" : undefined}
              className={cn("flex min-h-11 min-w-0 max-w-full touch-manipulation flex-col gap-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", selected ? "border-primary bg-primary/10 hover:bg-primary/15" : "border-border hover:bg-muted")}>
              <span className="truncate font-semibold">{bill.customer_name || "Walk-in guest"} · Order #{bill.restaurant_order_id || bill.id}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(bill.grand_total, currency)}{bill.status === "requested" ? " · Awaiting approval" : pending ? ` · ${pending} awaiting approval` : ""}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
