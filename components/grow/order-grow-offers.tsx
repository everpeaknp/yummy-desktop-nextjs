"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import type { GrowthProgram } from "@/lib/api/growth-programs";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { Button } from "@/components/ui/button";

export function OrderGrowOffers({ orderId, customerId, refreshKey, onClaimed }: { orderId: number; customerId?: number | null; refreshKey?: string; onClaimed: () => Promise<void> }) {
  const [offers, setOffers] = useState<GrowthProgram[]>([]);
  const [claimed, setClaimed] = useState<{ program: GrowthProgram; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    Promise.all([
      apiClient.get(`/growth/programs/orders/${orderId}/eligible`),
      apiClient.get(`/growth/programs/orders/${orderId}/claimed`),
    ])
      .then(([eligible, active]) => { if (current) { setOffers(eligible.data.data || []); setClaimed(active.data.data || null); } })
      .catch((cause) => { if (current) setError(getApiErrorMessage(cause, "Eligible offers could not be loaded.")); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [orderId, customerId, refreshKey]);

  async function claim(offer: GrowthProgram) {
    setBusy(true); setError("");
    try {
      await apiClient.post(`/growth/programs/${offer.id}/claim`, { order_id: orderId });
      setOffers([]);
      setClaimed({ program: offer, status: "reserved" });
      await onClaimed();
    } catch (cause) { setError(getApiErrorMessage(cause, "This reward could not be claimed.")); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (claimed?.program.reward_kind === "free_item" && !window.confirm("Remove this free item from the order? The kitchen will be notified.")) return;
    setBusy(true); setError("");
    try {
      await apiClient.delete(`/growth/programs/orders/${orderId}/claimed`);
      setClaimed(null);
      const response = await apiClient.get(`/growth/programs/orders/${orderId}/eligible`);
      setOffers(response.data.data || []);
      await onClaimed();
    } catch (cause) { setError(getApiErrorMessage(cause, "This reward could not be removed.")); }
    finally { setBusy(false); }
  }

  if (loading || (!offers.length && !claimed && !error)) return null;
  return <section aria-label="Order rewards" className="space-y-2 rounded-xl border border-border/50 bg-card p-4">
    <h3 className="text-sm font-semibold">{offers.length ? `${offers.length} ${offers.length === 1 ? "reward" : "rewards"} ready` : "Reward on this order"}</h3>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {claimed && <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{claimed.program.name}</p><p className="text-xs text-muted-foreground">Added to this order</p></div>{claimed.status === "reserved" && <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => void remove()}>Remove</Button>}</div>}
    {offers.map((offer) => <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{offer.name}</p><p className="text-xs text-muted-foreground">{offer.reward_kind === "free_item" ? `${offer.reward_quantity} × ${offer.reward_item_name || "menu item"} free` : offer.reward_kind === "fixed" ? `Rs. ${offer.reward_value} off` : `${offer.reward_value}% off, up to Rs. ${offer.percentage_cap}`}</p></div><Button type="button" size="sm" className="min-h-11" disabled={busy} onClick={() => void claim(offer)}>{offer.reward_kind === "free_item" ? "Claim free item" : "Claim reward"}</Button></div>)}
  </section>;
}
