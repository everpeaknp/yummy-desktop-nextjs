"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GuestBillMergeControl } from "./guest-bill-merge-control";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";
import type { Order, OrderItem } from "@/types/order";

type Bill = { order_id: number; customer_name?: string | null; split_label?: string; total_paid: number; status: string };
type Session = { anchor_order_id: number; split_group_id?: string | null; orders: Bill[] };
const label = (bill: Bill) => `${bill.customer_name?.trim() ? `${bill.customer_name.trim()} · ` : ""}${bill.split_label || `Bill #${bill.order_id}`}`;
const reason = (error: any) => typeof error.response?.data?.detail === "string" ? error.response.data.detail : "Could not complete the action. Refresh the bills and try again.";

export function BillManagementActions({ order, session, canManage, onCreateSplit, onChanged }: {
  order: Order; session?: Session | null; canManage: boolean; onCreateSplit: () => void; onChanged: (targetId: number) => Promise<void>;
}) {
  const [tableBills, setTableBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<"merge" | "transfer" | "cancel" | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const splitGroup = !!session?.split_group_id;
  const anchorId = splitGroup ? session!.anchor_order_id : order.id;
  useEffect(() => {
    if (splitGroup || !order.table_id) return;
    let disposed = false;
    setLoading(true); setError("");
    apiClient.get(OrderApis.activeOrders, { params: { restaurant_id: order.restaurant_id, table_id: order.table_id, limit: 5000 } })
      .then(response => {
        if (response.data.status !== "success") throw new Error("Load failed");
        if (!disposed) setTableBills((response.data.data.orders as Order[]).filter(bill =>
          bill.restaurant_id === order.restaurant_id && bill.table_id === order.table_id && !bill.split_group_id && !bill.parent_order_id
        ).map(bill => ({ order_id: bill.id, customer_name: bill.customer_name, status: bill.status,
          total_paid: (bill.payments || []).filter(payment => payment.status === "success").reduce((sum, payment) => sum + Number(payment.amount), 0) })));
      }).catch(error => { if (!disposed) setError(reason(error)); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [splitGroup, order.id, order.restaurant_id, order.table_id, attempt]);
  useEffect(() => {
    setItems([]); setQuantities({});
    if (!from || action !== "transfer") return;
    let disposed = false;
    setLoading(true); setError("");
    apiClient.get(OrderApis.getOrder(Number(from))).then(response => {
      if (!disposed) setItems(response.data.data.items || []);
    }).catch(error => { if (!disposed) setError(reason(error)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [from, action]);
  if (order.channel !== "table" || ["requested", "completed", "canceled"].includes(order.status)) return null;
  const bills = splitGroup ? session!.orders : tableBills;
  const eligible = bills.filter(bill => Number(bill.total_paid) === 0 && !["requested", "completed", "canceled", "cancelled"].includes(bill.status));
  const canCombine = canManage && eligible.length >= 2;
  const canCancel = canManage && splitGroup && bills.every(bill => Number(bill.total_paid) === 0);
  const selectedHasPayment = (order.payments || []).some(payment => payment.status === "success" && Number(payment.amount) > 0);
  const lines = items.map(item => ({ order_item_id: item.id, qty: Number(quantities[item.id] || 0) })).filter(line => line.qty > 0);
  const validLines = lines.length > 0 && lines.every(line => Number.isInteger(line.qty) && line.qty <= Number(items.find(item => item.id === line.order_item_id)?.qty || 0));
  const submit = async () => {
    if (!canManage || inFlight.current || (action === "transfer" && (!validLines || !from || !to || from === to))) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (action === "cancel") await apiClient.post(OrderApis.cancelGuestBillSplit(anchorId));
      else await apiClient.post(OrderApis.transferGuestBillItem(anchorId), { from_order_id: Number(from), to_order_id: Number(to), lines });
      setAction(null); setAttempt(value => value + 1);
      await onChanged(action === "cancel" ? anchorId : order.id);
    } catch (error) { setError(reason(error)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section id="bill-actions" aria-label="Bill actions" className="space-y-3 rounded-xl border bg-card p-4 scroll-mt-24">
    <h2 className="font-semibold">Bill actions</h2>
    <p className="text-xs text-muted-foreground">Move or combine accepted items without sending another kitchen ticket. Destination customer stays unchanged.</p>
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={!canManage || selectedHasPayment} onClick={onCreateSplit}>Create split</Button>
      <Button variant="outline" disabled={!canCombine} onClick={() => { setError(""); setFrom(""); setTo(""); setAction("transfer"); }}>Transfer items</Button>
      <Button variant="outline" disabled={!canCombine} onClick={() => { setError(""); setAction("merge"); }}>Merge bills</Button>
      <Button variant="outline" disabled={!canCancel} onClick={() => { setError(""); setAction("cancel"); }}>Cancel split</Button>
    </div>
    {!canCombine && <p className="text-xs text-muted-foreground">Transfer and merge require at least two unpaid, accepted bills.</p>}
    {!canCancel && <p className="text-xs text-muted-foreground">Cancel split requires an existing split with no recorded payments.</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading bills…</p>}
    {error && !action && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry</Button></div>}
    <Dialog open={!!action} onOpenChange={open => { if (!open && !busy) setAction(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <DialogHeader><DialogTitle>{action === "merge" ? "Merge bills" : action === "transfer" ? "Transfer items" : "Cancel split"}</DialogTitle>
          <DialogDescription>Original customer details are preserved in the audit history. Paid bills and bills with an open payment checkout cannot be reorganized.</DialogDescription></DialogHeader>
        {action === "merge" && <GuestBillMergeControl anchorId={anchorId} bills={bills} splitGroup={splitGroup} onBusyChange={setBusy} onMerged={async targetId => { setAction(null); setAttempt(value => value + 1); await onChanged(targetId); }} />}
        {action === "transfer" && <div className="space-y-3">
          <label className="block text-sm">Source bill<OptionSelect aria-label="Source bill" value={from} disabled={busy} onValueChange={event => { setFrom(event); setTo(""); }} className="mt-1 min-h-11 w-full"><option value="">Select source</option>{eligible.map(bill => <option key={bill.order_id} value={bill.order_id}>{label(bill)}</option>)}</OptionSelect></label>
          <label className="block text-sm">Destination bill<OptionSelect aria-label="Destination bill" value={to} disabled={busy} onValueChange={event => setTo(event)} className="mt-1 min-h-11 w-full"><option value="">Select destination</option>{eligible.filter(bill => String(bill.order_id) !== from).map(bill => <option key={bill.order_id} value={bill.order_id}>{label(bill)}</option>)}</OptionSelect></label>
          {items.map(item => <label key={item.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm"><span className="min-w-0 break-words">{item.name_snapshot} · available {item.qty}</span><input type="number" min={0} max={item.qty} step={1} value={quantities[item.id] || ""} disabled={busy} onChange={event => setQuantities(values => ({ ...values, [item.id]: event.target.value }))} className="min-h-11 w-20 shrink-0 rounded-lg border bg-background px-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring" /></label>)}
          <p className="text-sm text-muted-foreground">The destination retains its customer, including when unassigned. The source bill retains its customer.</p>
          <Button disabled={busy || loading || !from || !to || !validLines} onClick={() => void submit()}>{busy ? "Transferring…" : "Confirm transfer"}</Button>
        </div>}
        {action === "cancel" && <div className="space-y-3"><p className="text-sm">Combine all split bills back into the original bill? Its customer remains unchanged. Child bills are archived with their original customer associations.</p><Button disabled={busy || !canCancel} onClick={() => void submit()}>{busy ? "Canceling…" : "Confirm cancel split"}</Button></div>}
        {error && action && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  </section>;
}
