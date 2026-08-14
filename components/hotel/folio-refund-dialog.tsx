"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import apiClient from "@/lib/api-client";
import { AccountingApis, DrawerSessionApis } from "@/lib/api/endpoints";
import { resolveCheckoutCashDrawerReadiness } from "@/lib/checkout-cash-drawer-readiness";
import { hotelPmsApi } from "@/lib/hotel/api";
import type { HotelFolio, HotelPaymentMethod } from "@/lib/hotel/types";
import type { PaymentInstrument } from "@/types/accounting";
import type { DrawerSession } from "@/types/day-close";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentMethodGrid, STANDARD_PAYMENT_METHODS, type PaymentMethodOption } from "@/components/payments/payment-composer-controls";
import { hotelCurrency } from "./hotel-ui";

const METHODS = STANDARD_PAYMENT_METHODS
  .filter((method) => method.value !== "credit")
  .map((method) => ({ ...method, value: method.value as HotelPaymentMethod })) satisfies PaymentMethodOption<HotelPaymentMethod>[];
const DRAWER_HREF = "/cash-drawers?business_line=hotel&return_to=%2Fhotel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: number;
  folio: HotelFolio;
  amount: number;
  onRecorded: (folio: HotelFolio) => Promise<void> | void;
};

export function FolioRefundDialog({ open, onOpenChange, restaurantId, folio, amount, onRecorded }: Props) {
  const [method, setMethod] = useState<HotelPaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("Unused room nights after early checkout");
  const [instruments, setInstruments] = useState<PaymentInstrument[]>([]);
  const [instrumentId, setInstrumentId] = useState("");
  const [sessions, setSessions] = useState<DrawerSession[]>([]);
  const [drawerSessionId, setDrawerSessionId] = useState("");
  const [drawerControlsEnabled, setDrawerControlsEnabled] = useState(false);
  const [drawerReady, setDrawerReady] = useState(true);
  const [drawerMessage, setDrawerMessage] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const availableInstruments = useMemo(() => instruments.filter((item) => item.payment_method.toLowerCase() === method), [instruments, method]);
  const loadDrawer = useCallback(async () => {
    setDrawerLoading(true);
    try {
      const response = await apiClient.get<{ data: DrawerSession[]; message?: string }>(DrawerSessionApis.active({ restaurantId, businessLine: "hotel" }));
      const readiness = resolveCheckoutCashDrawerReadiness(response.data, { businessLine: "hotel" });
      const readySessions = readiness.paymentReadySessions;
      setDrawerControlsEnabled(readiness.controlsEnabled);
      setSessions(readySessions);
      const selected = readySessions.length === 1 ? String(readySessions[0].id) : "";
      setDrawerSessionId(selected);
      setDrawerReady(!readiness.controlsEnabled || readySessions.length === 1);
      setDrawerMessage(readiness.controlsEnabled ? readySessions.length > 1 ? "Select the hotel drawer paying this cash refund." : readiness.message || "Cash will be removed from the active hotel drawer." : "Drawer controls are disabled; the refund will be reconciled at day close.");
    } catch {
      setDrawerReady(false);
      setDrawerMessage("Unable to verify the hotel cash drawer.");
    } finally {
      setDrawerLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) return;
    setMethod("cash"); setReference(""); setReason("Unused room nights after early checkout"); setInstrumentId(""); setError("");
    void loadDrawer();
    void apiClient.get<{ data: PaymentInstrument[] }>(AccountingApis.paymentInstruments({ restaurantId, businessLine: "hotel", activeOnly: true }))
      .then((response) => setInstruments(response.data.data ?? [])).catch(() => setInstruments([]));
  }, [loadDrawer, open, restaurantId]);

  const submit = async () => {
    if (reason.trim().length < 3) return setError("Enter a reason for the refund.");
    if (availableInstruments.length > 0 && !instrumentId) return setError("Select the refund instrument.");
    if (method === "cash" && drawerControlsEnabled && !drawerSessionId) return setError("Select or open the hotel cash drawer paying this refund.");
    setSubmitting(true); setError("");
    try {
      const instrument = instruments.find((item) => String(item.id) === instrumentId) ?? null;
      const updated = await hotelPmsApi.addFolioRefund(folio.id, {
        method,
        amount,
        reference: reference.trim() || null,
        reason: reason.trim(),
        instrument: instrument ? { type: instrument.instrument_type, name: instrument.name, meta: instrument.metadata_json } : null,
        drawer_session_id: method === "cash" && drawerSessionId ? Number(drawerSessionId) : null,
        idempotency_key: `web-hotel-refund:${folio.id}:${crypto.randomUUID()}`,
      });
      await onRecorded(updated);
      onOpenChange(false);
    } catch (caught: any) {
      setError(caught?.response?.data?.detail || caught?.response?.data?.message || "Unable to record the refund.");
    } finally {
      setSubmitting(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Refund guest and continue</DialogTitle><DialogDescription>The guest paid for room nights that are no longer chargeable. Record how the money is returned before checkout.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Refund amount</p><p className="text-2xl font-bold">{hotelCurrency(amount, folio.currency)}</p></div>
        <div className="space-y-2"><Label>Refund method</Label><PaymentMethodGrid methods={METHODS} value={method} onChange={(value) => { setMethod(value); setInstrumentId(""); setError(""); }} /></div>
        {availableInstruments.length ? <div className="space-y-2"><Label>Refund instrument</Label><Select value={instrumentId} onValueChange={setInstrumentId}><SelectTrigger><SelectValue placeholder="Select instrument" /></SelectTrigger><SelectContent>{availableInstruments.map((instrument) => <SelectItem key={instrument.id} value={String(instrument.id)}>{instrument.name}</SelectItem>)}</SelectContent></Select></div> : null}
        <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Refund reference (optional)" maxLength={160} />
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Refund reason" maxLength={255} />
        {method === "cash" ? <Alert variant={drawerReady ? "default" : "destructive"}>{drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : drawerReady ? <CheckCircle2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}<AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{drawerLoading ? "Checking hotel cash drawer..." : drawerMessage}</span>{sessions.length > 1 ? <Select value={drawerSessionId} onValueChange={(value) => { setDrawerSessionId(value); setDrawerReady(Boolean(value)); }}><SelectTrigger className="min-w-56 bg-background"><SelectValue placeholder="Select hotel drawer" /></SelectTrigger><SelectContent>{sessions.map((session) => <SelectItem key={session.id} value={String(session.id)}>{session.station} · {session.drawer_key}</SelectItem>)}</SelectContent></Select> : null}<span className="flex items-center gap-2">{!drawerLoading && !drawerReady ? <Button asChild size="sm" variant="outline"><Link href={DRAWER_HREF}>Open hotel drawer</Link></Button> : null}<Button variant="ghost" size="sm" onClick={() => void loadDrawer()}><RefreshCw className="h-3.5 w-3.5" /></Button></span></AlertDescription></Alert> : null}
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button><Button onClick={() => void submit()} disabled={submitting || (method === "cash" && (drawerLoading || !drawerReady))}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Record refund and continue</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
