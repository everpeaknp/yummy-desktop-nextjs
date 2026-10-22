"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api-client";
import { OrderApis } from "@/lib/api/endpoints";

type Bill = { order_id: number; split_label?: string; customer_name?: string | null; total_paid: number; status: string };
export function GuestBillMergeControl({ anchorId, bills, onMerged, splitGroup = true, onBusyChange }: { anchorId: number; bills: Bill[]; onMerged: (targetId: number) => Promise<void>; splitGroup?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const eligible = bills.filter(b => Number(b.total_paid) === 0 && !["requested", "completed", "canceled", "cancelled"].includes(b.status));
  const sources = eligible.filter(b => !splitGroup || b.order_id !== anchorId);
  const source = sources.find(b => String(b.order_id) === from);
  const target = eligible.find(b => String(b.order_id) === to && String(b.order_id) !== from);
  const label = (bill: Bill) => `${bill.customer_name?.trim() ? `${bill.customer_name.trim()} · ` : ""}${bill.split_label || `Bill #${bill.order_id}`}`;
  const merge = async () => {
    if (!source || !target || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    onBusyChange?.(true);
    try {
      await apiClient.post(OrderApis.mergeGuestBills(anchorId), { from_order_id: source.order_id, to_order_id: target.order_id });
      setConfirm(false); setFrom(""); setTo(""); await onMerged(target.order_id);
    } catch (e: any) { setError(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Could not confirm the merge. Refresh the bills before trying again."); }
    finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  };
  if (eligible.length < 2 || !sources.length) return null;
  return <section className="space-y-3 rounded-xl border border-border bg-card p-3" aria-label="Merge guest bills">
    <h3 className="text-sm font-semibold">Merge unpaid guest bills</h3>
    <p className="text-xs leading-5 text-muted-foreground">Confirm with the guests before combining their bills. Paid bills cannot be merged.</p>
    <p className="text-xs leading-5 text-muted-foreground">The destination bill keeps its customer. Original customer details remain in the audit history.</p>
    <label className="block text-sm">Move this bill<OptionSelect aria-label="Move this bill" className="mt-1 min-h-11 w-full" value={from} disabled={busy} onValueChange={e => { setFrom(e); setTo(""); setConfirm(false); }}><option value="">Choose source bill</option>{sources.map(b => <option key={b.order_id} value={b.order_id}>{label(b)}</option>)}</OptionSelect></label>
    <label className="block text-sm">Into this bill<OptionSelect aria-label="Into this bill" className="mt-1 min-h-11 w-full" value={to} disabled={busy} onValueChange={e => { setTo(e); setConfirm(false); }}><option value="">Choose destination bill</option>{eligible.filter(b => String(b.order_id) !== from).map(b => <option key={b.order_id} value={b.order_id}>{label(b)}</option>)}</OptionSelect></label>
    {confirm && source && target && <p className="text-sm">Combine {label(source)} into {label(target)}? Billing customer: {target.customer_name?.trim() || "Unassigned (destination has no customer)"}. The source bill will be archived.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !source || !target} onClick={() => confirm ? void merge() : setConfirm(true)}>{busy ? "Merging…" : confirm ? "Confirm merge" : "Merge bills"}</Button>{confirm && <Button disabled={busy} variant="outline" onClick={() => setConfirm(false)}>Back</Button>}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
