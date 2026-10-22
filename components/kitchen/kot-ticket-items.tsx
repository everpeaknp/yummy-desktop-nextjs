"use client";

import { useState } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { KotApis } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { KotTicketItemList, type KitchenTicket, type KitchenTicketItem } from "./kot-ticket-card";

export function KotTicketItems({ ticket, canOperate, onUpdated }: {
  ticket: KitchenTicket;
  canOperate: boolean;
  onUpdated: (updated: KitchenTicket) => void | Promise<void>;
}) {
  const [busyItemId, setBusyItemId] = useState<KitchenTicketItem["id"] | null>(null);
  const [rejectItemId, setRejectItemId] = useState<KitchenTicketItem["id"] | null>(null);
  const [reason, setReason] = useState("");

  async function updateItem(itemId: KitchenTicketItem["id"], action: "accept" | "reject" | "ready" | "served") {
    if (typeof itemId !== "number") return;
    setBusyItemId(itemId);
    try {
      const response = action === "accept"
        ? await apiClient.post(KotApis.acceptKotItem(ticket.id, itemId))
        : action === "reject"
          ? await apiClient.post(KotApis.rejectKotItem(ticket.id, itemId), undefined, { params: { reason: reason.trim() } })
          : await apiClient.post(KotApis.markKotItemAll(ticket.id, itemId), { target: action.toUpperCase() });
      if (response.data?.status !== "success" || !response.data?.data) throw new Error("Ticket update did not return a ticket.");
      await onUpdated(response.data.data);
      toast.success(action === "accept" ? "Item accepted" : action === "reject" ? "Item rejected" : action === "ready" ? "Item marked ready" : "Item marked served");
      setRejectItemId(null);
      setReason("");
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message;
      toast.error(typeof detail === "string" ? detail : "Could not update item");
    } finally {
      setBusyItemId(null);
    }
  }

  function itemActions(item: KitchenTicketItem) {
    const quantity = Math.abs(Number(item.qty_change || 0));
    if (!canOperate || ticket.status === "SERVED" || ticket.status === "REJECTED" || item.is_deleted || Number(item.qty_change) <= 0 || typeof item.id !== "number") return null;
    const busy = busyItemId !== null;
    const status = String(item.item_status || (Number(item.qty_ready || 0) > 0 || Number(item.qty_served || 0) > 0 ? "PREPARING" : "PENDING")).toUpperCase();
    if (status === "PENDING") return <>
      <Button type="button" size="sm" variant="outline" className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => setRejectItemId(item.id)}>Reject item</Button>
      <Button type="button" size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => void updateItem(item.id, "accept")}>Accept</Button>
    </>;
    if (status === "REJECTED" || Number(item.qty_served || 0) >= quantity) return null;
    const ready = quantity > 0 && Number(item.qty_ready || 0) >= quantity;
    return <Button type="button" size="sm" className="h-9" disabled={busy} onClick={() => void updateItem(item.id, ready ? "served" : "ready")}>{ready ? "Mark served" : "Mark ready"}</Button>;
  }

  return <>
    <KotTicketItemList items={ticket.items || []} showProgress renderAction={itemActions} />
    <Dialog open={rejectItemId !== null} onOpenChange={(open) => { if (!open) { setRejectItemId(null); setReason(""); } }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] rounded-2xl border-border bg-card sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Reject item</DialogTitle><DialogDescription>Give a reason for the ticket activity log.</DialogDescription></DialogHeader>
        <label className="space-y-2 text-sm font-medium">Reason<Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Write a short reason…" className="min-h-28" /></label>
        <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setRejectItemId(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={!reason.trim() || busyItemId !== null} onClick={() => { if (rejectItemId !== null) void updateItem(rejectItemId, "reject"); }}>Reject item</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
