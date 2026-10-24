"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import { formatCurrency } from "@/lib/utils";

export function OrderRequestReview({ order, canApprove, canReject, onResolved, embedded = false }: {
  order: { id: number; approval_target_order_id?: number | null; restaurant_order_id?: number | null; table_name?: string | null; customer_name?: string | null; grand_total?: number; items?: { id?: number; name_snapshot?: string; item_name?: string; qty?: number; quantity?: number; notes?: string | null }[] };
  canApprove: boolean; canReject: boolean; onResolved: () => Promise<void>;
  embedded?: boolean;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [resolved, setResolved] = useState(false);
  const submit = async () => {
    if (!decision || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      // Re-read before acting: another staff client may have handled this request.
      const response = await apiClient.get(OrderApis.getOrder(order.id));
      const current = response.data.data;
      if (current.status !== "requested") {
        setError("This request has already changed. The order list has been refreshed.");
        setResolved(true); setDecision(null); await onResolved(); return;
      }
      if (decision === "approve") {
        const accepted = await apiClient.patch(OrderApis.updateOrderStatus(order.id), { status: "pending" });
        const acceptedOrderId = accepted.data?.data?.id || order.id;
        try {
          const response = await apiClient.get(`/kots/orders/${acceptedOrderId}`);
          for (const kot of response.data?.data || []) {
            if (kot.print_event_id && kot.should_auto_print && !kot.auto_printed_at) {
              window.dispatchEvent(new CustomEvent("yummy:kot-print", { detail: kot }));
            }
          }
        } catch (printError) {
          console.error("Could not load accepted order KOTs for printing", printError);
        }
      } else await apiClient.post(OrderApis.cancelOrder(order.id), { reason: "Customer food request rejected by staff" });
      setResolved(true); setDecision(null); await onResolved();
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not confirm the decision. Refresh the request before trying again.");
    } finally { inFlight.current = false; setBusy(false); }
  };
  return <article className={embedded ? "border-t border-border py-4" : "rounded-xl border border-orange-200 bg-card p-4 dark:border-orange-900"} aria-label={embedded ? "Pending item addition" : `Food request ${order.restaurant_order_id || order.id}`}>
    {!embedded && <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">Table {order.table_name || "—"}</h3><p className="mt-1 text-sm text-muted-foreground">{order.customer_name || "Customer"}</p></div><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">Awaiting approval</span></div>}
    {!embedded && <p className="mt-3 text-xs text-muted-foreground">Food request. No KOT is sent until accepted.</p>}
    <ul className="my-3 divide-y divide-border">{(order.items || []).map((item, index) => <li key={item.id || index} className="py-2 text-sm"><div className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.name_snapshot || item.item_name || "Item"}</span><span className="shrink-0 tabular-nums">×{item.qty ?? item.quantity ?? 0}</span></div>{item.notes && <p className="mt-1 break-words text-xs text-muted-foreground">{item.notes}</p>}</li>)}</ul>
    <div className="flex items-center justify-between gap-2 border-t pt-3"><span className="font-semibold tabular-nums">{embedded && <span className="mr-2 text-xs font-normal text-muted-foreground">Pending amount</span>}{formatCurrency(order.grand_total || 0)}</span>{!embedded && <Link href={`/orders/${order.approval_target_order_id || order.id}`} className="rounded px-2 py-3 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{order.approval_target_order_id ? "View order" : "View request"}</Link>}</div>
    {!resolved && <div className="mt-3 flex flex-wrap gap-2">{decision ? <><p className="w-full text-sm">{decision === "approve" ? "Accept these items and send them to the kitchen?" : "Reject only this food request? Earlier accepted items stay unchanged."}</p><Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : decision === "approve" ? "Confirm acceptance" : "Confirm rejection"}</Button><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Back</Button></> : <>{canReject && <Button variant="outline" onClick={() => setDecision("reject")}>Reject</Button>}{canApprove && <Button onClick={() => setDecision("approve")}>Accept request</Button>}</>}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {resolved && !error && <p role="status" className="mt-3 text-sm text-muted-foreground">Request handled.</p>}
  </article>;
}
